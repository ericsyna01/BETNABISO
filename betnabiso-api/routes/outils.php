<?php
$current  = requireAuth();
$m        = method();
$db       = getDB();
$id       = $GLOBALS['path_id'] ?? param('id');
$canWrite = in_array($current['role'], ['superadmin', 'admin']);

if ($m !== 'GET' && !$canWrite) respond(403, ['error' => 'Accès refusé']);

// Auto-création table
if (DB_DRIVER === 'pgsql') {
    $db->exec('CREATE TABLE IF NOT EXISTS outils (
        id           VARCHAR(36)  PRIMARY KEY,
        label        VARCHAR(150) NOT NULL,
        description  VARCHAR(500),
        categorie    VARCHAR(100),
        type         VARCHAR(10)  NOT NULL,
        url          VARCHAR(500) NOT NULL,
        "fileName"   VARCHAR(255),
        "fileSize"   INT,
        icone        VARCHAR(50),
        ordre        INT          NOT NULL DEFAULT 0,
        "createdAt"  TIMESTAMP    NOT NULL DEFAULT NOW()
    )');
    $db->exec('ALTER TABLE outils ADD COLUMN IF NOT EXISTS categorie VARCHAR(100)');
} else {
    $db->exec("CREATE TABLE IF NOT EXISTS outils (
        id          VARCHAR(36)  PRIMARY KEY,
        label       VARCHAR(150) NOT NULL,
        description VARCHAR(500),
        categorie   VARCHAR(100),
        type        VARCHAR(10)  NOT NULL,
        url         VARCHAR(500) NOT NULL,
        fileName    VARCHAR(255),
        fileSize    INT,
        icone       VARCHAR(50),
        ordre       INT          NOT NULL DEFAULT 0,
        createdAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");
    $exists = $db->query("SHOW COLUMNS FROM outils LIKE 'categorie'")->fetch();
    if (!$exists) $db->exec('ALTER TABLE outils ADD COLUMN categorie VARCHAR(100)');
}

function formatOutil(array $o): array {
    $o = trimIds($o);
    $map = ['filename'=>'fileName','filesize'=>'fileSize','createdat'=>'createdAt'];
    $out = [];
    foreach ($o as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    if (isset($out['ordre'])) $out['ordre'] = (int)$out['ordre'];
    if (isset($out['fileSize']) && $out['fileSize'] !== null) $out['fileSize'] = (int)$out['fileSize'];
    if (!empty($out['createdAt'])) $out['createdAt'] = date('c', strtotime($out['createdAt']));
    return $out;
}

if ($m === 'GET') {
    $stmt = $db->query('SELECT * FROM outils ORDER BY categorie ASC, ordre ASC, label ASC');
    respond(200, array_map('formatOutil', $stmt->fetchAll()));
}

if ($m === 'POST') {
    // Multipart (upload de fichier) ou JSON (lien externe)
    $b     = $_POST ?: body();
    $label = trim($b['label'] ?? '');
    $type  = trim($b['type'] ?? 'lien');
    if (!$label || !in_array($type, ['lien', 'fichier'], true)) {
        respond(400, ['error' => 'Nom et type (lien|fichier) requis']);
    }

    $description = trim($b['description'] ?? '') ?: null;
    $categorie   = trim($b['categorie'] ?? '') ?: null;
    $icone       = trim($b['icone'] ?? '') ?: 'construction';
    $url = null; $fileName = null; $fileSize = null;

    if ($type === 'lien') {
        $url = trim($b['url'] ?? '');
        if (!$url) respond(400, ['error' => 'URL requise pour un lien externe']);
    } else {
        if (empty($_FILES['file'])) respond(400, ['error' => 'Fichier requis']);
        $f   = $_FILES['file'];
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        $allowed = ['exe', 'msi', 'zip', '7z', 'bat', 'cmd', 'dmg', 'pkg'];
        if (!in_array($ext, $allowed, true)) respond(400, ['error' => 'Type de fichier non autorisé']);
        if ($f['error'] !== UPLOAD_ERR_OK) respond(400, ['error' => 'Échec de l\'envoi du fichier']);
        if ($f['size'] > 100 * 1024 * 1024) respond(400, ['error' => 'Fichier trop volumineux (100 Mo max)']);

        $mediaDir = __DIR__ . '/../media/';
        if (!is_dir($mediaDir)) mkdir($mediaDir, 0755, true);
        $storedName = bin2hex(random_bytes(16)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], $mediaDir . $storedName)) {
            respond(500, ['error' => 'Échec de l\'enregistrement du fichier sur le serveur']);
        }
        $url      = '/api/media/' . $storedName;
        $fileName = $f['name'];
        $fileSize = $f['size'];
    }

    $maxOrdre = (int)$db->query('SELECT COALESCE(MAX(ordre), 0) FROM outils')->fetchColumn();
    $newId    = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO outils (id, label, description, categorie, type, url, "fileName", "fileSize", icone, ordre)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$newId, $label, $description, $categorie, $type, $url, $fileName, $fileSize, $icone, $maxOrdre + 1]);

    $stmt = $db->prepare('SELECT * FROM outils WHERE id = ?');
    $stmt->execute([$newId]);
    respond(201, formatOutil($stmt->fetch()));
}

if ($m === 'PUT' && $id) {
    $b = body(); $fields = []; $vals = [];
    $strMap = ['label' => 'label', 'description' => 'description', 'categorie' => 'categorie', 'url' => 'url', 'icone' => 'icone', 'ordre' => 'ordre'];
    foreach ($strMap as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $b)) { $fields[] = "$dbCol = ?"; $vals[] = $b[$jsKey]; }
    }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    $vals[] = $id;
    $db->prepare('UPDATE outils SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);
    $stmt = $db->prepare('SELECT * FROM outils WHERE id = ?');
    $stmt->execute([$id]);
    respond(200, formatOutil($stmt->fetch()));
}

if ($m === 'DELETE' && $id) {
    $stmt = $db->prepare('SELECT * FROM outils WHERE id = ?');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if ($existing) {
        $existing = trimIds($existing);
        $type = $existing['type'] ?? null;
        $url  = $existing['url'] ?? '';
        if ($type === 'fichier' && str_starts_with($url, '/api/media/')) {
            $path = __DIR__ . '/../media/' . basename($url);
            if (is_file($path)) @unlink($path);
        }
    }
    $db->prepare('DELETE FROM outils WHERE id = ?')->execute([$id]);
    $stmt = $db->query('SELECT * FROM outils ORDER BY categorie ASC, ordre ASC, label ASC');
    respond(200, array_map('formatOutil', $stmt->fetchAll()));
}

respond(405, ['error' => 'Méthode non autorisée']);
