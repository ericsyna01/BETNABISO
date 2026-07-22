<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? null;

function logAudit(PDO $db, array $current, string $action, string $resource, string $resourceId, string $details = ''): void {
    try {
        $db->prepare(
            'INSERT INTO audit_logs (id,"userId","userNom","userRole",action,resource,"resourceId",details,"createdAt")
             VALUES (?,?,?,?,?,?,?,?,NOW())'
        )->execute([
            bin2hex(random_bytes(16)), trim($current['user_id']),
            $current['prenom'].' '.$current['nom'], $current['role'],
            $action, $resource, $resourceId, $details,
        ]);
    } catch (Exception $e) {}
}

// GET /evaluations?interventionId=xxx
if ($m === 'GET') {
    $intId = param('interventionId');
    if ($intId) {
        $stmt = $db->prepare('SELECT * FROM evaluations WHERE "interventionId"=? ORDER BY "createdAt" DESC');
        $stmt->execute([$intId]);
    } else {
        requireRole(['superadmin','admin'], $current);
        $stmt = $db->query('SELECT * FROM evaluations ORDER BY "createdAt" DESC');
    }
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id']             = trim($r['id']);
        $r['interventionId'] = trim($r['interventionid'] ?? $r['interventionId'] ?? '');
        $r['agentId']        = trim($r['agentid']        ?? $r['agentId']        ?? '');
        $r['agentNom']       = $r['agentnom']     ?? $r['agentNom']     ?? '';
        $r['evaluatedBy']    = trim($r['evaluatedby']    ?? $r['evaluatedBy']    ?? '');
        $r['evaluatedByNom'] = $r['evaluatedbynom'] ?? $r['evaluatedByNom'] ?? '';
        $r['note']           = (int)($r['note'] ?? 0);
        $r['createdAt']      = !empty($r['createdat']) ? date('c', strtotime($r['createdat'])) : '';
        unset($r['agentid'],$r['agentnom'],$r['interventionid'],
              $r['evaluatedby'],$r['evaluatedbynom'],$r['createdat']);
    }
    respond(200, $rows);
}

// POST /evaluations
if ($m === 'POST') {
    $b = body();
    if (empty($b['interventionId']) || empty($b['note'])) respond(400, ['error' => 'interventionId et note requis']);
    $note = (int)$b['note'];
    if ($note < 1 || $note > 5) respond(400, ['error' => 'note doit être entre 1 et 5']);

    $exists = $db->prepare('SELECT id FROM evaluations WHERE "interventionId"=? AND "evaluatedBy"=?');
    $exists->execute([$b['interventionId'], trim($current['user_id'])]);
    if ($exists->fetch()) {
        $db->prepare('UPDATE evaluations SET note=?,commentaire=? WHERE "interventionId"=? AND "evaluatedBy"=?')
           ->execute([$note, $b['commentaire'] ?? null, $b['interventionId'], trim($current['user_id'])]);
    } else {
        $db->prepare(
            'INSERT INTO evaluations (id,"interventionId","agentId","agentNom",note,commentaire,"evaluatedBy","evaluatedByNom","createdAt")
             VALUES (?,?,?,?,?,?,?,?,NOW())'
        )->execute([
            bin2hex(random_bytes(16)),
            $b['interventionId'], $b['agentId'] ?? '', $b['agentNom'] ?? '',
            $note, $b['commentaire'] ?? null,
            trim($current['user_id']), $current['prenom'].' '.$current['nom'],
        ]);
    }
    logAudit($db, $current, 'EVALUATE', 'intervention', $b['interventionId'], "note=$note");
    respond(201, ['ok' => true]);
}

respond(405, ['error' => 'Méthode non autorisée']);
