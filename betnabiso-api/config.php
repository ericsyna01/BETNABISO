<?php
// ── CORS ──────────────────────────────────────────────────────────────────────
$allowed = [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://192.168.100.137:4200',
    // TODO: ajouter le(s) domaine(s) de production BetNaBiso
];
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204); exit;
}

// ── Base de données ───────────────────────────────────────────────────────────
// Production (VPS) : MySQL  |  Local : PostgreSQL
$isLocal = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost:8888', 'localhost', '127.0.0.1', '127.0.0.1:8888'], true)
        || ($_SERVER['SERVER_ADDR'] ?? '') === '127.0.0.1';

if ($isLocal) {
    // PostgreSQL local
    define('DB_HOST', '127.0.0.1');
    define('DB_PORT', '5432');
    define('DB_NAME', 'betnabiso');
    define('DB_USER', 'mac');
    define('DB_PASS', '');
    define('DB_DRIVER', 'pgsql');
} else {
    // MySQL production (VPS)
    // Priorité à la variable d'environnement si définie (ne garde la valeur en
    // dur que comme repli, pour ne pas casser le déploiement actuel — à migrer
    // vers une vraie rotation du mot de passe + suppression du repli).
    define('DB_HOST', '127.0.0.1');
    define('DB_PORT', '3306');
    define('DB_NAME', 'betnabiso');
    define('DB_USER', getenv('DB_USER') ?: 'CHANGE_ME');   // TODO: identifiants MySQL de production BetNaBiso (ceux de l'ancien client ont été retirés)
    define('DB_PASS', getenv('DB_PASS') ?: 'CHANGE_ME');
    define('DB_DRIVER', 'mysql');
}

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        if (DB_DRIVER === 'pgsql') {
            $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', DB_HOST, DB_PORT, DB_NAME);
            $pdo = new PDO($dsn, DB_USER, DB_PASS ?: null, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            $pdo->exec("SET TIME ZONE 'UTC'");
        } else {
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            $pdo->exec("SET SQL_MODE='ANSI_QUOTES', time_zone='+00:00'");
        }
        // Auto-migration: colonne roles pour multi-profils
        try {
            if (DB_DRIVER === 'pgsql') {
                $pdo->exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT DEFAULT NULL');
            } else {
                $exists = $pdo->query("SHOW COLUMNS FROM users LIKE 'roles'")->fetch();
                if (!$exists) $pdo->exec('ALTER TABLE users ADD COLUMN roles TEXT DEFAULT NULL');
            }
        } catch (PDOException $e) {}
    }
    return $pdo;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function respond(int $code, mixed $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

function method(): string {
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

function param(string $key, mixed $default = null): mixed {
    return $_GET[$key] ?? $default;
}

// ── Notification temps réel ────────────────────────────────────────────────
// Signale au service d'événements (VPS) qu'une donnée d'un type donné a changé,
// pour que les clients connectés se mettent à jour instantanément au lieu
// d'attendre leur prochain cycle de polling. Best-effort : n'échoue jamais
// l'appelant si le service est indisponible.
function publishEvent(string $type): void {
    if ($type === 'machine_status') cacheInvalidate('hb:summary', 'hb:all');

    $payload = json_encode(['type' => $type]);
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 1,
    ]]);
    try { @file_get_contents('http://127.0.0.1:8083/publish', false, $ctx); } catch (Throwable $e) {}
}

// ── Cache Redis ───────────────────────────────────────────────────────────────
// Amortit les lectures répétées (plusieurs tableaux de bord ouverts en même
// temps) sur les requêtes les plus coûteuses. Best-effort : si Redis est
// indisponible, on retombe simplement sur une lecture base de données directe.
define('REDIS_PASS', getenv('REDIS_PASS') ?: 'CHANGE_ME');   // TODO: mot de passe Redis BetNaBiso (celui de l'ancien client a été retiré)

function getRedis(): ?Redis {
    static $redis  = null;
    static $failed = false;
    if ($failed) return null;
    if ($redis === null) {
        try {
            $redis = new Redis();
            $redis->connect('127.0.0.1', 6379, 0.5);
            $redis->auth(REDIS_PASS);
        } catch (Throwable $e) {
            $failed = true;
            return null;
        }
    }
    return $redis;
}

function cacheGet(string $key): ?array {
    $r = getRedis();
    if (!$r) return null;
    try {
        $v = $r->get($key);
        return $v !== false ? json_decode($v, true) : null;
    } catch (Throwable $e) { return null; }
}

function cacheSet(string $key, array $data, int $ttl = 5): void {
    $r = getRedis();
    if (!$r) return;
    try { $r->setex($key, $ttl, json_encode($data)); } catch (Throwable $e) {}
}

function cacheInvalidate(string ...$keys): void {
    $r = getRedis();
    if (!$r) return;
    try { foreach ($keys as $k) $r->del($k); } catch (Throwable $e) {}
}

function toTsDate(?string $val): ?string {
    if (!$val) return null;
    $ts = strtotime($val);
    return $ts !== false ? date('Y-m-d H:i:s', $ts) : null;
}

function trimIds(array $row): array {
    static $idSuffix = ['id','Id','ID'];
    foreach ($row as $k => $v) {
        if (is_string($v)) {
            foreach ($idSuffix as $s) {
                if ($k === 'id' || str_ends_with($k, 'Id') || str_ends_with($k, 'ID')) {
                    $row[$k] = rtrim($v);
                    break;
                }
            }
        }
    }
    return $row;
}

function requireRole(array $roles, array $user): void {
    $userRoles = $user['roles'] ?? [$user['role']];
    if (!array_intersect($userRoles, $roles)) {
        respond(403, ['error' => 'Accès refusé']);
    }
}

function requireAuth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? (getallheaders()['Authorization'] ?? '')
           ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        respond(401, ['error' => 'Token manquant']);
    }
    $token = $m[1];
    $db    = getDB();

    // Purge probabiliste des sessions expirées (1 chance sur 50 par requête)
    if (rand(1, 50) === 1) {
        $db->exec('DELETE FROM sessions WHERE expires_at < NOW()');
    }

    $stmt  = $db->prepare(
        'SELECT s.user_id, u.nom, u.prenom, u.role, u.roles, u.zone, u.actif
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if (!$user || !$user['actif']) {
        respond(401, ['error' => 'Session invalide ou expirée']);
    }
    $user['roles'] = !empty($user['roles'])
        ? json_decode($user['roles'], true)
        : [$user['role']];
    return $user;
}

// ── Anti-bruteforce ───────────────────────────────────────────────────────────
function ensureLoginAttemptsTable(PDO $db): void {
    if (DB_DRIVER === 'pgsql') {
        $db->exec("CREATE TABLE IF NOT EXISTS login_attempts (
            id            SERIAL PRIMARY KEY,
            ip            VARCHAR(45) NOT NULL,
            username      VARCHAR(100) NOT NULL,
            attempts      INT NOT NULL DEFAULT 1,
            blocked_until TIMESTAMP DEFAULT NULL,
            last_attempt  TIMESTAMP NOT NULL DEFAULT NOW()
        )");
    } else {
        $db->exec("CREATE TABLE IF NOT EXISTS login_attempts (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            ip            VARCHAR(45) NOT NULL,
            username      VARCHAR(100) NOT NULL,
            attempts      INT NOT NULL DEFAULT 1,
            blocked_until DATETIME DEFAULT NULL,
            last_attempt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )");
    }
}

function getLoginAttempts(PDO $db, string $ip, string $username): array {
    ensureLoginAttemptsTable($db);
    $stmt = $db->prepare(
        'SELECT * FROM login_attempts WHERE ip = ? AND username = ? LIMIT 1'
    );
    $stmt->execute([$ip, $username]);
    return $stmt->fetch() ?: [];
}

function recordFailedLogin(PDO $db, string $ip, string $username): void {
    $row = getLoginAttempts($db, $ip, $username);
    if (!$row) {
        $db->prepare('INSERT INTO login_attempts (ip, username, attempts) VALUES (?, ?, 1)')
           ->execute([$ip, $username]);
        $attempts = 1;
    } else {
        $attempts = $row['attempts'] + 1;
        $db->prepare('UPDATE login_attempts SET attempts = ?, last_attempt = NOW() WHERE ip = ? AND username = ?')
           ->execute([$attempts, $ip, $username]);
    }
    if ($attempts >= 5) {
        // Blocage temporaire de CE couple (ip, username) — jamais une
        // désactivation du compte : n'importe qui connaissant juste un nom
        // d'utilisateur valide pourrait sinon désactiver ce compte à distance
        // (y compris un admin/superadmin) en enchaînant 5 mots de passe faux,
        // sans jamais être authentifié.
        $db->prepare('UPDATE login_attempts SET blocked_until = ' . (DB_DRIVER === 'pgsql' ? "NOW() + INTERVAL '15 minutes'" : 'DATE_ADD(NOW(), INTERVAL 15 MINUTE)') . ' WHERE ip = ? AND username = ?')
           ->execute([$ip, $username]);
    }
}

/** true si ce couple (ip, username) est actuellement sous blocage temporaire. */
function isLoginBlocked(PDO $db, string $ip, string $username): bool {
    $row = getLoginAttempts($db, $ip, $username);
    return !empty($row['blocked_until']) && strtotime($row['blocked_until']) > time();
}

function clearLoginAttempts(PDO $db, string $ip, string $username): void {
    ensureLoginAttemptsTable($db);
    $db->prepare('DELETE FROM login_attempts WHERE ip = ? AND username = ?')
       ->execute([$ip, $username]);
}

function clearLoginAttemptsByUsername(PDO $db, string $username): void {
    ensureLoginAttemptsTable($db);
    $db->prepare('DELETE FROM login_attempts WHERE username = ?')->execute([$username]);
}
