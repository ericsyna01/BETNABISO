<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');

// Rappels personnels : chaque utilisateur ne voit que les siens.
if (DB_DRIVER === 'pgsql') {
    $db->exec('CREATE TABLE IF NOT EXISTS agenda (
        id           VARCHAR(36)  PRIMARY KEY,
        "userId"     VARCHAR(36)  NOT NULL,
        titre        VARCHAR(200) NOT NULL,
        note         TEXT,
        "dateRappel" DATE         NOT NULL,
        heure        VARCHAR(5),
        fait         BOOLEAN      NOT NULL DEFAULT FALSE,
        "createdAt"  TIMESTAMP    NOT NULL DEFAULT NOW()
    )');
} else {
    $db->exec("CREATE TABLE IF NOT EXISTS agenda (
        id          VARCHAR(36)  PRIMARY KEY,
        userId      VARCHAR(36)  NOT NULL,
        titre       VARCHAR(200) NOT NULL,
        note        TEXT,
        dateRappel  DATE         NOT NULL,
        heure       VARCHAR(5),
        fait        TINYINT(1)   NOT NULL DEFAULT 0,
        createdAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");
}

function fmtAgenda(array $r): array {
    $r = trimIds($r);
    $map = ['userid' => 'userId', 'daterappel' => 'dateRappel', 'createdat' => 'createdAt'];
    $out = [];
    foreach ($r as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    $out['fait'] = (bool)($out['fait'] ?? false);
    if (!empty($out['dateRappel'])) $out['dateRappel'] = date('Y-m-d', strtotime($out['dateRappel']));
    if (!empty($out['createdAt']))  $out['createdAt']  = date('c', strtotime($out['createdAt']));
    return $out;
}

/* ── GET : uniquement les rappels de l'utilisateur courant ─────────────────── */
if ($m === 'GET') {
    $stmt = $db->prepare('SELECT * FROM agenda WHERE "userId"=? ORDER BY "dateRappel" ASC, heure ASC');
    $stmt->execute([$current['user_id']]);
    respond(200, array_map('fmtAgenda', $stmt->fetchAll()));
}

/* ── POST ────────────────────────────────────────────────────────────────── */
if ($m === 'POST') {
    $b = body();
    $titre = trim($b['titre'] ?? '');
    if (!$titre || empty($b['dateRappel'])) respond(400, ['error' => 'Titre et date requis']);

    $newId = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO agenda (id, "userId", titre, note, "dateRappel", heure, fait)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $newId, $current['user_id'], $titre, $b['note'] ?? null,
        $b['dateRappel'], $b['heure'] ?? null, 0,
    ]);
    $stmt = $db->prepare('SELECT * FROM agenda WHERE id=?');
    $stmt->execute([$newId]);
    respond(201, fmtAgenda($stmt->fetch()));
}

/* ── PUT : modifier / marquer fait (propriétaire uniquement) ──────────────── */
if ($m === 'PUT' && $id) {
    $chk = $db->prepare('SELECT "userId" FROM agenda WHERE id=?');
    $chk->execute([$id]);
    $row = $chk->fetch();
    if (!$row) respond(404, ['error' => 'Rappel introuvable']);
    $ownerId = trim($row['userId'] ?? $row['userid'] ?? '');
    if ($ownerId !== trim($current['user_id'] ?? '')) respond(403, ['error' => 'Interdit']);

    $b = body();
    $fields = []; $vals = [];
    $strMap = ['titre' => 'titre', 'note' => 'note', 'dateRappel' => '"dateRappel"', 'heure' => 'heure'];
    foreach ($strMap as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $b)) { $fields[] = "$dbCol = ?"; $vals[] = $b[$jsKey]; }
    }
    if (array_key_exists('fait', $b)) { $fields[] = 'fait = ?'; $vals[] = (int)(bool)$b['fait']; }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    $vals[] = $id;
    $db->prepare('UPDATE agenda SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);

    $stmt = $db->prepare('SELECT * FROM agenda WHERE id=?');
    $stmt->execute([$id]);
    respond(200, fmtAgenda($stmt->fetch()));
}

/* ── DELETE (propriétaire uniquement) ──────────────────────────────────────── */
if ($m === 'DELETE' && $id) {
    $chk = $db->prepare('SELECT "userId" FROM agenda WHERE id=?');
    $chk->execute([$id]);
    $row = $chk->fetch();
    if (!$row) respond(404, ['error' => 'Rappel introuvable']);
    $ownerId = trim($row['userId'] ?? $row['userid'] ?? '');
    if ($ownerId !== trim($current['user_id'] ?? '')) respond(403, ['error' => 'Interdit']);

    $db->prepare('DELETE FROM agenda WHERE id=?')->execute([$id]);
    $stmt = $db->prepare('SELECT * FROM agenda WHERE "userId"=? ORDER BY "dateRappel" ASC, heure ASC');
    $stmt->execute([$current['user_id']]);
    respond(200, array_map('fmtAgenda', $stmt->fetchAll()));
}

respond(405, ['error' => 'Méthode non autorisée']);
