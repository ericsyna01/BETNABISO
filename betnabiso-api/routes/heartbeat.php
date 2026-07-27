<?php
const HB_OFFLINE_THRESHOLD = 60;  // secondes sans nouvelle donnee avant de considerer une machine hors ligne
const HB_POLL_IDLE         = 120; // intervalle (s) demande aux clients legacy pas encore migres au WebSocket

$m = method();
$b  = body();
$db = getDB();

// Auto-création table machine_status
if (DB_DRIVER === 'pgsql') {
    $db->exec("CREATE TABLE IF NOT EXISTS machine_status (
        id                  SERIAL PRIMARY KEY,
        agent_id            VARCHAR(100) NOT NULL,
        type                VARCHAR(20)  NOT NULL,
        first_seen          TIMESTAMP    NOT NULL DEFAULT NOW(),
        last_seen           TIMESTAMP    NOT NULL DEFAULT NOW(),
        ip                  VARCHAR(45),
        ip_change_count     INT          NOT NULL DEFAULT 0,
        last_ip_change_at   TIMESTAMP    DEFAULT NULL,
        duplicate_suspected BOOLEAN      NOT NULL DEFAULT FALSE,
        offline_alerted_at  TIMESTAMP    DEFAULT NULL,
        UNIQUE (agent_id, type)
    )");
    $db->exec('ALTER TABLE machine_status ADD COLUMN IF NOT EXISTS first_seen TIMESTAMP NOT NULL DEFAULT NOW()');
    $db->exec('ALTER TABLE machine_status ADD COLUMN IF NOT EXISTS ip_change_count INT NOT NULL DEFAULT 0');
    $db->exec('ALTER TABLE machine_status ADD COLUMN IF NOT EXISTS last_ip_change_at TIMESTAMP DEFAULT NULL');
    $db->exec('ALTER TABLE machine_status ADD COLUMN IF NOT EXISTS duplicate_suspected BOOLEAN NOT NULL DEFAULT FALSE');
    $db->exec('ALTER TABLE machine_status ADD COLUMN IF NOT EXISTS offline_alerted_at TIMESTAMP DEFAULT NULL');
    $db->exec('ALTER TABLE machine_status ADD COLUMN IF NOT EXISTS online_since TIMESTAMP DEFAULT NOW()');
} else {
    $db->exec("CREATE TABLE IF NOT EXISTS machine_status (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        agent_id            VARCHAR(100) NOT NULL,
        type                VARCHAR(20)  NOT NULL,
        first_seen          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip                  VARCHAR(45),
        ip_change_count     INT          NOT NULL DEFAULT 0,
        last_ip_change_at   DATETIME     DEFAULT NULL,
        duplicate_suspected TINYINT(1)   NOT NULL DEFAULT 0,
        offline_alerted_at  DATETIME     DEFAULT NULL,
        UNIQUE KEY uq_agent_type (agent_id, type)
    )");
    foreach (['first_seen' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'ip_change_count' => 'INT NOT NULL DEFAULT 0', 'last_ip_change_at' => 'DATETIME DEFAULT NULL', 'duplicate_suspected' => 'TINYINT(1) NOT NULL DEFAULT 0', 'offline_alerted_at' => 'DATETIME DEFAULT NULL'] as $col => $def) {
        $exists = $db->query("SHOW COLUMNS FROM machine_status LIKE '$col'")->fetch();
        if (!$exists) $db->exec("ALTER TABLE machine_status ADD COLUMN $col $def");
    }
}

// ── POST : synchronisation groupée depuis le service de présence (VPS WebSocket) ──
// Une seule requête, quel que soit le nombre de machines connectées en direct.
// La détection de doublon (même agent connecté depuis deux IP différentes) est
// calculée côté service de présence ; on se contente ici de stocker le résultat.
if ($m === 'POST' && param('action') === 'bulk-sync') {
    $key = $b['key'] ?? '';
    if ($key !== 'AMBT2026!HB') {
        respond(403, ['error' => 'Clé invalide']);
    }
    $online = $b['online'] ?? [];
    if (!is_array($online)) {
        respond(400, ['error' => 'Paramètres invalides']);
    }

    $updated = 0;
    foreach ($online as $entry) {
        $agentId = trim($entry['agentId'] ?? '');
        $type    = $entry['type'] ?? '';
        $ip      = $entry['ip'] ?? '0.0.0.0';
        $dup     = !empty($entry['duplicateSuspected']);
        if (!$agentId || !in_array($type, ['caisse', 'serveur'], true)) continue;

        try {
            $r = $db->prepare("SELECT id FROM agents WHERE id = ? OR identifiant = ? LIMIT 1");
            $r->execute([$agentId, $agentId]);
            $found = $r->fetch();
            if ($found) $agentId = $found['id'];
        } catch (Exception $e) { /* agents table indisponible → on garde l'id tel quel */ }

        if (DB_DRIVER === 'pgsql') {
            // online_since ne recule que si la machine avait dépassé le seuil hors-ligne
            // depuis son dernier ping : ça marque le début d'une nouvelle session continue
            // plutôt que la première connexion jamais vue (first_seen).
            $db->prepare(
                "INSERT INTO machine_status (agent_id, type, first_seen, last_seen, online_since, ip, duplicate_suspected)
                 VALUES (?, ?, NOW(), NOW(), NOW(), ?, ?)
                 ON CONFLICT (agent_id, type) DO UPDATE SET
                    online_since = CASE WHEN EXTRACT(EPOCH FROM (NOW() - machine_status.last_seen)) > " . HB_OFFLINE_THRESHOLD . "
                                        THEN NOW() ELSE machine_status.online_since END,
                    last_seen = NOW(), ip = EXCLUDED.ip,
                    duplicate_suspected = EXCLUDED.duplicate_suspected,
                    offline_alerted_at = NULL"
            )->execute([$agentId, $type, $ip, $dup ? 't' : 'f']);
        } else {
            $db->prepare(
                "INSERT INTO machine_status (agent_id, type, first_seen, last_seen, online_since, ip, duplicate_suspected)
                 VALUES (?, ?, NOW(), NOW(), NOW(), ?, ?)
                 ON DUPLICATE KEY UPDATE
                    online_since = IF(TIMESTAMPDIFF(SECOND, last_seen, NOW()) > " . HB_OFFLINE_THRESHOLD . ", NOW(), online_since),
                    last_seen = NOW(), ip = VALUES(ip),
                    duplicate_suspected = VALUES(duplicate_suspected),
                    offline_alerted_at = NULL"
            )->execute([$agentId, $type, $ip, $dup ? 1 : 0]);
        }
        $updated++;
    }
    if ($updated > 0) publishEvent('machine_status');
    respond(200, ['status' => 'ok', 'updated' => $updated]);
}

// ── POST : ping legacy (clients pas encore migrés vers le service de présence) ──
// N'écrit plus en base : le bulk-sync du VPS est désormais la seule source de vérité
// pour le statut. On répond juste pour que le client legacy espace ses tentatives.
if ($m === 'POST') {
    $key     = $b['key']     ?? '';
    $agentId = trim($b['agentId'] ?? '');
    $type    = $b['type']    ?? '';

    if ($key !== 'AMBT2026!HB') {
        respond(403, ['error' => 'Clé invalide']);
    }
    if (!$agentId || !in_array($type, ['caisse', 'serveur'], true)) {
        respond(400, ['error' => 'Paramètres invalides']);
    }
    if (strcasecmp($agentId, 'REMPLACER_ICI') === 0) {
        respond(400, ['error' => "AGENT_ID non configuré : ouvrir le fichier .bat et remplacer REMPLACER_ICI par l'identifiant réel de l'agent"]);
    }

    // Log temporaire pour identifier quelles machines legacy pingent encore, le temps de la migration.
    @file_put_contents(
        __DIR__ . '/../legacy_pings.log',
        date('Y-m-d H:i:s') . " ip={$_SERVER['REMOTE_ADDR']} agentId=$agentId type=$type\n",
        FILE_APPEND
    );

    respond(200, ['status' => 'inactive', 'nextPollSeconds' => HB_POLL_IDLE]);
}

// ── GET /heartbeat/summary : comptage global ──────────────────────────────────
if ($m === 'GET' && ($GLOBALS['path_id'] ?? '') === 'summary') {
    requireAuth();
    if ($cached = cacheGet('hb:summary')) respond(200, $cached);

    $seuil    = date('Y-m-d H:i:s', time() - HB_OFFLINE_THRESHOLD);
    $seuil24h = date('Y-m-d H:i:s', time() - 86400);
    $stmt  = $db->prepare(
        "SELECT
           SUM(CASE WHEN type='caisse'  AND last_seen >= ? THEN 1 ELSE 0 END) AS caisse_online,
           SUM(CASE WHEN type='serveur' AND last_seen >= ? THEN 1 ELSE 0 END) AS serveur_online,
           COUNT(DISTINCT agent_id) AS total_monitored,
           SUM(CASE WHEN duplicate_suspected THEN 1 ELSE 0 END) AS duplicates_suspected,
           COUNT(DISTINCT CASE WHEN last_seen >= ? AND online_since <= ? THEN agent_id END) AS long_online_agents
         FROM machine_status"
    );
    $stmt->execute([$seuil, $seuil, $seuil, $seuil24h]);
    $r = $stmt->fetch(PDO::FETCH_ASSOC);
    $data = [
        'caisseOnline'        => (int)($r['caisse_online']         ?? 0),
        'serveurOnline'       => (int)($r['serveur_online']        ?? 0),
        'totalMonitored'      => (int)($r['total_monitored']       ?? 0),
        'duplicatesSuspected' => (int)($r['duplicates_suspected']  ?? 0),
        'longOnlineAgents'    => (int)($r['long_online_agents']    ?? 0),
    ];
    cacheSet('hb:summary', $data, 5);
    respond(200, $data);
}

// ── GET /heartbeat/all : statut de toutes les machines ───────────────────────
if ($m === 'GET' && ($GLOBALS['path_id'] ?? '') === 'all') {
    requireAuth();
    if ($cached = cacheGet('hb:all')) respond(200, $cached);

    $stmt = $db->query("SELECT agent_id, type, first_seen, last_seen, online_since, ip, duplicate_suspected FROM machine_status");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    foreach ($rows as $row) {
        $aid       = $row['agent_id'];
        $lastTs    = strtotime($row['last_seen']);
        $firstTs   = strtotime($row['first_seen']);
        $onlineTs  = strtotime($row['online_since']);
        $diff      = time() - $lastTs;
        $online    = $diff < HB_OFFLINE_THRESHOLD;
        if (!isset($result[$aid])) $result[$aid] = ['caisse' => null, 'serveur' => null];
        $result[$aid][$row['type']] = [
            'online'             => $online,
            'minutesAgo'         => (int)floor($diff / 60),
            'ip'                 => $row['ip'],
            'duplicateSuspected' => (bool)$row['duplicate_suspected'],
            // Incoherent pour les agents migres (colonne ajoutee apres leur premier ping reel) → on cache
            'firstSeen'          => $firstTs <= $lastTs ? date('c', $firstTs) : null,
            // Duree de la session en cours (reinitialisee des qu'un ping arrive apres une coupure) ;
            // n'a de sens que si la machine est actuellement en ligne.
            'onlineSince'        => ($online && $onlineTs <= $lastTs) ? date('c', $onlineTs) : null,
        ];
    }
    cacheSet('hb:all', $result, 5);
    respond(200, $result);
}

// ── GET /heartbeat/{agentId} : statut d'un agent ─────────────────────────────
if ($m === 'GET') {
    requireAuth();
    $agentId = $GLOBALS['path_id'] ?? param('agentId');
    if (!$agentId) respond(400, ['error' => 'agentId requis']);

    $stmt = $db->prepare("SELECT type, first_seen, last_seen, online_since, ip, duplicate_suspected FROM machine_status WHERE agent_id = ?");
    $stmt->execute([$agentId]);
    $rows = $stmt->fetchAll();

    $seuil = HB_OFFLINE_THRESHOLD;
    $result = ['caisse' => null, 'serveur' => null];

    foreach ($rows as $row) {
        $ts       = strtotime($row['last_seen']);
        $firstTs  = strtotime($row['first_seen']);
        $onlineTs = strtotime($row['online_since']);
        $diff     = time() - $ts;
        $online   = $diff < $seuil;
        $result[$row['type']] = [
            'online'             => $online,
            'lastSeen'           => date('c', $ts),
            'minutesAgo'         => (int)floor($diff / 60),
            'ip'                 => $row['ip'],
            'duplicateSuspected' => (bool)$row['duplicate_suspected'],
            // Incoherent pour les agents migres (colonne ajoutee apres leur premier ping reel) → on cache
            'firstSeen'          => $firstTs <= $ts ? date('c', $firstTs) : null,
            'onlineSince'        => ($online && $onlineTs <= $ts) ? date('c', $onlineTs) : null,
        ];
    }

    respond(200, $result);
}

// ── GET /heartbeat (tous les agents) ─────────────────────────────────────────
respond(405, ['error' => 'Méthode non autorisée']);
