<?php
/**
 * Ta Cukrárna - Admin Registration Flow
 *
 * One-time registration flow for the opening-days admin. Sends a magic link
 * that grants access to the WebAuthn registration ceremony.
 *
 * Actions:
 *   POST ?action=request-token   - send a registration link (email)
 *   GET  ?action=validate-token  - validate a token and start the session flow
 *   POST ?action=verify-password - verify the mailbox password over IMAP
 *   POST ?action=reset           - clear registration session state
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';

// Set header for JSON response
header('Content-Type: application/json; charset=utf-8');

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$action = isset($_GET['action']) ? trim($_GET['action']) : '';

switch ($action) {

    case 'request-token':
        handleRequestToken();
        break;

    case 'validate-token':
        handleValidateToken();
        break;

    case 'verify-password':
        handleVerifyPassword();
        break;

    case 'reset':
        handleReset();
        break;

    default:
        jsonResponse(['error' => 'Unknown action.'], 400);
}

/**
 * Sends a one-time registration link to the given mailbox.
 * Never reveals whether the account exists.
 *
 * @return void
 */
function handleRequestToken(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => 'Method Not Allowed. Only POST requests are permitted.'], 405);
    }

    // Rate limit: max 3 requests per hour per IP
    $ip = getClientIp();
    $tmp_dir = sys_get_temp_dir();
    $limit_file = $tmp_dir . DIRECTORY_SEPARATOR . 'tacukrarna_reqtoken_' . md5($ip) . '.json';

    $now = time();
    $timestamps = [];
    if (file_exists($limit_file)) {
        $data = json_decode(file_get_contents($limit_file), true);
        if (is_array($data)) {
            foreach ($data as $ts) {
                if ($now - $ts < 3600) {
                    $timestamps[] = $ts;
                }
            }
        }
    }

    if (count($timestamps) >= 3) {
        jsonResponse(['error' => 'Příliš mnoho požadavků. Zkuste to prosím později. / Too many requests. Please try again later.'], 429);
    }
    $timestamps[] = $now;
    file_put_contents($limit_file, json_encode($timestamps));

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    $username = ($data && isset($data['username'])) ? trim($data['username']) : '';

    if (empty($username) || !filter_var($username, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Zadejte prosím platnou e-mailovou adresu. / Please enter a valid email address.'], 400);
    }

    // Password-less verification of whether the account exists (this is fine: the
    // difference in behaviour leaks nothing since we respond identically either way).
    $exists = false;
    try {
        $mailDb = getMailDb();
        $table = getenv('MAILDB_TABLE') ?: 'admin';
        $stmt = $mailDb->prepare("SELECT username FROM `{$table}` WHERE username = ? AND active = 1");
        $stmt->execute([$username]);
        $exists = (bool) $stmt->fetch();
    } catch (PDOException $e) {
        // Behave as if the account may exist; never reveal DB errors.
    }

    // Regardless of existence, generate a token so behaviour is identical
    $token = bin2hex(random_bytes(32));

    $pdo = getSqliteDb();
    $stmt = $pdo->prepare(
        'INSERT INTO reg_tokens (token, username, expires_at) VALUES (?, ?, datetime(\'now\', \'+1 hour\'))'
    );
    $stmt->execute([$token, $username]);

    if ($exists) {
        $link = 'https://tacukrarna.cz/admin/register/?token=' . $token;

        $subject = 'Registrace správce otevírací doby - Ta Cukrárna';
        $message = "Dobrý den,\n\n"
            . "klikněte na následující odkaz pro registraci správce otevírací doby. "
            . "Odkaz vyprší za 1 hodinu.\n\n"
            . $link . "\n\n"
            . "Pokud jste o tuto registraci nepožádali, tento e-mail ignorujte.\n\n"
            . "Tým Ta Cukrárna\n"
            . "https://tacukrarna.cz";

        $headers = [];
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-type: text/plain; charset=utf-8';
        $headers[] = 'From: ' . (getenv('SMTP_FROM') ?: 'Ta Cukrárna <info@tacukrarna.cz>');

        if (function_exists('mb_send_mail')) {
            mb_internal_encoding('UTF-8');
            @mb_send_mail($username, $subject, $message, implode("\r\n", $headers));
        }
    }

    // Generic response regardless of whether the account exists
    jsonResponse([
        'status' => 'success',
        'message' => 'Pokud účet existuje, obdržíte e-mail s odkazem. / If the account exists, you will receive an email with a link.'
    ]);
}

/**
 * Validates a registration token and stores the username in the session.
 *
 * @return void
 */
function handleValidateToken(): void
{
    startSession();

    $token = isset($_GET['token']) ? trim($_GET['token']) : '';

    if (empty($token)) {
        jsonResponse(['error' => 'Token neplatný nebo vypršel. / Token invalid or expired.'], 400);
    }

    $pdo = getSqliteDb();
    $stmt = $pdo->prepare(
        "SELECT * FROM reg_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonResponse(['error' => 'Token neplatný nebo vypršel. / Token invalid or expired.'], 400);
    }

    $_SESSION['reg_username'] = $row['username'];
    $_SESSION['reg_token_id'] = $row['id'];

    jsonResponse(['valid' => true, 'username' => $row['username']]);
}

/**
 * Verifies the mailbox password over IMAP and completes registration.
 *
 * @return void
 */
function handleVerifyPassword(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => 'Method Not Allowed. Only POST requests are permitted.'], 405);
    }

    startSession();

    if (empty($_SESSION['reg_username'])) {
        jsonResponse(['error' => 'Registrace nebyla zahájena. / Registration has not been started.'], 403);
    }

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    $password = ($data && isset($data['password'])) ? (string) $data['password'] : '';

    if ($password === '') {
        jsonResponse(['error' => 'Zadejte prosím heslo. / Please enter a password.'], 400);
    }

    // Verify the mailbox password over IMAP (localhost, no cert validation)
    if (!function_exists('imap_open')) {
        jsonResponse(['error' => 'Ověření hesla není momentálně dostupné. / Password verification is currently unavailable.'], 500);
    }

    $host = getenv('MAILDB_HOST') ?: '127.0.0.1';
    $mailbox = '{' . $host . ':143/imap/novalidate-cert}';

    $imap = @imap_open($mailbox, $_SESSION['reg_username'], $password);

    if ($imap === false) {
        jsonResponse(['error' => 'Nesprávné heslo. / Incorrect password.'], 401);
    }

    imap_close($imap);

    // Mark the token as used
    if (!empty($_SESSION['reg_token_id'])) {
        $pdo = getSqliteDb();
        $stmt = $pdo->prepare('UPDATE reg_tokens SET used = 1 WHERE id = ?');
        $stmt->execute([$_SESSION['reg_token_id']]);
    }

    $_SESSION['reg_verified'] = true;

    jsonResponse(['verified' => true]);
}

/**
 * Clears all registration session state.
 *
 * @return void
 */
function handleReset(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => 'Method Not Allowed. Only POST requests are permitted.'], 405);
    }

    startSession();

    unset(
        $_SESSION['reg_username'],
        $_SESSION['reg_token_id'],
        $_SESSION['reg_verified'],
        $_SESSION['reg_challenge'],
        $_SESSION['reg_challenge_time'],
        $_SESSION['reg_user_id']
    );

    jsonResponse(['status' => 'success']);
}
