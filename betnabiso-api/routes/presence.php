<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$uid     = trim($current['user_id']);

if ($m === 'POST') {
    if (DB_DRIVER === 'pgsql') {
        $db->prepare(
            'INSERT INTO presence (user_id, last_seen) VALUES (?, NOW())
             ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW()'
        )->execute([$uid]);
    } else {
        $db->prepare(
            'INSERT INTO presence (user_id, last_seen) VALUES (?, NOW())
             ON DUPLICATE KEY UPDATE last_seen = NOW()'
        )->execute([$uid]);
    }
    respond(200, ['ok' => true]);
}

if ($m === 'GET') {
    $cutoff = date('Y-m-d H:i:s', time() - 120);
    $stmt = $db->prepare('SELECT TRIM(user_id) AS user_id FROM presence WHERE last_seen > ?');
    $stmt->execute([$cutoff]);
    respond(200, array_column($stmt->fetchAll(), 'user_id'));
}

if ($m === 'DELETE') {
    $db->prepare('DELETE FROM presence WHERE user_id = ?')->execute([$uid]);
    respond(200, ['ok' => true]);
}

respond(405, ['error' => 'Méthode non autorisée']);
