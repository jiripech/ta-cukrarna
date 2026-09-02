# Changelog

## [Unreleased]

### Added

- **Opening hours admin panel**: Biometric-secured (WebAuthn/passkey) admin
  interface for managing opening hours. Owner authenticates via Touch ID/Face ID
  and can create custom schedule entries with date ranges and per-day hours.
- **Opening hours JSON API**: New `/api/opening-hours.php` endpoint serves
  custom schedules to the public site with stale-while-revalidate caching.
- **Passkey registration flow**: One-time registration via email token + IMAP
  password verification. Registered devices can authenticate without passwords.
- **SQLite credential store**: Passkey public keys and registration tokens
  stored in an Apache-denied SQLite database.

### Changed

- **Service worker v10**: Added stale-while-revalidate for `opening-hours.json`,
  excluded `/api/*` and `/admin/*` from caching.
- **Deploy workflow**: Added DB directory creation step for SQLite database.
