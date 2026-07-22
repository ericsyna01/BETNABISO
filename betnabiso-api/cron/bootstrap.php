<?php
/**
 * Bootstrap commun pour les scripts cron.
 * Sécurité : n'accepte que les appels CLI ou les requêtes HTTP avec le bon token.
 */

define('CRON_SECRET', 'amabel_cron_k9x2mP7qLvN3');   // ← changer en prod si besoin
define('LOG_FILE',    __DIR__ . '/cron.log');

// ── Sécurité ──────────────────────────────────────────────────────────────────
$isCli  = (php_sapi_name() === 'cli');
$token  = $_GET['token'] ?? (getenv('CRON_TOKEN') ?: '');
$validHttp = hash_equals(CRON_SECRET, $token);

if (!$isCli && !$validHttp) {
    http_response_code(403);
    exit("Accès refusé\n");
}

// ── Logging ───────────────────────────────────────────────────────────────────
function cronLog(string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    if (php_sapi_name() === 'cli') echo $line;
}

// ── Connexion DB ──────────────────────────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=betnabiso;charset=utf8mb4';
        $pdo = new PDO($dsn, 'betnabiso_app', 'Vps_Migration_2026!Secure', [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $pdo->exec("SET SQL_MODE='ANSI_QUOTES', time_zone='+00:00'");
    }
    return $pdo;
}
