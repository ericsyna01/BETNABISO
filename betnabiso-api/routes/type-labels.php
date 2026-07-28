<?php
$m  = method();
$db = getDB();
$id = $GLOBALS['path_id'] ?? param('id');

// Auto-création table (absente du schéma initial de ce fork)
if (DB_DRIVER === 'pgsql') {
    $db->exec('CREATE TABLE IF NOT EXISTS type_labels (
        id          VARCHAR(36)  PRIMARY KEY,
        categorie   VARCHAR(20)  NOT NULL,
        label       VARCHAR(100) NOT NULL,
        icone       VARCHAR(50),
        ordre       INT          NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP    NOT NULL DEFAULT NOW(),
        UNIQUE (categorie, label)
    )');
} else {
    $db->exec("CREATE TABLE IF NOT EXISTS type_labels (
        id          VARCHAR(36)  PRIMARY KEY,
        categorie   VARCHAR(20)  NOT NULL,
        label       VARCHAR(100) NOT NULL,
        icone       VARCHAR(50),
        ordre       INT          NOT NULL DEFAULT 0,
        createdAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_type_categorie_label (categorie, label)
    )");
}

// Seed unique : table tout juste créée pour ce fork, jamais peuplée ailleurs.
// Ne s'exécute qu'une fois (se désactive dès qu'une ligne existe), pour ne
// jamais écraser des types que l'admin aurait déjà personnalisés.
if ((int)$db->query('SELECT COUNT(*) FROM type_labels')->fetchColumn() === 0) {
    $seed = [
        ['intervention', 'Prise en main',     'computer',        1],
        ['intervention', 'Diagnostic',        'search',          2],
        ['intervention', 'Configuration',     'settings',        3],
        ['intervention', 'Maintenance',       'build',           4],
        ['intervention', 'Formation',         'school',          5],
        ['intervention', 'Redéploiement',     'sync_alt',        6],
        ['intervention', 'Autre',             'help',            7],
        ['mission',      'Technique',         'build',           1],
        ['mission',      'Déplacement',       'directions_car',  2],
        ['mission',      'Formation',         'school',          3],
        ['mission',      'Administratif',     'description',     4],
        ['mission',      'Autre',             'help',            5],
        ['panne',        'Caisse',            'point_of_sale',   1],
        ['panne',        'Serveur',           'dns',             2],
        ['panne',        'Réseau / Internet', 'wifi_off',        3],
        ['panne',        'Autre',             'help',            4],
        ['panne',        'Imprimante',        'print',           5],
        ['panne',        'Lecteur code barre','qr_code_scanner', 6],
    ];
    $ins = $db->prepare('INSERT INTO type_labels (id, categorie, label, icone, ordre) VALUES (?, ?, ?, ?, ?)');
    foreach ($seed as [$cat, $label, $icone, $ordre]) {
        $ins->execute([bin2hex(random_bytes(16)), $cat, $label, $icone, $ordre]);
    }
}

function formatTypeLabel(array $t): array {
    $t = trimIds($t);
    $map = ['createdat'=>'createdAt'];
    $out = [];
    foreach ($t as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    if (isset($out['ordre'])) $out['ordre'] = (int)$out['ordre'];
    if (!empty($out['createdAt'])) $out['createdAt'] = date('c', strtotime($out['createdAt']));
    return $out;
}

if ($m === 'GET') {
    // Public : utilisé aussi par le formulaire libre-service (signalement de
    // panne), qui n'a pas de session.
    $where = []; $vals = [];
    if ($cat = param('categorie')) { $where[] = 'categorie = ?'; $vals[] = $cat; }
    $sql  = 'SELECT * FROM type_labels' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY categorie ASC, ordre ASC, label ASC';
    $stmt = $db->prepare($sql);
    $stmt->execute($vals);
    respond(200, array_map('formatTypeLabel', $stmt->fetchAll()));
}

$current = requireAuth();
if (!in_array($current['role'], ['superadmin', 'admin'])) respond(403, ['error' => 'Accès refusé']);

if ($m === 'POST') {
    $b         = body();
    $categorie = trim($b['categorie'] ?? '');
    $label     = trim($b['label'] ?? '');
    if (!in_array($categorie, ['intervention', 'mission', 'panne', 'outil'], true) || !$label) {
        respond(400, ['error' => 'Catégorie (intervention|mission|panne|outil) et label requis']);
    }
    $exists = $db->prepare('SELECT COUNT(*) FROM type_labels WHERE categorie = ? AND LOWER(label) = LOWER(?)');
    $exists->execute([$categorie, $label]);
    if ((int)$exists->fetchColumn() > 0) respond(409, ['error' => 'Ce type existe déjà dans cette catégorie']);

    $stmtMax = $db->prepare('SELECT COALESCE(MAX(ordre), 0) FROM type_labels WHERE categorie = ?');
    $stmtMax->execute([$categorie]);
    $maxOrdre = (int)$stmtMax->fetchColumn();

    $newId = bin2hex(random_bytes(16));
    $db->prepare('INSERT INTO type_labels (id, categorie, label, icone, ordre) VALUES (?, ?, ?, ?, ?)')
        ->execute([$newId, $categorie, $label, $b['icone'] ?? null, $maxOrdre + 1]);
    $stmt = $db->prepare('SELECT * FROM type_labels WHERE id = ?');
    $stmt->execute([$newId]);
    respond(201, formatTypeLabel($stmt->fetch()));
}

if ($m === 'PUT' && $id) {
    $b = body(); $fields = []; $vals = [];
    $strMap = ['label' => 'label', 'icone' => 'icone', 'ordre' => 'ordre'];
    foreach ($strMap as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $b)) { $fields[] = "$dbCol = ?"; $vals[] = $b[$jsKey]; }
    }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    if (isset($b['label'])) {
        $current2 = $db->prepare('SELECT categorie FROM type_labels WHERE id = ?');
        $current2->execute([$id]);
        $cat = $current2->fetchColumn();
        $exists = $db->prepare('SELECT COUNT(*) FROM type_labels WHERE categorie = ? AND LOWER(label) = LOWER(?) AND id != ?');
        $exists->execute([$cat, $b['label'], $id]);
        if ((int)$exists->fetchColumn() > 0) respond(409, ['error' => 'Ce type existe déjà dans cette catégorie']);
    }
    $vals[] = $id;
    $db->prepare('UPDATE type_labels SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);
    $stmt = $db->prepare('SELECT * FROM type_labels WHERE id = ?');
    $stmt->execute([$id]);
    respond(200, formatTypeLabel($stmt->fetch()));
}

if ($m === 'DELETE' && $id) {
    $db->prepare('DELETE FROM type_labels WHERE id = ?')->execute([$id]);
    $stmt = $db->query('SELECT * FROM type_labels ORDER BY categorie ASC, ordre ASC, label ASC');
    respond(200, array_map('formatTypeLabel', $stmt->fetchAll()));
}

respond(405, ['error' => 'Méthode non autorisée']);
