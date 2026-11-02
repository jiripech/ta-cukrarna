<?php
/**
 * Ta Cukrárna - SQLite Database Initialization
 *
 * One-time setup script that creates the passkeys SQLite database
 * and required tables. Safe to run multiple times (idempotent).
 *
 * Usage: php public/api/DB/init.php
 */

$db_path = __DIR__ . '/passkeys.sqlite';

echo "Initializing database at: $db_path\n";

try {
    $pdo = new PDO('sqlite:' . $db_path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create passkeys table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS passkeys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            credential_id BLOB NOT NULL UNIQUE,
            public_key BLOB NOT NULL,
            counter INTEGER NOT NULL DEFAULT 0,
            username TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_used_at TEXT,
            user_agent TEXT,
            device_info TEXT
        )
    ");
    // Add columns if they don't exist (migration for existing databases)
    $cols = $pdo->query("PRAGMA table_info(passkeys)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('user_agent', $cols)) {
        $pdo->exec("ALTER TABLE passkeys ADD COLUMN user_agent TEXT");
        echo "✓ Column 'user_agent' added to 'passkeys'\n";
    }
    if (!in_array('device_info', $cols)) {
        $pdo->exec("ALTER TABLE passkeys ADD COLUMN device_info TEXT");
        echo "✓ Column 'device_info' added to 'passkeys'\n";
    }
    echo "✓ Table 'passkeys' ready\n";

    // Create registration tokens table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS reg_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    ");
    echo "✓ Table 'reg_tokens' ready\n";

    echo "\nDatabase initialized successfully.\n";

} catch (PDOException $e) {
    echo "\n✗ Database initialization failed: " . $e->getMessage() . "\n";
    exit(1);
}
