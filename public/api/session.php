<?php
/**
 * Ta Cukrárna - Session Management Helpers
 *
 * Provides session handling, CSRF protection, and admin authentication
 * functions for the WebAuthn admin panel.
 */

require_once __DIR__ . '/db.php';

/**
 * Starts a session with secure cookie settings.
 *
 * @return void
 */
function startSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $is_localhost = isset($_SERVER['HTTP_HOST']) &&
        (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false ||
         strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false);

    session_set_cookie_params([
        'lifetime' => 86400,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !$is_localhost,
    ]);

    session_start();
}

/**
 * Generates a new CSRF token and stores it in the session.
 *
 * @return string Hex-encoded token
 */
function generateCsrfToken(): string
{
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    return $token;
}

/**
 * Returns the current CSRF token, generating one if needed.
 *
 * @return string Hex-encoded token
 */
function getCsrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        return generateCsrfToken();
    }
    return $_SESSION['csrf_token'];
}

/**
 * Validates a submitted CSRF token against the session token.
 *
 * @param string $token Submitted token
 * @return bool
 */
function validateCsrfToken(string $token): bool
{
    if (empty($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Sets admin session variables after successful authentication.
 *
 * @param string $username Admin username
 * @return void
 */
function setAdminSession(string $username): void
{
    $_SESSION['admin'] = true;
    $_SESSION['admin_user'] = $username;
    $_SESSION['admin_login_time'] = time();
}

/**
 * Checks if the current session is a valid admin session.
 *
 * @return bool
 */
function isAdmin(): bool
{
    if (empty($_SESSION['admin']) || $_SESSION['admin'] !== true) {
        return false;
    }

    if (empty($_SESSION['admin_login_time'])) {
        return false;
    }

    // Session expires after 24 hours
    if (time() - $_SESSION['admin_login_time'] > 86400) {
        return false;
    }

    return true;
}

/**
 * Requires admin authentication. Exits with 401 if not authenticated.
 *
 * @return void
 */
function requireAdmin(): void
{
    if (!isAdmin()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

/**
 * Returns the current admin username or empty string.
 *
 * @return string
 */
function getAdminUsername(): string
{
    return $_SESSION['admin_user'] ?? '';
}
