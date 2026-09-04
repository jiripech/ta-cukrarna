#!/usr/bin/env bash
#
# Read-only IMAP/Dovecot probe for the VPS.
#
# Diagnoses the PHP <-> Dovecot handshake used by the admin registration
# flow (register.php verify-password). Collects facts only:
#
#   1. Effective Dovecot TLS/auth configuration and listeners
#   2. Raw PHP-socket IMAP conversation on 127.0.0.1:143: greeting,
#      capabilities (STARTTLS/LOGINDISABLED), STARTTLS with modern OpenSSL
#      (TLSv1.2), and LOGIN attempts - all with a DUMMY account
#   3. PHP ext-imap (libc-client) behavior for common mailbox-flag variants
#
# No configuration is changed and no real credentials are used. The LOGIN
# probes intentionally use a dummy account and are expected to fail with an
# auth error - that still proves the transport works end to end.
#
# Run as root on the VPS:
#   sudo bash vps-imap-probe.sh
# (Safe to re-run; prints everything needed to debug the handshake.)

set -uo pipefail

section() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

# PHP network probes run as the web server user: register.php experiences
# Dovecot as www-data, not as root. Falls back to the current user. The PHP
# code is fed on stdin (heredoc), not as an argument.
RUN_PHP() {
  if [ "$(id -u)" = "0" ] && id www-data >/dev/null 2>&1; then
    sudo -u www-data php 2>&1
  else
    php 2>&1
  fi
}

section "PHP facts"
php -v | head -n1
echo "PHP OpenSSL: $(php -r 'echo defined("OPENSSL_VERSION_TEXT") ? OPENSSL_VERSION_TEXT : "n/a";')"
php -m | grep -qi '^imap$' && echo "ext-imap: loaded" || echo "ext-imap: NOT loaded"
echo "(note: network probes below run as www-data; the CLI php.ini can differ from FPM)"

section "Dovecot effective configuration (doveconf -n)"
if command -v doveconf >/dev/null 2>&1; then
  doveconf -n 2>/dev/null | grep -E '^(ssl|ssl_min_protocol|ssl_cipher_list|disable_plaintext_auth|auth_mechanisms|listen|verbose_ssl|auth_verbose|auth_verbose_passwords)\b' || echo "(no matching lines)"
  echo "---- service imap-login listeners ----"
  doveconf -n 2>/dev/null | sed -n '/^service imap-login/,/^}/p' || true
else
  echo "doveconf not found in PATH"
fi

section "Listening sockets (143/993)"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | grep -E ':(143|993)\b' || echo "(nothing listening on 143/993)"
else
  echo "ss not available"
fi

section "doveadm auth service check (dummy user, expect auth failure not crash)"
if command -v doveadm >/dev/null 2>&1; then
  doveadm auth test probe@invalid.example probe-dummy 2>&1 | head -n3
else
  echo "doveadm not found in PATH"
fi

section "Raw IMAP on 127.0.0.1:143 - plaintext path (PHP streams)"
RUN_PHP <<'PHP'
<?php
$sock = @stream_socket_client('tcp://127.0.0.1:143', $errno, $err, 5);
if (!$sock) { echo "connect FAILED: $err\n"; exit(0); }
stream_set_timeout($sock, 5);
echo "greeting: " . trim((string) fgets($sock, 1024)) . "\n";
fwrite($sock, "P1 CAPABILITY\r\n");
$caps = '';
while (($line = fgets($sock, 1024)) !== false) {
    $caps .= $line;
    if (strpos($line, 'P1 ') === 0) break;
}
echo "capabilities: " . str_replace("\r\n", ' | ', trim($caps)) . "\n";
echo "STARTTLS advertised: " . var_export(stripos($caps, 'STARTTLS') !== false, true) . "\n";
echo "LOGINDISABLED: " . var_export(stripos($caps, 'LOGINDISABLED') !== false, true) . "\n";
// Dummy LOGIN: an auth failure here PROVES plaintext auth from loopback is
// accepted (Dovecot's disable_plaintext_auth localhost exemption).
fwrite($sock, "P2 LOGIN probe@example.cz probe-dummy\r\n");
while (($line = fgets($sock, 1024)) !== false) {
    echo "login reply: " . trim($line) . "\n";
    if (strpos($line, 'P2 ') === 0) break;
}
fwrite($sock, "P9 LOGOUT\r\n");
fclose($sock);
PHP

section "Raw IMAP STARTTLS with modern OpenSSL (PHP streams, TLSv1.2)"
RUN_PHP <<'PHP'
<?php
$sock = @stream_socket_client('tcp://127.0.0.1:143', $errno, $err, 5);
if (!$sock) { echo "connect FAILED: $err\n"; exit(0); }
stream_set_timeout($sock, 5);
fgets($sock, 1024); // greeting
fwrite($sock, "P1 CAPABILITY\r\n");
while (($line = fgets($sock, 1024)) !== false) {
    if (strpos($line, 'P1 ') === 0) break;
}
fwrite($sock, "P2 STARTTLS\r\n");
echo "starttls reply: " . trim((string) fgets($sock, 1024)) . "\n";
$ok = stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT);
echo "enable_crypto(TLSv1.2): " . var_export($ok, true) . "\n";
if ($ok === true) {
    fwrite($sock, "P3 CAPABILITY\r\n");
    while (($line = fgets($sock, 1024)) !== false) {
        echo "tls capabilities: " . trim($line) . "\n";
        if (strpos($line, 'P3 ') === 0) break;
    }
    fwrite($sock, "P4 LOGIN probe@example.cz probe-dummy\r\n");
    while (($line = fgets($sock, 1024)) !== false) {
        echo "tls login reply: " . trim($line) . "\n";
        if (strpos($line, 'P4 ') === 0) break;
    }
}
fwrite($sock, "P9 LOGOUT\r\n");
fclose($sock);
PHP

section "PHP ext-imap (libc-client) mailbox-flag variants (dummy credentials)"
echo "(each attempt uses a dummy account; the error TEXT is the signal)"
RUN_PHP <<'PHP'
<?php
if (!function_exists('imap_open')) { echo "ext-imap not loaded - nothing to probe\n"; exit(0); }
$variants = [
    '143/imap/notls                (current code)',
    '143/imap/novalidate-cert      (pre-v1.2.9 code)',
    '143/imap/tls/novalidate-cert',
    '993/imap/ssl/novalidate-cert',
];
foreach ($variants as $label) {
    [$p, ] = explode(' ', $label);
    [$port, $flags] = explode('/', $p, 2);
    $mailbox = "{127.0.0.1:$port/$flags}";
    if (function_exists('imap_errors')) { @imap_errors(); }
    $r = @imap_open($mailbox, 'probe@example.cz', 'probe-dummy');
    echo "$label  =>  " . ($r ? 'OPENED (unexpected with dummy creds!)' : 'FAILED') . "\n";
    if (!$r) {
        echo '    last_error: ' . (imap_last_error() ?: '(none)') . "\n";
    } else {
        @imap_close($r);
    }
}
PHP

section "Interpretation guide"
cat <<'TXT'
- Raw STARTTLS enable_crypto(TLSv1.2) = true  -> server TLS is fine; the
  problem is purely libc-client. Fix = stop using ext-imap for the
  password check (native PHP-socket IMAP client) or a no-TLS listener.
- Raw plaintext LOGIN got an auth failure (P2 NO)  -> Dovecot accepts
  plaintext logins from loopback (disable_plaintext_auth exemption holds).
- LOGINDISABLED=true on the plaintext connection  -> the loopback
  exemption does NOT apply; plaintext LOGIN is off even locally.
- ext-imap variants: if every variant fails with an SSL/TLS error while
  the raw probes succeed, libc-client is confirmed broken on this build.
TXT
