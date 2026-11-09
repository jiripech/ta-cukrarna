<?php
/**
 * Ta Cukrárna - Chatbot PDF Emailing API
 *
 * Handles secure email delivery of the cake catalog link.
 * Integrates with the local system MTA in production, and provides email logging
 * in local development environments.
 */

// Set header for JSON response
header('Content-Type: application/json; charset=utf-8');

// Define allowed origins for CORS (production + local development)
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
    header("Access-Control-Allow-Methods: POST, OPTIONS");
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('HTTP/1.1 405 Method Not Allowed');
    echo json_encode(['error' => 'Method Not Allowed. Only POST requests are permitted.']);
    exit;
}

// 1. IP + User-Agent Combined Rate Limiting
//
// Keyed on REMOTE_ADDR only: X-Forwarded-For is client-controlled here
// (Apache is the edge), so honoring it made the limit bypassable by
// rotating the header. Mirrors getClientIp() in db.php.
$ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
$ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';

if (!getenv('PLAYWRIGHT_TEST_MODE')) {
    $client_hash = md5($ip . '|' . $ua);
    $tmp_dir = __DIR__ . '/../tmp';
    if (!is_dir($tmp_dir)) {
        @mkdir($tmp_dir, 0755, true);
    }
    $rate_limit_file = $tmp_dir . DIRECTORY_SEPARATOR . 'tacukrarna_limit_' . $client_hash . '.json';

    $now = time();
    $timestamps = [];

    if (file_exists($rate_limit_file)) {
        $raw_content = file_get_contents($rate_limit_file);
        $data = json_decode($raw_content, true);
        if (is_array($data)) {
            // Keep only timestamps from the last 60 seconds
            foreach ($data as $ts) {
                if ($now - $ts < 60) {
                    $timestamps[] = $ts;
                }
            }
        }
    }

    // Limit: 5 requests per 60 seconds
    if (count($timestamps) >= 5) {
        header('HTTP/1.1 429 Too Many Requests');
        echo json_encode(['error' => 'Příliš mnoho požadavků. Zkuste to prosím za minutu. / Too many requests. Please try again in a minute.']);
        exit;
    }

    // Add current timestamp and save
    $timestamps[] = $now;
    file_put_contents($rate_limit_file, json_encode($timestamps));
}

// 2. Parse and Validate Request Body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['error' => 'Invalid JSON payload.']);
    exit;
}

$email = isset($data['email']) ? trim($data['email']) : '';
$lang = isset($data['language']) ? trim($data['language']) : 'cs';
$honeypot = isset($data['bot_honeypot']) ? trim($data['bot_honeypot']) : '';
$anti_bot_token = isset($data['anti_bot_token']) ? trim($data['anti_bot_token']) : '';
$rendered_at = isset($data['rendered_at']) ? filter_var($data['rendered_at'], FILTER_VALIDATE_INT) : false;
$submitted_at = isset($data['submitted_at']) ? filter_var($data['submitted_at'], FILTER_VALIDATE_INT) : false;

if ($honeypot !== '') {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Verification failed.']);
    exit;
}

if (empty($anti_bot_token) || preg_match('/[^A-Za-z0-9]/', $anti_bot_token) || strlen($anti_bot_token) < 12) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Verification failed.']);
    exit;
}

if ($rendered_at === false || $submitted_at === false || $submitted_at < $rendered_at) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['error' => 'Invalid request metadata.']);
    exit;
}

$wait_ms = $submitted_at - $rendered_at;
if ($wait_ms < 1000) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Verification failed.']);
    exit;
}

if ($wait_ms > 86400000) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Verification failed.']);
    exit;
}

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['error' => 'Zadejte prosím platnou e-mailovou adresu. / Please enter a valid email address.']);
    exit;
}

if (!in_array($lang, ['cs', 'sk', 'en'])) {
    $lang = 'cs';
}

// 3. Catalog PDF URL
//
// The URL is embedded verbatim in an email sent from the official
// info@tacukrarna.cz address, so the host must never follow the
// client-controlled Host header (a spoofed Host used to turn the official
// email into a phishing message linking to the attacker's site). Only the
// allowlisted production hosts are used; anything else falls back to the
// canonical domain. Always https: production is TLS-only and the catalog
// is public there.
$host = isset($_SERVER['HTTP_HOST']) ? strtolower((string) $_SERVER['HTTP_HOST']) : '';
if (!in_array($host, ['tacukrarna.cz', 'www.tacukrarna.cz'], true)) {
    $host = 'tacukrarna.cz';
}

$pdf_url = 'https://' . $host . '/AtJstePysnaNaKazdyOkamzik.pdf';

// 4. Localized Subjects & Bodies
$subjects = [
    'cs' => 'Praktický návod pro svatební sladký bar - Ta Cukrárna',
    'sk' => 'Praktický návod pre svadobný sladký bar - Ta Cukrárna',
    'en' => 'Wedding Cake & Dessert Bar Guide - Ta Cukrárna'
];

$messages = [
    'cs' => "Dobrý den,\n\nděkujeme za Váš zájem o naši rodinnou cukrárnu. Na níže uvedeném odkazu si můžete stáhnout náš praktický návod a průvodce pro svatební sladký bar a dorty:\n\n" . $pdf_url . "\n\nPřejeme krásný den a těšíme se na Vás!\n\nTým Ta Cukrárna\nhttps://tacukrarna.cz",
    'sk' => "Dobrý deň,\n\nďakujeme za Váš záujem o našu rodinnú cukráreň. Na nižšie uvedenom odkaze si môžete stiahnuť náš praktický návod a sprievodcu pre svadobný sladký bar a torty:\n\n" . $pdf_url . "\n\nPrajeme krásny deň a tešíme sa na Vás!\n\nTím Ta Cukrárna\nhttps://tacukrarna.cz",
    'en' => "Hello,\n\nthank you for your interest in our family bakery. You can download our practical wedding guide and handbook at the link below:\n\n" . $pdf_url . "\n\nWe wish you a wonderful day and look forward to hearing from you!\n\nThe Ta Cukrárna Team\nhttps://tacukrarna.cz"
];

$subject = $subjects[$lang];
$message = $messages[$lang];

// 5. Send Email (Mocking for local development/testing)
//
// Dev detection uses only server-side signals: the PLAYWRIGHT_TEST_MODE env
// var or a loopback client address. The old Host-header-based check let a
// remote attacker flip the endpoint into "dev" mode by sending
// "Host: localhost".
$is_dev = getenv('PLAYWRIGHT_TEST_MODE') === 'true'
    || in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);

if ($is_dev) {
    // Log email to a local dev file for developer inspection and E2E testing validation
    $log_file = $tmp_dir . DIRECTORY_SEPARATOR . 'tacukrarna_dev_mail.log';
    $log_entry = "[" . date('Y-m-d H:i:s') . "] TO: $email | LANG: $lang | SUBJECT: $subject\nBODY:\n$message\n----------------------------------------\n";
    file_put_contents($log_file, $log_entry, FILE_APPEND);

    echo json_encode([
        'status' => 'success',
        'message' => 'Email simulated successfully (logged in dev environment).',
        'dev_log' => $log_file
    ]);
    exit;
}

// Production sending using local system MTA (Postfix/sendmail)
$to = $email;
$from_email = 'info@tacukrarna.cz';
$from = 'Ta Cukrárna <' . $from_email . '>';

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/plain; charset=utf-8';
$headers[] = 'From: ' . $from;
$headers[] = 'Reply-To: ' . $from_email;
// $headers[] = 'X-Mailer: PHP/' . phpversion();

$mail_sent = false;
if (function_exists('mb_send_mail')) {
    mb_internal_encoding("UTF-8");
    $mail_sent = mb_send_mail($to, $subject, $message, implode("\r\n", $headers), '-f' . $from_email);
} else {
    // Base64 encode subject to protect special accents (UTF-8)
    $encoded_subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $mail_sent = mail($to, $encoded_subject, $message, implode("\r\n", $headers), '-f' . $from_email);
}

if ($mail_sent) {
    echo json_encode(['status' => 'success']);
} else {
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['error' => 'Chyba při odesílání e-mailu. Zkuste to prosím znovu. / Error sending email. Please try again.']);
}
