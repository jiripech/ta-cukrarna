# Chatbot API Security Recommendations

## Summary

The current PHP endpoint is reachable from any browser and accepts a public
`POST` request with an email address and language. Even though transport
security is handled by SSL, the API remains exposed to abuse from automated
requests and scripted clients.

## Key risks

- Public API abuse: the endpoint can be called directly from the browser
  console, cURL, or automated scripts.
- Spam/relay abuse: an attacker can spam the email delivery flow with many
  arbitrary addresses.
- DDoS/resource exhaustion: repeated requests can overload PHP, mail delivery,
  or the server.
- Account/email reputation damage: excessive outbound mail can trigger
  blacklisting or rate limits from the MTA.

## What is currently good

- The endpoint already enforces `POST` only.
- Email addresses are validated with `FILTER_VALIDATE_EMAIL`.
- Language input is restricted to a fixed set.
- There is a basic rate-limit implementation based on IP+User-Agent.

## What still needs to be changed

### 1. Add a bot-proof front-end control

The strongest improvement is to require a human verification step before sending
mail.

- Integrate a CAPTCHA service such as reCAPTCHA v3/v2 or hCaptcha on the chatbot
  form.
- Send the CAPTCHA token with the same `POST` payload.
- Validate the token server-side in `public/api/chatbot.php` before continuing.
- Reject the request immediately if token verification fails.

Why: this prevents automated abuse even when the endpoint is public.

### 2. Harden rate limiting and abuse controls

The current limit is a good start, but it should be stricter and stateful.

- Use a persistent store for limits instead of one temporary file per request
  path. Examples:
  - Redis
  - SQLite
  - In-memory cache with fallback
- Apply limits at multiple axes:
  - per IP address
  - per email address
  - per endpoint/session token
- Use a longer sliding window for email sending, for example:
  - max 5 requests per IP per minute
  - max 10 requests per IP per hour
  - max 3 emails per target email per 24 hours
- Optional: blacklisting of known abusive IPs or user agents.

Why: a single 60-second window is too weak for sustained abuse.

### 3. Validate and sanitize user input more strictly

Even though the current email validation is okay, please add extra checks:

- Reject values containing control characters such as `\r`, `\n`, or `\0`.
- Sanitize `email` using a strict regex or built-in filtering.
- Confirm `language` is one of `cs`, `sk`, `en` before using it.

Why: this closes any remaining header injection or malformed-input vector.

### 4. Protect the email send path

The endpoint should not call `mail()` directly without additional protection.

- Prefer an authenticated SMTP relay or transactional email provider.
- Use a queue/worker pattern for sending mail asynchronously if possible.
- Log every attempted request with timestamp, IP, email, and result.
- If using `mail()`, keep headers static and safe.

Why: asynchronous handling prevents the web request from blocking and improves
resilience under load.

### 5. Add request origin / token verification

Do not rely on `Origin` or `Referer` alone, but use them as supplementary
signals.

- Issue a short-lived CSRF-style token when rendering the chatbot form.
- Require that token in the `POST` payload.
- Validate it server-side.

Why: this makes it harder for third-party pages or scripts to reuse the endpoint
easily.

### 6. Make rate limiting more visible and fail-fast

Respond with clear and consistent error codes:

- `429 Too Many Requests` for rate limit exceeded
- `400 Bad Request` for invalid input
- `403 Forbidden` for failed CAPTCHA or token validation
- `500 Internal Server Error` only for real send failures

Why: this isolates the abuse path and makes logs easier to understand.

## Recommended implementation changes

1. Add a CAPTCHA token to the client request in `src/components/Chatbot.tsx`.
2. Validate the CAPTCHA server-side in `public/api/chatbot.php`.
3. Replace the current temp-file limiter with a more reliable store.
4. Add email-per-recipient limits.
5. Reject request immediately if `email` contains CR/LF or other header
   injection characters.
6. Add logging for all failures and rate-limit events.

## Deployment / infrastructure suggestions

- Put the endpoint behind a CDN/WAF or reverse proxy that can filter high-volume
  abuse.
- Use `fail2ban` or similar on the VPS to block abusive IPs after repeated bad
  requests.
- Monitor mail delivery and outbound rates from the MTA.
- Limit PHP-FPM worker concurrency if needed to keep the server stable.

## Practical next steps for tomorrow

1. Review whether you want CAPTCHA or a simpler honeypot/token scheme.
2. Decide on the storage method for rate limiting (Redis/SQLite/tmp file).
3. Implement server-side validation and stronger per-email limits.
4. Add logging and monitor for suspicious traffic after deployment.

## Notes

- This is not a public authenticated API; it must be treated as a low-trust,
  user-facing mail request endpoint.
- The biggest remaining risk is automated abuse, not SSL transport security.
- A CAPTCHA plus stricter rate limiting will be the most effective immediate
  fix.
