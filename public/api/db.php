<?php
/**
 * Ta Cukrárna - Shared Database Bootstrap
 *
 * Provides database connection helpers and utility functions
 * used by all API endpoints.
 */

/**
 * Returns a PDO connection to MariaDB (mail database).
 *
 * @return PDO
 */
function getMailDb(): PDO
{
    loadEnv();

    $host = getenv('MAILDB_HOST') ?: '127.0.0.1';
    $name = getenv('MAILDB_NAME') ?: '';
    $user = getenv('MAILDB_USER') ?: '';
    $pass = getenv('MAILDB_PASSWORD') ?: '';

    $dsn = "mysql:host=$host;dbname=$name;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    return $pdo;
}

/**
 * Returns a PDO connection to the SQLite passkeys database.
 *
 * @return PDO
 */
function getSqliteDb(): PDO
{
    $db_path = __DIR__ . '/DB/passkeys.sqlite';

    $pdo = new PDO('sqlite:' . $db_path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $pdo->exec('PRAGMA journal_mode=WAL');

    return $pdo;
}

/**
 * Loads .env file into $_ENV and environment variables.
 * Only sets variables that are not already defined.
 * For local development — on VPS, env vars are set via Apache/systemd.
 *
 * @return void
 */
function loadEnv(): void
{
    $env_path = __DIR__ . '/../../.env';

    if (!file_exists($env_path)) {
        return;
    }

    $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        // Skip comments and empty lines
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }

        // Parse KEY=VALUE
        if (strpos($line, '=') === false) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);

        // Remove surrounding quotes if present
        if (strlen($value) >= 2 && $value[0] === '"' && $value[strlen($value) - 1] === '"') {
            $value = substr($value, 1, -1);
        } elseif (strlen($value) >= 2 && $value[0] === "'" && $value[strlen($value) - 1] === "'") {
            $value = substr($value, 1, -1);
        }

        // Only set if not already defined
        if (getenv($key) === false) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

/**
 * Sends a JSON response and exits.
 *
 * @param array $data Response data
 * @param int $statusCode HTTP status code
 * @return void
 */
function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/**
 * Returns the client IP address, honoring X-Forwarded-For.
 *
 * @return string
 */
function getClientIp(): string
{
    $ip = isset($_SERVER['HTTP_X_FORWARDED_FOR'])
        ? $_SERVER['HTTP_X_FORWARDED_FOR']
        : $_SERVER['REMOTE_ADDR'];

    // Take first IP if multiple are listed
    $ip = trim(explode(',', $ip)[0]);

    return $ip;
}
