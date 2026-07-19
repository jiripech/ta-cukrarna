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
$ip = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? $_SERVER['HTTP_X_FORWARDED_FOR'] : $_SERVER['REMOTE_ADDR'];
$ip = trim(explode(',', $ip)[0]);
$ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';

$client_hash = md5($ip . '|' . $ua);
$tmp_dir = sys_get_temp_dir();
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

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['error' => 'Zadejte prosím platnou e-mailovou adresu. / Please enter a valid email address.']);
    exit;
}

if (!in_array($lang, ['cs', 'sk', 'en'])) {
    $lang = 'cs';
}

// 3. Dynamic Base URL Detection for Catalog PDF
$proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
          (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'tacukrarna.cz';

$pdf_url = $proto . '://' . $host . '/AtJstePysnaNaKazdyOkamzik.pdf';

// 4. Localized Subjects & Bodies
$subjects = [
    'cs' => 'Katalog dortů - Ta Cukrárna',
    'sk' => 'Katalóg tort - Ta Cukrárna',
    'en' => 'Cake Catalog - Ta Cukrárna'
];

$messages = [
    'cs' => "Dobrý den,\n\nděkujeme za Váš zájem o naše dorty. Na níže uvedeném odkazu si můžete stáhnout náš kompletní katalog:\n\n" . $pdf_url . "\n\nTěšíme se na Vaši objednávku!\n\nTým Ta Cukrárna\nhttps://tacukrarna.cz",
    'sk' => "Dobrý deň,\n\nďakujeme za Váš záujem o naše torty. Na nižšie uvedenom odkaze si môžete stiahnuť náš kompletný katalóg:\n\n" . $pdf_url . "\n\nTešíme se na Vašu objednávku!\n\nTým Ta Cukrárna\nhttps://tacukrarna.cz",
    'en' => "Hello,\n\nthank you for your interest in our cakes. You can download our complete catalog at the link below:\n\n" . $pdf_url . "\n\nWe look forward to your order!\n\nThe Ta Cukrárna Team\nhttps://tacukrarna.cz"
];

$subject = $subjects[$lang];
$message = $messages[$lang];

// 5. Send Email (Mocking for local development/testing)
$is_dev = (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false);

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
