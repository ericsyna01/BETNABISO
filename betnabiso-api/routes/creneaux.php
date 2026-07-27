<?php
$current  = requireAuth();
$m        = method();
$db       = getDB();
$id       = $GLOBALS['path_id'] ?? param('id');
$canWrite = in_array($current['role'], ['superadmin', 'admin']);

if ($m !== 'GET' && !$canWrite) respond(403, ['error' => 'Accès refusé']);

// Auto-création table (absente du schéma initial de ce fork)
if (DB_DRIVER === 'pgsql') {
    $db->exec('CREATE TABLE IF NOT EXISTS creneaux (
        id             VARCHAR(36)  PRIMARY KEY,
        label          VARCHAR(100) NOT NULL UNIQUE,
        "heureDebut"   VARCHAR(8)   NOT NULL,
        "heureFin"     VARCHAR(8)   NOT NULL,
        "couleurTexte" VARCHAR(9)   NOT NULL DEFAULT \'#1565c0\',
        "couleurFond"  VARCHAR(9)   NOT NULL DEFAULT \'#e3f2fd\',
        ordre          INT          NOT NULL DEFAULT 0,
        "createdAt"    TIMESTAMP    NOT NULL DEFAULT NOW()
    )');
} else {
    $db->exec("CREATE TABLE IF NOT EXISTS creneaux (
        id           VARCHAR(36)  PRIMARY KEY,
        label        VARCHAR(100) NOT NULL UNIQUE,
        heureDebut   VARCHAR(8)   NOT NULL,
        heureFin     VARCHAR(8)   NOT NULL,
        couleurTexte VARCHAR(9)   NOT NULL DEFAULT '#1565c0',
        couleurFond  VARCHAR(9)   NOT NULL DEFAULT '#e3f2fd',
        ordre        INT          NOT NULL DEFAULT 0,
        createdAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");
}

function formatCreneau(array $c): array {
    $c = trimIds($c);
    $map = ['heuredebut'=>'heureDebut','heurefin'=>'heureFin',
            'couleurtexte'=>'couleurTexte','couleurfond'=>'couleurFond','createdat'=>'createdAt'];
    $out = [];
    foreach ($c as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    if (isset($out['ordre'])) $out['ordre'] = (int)$out['ordre'];
    if (!empty($out['createdAt'])) $out['createdAt'] = date('c', strtotime($out['createdAt']));
    return $out;
}

if ($m === 'GET') {
    $stmt = $db->query('SELECT * FROM creneaux ORDER BY ordre ASC, label ASC');
    respond(200, array_map('formatCreneau', $stmt->fetchAll()));
}

if ($m === 'POST') {
    $b     = body();
    $label = trim($b['label'] ?? '');
    if (!$label || empty($b['heureDebut']) || empty($b['heureFin'])) {
        respond(400, ['error' => 'Label, heure de début et heure de fin requis']);
    }
    $exists = $db->prepare('SELECT COUNT(*) FROM creneaux WHERE LOWER(label) = LOWER(?)');
    $exists->execute([$label]);
    if ((int)$exists->fetchColumn() > 0) respond(409, ['error' => 'Un créneau porte déjà ce nom']);

    $maxOrdre = (int)$db->query('SELECT COALESCE(MAX(ordre), 0) FROM creneaux')->fetchColumn();
    $newId    = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO creneaux (id, label, "heureDebut", "heureFin", "couleurTexte", "couleurFond", ordre)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $newId, $label, $b['heureDebut'], $b['heureFin'],
        $b['couleurTexte'] ?? '#1565c0', $b['couleurFond'] ?? '#e3f2fd',
        $maxOrdre + 1,
    ]);
    $stmt = $db->prepare('SELECT * FROM creneaux WHERE id = ?');
    $stmt->execute([$newId]);
    respond(201, formatCreneau($stmt->fetch()));
}

if ($m === 'PUT' && $id) {
    $b = body(); $fields = []; $vals = [];
    $strMap = [
        'label'=>'label', 'heureDebut'=>'"heureDebut"', 'heureFin'=>'"heureFin"',
        'couleurTexte'=>'"couleurTexte"', 'couleurFond'=>'"couleurFond"', 'ordre'=>'ordre',
    ];
    foreach ($strMap as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $b)) { $fields[] = "$dbCol = ?"; $vals[] = $b[$jsKey]; }
    }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    if (isset($b['label'])) {
        $exists = $db->prepare('SELECT COUNT(*) FROM creneaux WHERE LOWER(label) = LOWER(?) AND id != ?');
        $exists->execute([$b['label'], $id]);
        if ((int)$exists->fetchColumn() > 0) respond(409, ['error' => 'Un créneau porte déjà ce nom']);
    }
    $vals[] = $id;
    $db->prepare('UPDATE creneaux SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);
    $stmt = $db->prepare('SELECT * FROM creneaux WHERE id = ?');
    $stmt->execute([$id]);
    respond(200, formatCreneau($stmt->fetch()));
}

if ($m === 'DELETE' && $id) {
    $db->prepare('DELETE FROM creneaux WHERE id = ?')->execute([$id]);
    $stmt = $db->query('SELECT * FROM creneaux ORDER BY ordre ASC, label ASC');
    respond(200, array_map('formatCreneau', $stmt->fetchAll()));
}

respond(405, ['error' => 'Méthode non autorisée']);
