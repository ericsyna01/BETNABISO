<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');
$action  = param('action');

function formatUser(array $u): array {
    $u = trimIds($u);
    unset($u['password_hash']);
    $u['actif']              = (bool)$u['actif'];
    $u['mustChangePassword'] = (bool)$u['mustChangePassword'];
    foreach (['createdAt', 'lastLogin'] as $f) {
        if (!empty($u[$f])) $u[$f] = date('c', strtotime($u[$f]));
    }
    $u['roles'] = !empty($u['roles'])
        ? json_decode($u['roles'], true)
        : [$u['role']];
    return $u;
}

if ($m === 'GET') {
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $u = $stmt->fetch();
        if (!$u) respond(404, ['error' => 'Utilisateur non trouvé']);
        respond(200, formatUser($u));
    }
    $role = param('role');
    if ($role) {
        $stmt = $db->prepare('SELECT * FROM users WHERE role = ? ORDER BY nom, prenom');
        $stmt->execute([$role]);
    } else {
        $stmt = $db->query('SELECT * FROM users ORDER BY nom, prenom');
    }
    respond(200, array_map('formatUser', $stmt->fetchAll()));
}

if ($m === 'POST') {
    requireRole(['superadmin', 'admin'], $current);
    $b = body();
    foreach (['nom','prenom','username','role'] as $req) {
        if (empty($b[$req])) respond(400, ['error' => "Champ requis: $req"]);
    }
    $roles = !empty($b['roles']) && is_array($b['roles']) ? $b['roles'] : [$b['role']];
    if (!in_array($b['role'], $roles)) $roles[] = $b['role'];
    $newId = $b['id'] ?? bin2hex(random_bytes(16));
    $mcp = DB_DRIVER === 'pgsql' ? '"mustChangePassword"' : '`mustChangePassword`';
    $db->prepare(
        "INSERT INTO users (id,nom,prenom,email,username,password_hash,role,roles,zone,actif,$mcp)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    )->execute([
        $newId,
        $b['nom'], $b['prenom'], $b['email'] ?? null, $b['username'],
        password_hash($b['password'] ?? 'changeme', PASSWORD_BCRYPT),
        $b['role'], json_encode($roles), $b['zone'] ?? null,
        isset($b['actif']) ? (int)$b['actif'] : 1,
        isset($b['mustChangePassword']) ? (int)$b['mustChangePassword'] : 1,
    ]);
    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$newId]);
    respond(201, formatUser($stmt->fetch()));
}

if ($m === 'PUT' && $id) {
    requireRole(['superadmin', 'admin'], $current);
    $b = body(); $fields = []; $vals = [];
    foreach (['nom','prenom','email','username','role','zone'] as $f) {
        if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if (array_key_exists('roles', $b) && is_array($b['roles'])) {
        $roles = $b['roles'];
        if (!empty($b['role']) && !in_array($b['role'], $roles)) $roles[] = $b['role'];
        $fields[] = 'roles = ?'; $vals[] = json_encode($roles);
    }
    if (array_key_exists('actif', $b))              { $fields[] = 'actif = ?';               $vals[] = (int)$b['actif']; }
    if (array_key_exists('mustChangePassword', $b)) { $mcpCol = DB_DRIVER === 'pgsql' ? '"mustChangePassword"' : '`mustChangePassword`'; $fields[] = "$mcpCol = ?"; $vals[] = (int)$b['mustChangePassword']; }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    $vals[] = $id;
    $db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);
    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$id]);
    respond(200, formatUser($stmt->fetch()));
}

if ($m === 'PATCH' && $id) {
    $b = body();
    if ($action === 'toggle-active') {
        requireRole(['superadmin', 'admin'], $current);
        $db->prepare('UPDATE users SET actif = CASE WHEN actif = 1 THEN 0 ELSE 1 END WHERE id = ?')->execute([$id]);
        // Si réactivation, effacer les tentatives de connexion échouées
        $uRow = $db->prepare('SELECT username, actif FROM users WHERE id = ?');
        $uRow->execute([$id]);
        $uData = $uRow->fetch();
        if ($uData && $uData['actif']) {
            clearLoginAttemptsByUsername($db, $uData['username']);
        }
        $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        respond(200, formatUser($stmt->fetch()));
    }
    if ($action === 'set-password') {
        if ($id !== $current['user_id']) requireRole(['superadmin', 'admin'], $current);
        $pwd = $b['password'] ?? '';
        if (!$pwd) respond(400, ['error' => 'Mot de passe manquant']);
        $col = DB_DRIVER === 'pgsql' ? '"mustChangePassword"' : '`mustChangePassword`';
        $forcePwdChange = ($current['role'] === 'superadmin') ? 0 : 1;
        $db->prepare("UPDATE users SET password_hash = ?, $col = ? WHERE id = ?")
           ->execute([password_hash($pwd, PASSWORD_BCRYPT), $forcePwdChange, $id]);
        respond(200, ['message' => 'Mot de passe réinitialisé']);
    }
}

if ($m === 'DELETE' && $id) {
    requireRole(['superadmin'], $current);
    $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    respond(200, ['message' => 'Utilisateur supprimé']);
}

respond(405, ['error' => 'Méthode non autorisée']);
