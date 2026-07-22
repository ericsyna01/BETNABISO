<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');

function formatMsg(array $msg): array {
    $msg = trimIds($msg);
    // Normaliser clés PostgreSQL
    $map = ['fromid'=>'fromId','fromnom'=>'fromNom','fromrole'=>'fromRole',
            'toid'=>'toId','tonom'=>'toNom','createdat'=>'createdAt','readat'=>'readAt'];
    $out = [];
    foreach ($msg as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    foreach (['createdAt', 'readAt'] as $f) {
        if (!empty($out[$f])) $out[$f] = date('c', strtotime($out[$f]));
    }
    $out['attachment'] = !empty($out['attachment']) ? json_decode($out['attachment'], true) : null;
    return $out;
}

if ($m === 'GET') {
    $withUserId = param('with');
    if ($withUserId) {
        $stmt = $db->prepare(
            'SELECT * FROM messages
             WHERE ("fromId" = ? AND "toId" = ?) OR ("fromId" = ? AND "toId" = ?)
             ORDER BY "createdAt" ASC'
        );
        $stmt->execute([$current['user_id'], $withUserId, $withUserId, $current['user_id']]);
        $rows = array_map('formatMsg', $stmt->fetchAll());
        $db->prepare('UPDATE messages SET "readAt" = NOW() WHERE "fromId" = ? AND "toId" = ? AND "readAt" IS NULL')
           ->execute([$withUserId, $current['user_id']]);
        respond(200, $rows);
    }
    $stmt = $db->prepare('SELECT * FROM messages WHERE "fromId" = ? OR "toId" = ? ORDER BY "createdAt" ASC');
    $stmt->execute([$current['user_id'], $current['user_id']]);
    respond(200, array_map('formatMsg', $stmt->fetchAll()));
}

if ($m === 'POST') {
    $b = body();
    if (empty($b['toId']) || empty($b['content'])) {
        respond(400, ['error' => 'toId et content requis']);
    }
    $newId = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO messages (id,"fromId","fromNom","fromRole","toId","toNom",content,attachment,"createdAt")
         VALUES (?,?,?,?,?,?,?,?,NOW())'
    )->execute([
        $newId,
        $current['user_id'],
        $current['prenom'] . ' ' . $current['nom'],
        $current['role'],
        $b['toId'],
        $b['toNom'] ?? '',
        $b['content'],
        !empty($b['attachment']) ? json_encode($b['attachment']) : null,
    ]);
    $stmt = $db->prepare('SELECT * FROM messages WHERE id = ?');
    $stmt->execute([$newId]);
    publishEvent('message');
    respond(201, formatMsg($stmt->fetch()));
}

if ($m === 'PATCH' && $id) {
    $db->prepare('UPDATE messages SET "readAt" = NOW() WHERE "fromId" = ? AND "toId" = ? AND "readAt" IS NULL')
       ->execute([$id, $current['user_id']]);
    respond(200, ['ok' => true]);
}

respond(405, ['error' => 'Méthode non autorisée']);
