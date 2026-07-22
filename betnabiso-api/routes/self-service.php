<?php
// ── Signalement libre-service ────────────────────────────────────────────────
// Route publique, volontairement SANS requireAuth() : un agent/site qui ne
// parvient pas à joindre le support par téléphone doit pouvoir signaler une
// panne directement, via un lien unique par agent (public_token), sans avoir
// à se connecter à l'application.
$m     = method();
$token = $GLOBALS['path_id'] ?? param('token');
$db    = getDB();

if (!$token) respond(400, ['error' => 'Lien invalide']);

$stmt = $db->prepare('SELECT id, "nomAgent", zone FROM agents WHERE public_token = ?');
$stmt->execute([$token]);
$agent = $stmt->fetch();
if (!$agent) respond(404, ['error' => 'Lien invalide ou expiré']);

if ($m === 'GET') {
    respond(200, ['id' => trim($agent['id']), 'nomAgent' => $agent['nomAgent'], 'zone' => $agent['zone']]);
}

if ($m === 'POST') {
    // Anti-abus : max 3 signalements par lien toutes les 10 minutes.
    $redis = getRedis();
    if ($redis) {
        try {
            $rlKey = "ss:rl:$token";
            $count = $redis->incr($rlKey);
            if ($count === 1) $redis->expire($rlKey, 600);
            if ($count > 3) respond(429, ['error' => 'Trop de signalements, réessayez plus tard']);
        } catch (Throwable $e) {}
    }

    // Le formulaire envoie un multipart/form-data quand une photo est jointe,
    // donc on lit $_POST (fonctionne aussi bien pour form-urlencoded) plutôt
    // que body() qui ne lit que du JSON brut.
    $b         = $_POST ?: body();
    $typePanne = trim($b['type'] ?? '');
    $desc      = trim($b['description'] ?? '');
    $contact   = trim($b['contactNom'] ?? '');
    $numero    = trim($b['contactNumero'] ?? '');

    if (!in_array($typePanne, ['Caisse', 'Serveur', 'Réseau', 'Autre'], true)) {
        respond(400, ['error' => 'Type de panne invalide']);
    }
    if ($desc === '' || mb_strlen($desc) > 500) {
        respond(400, ['error' => 'Description requise (500 caractères max)']);
    }
    $contact = mb_substr($contact, 0, 100);
    $numero  = mb_substr($numero, 0, 30);

    // Photo optionnelle : jointe pour donner un aperçu visuel de la panne au
    // technicien qui sera assigné. Stockée dans "media" (jamais "uploads",
    // qui entre en collision avec la route API du même nom côté nginx).
    // Toute erreur est signalée explicitement plutôt que d'envoyer le
    // signalement en silence sans la photo (ce qui trompait l'agent avant).
    $photoUrl = null;
    if (!empty($_FILES['photo'])) {
        $f = $_FILES['photo'];
        if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
            respond(400, ['error' => 'Photo trop volumineuse (15 Mo max)']);
        }
        if ($f['error'] !== UPLOAD_ERR_OK) {
            respond(400, ['error' => 'Échec de l\'envoi de la photo, réessayez']);
        }
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
            respond(400, ['error' => 'Format de photo non supporté']);
        }
        if ($f['size'] > 5 * 1024 * 1024) {
            respond(400, ['error' => 'Photo trop volumineuse (5 Mo max)']);
        }
        $mediaDir = __DIR__ . '/../media/';
        if (!is_dir($mediaDir)) mkdir($mediaDir, 0755, true);
        $name = bin2hex(random_bytes(16)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], $mediaDir . $name)) {
            respond(500, ['error' => 'Échec de l\'enregistrement de la photo sur le serveur']);
        }
        $photoUrl = '/api/media/' . $name;
    }

    $message = "Panne signalée ($typePanne) : $desc";
    if ($contact || $numero) $message .= " — contact sur place : " . trim("$contact $numero");

    $db->prepare(
        'INSERT INTO notifications (id,type,"agentId","agentNom","requestedByNom","requestedByRole",message,statut,photoUrl)
         VALUES (?,?,?,?,?,?,?,?,?)'
    )->execute([
        bin2hex(random_bytes(16)),
        'signalement_panne',
        trim($agent['id']), $agent['nomAgent'],
        $contact ?: null, 'agent',
        $message, 'non_lue', $photoUrl,
    ]);
    publishEvent('notifications');
    respond(201, ['status' => 'ok']);
}

respond(405, ['error' => 'Méthode non autorisée']);
