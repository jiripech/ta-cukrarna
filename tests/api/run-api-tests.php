<?php
/**
 * Ta Cukrárna - PHP API Security Test Suite
 *
 * Integration tests for the security-critical behaviour of the PHP backend
 * (public/api/*.php). The static E2E harness (npx serve out) cannot execute
 * PHP, so this suite boots the PHP built-in server against a THROWAWAY copy
 * of public/ with a fresh SQLite database and drives the real endpoints over
 * HTTP — no Docker or Apache required, only php-cli.
 *
 * Covered regressions (v1.3.11 security fixes):
 *   V1  Registration password proof is enforced server-side: a valid
 *       registration token alone must NOT allow passkey registration
 *       (challenge_register returns 403 until reg_verified is set).
 *   V2  Rate limits are keyed on REMOTE_ADDR: rotating the client-controlled
 *       X-Forwarded-For header must NOT defeat them (register + chatbot).
 *   V3  The chatbot email catalog link cannot be poisoned via the Host
 *       header (allowlisted hosts only).
 *   V4  Session ID is regenerated on registration-token validation, on admin
 *       login (setAdminSession), and the session cookie Secure flag follows
 *       the TLS state of the connection, not the spoofable Host header.
 *
 * Usage:
 *   php tests/api/run-api-tests.php              (orchestrator + HTTP cases)
 *   php tests/api/run-api-tests.php --unit=<name> (single CLI unit case)
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

const CHATBOT_PDF_PATH = '/AtJstePysnaNaKazdyOkamzik.pdf';

/** @var array<int, array{string,bool,string}> */
$results = [];
$failures = 0;

/**
 * Records and prints a single expectation.
 */
function expect(bool $condition, string $message): void
{
    global $results, $failures;
    $results[] = [$condition ? 'PASS' : 'FAIL', $condition, $message];
    echo ($condition ? '  ✓ ' : '  ✗ ') . $message . "\n";
    if (!$condition) {
        $failures++;
    }
}

// ---------------------------------------------------------------------------
// CLI unit cases (run in a fresh PHP process so session state is isolated)
// ---------------------------------------------------------------------------

if (isset($argv[1]) && str_starts_with($argv[1], '--unit=')) {
    exit(runCliUnit(substr($argv[1], 7)));
}

/**
 * CLI unit cases. Exit 0 = pass, 1 = fail.
 */
function runCliUnit(string $name): int
{
    require_once __DIR__ . '/../../public/api/session.php';

    switch ($name) {
        case 'admin-session-regeneration':
            // setAdminSession() must regenerate the session ID (fixation).
            $_SERVER['HTTP_HOST'] = 'tacukrarna.cz';
            $_SERVER['HTTPS'] = 'on';
            startSession();
            $before = session_id();
            setAdminSession('admin@tacukrarna.cz');
            $after = session_id();
            echo "session id before=$before after=$after\n";
            return ($before !== '' && $after !== '' && $before !== $after) ? 0 : 1;

        case 'cookie-secure-https':
            // TLS connection → Secure cookie, regardless of anything else.
            $_SERVER['HTTP_HOST'] = 'tacukrarna.cz';
            $_SERVER['HTTPS'] = 'on';
            startSession();
            return session_get_cookie_params()['secure'] === true ? 0 : 1;

        case 'cookie-nosecure-http':
            // Plain local HTTP (dev) → no Secure flag (cookies must work).
            $_SERVER['HTTP_HOST'] = 'tacukrarna.cz';
            unset($_SERVER['HTTPS']);
            startSession();
            return session_get_cookie_params()['secure'] === false ? 0 : 1;

        case 'cookie-host-spoof-tls':
            // A spoofed "Host: localhost" must NOT strip the Secure flag on
            // a TLS connection (the old Host-header-based check did).
            $_SERVER['HTTP_HOST'] = 'localhost';
            $_SERVER['HTTPS'] = 'on';
            startSession();
            return session_get_cookie_params()['secure'] === true ? 0 : 1;
    }

    fwrite(STDERR, "Unknown unit: $name\n");
    return 1;
}

// ---------------------------------------------------------------------------
// Orchestrator: temp docroot, two API servers, HTTP regression cases
// ---------------------------------------------------------------------------

$repoRoot = realpath(__DIR__ . '/../..');
if ($repoRoot === false) {
    exit("Cannot locate repository root\n");
}

$sourcePublic = $repoRoot . '/public';
$workDir = sys_get_temp_dir() . '/tacukrarna-api-tests-' . getmypid();
$portA = 8191; // production parity: no ADMIN_USERS
$portB = 8192; // test parity: ADMIN_USERS set (Docker container behaviour)
$baseA = "http://127.0.0.1:$portA";
$baseB = "http://127.0.0.1:$portB";

$runningProcs = [];

register_shutdown_function(static function () use (&$runningProcs, $workDir): void {
    foreach ($runningProcs as $proc) {
        if (is_resource($proc)) {
            proc_terminate($proc);
            proc_close($proc);
        }
    }
    if (is_dir($workDir)) {
        exec('rm -rf ' . escapeshellarg($workDir));
    }
});

echo "Ta Cukrárna API security tests\n";
echo "==============================\n";

// Stale rate-limit state from earlier runs would poison the assertions.
foreach (glob(sys_get_temp_dir() . '/tacukrarna_*.json') ?: [] as $stale) {
    @unlink($stale);
}
$devMailLog = sys_get_temp_dir() . '/tacukrarna_dev_mail.log';

// -- 1. Throwaway docroot: copy public/ without any runtime DB state --------
echo "Preparing temp docroot at $workDir\n";
copyPublicWithoutRuntimeState($sourcePublic, $workDir . '/public');

exec(
    PHP_BINARY . ' ' . escapeshellarg($workDir . '/public/api/DB/init.php') . ' > /dev/null 2>&1',
    $initOut,
    $initRc
);
if ($initRc !== 0) {
    exit("Failed to initialize the test SQLite database\n");
}

$tokenA = bin2hex(random_bytes(16)); // production-parity server
$tokenB = bin2hex(random_bytes(16)); // ADMIN_USERS-parity server
seedRegToken($workDir . '/public/api/DB/passkeys.sqlite', $tokenA, 'owner@tacukrarna.cz');
seedRegToken($workDir . '/public/api/DB/passkeys.sqlite', $tokenB, 'admin@example.cz');

// -- 2. Boot the two API servers --------------------------------------------
startServer($workDir . '/public', $portA, [
    'MAILDB_HOST' => '127.0.0.1',
    'MAILDB_NAME' => 'nonexistent_test_db',
    'MAILDB_USER' => 'nouser',
    'MAILDB_PASSWORD' => 'nopass',
    // Test-mode mail: chatbot.php logs instead of relaying. Keeps T5
    // deterministic — with a spoofed Host the old Host-based is_dev check
    // would silently switch to the production mail path and write nothing.
    'PLAYWRIGHT_TEST_MODE' => 'true',
]);
startServer($workDir . '/public', $portB, [
    'ADMIN_USERS' => 'admin@example.cz',
    'MAILDB_HOST' => '127.0.0.1',
    'MAILDB_NAME' => 'nonexistent_test_db',
    'MAILDB_USER' => 'nouser',
    'MAILDB_PASSWORD' => 'nopass',
]);
// Do not leak the server env overrides into the CLI unit subprocesses.
putenv('ADMIN_USERS');
putenv('MAILDB_HOST');
putenv('MAILDB_NAME');
putenv('MAILDB_USER');
putenv('MAILDB_PASSWORD');
putenv('PLAYWRIGHT_TEST_MODE');

// -- 3. HTTP cases -----------------------------------------------------------

// T1 — V1 + V4: production parity. A stolen token must not be enough to
// register a passkey, and validating a token must rotate the session ID.
echo "\nT1: registration gate requires the password proof (V1, V4)\n";
$jar = [];
[$status] = http('GET', "$baseA/api/csrf.php", [], null, $jar);
$sidBefore = $jar['PHPSESSID'] ?? '';
[$status, , $body] = http(
    'GET',
    "$baseA/api/register.php?action=validate-token&token=$tokenA",
    [],
    null,
    $jar
);
$data = json_decode($body, true);
expect($status === 200, 'valid token is accepted (HTTP 200)');
expect(
    is_array($data) && ($data['valid'] ?? false) === true && ($data['password_required'] ?? null) === true,
    'token grants username but the password proof is required'
);
$sidAfter = $jar['PHPSESSID'] ?? '';
expect(
    $sidBefore !== '' && $sidAfter !== '' && $sidBefore !== $sidAfter,
    'session ID is regenerated at token validation (session fixation hardening, V4)'
);
[$status, , $body] = http(
    'POST',
    "$baseA/api/webauthn.php?action=challenge_register",
    ['Content-Type: application/json'],
    '{}',
    $jar
);
expect($status === 403, 'challenge_register is rejected without the password proof (HTTP 403, V1)');
expect(!str_contains($body, 'createArgs'), 'no WebAuthn ceremony arguments are leaked');

// T2 — guard: the legitimate no-password flow (ADMIN_USERS test parity,
// used by the Docker container) must keep working end to end.
echo "\nT2: legitimate no-password flow still works (guard)\n";
$jar = [];
[$status, , $body] = http(
    'GET',
    "$baseB/api/register.php?action=validate-token&token=$tokenB",
    [],
    null,
    $jar
);
$data = json_decode($body, true);
expect(
    $status === 200 && is_array($data) && ($data['password_required'] ?? null) === false,
    'ADMIN_USERS parity reports password_required=false'
);
[$status, , $body] = http(
    'POST',
    "$baseB/api/webauthn.php?action=challenge_register",
    ['Content-Type: application/json'],
    '{}',
    $jar
);
expect($status === 200 && str_contains($body, 'createArgs'), 'challenge_register succeeds for the pre-verified flow');

// T3 — V2: rotating X-Forwarded-For must not defeat the request-token limit.
echo "\nT3: register-token rate limit survives X-Forwarded-For rotation (V2)\n";
$jar = [];
$firstFourStatuses = [];
for ($i = 1; $i <= 4; $i++) {
    [$status] = http(
        'POST',
        "$baseA/api/register.php?action=request-token",
        [
            'Content-Type: application/json',
            'X-Forwarded-For: 10.0.0.' . $i,
        ],
        (string) json_encode(['username' => 'flood@example.cz']),
        $jar
    );
    $firstFourStatuses[] = $status;
}
expect(
    $firstFourStatuses[0] === 200 && $firstFourStatuses[1] === 200 && $firstFourStatuses[2] === 200,
    'first three requests from one client are allowed'
);
expect(
    $firstFourStatuses[3] === 429,
    'fourth request is rate limited even with a different X-Forwarded-For (HTTP 429)'
);

// T4 — V2: same for the chatbot mail relay (5 per minute).
echo "\nT4: chatbot rate limit survives X-Forwarded-For rotation (V2)\n";
$jar = [];
$chatbotBody = static fn (): string => (string) json_encode([
    'email' => 'victim@example.com',
    'language' => 'en',
    'bot_honeypot' => '',
    'anti_bot_token' => 'abcdef123456',
    'rendered_at' => (time() - 3) * 1000,
    'submitted_at' => time() * 1000,
]);
$statuses = [];
for ($i = 1; $i <= 6; $i++) {
    [$status] = http(
        'POST',
        "$baseA/api/chatbot.php",
        [
            'Content-Type: application/json',
            'X-Forwarded-For: 10.1.0.' . $i,
        ],
        $chatbotBody(),
        $jar
    );
    $statuses[] = $status;
}
expect(
    count(array_keys(array_slice($statuses, 0, 5), 200)) === 5,
    'first five requests from one client are allowed'
);
expect($statuses[5] === 429, 'sixth request is rate limited even with a different X-Forwarded-For (HTTP 429)');

// T5 — V3: the catalog link in the email must not follow a spoofed Host.
echo "\nT5: chatbot email link is immune to Host header spoofing (V3)\n";
// T4 exhausted the (correctly shared) REMOTE_ADDR rate-limit bucket; reset
// it so this case exercises the Host-spoofing path, not the limiter.
foreach (glob(sys_get_temp_dir() . '/tacukrarna_limit_*.json') ?: [] as $stale) {
    @unlink($stale);
}
@unlink($devMailLog);
[$status, , $body] = http(
    'POST',
    "$baseA/api/chatbot.php",
    [
        'Content-Type: application/json',
        'Host: evil.example',
        'X-Forwarded-For: 10.1.1.1',
    ],
    $chatbotBody(),
    $jar
);
expect($status === 200, 'chatbot accepts a well-formed request');
$log = @file_get_contents($devMailLog) ?: '';
expect(
    str_contains($log, 'https://tacukrarna.cz' . CHATBOT_PDF_PATH),
    'email body links to the allowlisted production host'
);
expect(
    !str_contains($log, 'evil.example'),
    'spoofed Host does not appear anywhere in the sent email'
);

// T6 — V4: CLI units for the login-path session regeneration and the
// TLS-derived Secure cookie flag.
echo "\nT6: CLI units — setAdminSession regeneration, Secure cookie (V4)\n";
expect(runUnitSub('admin-session-regeneration'), 'setAdminSession() regenerates the session ID');
expect(runUnitSub('cookie-secure-https'), 'Secure cookie on a TLS connection');
expect(runUnitSub('cookie-nosecure-http'), 'no Secure cookie on plain local HTTP');
expect(runUnitSub('cookie-host-spoof-tls'), 'spoofed Host: localhost cannot strip the Secure flag on TLS');

// -- 4. Summary --------------------------------------------------------------
echo "\nSummary: " . (count($results) - $failures) . '/' . count($results) . ' expectations passed';
echo $failures === 0 ? " — ALL GREEN\n" : " — $failures FAILED\n";
exit($failures === 0 ? 0 : 1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Copies public/ to the target dir, skipping runtime DB/log/credential files
 * (a fresh database is created afterwards via init.php).
 */
function copyPublicWithoutRuntimeState(string $source, string $target): void
{
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $item) {
        $path = (string) $item;
        $rel = substr($path, strlen($source) + 1);
        if (
            str_contains($rel, 'DB/passkeys.sqlite')
            || str_contains($rel, 'DB/api-debug.log')
            || str_contains($rel, 'DB/test-credentials.json')
            || str_contains($rel, '.DS_Store')
        ) {
            continue;
        }
        $dest = $target . '/' . $rel;
        if ($item->isDir()) {
            @mkdir($dest, 0777, true);
        } else {
            @mkdir(dirname($dest), 0777, true);
            copy($path, $dest);
        }
    }
}

/**
 * Inserts a registration token directly into the fresh test database.
 */
function seedRegToken(string $dbPath, string $token, string $username): void
{
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $stmt = $pdo->prepare(
        "INSERT INTO reg_tokens (token, username, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))"
    );
    $stmt->execute([$token, $username]);
}

/**
 * Boots php -S in the background and waits until it accepts connections.
 * Env overrides are applied via putenv() and inherited by the child.
 *
 * @param array<string, string> $envOverrides
 */
function startServer(string $docroot, int $port, array $envOverrides): void
{
    global $runningProcs;

    foreach ($envOverrides as $key => $value) {
        putenv("$key=$value");
    }

    $proc = proc_open(
        [PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $docroot],
        [
            0 => ['file', '/dev/null', 'r'],
            1 => ['file', '/dev/null', 'w'],
            2 => ['file', '/dev/null', 'w'],
        ],
        $pipes
    );
    if (!is_resource($proc)) {
        exit("Failed to start the PHP dev server on port $port\n");
    }
    $runningProcs[] = $proc;

    for ($i = 0; $i < 50; $i++) {
        $conn = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
        if (is_resource($conn)) {
            fclose($conn);
            return;
        }
        usleep(100_000);
    }
    exit("PHP dev server on port $port did not become ready\n");
}

/**
 * Runs one CLI unit case in a fresh PHP process; returns true on exit 0.
 */
function runUnitSub(string $unit): bool
{
    $cmd = PHP_BINARY . ' ' . escapeshellarg(__FILE__) . ' --unit=' . $unit . ' 2>&1';
    exec($cmd, $out, $rc);
    if ($rc !== 0) {
        echo "    (unit output: " . implode(' | ', $out) . ")\n";
    }
    return $rc === 0;
}

/**
 * Minimal HTTP client with a cookie jar (PHP streams, no curl dependency).
 *
 * @param array<int, string> $headers
 * @param array<string, string> $jar modified in place
 * @return array{0: int, 1: array<int, string>, 2: string} status, set-cookie pairs, body
 */
function http(string $method, string $url, array $headers = [], ?string $body = null, array &$jar = []): array
{
    $cookieHeader = '';
    foreach ($jar as $name => $value) {
        $cookieHeader .= ($cookieHeader === '' ? '' : '; ') . $name . '=' . $value;
    }
    if ($cookieHeader !== '') {
        $headers[] = 'Cookie: ' . $cookieHeader;
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body ?? '',
            'ignore_errors' => true,
            'timeout' => 15,
            'protocol_version' => 1.1,
        ],
    ]);

    $responseBody = @file_get_contents($url, false, $context);
    $status = 0;
    $setCookies = [];

    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $header, $m) === 1) {
            $status = (int) $m[1];
            continue;
        }
        if (stripos($header, 'set-cookie:') === 0) {
            $pair = trim(explode(';', substr($header, 11))[0]);
            $eq = strpos($pair, '=');
            if ($eq !== false) {
                $jar[trim(substr($pair, 0, $eq))] = trim(substr($pair, $eq + 1));
            }
            $setCookies[] = $pair;
        }
    }

    return [$status, $setCookies, $responseBody === false ? '' : $responseBody];
}
