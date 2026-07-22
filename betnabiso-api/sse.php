<?php
// ── SSE — Server-Sent Events (temps réel) ────────────────────────────────────
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', false);
@ini_set('implicit_flush', true);
@ini_set('max_execution_time', 0);
ob_implicit_flush(true);
while (ob_get_level() > 0) ob_end_flush();

require_once __DIR__ . '/config.php';

header('Content-Type: text/event-stream; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('X-Accel-Buffering: no');

function sse(string $event, mixed $data): void {
    echo "event: {$event}\n";
    echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    @flush();
}

// ── Auth via ?token= ──────────────────────────────────────────────────────────
$token = trim($_GET['token'] ?? '');
if (!$token) { sse('error', ['message' => 'Token manquant']); exit; }

$db   = getDB();
$stmt = $db->prepare(
    'SELECT s.user_id, u.prenom, u.nom, u.role, u.actif
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > NOW()'
);
$stmt->execute([$token]);
$user = $stmt->fetch();

if (!$user || !$user['actif']) { sse('error', ['message' => 'Session invalide']); exit; }

sse('connected', [
    'userId' => $user['user_id'],
    'role'   => $user['role'],
    'nom'    => $user['prenom'] . ' ' . $user['nom'],
]);

// Partir 5s en arrière pour couvrir le délai entre loadFromApi() et SSE
$ago           = date('Y-m-d H:i:s', time() - 5);
$lastMaxInterv = $ago;
$lastMaxMsg    = $ago;
$lastMaxAgents = $ago;
$lastMaxNotifs = $ago;
$lastHeartbeat = time();

$isAdmin = in_array($user['role'], ['superadmin', 'admin', 'support'], true);

while (true) {
    if (@connection_aborted()) break;

    // ── Interventions (scope par rôle) ────────────────────────────────────────
    try {
        switch ($user['role']) {
            case 'technicien':
                $s = $db->prepare('SELECT MAX("updatedAt") FROM interventions WHERE "technicienId" = ?');
                $s->execute([$user['user_id']]); break;
            case 'chauffeur':
                $s = $db->prepare('SELECT MAX("updatedAt") FROM interventions WHERE "chauffeurId" = ?');
                $s->execute([$user['user_id']]); break;
            default:
                $s = $db->query('SELECT MAX("updatedAt") FROM interventions'); break;
        }
        $maxInterv = $s->fetchColumn();
        if ($maxInterv && $maxInterv > $lastMaxInterv) {
            sse('data_update', ['type' => 'interventions']);
            $lastMaxInterv = $maxInterv;
        }
    } catch (Exception $e) { }

    // ── Agents ────────────────────────────────────────────────────────────────
    try {
        $maxAgents = $db->query('SELECT MAX("updatedAt") FROM agents')->fetchColumn();
        if ($maxAgents && $maxAgents > $lastMaxAgents) {
            sse('data_update', ['type' => 'agents']);
            $lastMaxAgents = $maxAgents;
        }
    } catch (Exception $e) { }

    // ── Notifications (scope par rôle) ────────────────────────────────────────
    try {
        if ($isAdmin) {
            $s = $db->query('SELECT MAX("createdAt") FROM notifications');
        } else {
            $s = $db->prepare('SELECT MAX("createdAt") FROM notifications WHERE "userId" = ?');
            $s->execute([$user['user_id']]);
        }
        $maxNotifs = $s->fetchColumn();
        if ($maxNotifs && $maxNotifs > $lastMaxNotifs) {
            sse('data_update', ['type' => 'notifications']);
            $lastMaxNotifs = $maxNotifs;
        }
    } catch (Exception $e) { }

    // ── Messages chat ──────────────────────────────────────────────────────────
    try {
        $s = $db->prepare('SELECT MAX("createdAt") FROM messages WHERE "toId" = ?');
        $s->execute([$user['user_id']]);
        $maxMsg = $s->fetchColumn();
        if ($maxMsg && $maxMsg > $lastMaxMsg) {
            sse('new_message', ['message' => 'Nouveau message']);
            $lastMaxMsg = $maxMsg;
        }
    } catch (Exception $e) { }

    // ── Heartbeat toutes les 25s ───────────────────────────────────────────────
    if (time() - $lastHeartbeat >= 25) {
        sse('heartbeat', ['t' => time()]);
        $lastHeartbeat = time();
    }

    sleep(1);
}
