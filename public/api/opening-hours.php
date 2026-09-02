<?php
/**
 * Ta Cukrárna - Opening Hours API
 *
 * Reads and writes the public opening-hours.json file that powers the
 * "opening days" section of the website. Reads are public and cached;
 * writes require an authenticated admin session + CSRF token.
 *
 *   GET  /api/opening-hours.php - return the current schedule (public)
 *   POST /api/opening-hours.php - save a new schedule (admin only)
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';

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
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Path to the opening hours JSON file (at public/ level)
$file_path = __DIR__ . '/../opening-hours.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    handleGet($file_path);
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handlePost($file_path);
} else {
    jsonResponse(['error' => 'Method Not Allowed. Only GET and POST requests are permitted.'], 405);
}

/**
 * Serves the current schedule for public consumption.
 *
 * @param string $filePath
 * @return void
 */
function handleGet(string $filePath): void
{
    header('Cache-Control: max-age=300, stale-while-revalidate=3600');

    if (!file_exists($filePath)) {
        // Create the initial empty schedule on first GET
        @file_put_contents($filePath, json_encode(['schedule' => []]));
        jsonResponse(['schedule' => []]);
    }

    $content = file_get_contents($filePath);
    if ($content === false) {
        jsonResponse(['error' => 'Nepodařilo se přečíst otevírací dobu. / Could not read the opening hours.'], 500);
    }

    $data = json_decode($content, true);
    if (!is_array($data) || !isset($data['schedule']) || !is_array($data['schedule'])) {
        jsonResponse(['schedule' => []]);
    }

    echo $content;
    exit;
}

/**
 * Validates and atomically saves a new schedule.
 *
 * @param string $filePath
 * @return void
 */
function handlePost(string $filePath): void
{
    startSession();
    requireAdmin();

    // Rate limit: max 10 requests per hour per IP
    $ip = getClientIp();
    $tmp_dir = sys_get_temp_dir();
    $limit_file = $tmp_dir . DIRECTORY_SEPARATOR . 'tacukrarna_openhours_' . md5($ip) . '.json';

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

    if (count($timestamps) >= 10) {
        jsonResponse(['error' => 'Příliš mnoho požadavků. Zkuste to prosím později. / Too many requests. Please try again later.'], 429);
    }
    $timestamps[] = $now;
    file_put_contents($limit_file, json_encode($timestamps));

    // Validate CSRF token (from POST body or X-CSRF-Token header)
    $csrf_token = '';
    if (isset($_POST['csrf_token'])) {
        $csrf_token = (string) $_POST['csrf_token'];
    } elseif (isset($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $csrf_token = $_SERVER['HTTP_X_CSRF_TOKEN'];
    }

    if (!validateCsrfToken($csrf_token)) {
        jsonResponse(['error' => 'Neplatný bezpečnostní token. Obnovte prosím stránku. / Invalid security token. Please reload the page.'], 403);
    }

    // Parse JSON body
    $input = file_get_contents('php://input');
    $payload = json_decode($input, true);

    if (!is_array($payload) || !isset($payload['schedule']) || !is_array($payload['schedule'])) {
        jsonResponse(['error' => 'Neplatná data. / Invalid data.'], 400);
    }

    $schedule = $payload['schedule'];

    // Validate the whole schedule before writing anything
    if (!validateSchedule($schedule)) {
        jsonResponse(['error' => 'Neplatná data otevírací doby. / Invalid opening hours data.'], 400);
    }

    // Write to a temp file, then atomically rename
    $tmp = $filePath . '.tmp.' . getmypid();
    $contents = json_encode(['schedule' => $schedule], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    if (file_put_contents($tmp, $contents) === false) {
        @unlink($tmp);
        jsonResponse(['error' => 'Nepodařilo se uložit otevírací dobu. / Could not save the opening hours.'], 500);
    }

    if (!rename($tmp, $filePath)) {
        @unlink($tmp);
        jsonResponse(['error' => 'Nepodařilo se uložit otevírací dobu. / Could not save the opening hours.'], 500);
    }

    jsonResponse(['status' => 'success', 'schedule' => $schedule]);
}

/**
 * Validates the schedule schema and constraints.
 *
 * @param array $schedule
 * @return bool
 */
function validateSchedule(array $schedule): bool
{
    $dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    $ranges = [];

    foreach ($schedule as $entry) {
        if (!is_array($entry)) {
            return false;
        }

        if (empty($entry['startDate']) || empty($entry['endDate'])) {
            return false;
        }

        // Validate ISO dates
        if (!isValidIsoDate($entry['startDate']) || !isValidIsoDate($entry['endDate'])) {
            return false;
        }

        if ($entry['startDate'] > $entry['endDate']) {
            return false;
        }

        if (!isset($entry['days']) || !is_array($entry['days'])) {
            return false;
        }

        foreach ($dayKeys as $key) {
            if (!array_key_exists($key, $entry['days'])) {
                return false;
            }

            $text = (string) $entry['days'][$key];

            if (mb_strlen($text) > 100) {
                return false;
            }

            // Only allowed characters: letters, numbers, spaces, hyphens, colons,
            // periods, commas and Czech characters.
            if (!preg_match('/^[A-Za-z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .,:\-]*$/', $text)) {
                return false;
            }
        }

        $ranges[] = [$entry['startDate'], $entry['endDate']];
    }

    // Check for overlapping date ranges
    foreach ($ranges as $i => $a) {
        foreach ($ranges as $j => $b) {
            if ($i === $j) {
                continue;
            }
            if ($a[0] <= $b[1] && $b[0] <= $a[1]) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Checks whether a string is a valid ISO date (YYYY-MM-DD).
 *
 * @param mixed $date
 * @return bool
 */
function isValidIsoDate($date): bool
{
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return false;
    }

    $parts = explode('-', $date);
    return checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0]);
}
