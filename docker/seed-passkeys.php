<?php

/**
 * Ta Cukrárna - Docker test environment passkey seeder
 *
 * Runs at container start (from docker-entrypoint.sh) and prepares the SQLite
 * passkey store so at least one user can sign in against the REAL PHP API:
 *
 *  1. Creates the schema via public/api/DB/init.php (idempotent).
 *  2. Generates a fresh P-256 (ES256) keypair.
 *  3. Stores the public key PEM in the `passkeys` table - the same format
 *     webauthn.php's processCreate() persists (AuthenticatorData::getPublicKeyPem()).
 *  4. Writes public/api/DB/test-credentials.json (gitignored) with the private
 *     key as a WebCrypto JWK - e2e/admin-login.spec.ts imports it to sign the
 *     server's real challenge with crypto.subtle.
 *
 * Replacing the row on every start also resets the signature counter, so the
 * stub authenticator can always assert with counter 1 (lbuchs/WebAuthn
 * requires a strictly increasing counter).
 *
 * NOTE: test-only secret material - never run on the VPS.
 */

$dbPath = '/var/www/html/api/DB/passkeys.sqlite';
$credFile = '/var/www/html/api/DB/test-credentials.json';

// The registered user: first ADMIN_USERS entry when the container .env
// (mounted at /var/www/.env) defines one, otherwise the default test user.
$username = 'owner@tacukrarna.cz';
$envFile = '/var/www/.env';
if (is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (preg_match('/^ADMIN_USERS\s*=\s*(.+)$/', $line, $m)) {
            $first = trim(explode(',', $m[1])[0]);
            if ($first !== '') {
                $username = strtolower($first);
            }
            break;
        }
    }
}

try {
    require '/var/www/html/api/DB/init.php';

    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pkey = openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ]);
    if (!$pkey) {
        throw new RuntimeException('openssl_pkey_new failed: ' . openssl_error_string());
    }

    $details = openssl_pkey_get_details($pkey);
    if (!$details || !isset($details['ec']['d'], $details['ec']['x'], $details['ec']['y'])) {
        throw new RuntimeException('could not read EC key details');
    }

    // EC components come as binary strings; JWK needs fixed 32-byte big-endian
    $fix = static function (string $v): string {
        return str_pad($v, 32, "\0", STR_PAD_LEFT);
    };

    $b64url = static function (string $bin): string {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    };

    $credentialId = random_bytes(32);

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM passkeys WHERE username = ?')->execute([$username]);
    $pdo->prepare('INSERT INTO passkeys (credential_id, public_key, counter, username) VALUES (?, ?, 0, ?)')
        ->execute([$credentialId, $details['key'], $username]);

    // Pre-inserted registration token (skips request-token/email so the full
    // register flow can be walked without a mailbox). Longer validity than
    // the 1-hour production tokens because the seeder runs at container start.
    // Stale tokens (used or expired) and previous tokens of the seeded user
    // are removed, so exactly one live token exists and the freshly
    // generated URL is always THE current one after a container restart.
    $pdo->prepare('DELETE FROM reg_tokens WHERE used = 1 OR expires_at <= datetime(\'now\')')
        ->execute();
    $pdo->prepare('DELETE FROM reg_tokens WHERE username = ?')
        ->execute([$username]);
    $registerToken = bin2hex(random_bytes(32));
    $pdo->prepare(
        "INSERT INTO reg_tokens (token, username, expires_at) VALUES (?, ?, datetime('now', '+24 hours'))"
    )->execute([$registerToken, $username]);
    $pdo->commit();

    file_put_contents($credFile, json_encode([
        'credentialId' => $b64url($credentialId),
        'jwk' => [
            'kty' => 'EC',
            'crv' => 'P-256',
            'd' => $b64url($fix($details['ec']['d'])),
            'x' => $b64url($fix($details['ec']['x'])),
            'y' => $b64url($fix($details['ec']['y'])),
        ],
        'username' => $username,
        'registerToken' => $registerToken,
        'registerUrl' => 'http://localhost/admin/register/?token=' . $registerToken,
    ]) . "\n");

echo "✓ Seeded test passkey + registration token for {$username}\n";
echo "  ➡️  Registration URL (valid 24h): http://localhost/admin/register/?token={$registerToken}\n";
} catch (Throwable $e) {
    fwrite(STDERR, '✗ Seeding failed: ' . $e->getMessage() . "\n");
    exit(1);
}
