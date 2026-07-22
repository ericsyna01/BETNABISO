<?php
$current  = requireAuth();
$m        = method();
$db       = getDB();
$id       = $GLOBALS['path_id'] ?? param('id');
$canWrite = in_array($current['role'], ['superadmin', 'admin']);

if ($m !== 'GET' && !$canWrite) respond(403, ['error' => 'Accès refusé']);

function formatPlan(array $p): array {
    $p = trimIds($p);
    $map = ['userid'=>'userId','usernom'=>'userNom','userrole'=>'userRole',
            'heuredebut'=>'heureDebut','heurefin'=>'heureFin','createdat'=>'createdAt'];
    $out = [];
    foreach ($p as $k => $v) { $out[$map[$k] ?? $k] = $v; }
    if (!empty($out['createdAt'])) $out['createdAt'] = date('c', strtotime($out['createdAt']));
    if (!empty($out['date']) && strlen($out['date']) > 10) $out['date'] = substr($out['date'], 0, 10);
    return $out;
}

if ($m === 'GET') {
    $where = []; $vals = [];
    if ($week = param('week')) {
        $where[] = 'WEEK(date, 3) = ?';
        $vals[]  = (int)$week;
        $year    = param('year') ?? (string)date('Y');
        $where[] = 'YEAR(date) = ?';
        $vals[]  = (int)$year;
    } elseif ($year = param('year')) {
        $where[] = 'YEAR(date) = ?';
        $vals[]  = (int)$year;
    }
    if ($uid = param('userId')) { $where[] = '"userId" = ?'; $vals[] = $uid; }
    $sql  = 'SELECT * FROM planning' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY date ASC, "heureDebut" ASC';
    $stmt = $db->prepare($sql);
    $stmt->execute($vals);
    respond(200, array_map('formatPlan', $stmt->fetchAll()));
}

if ($m === 'POST') {
    $b     = body();
    $newId = $b['id'] ?? bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO planning (id,"userId","userNom","userRole",date,type,"heureDebut","heureFin",note)
         VALUES (?,?,?,?,?,?,?,?,?)'
    )->execute([
        $newId,
        $b['userId'], $b['userNom'], $b['userRole'],
        $b['date'], $b['type'],
        $b['heureDebut'], $b['heureFin'],
        $b['note'] ?? null,
    ]);
    try {
        $db->prepare(
            'INSERT INTO notifications (id,type,"technicienId","requestedById","requestedByNom","requestedByRole",message,statut)
             VALUES (?,?,?,?,?,?,?,?)'
        )->execute([
            bin2hex(random_bytes(16)),
            'planning_assigne',
            $b['userId'],
            $current['user_id'], $current['prenom'] . ' ' . $current['nom'], $current['role'],
            'Nouvelle affectation planning : ' . $b['type'] . ' le ' . date('d/m/Y', strtotime($b['date'])) . ' (' . $b['heureDebut'] . '-' . $b['heureFin'] . ')',
            'non_lue',
        ]);
    } catch (Exception $e) {}
    publishEvent('notifications');
    $stmt = $db->prepare('SELECT * FROM planning WHERE id = ?');
    $stmt->execute([$newId]);
    respond(201, formatPlan($stmt->fetch()));
}

if ($m === 'DELETE' && $id) {
    $db->prepare('DELETE FROM planning WHERE id = ?')->execute([$id]);
    respond(200, ['message' => 'Affectation supprimée']);
}

respond(405, ['error' => 'Méthode non autorisée']);
