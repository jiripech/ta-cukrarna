<?php
/**
 * Ta Cukrárna - CSRF Token Endpoint
 *
 * Returns the current session CSRF token (generating one if needed).
 * Used by the admin panel after a successful WebAuthn login so that
 * POST requests to opening-hours.php can include a valid X-CSRF-Token header.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';

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
    header("Access-Control-Allow-Headers: Content-Type");
    header("Access-Control-Allow-Methods: GET, OPTIONS");
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method Not Allowed. Only GET requests are permitted.'], 405);
}

startSession();

jsonResponse(['csrf_token' => getCsrfToken()]);