<?php
$current = requireAuth();
$m       = method();

// Le dossier de stockage physique est volontairement différent du nom de la
// route API ("uploads") : nginx fait un fallback "$uri/" vers le PHP quand
// le chemin ne correspond à aucun fichier/dossier réel, mais bascule en
// listage de répertoire (403) si un dossier du même nom existe à cet endroit.
// Un dossier "media" ne peut jamais entrer en collision avec la route /api/uploads.
$uploadDir = __DIR__ . '/../media/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

if ($m === 'POST') {
    if (empty($_FILES['file'])) respond(400, ['error' => 'Aucun fichier']);
    $f    = $_FILES['file'];
    $ext  = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg','jpeg','png','gif','pdf','doc','docx','xls','xlsx','txt'];
    if (!in_array($ext, $allowed)) respond(400, ['error' => 'Type de fichier non autorisé']);
    if ($f['size'] > 5 * 1024 * 1024) respond(400, ['error' => 'Fichier trop lourd (max 5 Mo)']);

    $name = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], $uploadDir . $name)) {
        respond(500, ['error' => 'Échec de l\'enregistrement du fichier sur le serveur']);
    }

    respond(201, [
        'url'      => '/api/media/' . $name,
        'name'     => $f['name'],
        'size'     => $f['size'],
        'mimeType' => $f['type'],
        'isImage'  => in_array($ext, ['jpg','jpeg','png','gif']),
    ]);
}

respond(405, ['error' => 'Méthode non autorisée']);
