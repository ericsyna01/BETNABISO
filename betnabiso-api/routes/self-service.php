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

// Migration défensive : colonne ajoutée après la mise en prod initiale de la table.
try {
    if (DB_DRIVER === 'pgsql') {
        $db->exec('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "audioUrl" VARCHAR(255)');
    } else {
        $exists = $db->query("SHOW COLUMNS FROM notifications LIKE 'audioUrl'")->fetch();
        if (!$exists) $db->exec('ALTER TABLE notifications ADD COLUMN audioUrl VARCHAR(255)');
    }
} catch (Throwable $e) {}

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

    if ($typePanne === '' || mb_strlen($typePanne) > 50) {
        respond(400, ['error' => 'Type de panne invalide']);
    }
    if (mb_strlen($desc) > 500) {
        respond(400, ['error' => 'Description trop longue (500 caractères max)']);
    }
    // La description écrite n'est obligatoire que si aucun message vocal n'est
    // joint : certains agents ne sont pas à l'aise à l'écrit et préfèrent décrire
    // la panne à voix haute plutôt que de ne rien pouvoir signaler du tout.
    if ($desc === '' && empty($_FILES['audio'])) {
        respond(400, ['error' => 'Décrivez le problème par écrit ou par message vocal']);
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

    // Message vocal optionnel : alternative à la description écrite pour un agent
    // qui ne se sent pas à l'aise pour décrire la panne par texte.
    $audioUrl = null;
    if (!empty($_FILES['audio'])) {
        $f = $_FILES['audio'];
        if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
            respond(400, ['error' => 'Message vocal trop volumineux (10 Mo max)']);
        }
        if ($f['error'] !== UPLOAD_ERR_OK) {
            respond(400, ['error' => 'Échec de l\'envoi du message vocal, réessayez']);
        }
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['webm', 'mp4', 'm4a', 'ogg', 'wav', 'mp3', 'aac'], true)) {
            respond(400, ['error' => 'Format de message vocal non supporté']);
        }
        if ($f['size'] > 10 * 1024 * 1024) {
            respond(400, ['error' => 'Message vocal trop volumineux (10 Mo max)']);
        }
        $mediaDir = __DIR__ . '/../media/';
        if (!is_dir($mediaDir)) mkdir($mediaDir, 0755, true);
        $name = bin2hex(random_bytes(16)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], $mediaDir . $name)) {
            respond(500, ['error' => 'Échec de l\'enregistrement du message vocal sur le serveur']);
        }
        $audioUrl = '/api/media/' . $name;
    }

    $message = $desc !== ''
        ? "Panne signalée ($typePanne) : $desc"
        : "Panne signalée ($typePanne) — message vocal joint (aucune description écrite)";
    if ($audioUrl && $desc !== '') $message .= ' [+ message vocal joint]';
    if ($contact || $numero) $message .= " — contact sur place : " . trim("$contact $numero");

    $db->prepare(
        'INSERT INTO notifications (id,type,"agentId","agentNom","requestedByNom","requestedByRole",message,statut,photoUrl,audioUrl)
         VALUES (?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        bin2hex(random_bytes(16)),
        'signalement_panne',
        trim($agent['id']), $agent['nomAgent'],
        $contact ?: null, 'agent',
        $message, 'non_lue', $photoUrl, $audioUrl,
    ]);
    publishEvent('notifications');
    respond(201, ['status' => 'ok']);
}

respond(405, ['error' => 'Méthode non autorisée']);
