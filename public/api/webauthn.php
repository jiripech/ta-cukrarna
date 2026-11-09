<?php
/**
 * Ta Cukrárna - WebAuthn Admin Ceremonies
 *
 * Single entry point for WebAuthn registration and authentication ceremonies.
 * Handles challenge generation and response verification using the
 * lbuchs/WebAuthn library and the SQLite passkeys store.
 *
 * Actions (all POST):
 *   ?action=challenge_register    - generate a registration challenge
 *   ?action=verify_register       - verify a registration response and store the passkey
 *   ?action=challenge_login       - generate an authentication challenge
 *   ?action=verify_login          - verify an authentication response and open a session
 *   ?action=list_credentials      - list all passkeys for the authenticated admin (admin session + CSRF)
 *   ?action=revoke_credential     - revoke a passkey (admin session + CSRF)
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/vendor/autoload.php';

use lbuchs\WebAuthn\WebAuthn;
use lbuchs\WebAuthn\WebAuthnException;
use lbuchs\WebAuthn\Binary\ByteBuffer;

// Set header for JSON response
header('Content-Type: application/json; charset=utf-8');

// Allow same-origin requests
$allowed_origins = [
    'https://tacukrarna.cz',
    'https://www.tacukrarna.cz',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080'
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Headers: Content-Type, X-CSRF-Token");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
}

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method Not Allowed. Only POST requests are permitted.'], 405);
}

// Force base64url encoding for binary data in JSON objects
ByteBuffer::$useBase64UrlEncoding = true;

/**
 * Creates a WebAuthn instance with the relying party configuration.
 *
 * The RP ID defaults to the production domain; WEBAUTHN_RP_ID may override
 * it (e.g. "localhost" in the Docker test container so REAL browser
 * ceremonies work on http://localhost - lbuchs _checkOrigin allows http for
 * rpId localhost). Never set WEBAUTHN_RP_ID on the VPS.
 *
 * @return WebAuthn
 */
function createWebAuthn(): WebAuthn
{
    // loadEnv() must precede getenv(): WEBAUTHN_RP_ID normally lives in the
    // .env file (one level above the docroot), and unlike getMailDb() this
    // code path never loads it otherwise - the value would silently fall
    // back to the production RP ID (same trap as ADMIN_USERS).
    loadEnv();

    $rpId = getenv('WEBAUTHN_RP_ID') ?: 'tacukrarna.cz';

    return new WebAuthn('Ta Cukrárna', $rpId, null, true);
}

$action = isset($_GET['action']) ? trim($_GET['action']) : '';

try {
    switch ($action) {
        case 'challenge_register':
            handleChallengeRegister();
            break;

        case 'verify_register':
            handleVerifyRegister();
            break;

        case 'challenge_login':
            handleChallengeLogin();
            break;

        case 'verify_login':
            handleVerifyLogin();
            break;

        case 'list_credentials':
            handleListCredentials();
            break;

        case 'revoke_credential':
            handleRevokeCredential();
            break;

        default:
            jsonResponse(['error' => 'Unknown action.'], 400);
    }
} catch (WebAuthnException $e) {
    jsonResponse(['error' => 'Autentizace selhala. Zkuste to prosím znovu. / Authentication failed. Please try again.'], 400);
} catch (PDOException $e) {
    jsonResponse(['error' => 'Došlo k chybě serveru. Zkuste to prosím znovu. / A server error occurred. Please try again.'], 500);
}

/**
 * Generates a registration challenge during the register.php flow.
 * Requires a registration token already stored in the session (no admin session).
 *
 * @return void
 */
function handleChallengeRegister(): void
{
    startSession();

    // Registration flow must be initiated by register.php (validated token)
    // AND the mailbox password must have been proven (verify-password sets
    // reg_verified; the ADMIN_USERS test flow is pre-verified by
    // validate-token). Without this check a valid token alone was enough to
    // register a passkey, skipping the password proof entirely.
    if (empty($_SESSION['reg_username']) || empty($_SESSION['reg_verified'])) {
        jsonResponse(['error' => 'Registrace nebyla zahájena. / Registration has not been started.'], 403);
    }

    // Prevent re-challenging within a single registration
    if (!empty($_SESSION['reg_challenge_time'])) {
        jsonResponse(['error' => 'Výzva byla již vygenerována. / A challenge has already been generated.'], 400);
    }

    $username = $_SESSION['reg_username'];

    $webauthn = createWebAuthn();

    // Generate our own user identifier (independent of the email)
    $userId = bin2hex(random_bytes(16));

    // Resident key (passkey) and user verification required
    $excludeIds = loadCredentialIds($username);
    $createArgs = $webauthn->getCreateArgs($userId, $username, $username, 120, true, true, null, $excludeIds);

    $_SESSION['reg_challenge'] = $webauthn->getChallenge()->getBinaryString();
    $_SESSION['reg_challenge_time'] = time();
    $_SESSION['reg_user_id'] = $userId;

    jsonResponse(['createArgs' => $createArgs]);
}

/**
 * Verifies a registration response and stores the new passkey.
 *
 * @return void
 */
function handleVerifyRegister(): void
{
    startSession();

    // Same gate as challenge_register: the password proof is mandatory
    // (defense in depth — the challenge step alone is not trusted).
    if (empty($_SESSION['reg_username']) || empty($_SESSION['reg_challenge']) || empty($_SESSION['reg_verified'])) {
        jsonResponse(['error' => 'Registrace nebyla zahájena. / Registration has not been started.'], 403);
    }

    // Challenge expires after 120 seconds
    if (time() - $_SESSION['reg_challenge_time'] > 120) {
        jsonResponse(['error' => 'Výzva vypršela. Zkuste to prosím znovu. / The challenge has expired. Please try again.'], 400);
    }

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data || empty($data['clientDataJSON']) || empty($data['attestationObject'])) {
        jsonResponse(['error' => 'Neplatná data. / Invalid data.'], 400);
    }

    $username = $_SESSION['reg_username'];

    $webauthn = createWebAuthn();

    $result = $webauthn->processCreate(
        base64_decode($data['clientDataJSON']),
        base64_decode($data['attestationObject']),
        $_SESSION['reg_challenge'],
        true,
        true,
        false,
        false
    );

    $pdo = getSqliteDb();

    // Capture device info from the request
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $deviceInfo = json_encode([
        'transports' => $data['transports'] ?? [],
        'platform' => $data['platform'] ?? '',
    ]);

    $stmt = $pdo->prepare(
        'INSERT INTO passkeys (credential_id, public_key, counter, username, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $result->credentialId,
        $result->credentialPublicKey,
        $result->signatureCounter ?? 0,
        $username,
        $userAgent,
        $deviceInfo,
    ]);

    // Clear registration session data
    unset(
        $_SESSION['reg_username'],
        $_SESSION['reg_challenge'],
        $_SESSION['reg_challenge_time'],
        $_SESSION['reg_user_id'],
        $_SESSION['reg_token_id'],
        $_SESSION['reg_verified']
    );

    jsonResponse(['status' => 'success']);
}

/**
 * Generates an authentication challenge (the login step itself).
 * No authentication required.
 *
 * @return void
 */
function handleChallengeLogin(): void
{
    startSession();

    $pdo = getSqliteDb();
    $rows = $pdo->query('SELECT credential_id FROM passkeys')->fetchAll();

    if (count($rows) === 0) {
        jsonResponse(['error' => 'Nejsou registrovány žádné přístupové klíče. / No passkeys registered.'], 400);
    }

    $webauthn = createWebAuthn();

    // Empty passkey array = discoverable credentials (resident keys)
    $getArgs = $webauthn->getGetArgs([], 120, true, true, true, true, true, true);

    $_SESSION['login_challenge'] = $webauthn->getChallenge()->getBinaryString();
    $_SESSION['login_challenge_time'] = time();

    jsonResponse(['getArgs' => $getArgs]);
}

/**
 * Verifies an authentication response and opens an admin session.
 *
 * @return void
 */
function handleVerifyLogin(): void
{
    startSession();

    if (empty($_SESSION['login_challenge'])) {
        jsonResponse(['error' => 'Autentizace nebyla zahájena. / Authentication has not been started.'], 403);
    }

    // Challenge expires after 120 seconds
    if (time() - $_SESSION['login_challenge_time'] > 120) {
        jsonResponse(['error' => 'Výzva vypršela. Zkuste to prosím znovu. / The challenge has expired. Please try again.'], 400);
    }

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data || empty($data['id']) || empty($data['clientDataJSON']) || empty($data['authenticatorData']) || empty($data['signature'])) {
        jsonResponse(['error' => 'Neplatná data. / Invalid data.'], 400);
    }

    // Browser sends the credential id as base64url; decode and look up the stored passkey
    $credentialId = base64_decode(strtr($data['id'], '-_', '+/') . str_repeat('=', (4 - strlen($data['id']) % 4) % 4));

    $pdo = getSqliteDb();
    $stmt = $pdo->prepare('SELECT * FROM passkeys WHERE credential_id = ?');
    $stmt->execute([$credentialId]);
    $stored = $stmt->fetch();

    // Do not reveal which step failed
    if (!$stored) {
        jsonResponse(['error' => 'Autentizace selhala. Zkuste to prosím znovu. / Authentication failed. Please try again.'], 401);
    }

    // Real browsers deliver the ES256 assertion signature as raw r||s
    // (IEEE P1363, 64 bytes); openssl_verify() (via lbuchs processGet)
    // expects a DER-encoded ECDSA-Sig-Value and cannot read raw signatures.
    // Convert at the API boundary; DER signatures pass through untouched.
    $signatureBinary = base64_decode($data['signature']);
    if (strlen($signatureBinary) === 64 && ord($signatureBinary[0]) !== 0x30) {
        $signatureBinary = rawEcdsaSignatureToDer($signatureBinary);
    }

    $webauthn = createWebAuthn();

    try {
        $valid = $webauthn->processGet(
            base64_decode($data['clientDataJSON']),
            base64_decode($data['authenticatorData']),
            $signatureBinary,
            $stored['public_key'],
            $_SESSION['login_challenge'],
            $stored['counter'],
            true,
            true
        );
    } catch (WebAuthnException $e) {
        jsonResponse(['error' => 'Autentizace selhala. Zkuste to prosím znovu. / Authentication failed. Please try again.'], 401);
    }

    if (!$valid) {
        jsonResponse(['error' => 'Autentizace selhala. Zkuste to prosím znovu. / Authentication failed. Please try again.'], 401);
    }

    // Update the signature counter and last usage
    $newCounter = $webauthn->getSignatureCounter() ?? $stored['counter'];
    $update = $pdo->prepare('UPDATE passkeys SET counter = ?, last_used_at = datetime(\'now\') WHERE id = ?');
    $update->execute([$newCounter, $stored['id']]);

    // Open the admin session
    setAdminSession($stored['username']);

    unset($_SESSION['login_challenge'], $_SESSION['login_challenge_time']);

    jsonResponse(['status' => 'success']);
}

/**
 * Loads the binary credential ids already registered for a username,
 * used to prevent re-registration of the same device.
 *
 * @param string $username
 * @return array
 */
function loadCredentialIds(string $username): array
{
    $pdo = getSqliteDb();
    $stmt = $pdo->prepare('SELECT credential_id FROM passkeys WHERE username = ?');
    $stmt->execute([$username]);
    $rows = $stmt->fetchAll();

    $ids = [];
    foreach ($rows as $row) {
        $ids[] = new ByteBuffer($row['credential_id']);
    }

    return $ids;
}

/**
 * Converts a raw ES256 signature (r||s, 64 bytes as delivered by browsers
 * and WebCrypto) into a DER-encoded ECDSA-Sig-Value as required by
 * openssl_verify(). Raw signatures shorter/longer than 64 bytes (other
 * curves) are not handled here.
 *
 * @param string $raw 64-byte raw signature (r and s, big-endian, 32 bytes each)
 * @return string DER-encoded ECDSA-Sig-Value
 */
function rawEcdsaSignatureToDer(string $raw): string
{
    $toDerInteger = static function (string $half): string {
        // strip leading zero padding, keep at least one byte
        $value = ltrim($half, "\x00");
        if ($value === '') {
            $value = "\x00";
        }
        // negative integers would misparse; prepend an (un)sign byte
        if (ord($value[0]) > 0x7f) {
            $value = "\x00" . $value;
        }
        return "\x02" . chr(strlen($value)) . $value;
    };

    $r = $toDerInteger(substr($raw, 0, 32));
    $s = $toDerInteger(substr($raw, 32, 32));
    $body = $r . $s;

    return "\x30" . chr(strlen($body)) . $body;
}

/**
 * Rate limiting helper: checks and records requests per IP.
 * Used for admin actions that modify passkeys.
 *
 * @param string $prefix Prefix for the temp file (e.g., 'passkey_list', 'passkey_revoke')
 * @param int $limit Max requests per hour
 * @return bool True if allowed, false if rate limited
 */
function checkRateLimit(string $prefix, int $limit = 10): bool
{
    $ip = getClientIp();
    $tmp_dir = __DIR__ . '/../tmp';
    if (!is_dir($tmp_dir)) {
        @mkdir($tmp_dir, 0755, true);
    }
    $limit_file = $tmp_dir . DIRECTORY_SEPARATOR . 'tacukrarna_' . $prefix . '_' . md5($ip) . '.json';

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

    if (count($timestamps) >= $limit) {
        return false;
    }
    $timestamps[] = $now;
    file_put_contents($limit_file, json_encode($timestamps));
    return true;
}

/**
 * Validates CSRF token from POST body or X-CSRF-Token header.
 *
 * @return bool
 */
function validateAdminCsrf(): bool
{
    $csrf_token = '';
    if (isset($_POST['csrf_token'])) {
        $csrf_token = (string) $_POST['csrf_token'];
    } elseif (isset($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $csrf_token = $_SERVER['HTTP_X_CSRF_TOKEN'];
    }
    return validateCsrfToken($csrf_token);
}

/**
 * Lists all passkeys for the authenticated admin user.
 * Requires admin session + CSRF token.
 *
 * @return void
 */
function handleListCredentials(): void
{
    startSession();
    requireAdmin();

    // Rate limit: max 10 requests per hour per IP
    if (!checkRateLimit('passkey_list')) {
        jsonResponse(['error' => 'Příliš mnoho požadavků. Zkuste to prosím později. / Too many requests. Please try again later.'], 429);
    }

    // Validate CSRF token
    if (!validateAdminCsrf()) {
        jsonResponse(['error' => 'Neplatný bezpečnostní token. Obnovte prosím stránku. / Invalid security token. Please reload the page.'], 403);
    }

    $username = getAdminUsername();
    $pdo = getSqliteDb();

    $stmt = $pdo->prepare('
        SELECT id, credential_id, counter, created_at, last_used_at, user_agent, device_info
        FROM passkeys
        WHERE username = ?
        ORDER BY created_at DESC
    ');
    $stmt->execute([$username]);
    $rows = $stmt->fetchAll();

    $credentials = [];
    foreach ($rows as $row) {
        $credentials[] = [
            'id' => (int) $row['id'],
            'credential_id' => base64_encode($row['credential_id']),
            'counter' => (int) $row['counter'],
            'created_at' => $row['created_at'],
            'last_used_at' => $row['last_used_at'],
            'user_agent' => $row['user_agent'],
            'device_info' => $row['device_info'] ? json_decode($row['device_info'], true) : null,
        ];
    }

    jsonResponse(['credentials' => $credentials]);
}

/**
 * Revokes a passkey for the authenticated admin user.
 * Requires admin session + CSRF token.
 *
 * @return void
 */
function handleRevokeCredential(): void
{
    startSession();
    requireAdmin();

    // Rate limit: max 10 requests per hour per IP
    if (!checkRateLimit('passkey_revoke')) {
        jsonResponse(['error' => 'Příliš mnoho požadavků. Zkuste to prosím později. / Too many requests. Please try again later.'], 429);
    }

    // Validate CSRF token
    if (!validateAdminCsrf()) {
        jsonResponse(['error' => 'Neplatný bezpečnostní token. Obnovte prosím stránku. / Invalid security token. Please reload the page.'], 403);
    }

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data || empty($data['credential_id'])) {
        jsonResponse(['error' => 'Neplatná data. / Invalid data.'], 400);
    }

    // Decode base64url credential ID
    $credentialId = base64_decode(strtr($data['credential_id'], '-_', '+/') . str_repeat('=', (4 - strlen($data['credential_id']) % 4) % 4));

    $username = getAdminUsername();
    $pdo = getSqliteDb();

    // Verify the credential belongs to this user before deleting
    $stmt = $pdo->prepare('SELECT id FROM passkeys WHERE credential_id = ? AND username = ?');
    $stmt->execute([$credentialId, $username]);
    $stored = $stmt->fetch();

    if (!$stored) {
        // Don't reveal whether the credential exists or belongs to another user
        jsonResponse(['error' => 'Přístupový klíč nebyl nalezen. / Passkey not found.'], 404);
    }

    // Prevent revoking the last passkey if it's the only one (optional safety)
    // Commented out to allow full revocation - user can re-register via /admin/register/
    // $countStmt = $pdo->prepare('SELECT COUNT(*) FROM passkeys WHERE username = ?');
    // $countStmt->execute([$username]);
    // if ((int)$countStmt->fetchColumn() <= 1) {
    //     jsonResponse(['error' => 'Nelze odvolat poslední přístupový klíč. / Cannot revoke the last passkey.'], 400);
    // }

    $deleteStmt = $pdo->prepare('DELETE FROM passkeys WHERE id = ?');
    $deleteStmt->execute([$stored['id']]);

    jsonResponse(['status' => 'success']);
}
