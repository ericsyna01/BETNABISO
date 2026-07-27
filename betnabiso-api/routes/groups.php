<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? null;
$action  = param('action');
$myId    = trim($current['user_id']);

function parseMembers($raw): array {
    if (is_array($raw)) return array_map('trim', $raw);
    if (!$raw) return [];
    return array_map('trim', explode(',', trim((string)$raw, '{}')));
}

function formatGroup(array $g): array {
    $g['id'] = trim($g['id'] ?? '');
    $map = ['createdbuid'=>'createdById','createdbynom'=>'createdByNom','createdat'=>'createdAt'];
    $out = [];
    foreach ($g as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    if (!empty($out['createdAt'])) $out['createdAt'] = date('c', strtotime($out['createdAt']));
    $out['members'] = parseMembers($out['members'] ?? '');
    if (isset($out['createdById'])) $out['createdById'] = trim($out['createdById']);
    return $out;
}

function formatGroupMsg(array $msg): array {
    $map = ['fromid'=>'fromId','fromnom'=>'fromNom','fromrole'=>'fromRole',
            'groupid'=>'groupId','createdat'=>'createdAt'];
    $out = [];
    foreach ($msg as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    $out['id']      = trim($out['id'] ?? '');
    $out['fromId']  = trim($out['fromId'] ?? '');
    $out['groupId'] = trim($out['groupId'] ?? '');
    if (!empty($out['createdAt'])) $out['createdAt'] = date('c', strtotime($out['createdAt']));
    $out['attachment'] = !empty($out['attachment']) ? json_decode($out['attachment'], true) : null;
    return $out;
}

// GET /groups — liste des groupes de l'utilisateur courant
if ($m === 'GET' && !$id) {
    $stmt = $db->prepare(
        "SELECT g.id, g.name,
                trim(g.\"createdById\") AS \"createdById\",
                g.\"createdByNom\",
                g.\"createdAt\",
                STRING_AGG(TRIM(m.\"userId\"), ',') AS members
         FROM chat_groups g
         JOIN chat_group_members m ON m.\"groupId\" = g.id
         WHERE g.id IN (
             SELECT \"groupId\" FROM chat_group_members WHERE trim(\"userId\") = ?
         )
         GROUP BY g.id, g.name, g.\"createdById\", g.\"createdByNom\", g.\"createdAt\"
         ORDER BY g.\"createdAt\" DESC"
    );
    $stmt->execute([$myId]);
    respond(200, array_map('formatGroup', $stmt->fetchAll()));
}

// GET /groups/:id?action=messages — messages d'un groupe
if ($m === 'GET' && $id && $action === 'messages') {
    $check = $db->prepare('SELECT 1 FROM chat_group_members WHERE "groupId"=? AND trim("userId")=?');
    $check->execute([$id, $myId]);
    if (!$check->fetch()) respond(403, ['error' => 'Non membre du groupe']);
    $stmt = $db->prepare(
        'SELECT * FROM group_messages WHERE "groupId"=? ORDER BY "createdAt" ASC'
    );
    $stmt->execute([$id]);
    respond(200, array_map('formatGroupMsg', $stmt->fetchAll()));
}

// POST /groups — créer un groupe (admin/superadmin uniquement)
if ($m === 'POST' && !$id) {
    requireRole(['superadmin', 'admin'], $current);
    $b = body();
    if (empty($b['name'])) respond(400, ['error' => 'name requis']);
    $groupId = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO chat_groups (id, name, "createdById", "createdByNom", "createdAt") VALUES (?,?,?,?,NOW())'
    )->execute([$groupId, $b['name'], $myId, $current['prenom'].' '.$current['nom']]);

    $members = array_unique(array_merge([$myId], $b['memberIds'] ?? []));
    $ins = $db->prepare('INSERT INTO chat_group_members ("groupId","userId") VALUES (?,?)');
    foreach ($members as $uid) { $ins->execute([$groupId, trim($uid)]); }

    $stmt = $db->prepare(
        "SELECT g.id, g.name,
                trim(g.\"createdById\") AS \"createdById\",
                g.\"createdByNom\", g.\"createdAt\",
                STRING_AGG(TRIM(m.\"userId\"), ',') AS members
         FROM chat_groups g
         JOIN chat_group_members m ON m.\"groupId\" = g.id
         WHERE g.id = ?
         GROUP BY g.id, g.name, g.\"createdById\", g.\"createdByNom\", g.\"createdAt\""
    );
    $stmt->execute([$groupId]);
    respond(201, formatGroup($stmt->fetch()));
}

// POST /groups/:id — envoyer un message dans un groupe
if ($m === 'POST' && $id) {
    $b = body();
    if (empty($b['content'])) respond(400, ['error' => 'content requis']);
    $check = $db->prepare('SELECT 1 FROM chat_group_members WHERE "groupId"=? AND trim("userId")=?');
    $check->execute([$id, $myId]);
    if (!$check->fetch()) respond(403, ['error' => 'Non membre du groupe']);
    $msgId = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO group_messages (id,"groupId","fromId","fromNom","fromRole",content,attachment,"createdAt")
         VALUES (?,?,?,?,?,?,?,NOW())'
    )->execute([
        $msgId, $id, $myId,
        $current['prenom'].' '.$current['nom'],
        $current['role'],
        $b['content'],
        !empty($b['attachment']) ? json_encode($b['attachment']) : null,
    ]);
    $stmt = $db->prepare('SELECT * FROM group_messages WHERE id=?');
    $stmt->execute([$msgId]);
    publishEvent('message');
    respond(201, formatGroupMsg($stmt->fetch()));
}

// DELETE /groups/:id — supprimer un groupe (admin/superadmin uniquement)
if ($m === 'DELETE' && $id) {
    requireRole(['superadmin', 'admin'], $current);
    $db->prepare('DELETE FROM group_messages WHERE "groupId" = ?')->execute([$id]);
    $db->prepare('DELETE FROM chat_group_members WHERE "groupId" = ?')->execute([$id]);
    $db->prepare('DELETE FROM chat_groups WHERE id = ?')->execute([$id]);
    respond(200, ['message' => 'Groupe supprimé']);
}

respond(405, ['error' => 'Méthode non autorisée']);
