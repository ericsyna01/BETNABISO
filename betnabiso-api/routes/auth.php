<?php
$m = method();
$b = body();

// Colonnes à guillemets selon le driver
$colMCP     = DB_DRIVER === 'pgsql' ? '"mustChangePassword"' : '`mustChangePassword`';
$colLLogin  = DB_DRIVER === 'pgsql' ? '"lastLogin"'          : '`lastLogin`';

if ($m === 'POST' && param('action') === 'logout') {
    $user   = requireAuth();
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? (getallheaders()['Authorization'] ?? '')
           ?? '';
    preg_match('/^Bearer\s+(.+)$/i', $header, $match);
    $token = $match[1] ?? '';
    $db    = getDB();
    if ($token) {
        $db->prepare('DELETE FROM sessions WHERE id = ?')->execute([$token]);
    }
    $db->prepare('DELETE FROM presence WHERE user_id = ?')->execute([trim($user['user_id'])]);
    respond(200, ['message' => 'Déconnecté']);
}

if ($m === 'POST' && param('action') === 'change-password') {
    $user       = requireAuth();
    $currentPwd = $b['currentPassword'] ?? '';
    $newPwd     = $b['newPassword']     ?? '';

    if (strlen($newPwd) < 6) respond(400, ['error' => 'Mot de passe trop court (minimum 6 caractères)']);

    $db   = getDB();
    $stmt = $db->prepare("SELECT password_hash, $colMCP FROM users WHERE id = ?");
    $stmt->execute([trim($user['user_id'])]);
    $row  = $stmt->fetch();

    if (!$row) respond(404, ['error' => 'Utilisateur introuvable']);

    // Vérification du mot de passe actuel seulement si ce n'est pas un changement forcé
    if (!$row['mustChangePassword'] && !password_verify($currentPwd, $row['password_hash'])) {
        respond(401, ['error' => 'Mot de passe actuel incorrect']);
    }

    $db->prepare("UPDATE users SET password_hash = ?, $colMCP = 0 WHERE id = ?")
       ->execute([password_hash($newPwd, PASSWORD_BCRYPT), trim($user['user_id'])]);
    respond(200, ['message' => 'Mot de passe mis à jour']);
}

if ($m === 'POST') {
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';
    if (!$username || !$password) respond(400, ['error' => 'Identifiants manquants']);

    $ip  = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $db  = getDB();

    $stmt = $db->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $u = $stmt->fetch();

    if (!$u) {
        recordFailedLogin($db, $ip, $username);
        respond(401, ['error' => 'Identifiants incorrects']);
    }

    if (!$u['actif']) {
        respond(403, ['error' => 'Compte bloqué après trop de tentatives. Contactez votre administrateur.']);
    }

    if (!password_verify($password, $u['password_hash'])) {
        recordFailedLogin($db, $ip, $username);
        respond(401, ['error' => 'Identifiants incorrects']);
    }

    // Succès — réinitialiser le compteur
    clearLoginAttempts($db, $ip, $username);

    $token     = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+8 hours'));
    $db->prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
       ->execute([$token, $u['id'], $expiresAt]);
    $db->prepare("UPDATE users SET $colLLogin = NOW() WHERE id = ?")->execute([$u['id']]);

    $u = trimIds($u);
    unset($u['password_hash']);
    $u['token']              = $token;
    $u['actif']              = (bool)$u['actif'];
    $u['mustChangePassword'] = (bool)($u['mustChangePassword'] ?? false);
    foreach (['createdAt', 'lastLogin'] as $f) {
        if (!empty($u[$f])) $u[$f] = date('c', strtotime($u[$f]));
    }
    respond(200, $u);
}

respond(405, ['error' => 'Méthode non autorisée']);
