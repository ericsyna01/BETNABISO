<?php
// Le ZoneService Angular attend string[] (tableau de noms), pas des objets
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id'); // contient le nom de zone (encodé URL)

function getAllZoneNames(PDO $db): array {
    return $db->query('SELECT nom FROM zones ORDER BY nom ASC')->fetchAll(PDO::FETCH_COLUMN);
}

if ($m === 'GET') {
    respond(200, getAllZoneNames($db));
}

if ($m === 'POST') {
    requireRole(['superadmin', 'admin'], $current);
    $b   = body();
    $nom = trim($b['nom'] ?? '');
    if (!$nom) respond(400, ['error' => 'Nom requis']);
    // Vérifier si la zone existe déjà
    $exists = $db->prepare('SELECT COUNT(*) FROM zones WHERE LOWER(nom) = LOWER(?)');
    $exists->execute([$nom]);
    if ((int)$exists->fetchColumn() > 0) respond(409, ['error' => 'Zone déjà existante']);
    $newId = bin2hex(random_bytes(16));
    $db->prepare('INSERT INTO zones (id, nom) VALUES (?, ?)')->execute([$newId, $nom]);
    respond(201, getAllZoneNames($db));
}

if ($m === 'DELETE' && $id) {
    requireRole(['superadmin', 'admin'], $current);
    $nom = urldecode($id); // Le service envoie le nom encodé dans l'URL
    $db->prepare('DELETE FROM zones WHERE nom = ?')->execute([$nom]);
    respond(200, getAllZoneNames($db));
}

respond(405, ['error' => 'Méthode non autorisée']);
