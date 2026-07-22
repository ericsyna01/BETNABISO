<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');

function fmtMission(array $r): array {
    $r = trimIds($r);
    $map = [
        'assignedtoid'  => 'assignedToId',  'assignedtonom'  => 'assignedToNom',
        'assignedbyid'  => 'assignedById',  'assignedbynom'  => 'assignedByNom',
        'datemission'   => 'dateMission',   'createdat'      => 'createdAt',
        'completedat'   => 'completedAt',
    ];
    $out = [];
    foreach ($r as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    foreach (['createdAt','completedAt','dateMission'] as $f) {
        if (!empty($out[$f])) $out[$f] = date('c', strtotime($out[$f]));
    }
    return $out;
}

/* ── GET ─────────────────────────────────────────────────────────────────── */
if ($m === 'GET') {
    if (in_array($current['role'], ['superadmin','admin'], true)) {
        $stmt = $db->query('SELECT * FROM missions ORDER BY "createdAt" DESC');
    } else {
        $stmt = $db->prepare('SELECT * FROM missions WHERE "assignedToId"=? ORDER BY "createdAt" DESC');
        $stmt->execute([$current['user_id']]);
    }
    respond(200, array_map('fmtMission', $stmt->fetchAll()));
}

/* ── POST ────────────────────────────────────────────────────────────────── */
if ($m === 'POST') {
    requireRole(['superadmin','admin'], $current);
    $b = body();
    $newId = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO missions (id,titre,description,type,priorite,"assignedToId","assignedToNom","assignedById","assignedByNom","dateMission",statut)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $newId, $b['titre'], $b['description'] ?? null, $b['type'] ?? 'Autre',
        $b['priorite'] ?? 'Normale', $b['assignedToId'], $b['assignedToNom'],
        $current['user_id'], $current['prenom'].' '.$current['nom'],
        $b['dateMission'] ?? date('Y-m-d'), 'assignée',
    ]);
    // Notification à la personne assignée
    try {
        $db->prepare(
            'INSERT INTO notifications (id, type, "technicienId", "requestedById", "requestedByNom", "requestedByRole", message, statut)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            bin2hex(random_bytes(16)),
            'mission_assignee',
            $b['assignedToId'],
            $current['user_id'],
            $current['prenom'].' '.$current['nom'],
            $current['role'],
            'Nouvelle mission : '.($b['titre'] ?? 'Mission'),
            'non_lue',
        ]);
    } catch (Exception $e) {}
    publishEvent('notifications');

    $stmt = $db->prepare('SELECT * FROM missions WHERE id=?');
    $stmt->execute([$newId]);
    publishEvent('missions');
    respond(201, fmtMission($stmt->fetch()));
}

/* ── PATCH ───────────────────────────────────────────────────────────────── */
if ($m === 'PATCH' && $id) {
    $b = body();
    $statut = $b['statut'] ?? null;
    $notes  = $b['notes']  ?? null;

    /* Technicien peut seulement changer le statut de ses propres missions */
    $chk = $db->prepare('SELECT "assignedToId" FROM missions WHERE id=?');
    $chk->execute([$id]);
    $row = $chk->fetch();
    if (!$row) respond(404, ['error' => 'Mission introuvable']);

    $assignedId = trim($row['assignedToId'] ?? $row['assignedtoid'] ?? '');
    $isOwner = $assignedId === trim($current['user_id'] ?? '');
    $isAdmin = in_array($current['role'], ['superadmin','admin'], true);
    if (!$isOwner && !$isAdmin) respond(403, ['error' => 'Interdit']);

    $completedAt = in_array($statut, ['terminée']) ? 'NOW()' : 'NULL';
    $db->prepare(
        "UPDATE missions SET statut=?, notes=COALESCE(?,notes), \"completedAt\"=$completedAt WHERE id=?"
    )->execute([$statut, $notes, $id]);

    $stmt = $db->prepare('SELECT * FROM missions WHERE id=?');
    $stmt->execute([$id]);
    publishEvent('missions');
    respond(200, fmtMission($stmt->fetch()));
}

/* ── DELETE ──────────────────────────────────────────────────────────────── */
if ($m === 'DELETE' && $id) {
    requireRole(['superadmin','admin'], $current);
    $db->prepare('DELETE FROM missions WHERE id=?')->execute([$id]);
    publishEvent('missions');
    respond(200, ['message' => 'Mission supprimée']);
}

respond(405, ['error' => 'Méthode non autorisée']);
