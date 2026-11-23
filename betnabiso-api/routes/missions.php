<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');

// Colonnes additives : mission confiée à un binôme (deux personnes), et
// agent (point de vente) concerné, choisi dans la liste plutôt que recopié
// à la main dans le titre.
if (DB_DRIVER === 'pgsql') {
    $db->exec('ALTER TABLE missions ADD COLUMN IF NOT EXISTS "assignedToId2" VARCHAR(36)');
    $db->exec('ALTER TABLE missions ADD COLUMN IF NOT EXISTS "assignedToNom2" VARCHAR(150)');
    $db->exec('ALTER TABLE missions ADD COLUMN IF NOT EXISTS "agentId" VARCHAR(64)');
    $db->exec('ALTER TABLE missions ADD COLUMN IF NOT EXISTS "agentNom" VARCHAR(255)');
} else {
    foreach (['assignedToId2' => 'VARCHAR(36)', 'assignedToNom2' => 'VARCHAR(150)',
              'agentId' => 'VARCHAR(64)', 'agentNom' => 'VARCHAR(255)'] as $col => $def) {
        $exists = $db->query("SHOW COLUMNS FROM missions LIKE '$col'")->fetch();
        if (!$exists) $db->exec("ALTER TABLE missions ADD COLUMN \"$col\" $def");
    }
}

function fmtMission(array $r): array {
    $r = trimIds($r);
    $map = [
        'assignedtoid'  => 'assignedToId',  'assignedtonom'  => 'assignedToNom',
        'assignedtoid2' => 'assignedToId2', 'assignedtonom2' => 'assignedToNom2',
        'assignedbyid'  => 'assignedById',  'assignedbynom'  => 'assignedByNom',
        'datemission'   => 'dateMission',   'createdat'      => 'createdAt',
        'completedat'   => 'completedAt',
        'agentid'       => 'agentId',       'agentnom'       => 'agentNom',
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
        $stmt = $db->prepare('SELECT * FROM missions WHERE "assignedToId"=? OR "assignedToId2"=? ORDER BY "createdAt" DESC');
        $stmt->execute([$current['user_id'], $current['user_id']]);
    }
    respond(200, array_map('fmtMission', $stmt->fetchAll()));
}

/* ── POST ────────────────────────────────────────────────────────────────── */
if ($m === 'POST') {
    requireRole(['superadmin','admin'], $current);
    $b = body();
    $newId = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO missions (id,titre,description,type,priorite,"assignedToId","assignedToNom","assignedToId2","assignedToNom2","agentId","agentNom","assignedById","assignedByNom","dateMission",statut)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $newId, $b['titre'], $b['description'] ?? null, $b['type'] ?? 'Autre',
        $b['priorite'] ?? 'Normale', $b['assignedToId'], $b['assignedToNom'],
        $b['assignedToId2'] ?? null, $b['assignedToNom2'] ?? null,
        ($b['agentId'] ?? null) ?: null, ($b['agentNom'] ?? null) ?: null,
        $current['user_id'], $current['prenom'].' '.$current['nom'],
        $b['dateMission'] ?? date('Y-m-d'), 'assignée',
    ]);
    // Notification à la ou aux personnes assignées
    try {
        foreach (array_filter([$b['assignedToId'], $b['assignedToId2'] ?? null]) as $assigneeId) {
            $db->prepare(
                'INSERT INTO notifications (id, type, "technicienId", "requestedById", "requestedByNom", "requestedByRole", message, statut)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                bin2hex(random_bytes(16)),
                'mission_assignee',
                $assigneeId,
                $current['user_id'],
                $current['prenom'].' '.$current['nom'],
                $current['role'],
                'Nouvelle mission : '.($b['titre'] ?? 'Mission'),
                'non_lue',
            ]);
        }
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

    /* Technicien peut seulement changer le statut de ses propres missions (binôme inclus) */
    $chk = $db->prepare('SELECT "assignedToId", "assignedToId2" FROM missions WHERE id=?');
    $chk->execute([$id]);
    $row = $chk->fetch();
    if (!$row) respond(404, ['error' => 'Mission introuvable']);

    $myId = trim($current['user_id'] ?? '');
    $assignedId  = trim($row['assignedToId']  ?? $row['assignedtoid']  ?? '');
    $assignedId2 = trim($row['assignedToId2'] ?? $row['assignedtoid2'] ?? '');
    $isOwner = $assignedId === $myId || ($assignedId2 !== '' && $assignedId2 === $myId);
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

/* ── PUT : modifier les détails d'une mission (réservé admin) ─────────────── */
if ($m === 'PUT' && $id) {
    requireRole(['superadmin','admin'], $current);
    $chk = $db->prepare('SELECT statut FROM missions WHERE id=?');
    $chk->execute([$id]);
    $row = $chk->fetch();
    if (!$row) respond(404, ['error' => 'Mission introuvable']);
    if (($row['statut'] ?? '') === 'terminée') respond(400, ['error' => 'Impossible de modifier une mission terminée']);

    $b = body();
    $fields = []; $vals = [];
    $strMap = [
        'titre' => 'titre', 'description' => 'description', 'type' => 'type', 'priorite' => 'priorite',
        'assignedToId' => '"assignedToId"', 'assignedToNom' => '"assignedToNom"',
        'dateMission' => '"dateMission"',
    ];
    foreach ($strMap as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $b)) { $fields[] = "$dbCol = ?"; $vals[] = $b[$jsKey]; }
    }
    // Coéquipier : normalisé en NULL plutôt que chaîne vide quand on le retire.
    if (array_key_exists('assignedToId2', $b))  { $fields[] = '"assignedToId2" = ?';  $vals[] = $b['assignedToId2']  ?: null; }
    if (array_key_exists('assignedToNom2', $b)) { $fields[] = '"assignedToNom2" = ?'; $vals[] = $b['assignedToNom2'] ?: null; }
    if (array_key_exists('agentId', $b))        { $fields[] = '"agentId" = ?';        $vals[] = $b['agentId']        ?: null; }
    if (array_key_exists('agentNom', $b))       { $fields[] = '"agentNom" = ?';       $vals[] = $b['agentNom']       ?: null; }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    $vals[] = $id;
    $db->prepare('UPDATE missions SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);

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
