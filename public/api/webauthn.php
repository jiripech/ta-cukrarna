<?php
/**
 * Ta Cukrárna - WebAuthn Admin Ceremonies
 *
 * Single entry point for WebAuthn registration and authentication ceremonies.
 * Handles challenge generation and response verification using the
 * lbuchs/WebAuthn library and the SQLite passkeys store.
 *
 * Actions (all POST):
 *   ?action=challenge_register  - generate a registration challenge
 *   ?action=verify_register     - verify a registration response and store the passkey
 *   ?action=challenge_login     - generate an authentication challenge
 *   ?action=verify_login        - verify an authentication response and open a session
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/vendor/autoload.php';

use lbuchs\WebAuthn\WebAuthn;
use lbuchs\WebAuthn\WebAuthnException;
use lbuchs\WebAuthn\Binary\ByteBuffer;

// Set header for JSON response
header('Content-Type: application/json; charset=utf-8');

// Only allow same-origin requests (no cross-origin CORS headers needed)
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
 * @return WebAuthn
 */
function createWebAuthn(): WebAuthn
{
    return new WebAuthn('Ta Cukrárna', 'tacukrarna.cz', null, true);
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
    if (empty($_SESSION['reg_username'])) {
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

    if (empty($_SESSION['reg_username']) || empty($_SESSION['reg_challenge'])) {
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

    $stmt = $pdo->prepare(
        'INSERT INTO passkeys (credential_id, public_key, counter, username) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $result->credentialId,
        $result->credentialPublicKey,
        $result->signatureCounter ?? 0,
        $username,
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

    $webauthn = createWebAuthn();

    try {
        $valid = $webauthn->processGet(
            base64_decode($data['clientDataJSON']),
            base64_decode($data['authenticatorData']),
            base64_decode($data['signature']),
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
