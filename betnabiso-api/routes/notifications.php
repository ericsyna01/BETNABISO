<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');
$action  = param('action');

function formatNotif(array $n): array {
    $n = trimIds($n);
    $map = ['agentid'=>'agentId','agentnom'=>'agentNom',
            'interventionid'=>'interventionId',
            'requestedbyid'=>'requestedById','requestedbynom'=>'requestedByNom',
            'requestedbyrole'=>'requestedByRole','createdat'=>'createdAt'];
    $out = [];
    foreach ($n as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    if (!empty($out['createdAt'])) $out['createdAt'] = date('c', strtotime($out['createdAt']));
    return $out;
}

if ($m === 'GET') {
    if (in_array($current['role'], ['superadmin', 'admin'], true)) {
        $stmt = $db->query('SELECT * FROM notifications ORDER BY "createdAt" DESC');
    } elseif ($current['role'] === 'support') {
        /* Support : reçoit les prises en charge et les signalements libre-service des agents */
        $stmt = $db->prepare(
            'SELECT * FROM notifications WHERE type IN (?, ?) OR "requestedById" = ? ORDER BY "createdAt" DESC'
        );
        $stmt->execute(['prise_en_charge', 'signalement_panne', $current['user_id']]);
    } else {
        /* Technicien/chauffeur/admin : leurs propres notifications d'affectation
           (technicienId), leurs signalements (agentId) et ce qu'ils ont eux-mêmes déclenché */
        $stmt = $db->prepare(
            'SELECT * FROM notifications WHERE "agentId" = ? OR "technicienId" = ? OR "requestedById" = ? ORDER BY "createdAt" DESC'
        );
        $stmt->execute([$current['user_id'], $current['user_id'], $current['user_id']]);
    }
    respond(200, array_map('formatNotif', $stmt->fetchAll()));
}

if ($m === 'POST') {
    $b     = body();
    $newId = $b['id'] ?? bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO notifications (id,type,"agentId","agentNom","interventionId","requestedById","requestedByNom","requestedByRole",message,statut)
         VALUES (?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $newId, $b['type'], $b['agentId'] ?? null, $b['agentNom'] ?? null,
        $b['interventionId'] ?? null,
        $b['requestedById'] ?? null, $b['requestedByNom'] ?? null, $b['requestedByRole'] ?? null,
        $b['message'] ?? null, 'non_lue',
    ]);
    $stmt = $db->prepare('SELECT * FROM notifications WHERE id = ?');
    $stmt->execute([$newId]);
    publishEvent('notifications');
    respond(201, formatNotif($stmt->fetch()));
}

if ($m === 'PATCH') {
    if ($action === 'mark-all-lue') {
        if (in_array($current['role'], ['superadmin', 'admin'], true)) {
            $db->exec("UPDATE notifications SET statut = 'lue' WHERE statut = 'non_lue'");
        } else {
            $db->prepare("UPDATE notifications SET statut = 'lue' WHERE statut = 'non_lue' AND (\"agentId\" = ? OR \"technicienId\" = ? OR \"requestedById\" = ?)")
               ->execute([$current['user_id'], $current['user_id'], $current['user_id']]);
        }
        respond(200, ['message' => 'Notifications marquées comme lues']);
    }
    if ($id && $action === 'traitee') {
        requireRole(['superadmin', 'admin', 'support'], $current);
        $db->prepare("UPDATE notifications SET statut = 'traitée' WHERE id = ?")->execute([$id]);
        $stmt = $db->prepare('SELECT * FROM notifications WHERE id = ?');
        $stmt->execute([$id]);
        respond(200, formatNotif($stmt->fetch()));
    }
}

if ($m === 'DELETE' && $id) {
    requireRole(['superadmin', 'admin', 'support'], $current);
    $db->prepare('DELETE FROM notifications WHERE id = ?')->execute([$id]);
    respond(200, ['message' => 'Notification supprimée']);
}

respond(405, ['error' => 'Méthode non autorisée']);
