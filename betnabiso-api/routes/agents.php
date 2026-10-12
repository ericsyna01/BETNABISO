<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');
$action  = param('action');

function auditAgent(PDO $db, array $current, string $act, string $agentId, string $details = ''): void {
    try {
        $db->prepare(
            'INSERT INTO audit_logs (id,"userId","userNom","userRole",action,resource,"resourceId",details,"createdAt")
             VALUES (?,?,?,?,?,?,?,?,NOW())'
        )->execute([
            bin2hex(random_bytes(16)), trim($current['user_id']),
            $current['prenom'].' '.$current['nom'], $current['role'],
            $act, 'agent', $agentId, $details,
        ]);
    } catch (Exception $e) {}
}

/**
 * Un admin "scopé" (role==='admin' avec une zone définie) ne doit voir/modifier
 * que les agents de SA zone — jusqu'ici ce n'était qu'un filtre d'affichage
 * côté frontend, jamais vérifié ici : changer l'id dans l'URL suffisait à
 * lire/modifier/supprimer un agent d'une autre zone.
 * superadmin et support ne sont volontairement pas restreints (comportement
 * déjà existant côté frontend).
 */
function enforceAgentZone(array $current, ?string $agentZone): void {
    if ($current['role'] !== 'admin' || empty($current['zone'])) return;
    if (strcasecmp(trim($current['zone']), trim((string)$agentZone)) !== 0) {
        respond(403, ['error' => 'Accès refusé : cet agent n\'est pas dans votre zone']);
    }
}

function formatAgent(array $a): array {
    $a = trimIds($a);
    if (isset($a['localisation']) && is_string($a['localisation'])) {
        $a['localisation'] = json_decode($a['localisation'], true);
    }
    foreach (['createdAt', 'updatedAt'] as $f) {
        if (!empty($a[$f])) $a[$f] = date('c', strtotime($a[$f]));
    }
    if (!empty($a['date']) && strlen($a['date']) > 10) $a['date'] = substr($a['date'], 0, 10);
    if (isset($a['public_token'])) { $a['publicToken'] = $a['public_token']; unset($a['public_token']); }
    return $a;
}

if ($m === 'GET') {
    if ($action === 'stats') {
        $total      = (int)$db->query('SELECT COUNT(*) FROM agents')->fetchColumn();
        $actifs     = (int)$db->query("SELECT COUNT(*) FROM agents WHERE statut = 'Actif'")->fetchColumn();
        $inactifs   = (int)$db->query("SELECT COUNT(*) FROM agents WHERE statut = 'Inactif'")->fetchColumn();
        $aRedeploy  = (int)$db->query("SELECT COUNT(*) FROM agents WHERE statut = 'À redéployer'")->fetchColumn();
        $redeployes = (int)$db->query("SELECT COUNT(*) FROM agents WHERE statut = 'Redéployé'")->fetchColumn();
        $zones      = $db->query('SELECT zone, COUNT(*) AS count FROM agents GROUP BY zone')->fetchAll();
        respond(200, ['total' => $total, 'actifs' => $actifs, 'inactifs' => $inactifs,
                      'aRedeployer' => $aRedeploy, 'redeployes' => $redeployes, 'parZone' => $zones]);
    }
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM agents WHERE id = ?');
        $stmt->execute([$id]);
        $a = $stmt->fetch();
        if (!$a) respond(404, ['error' => 'Agent non trouvé']);
        enforceAgentZone($current, $a['zone'] ?? null);
        respond(200, formatAgent($a));
    }
    $where = []; $vals = [];
    if ($z = param('zone'))   { $where[] = 'LOWER(zone) = LOWER(?)'; $vals[] = $z; }
    if ($s = param('statut')) { $where[] = 'statut = ?'; $vals[] = $s; }
    // Même pour la liste complète (sans ?zone= explicite) : un admin scopé ne
    // doit recevoir que les agents de sa zone, pas uniquement un affichage
    // filtré côté client qui laisserait passer le reste via l'API brute.
    if ($current['role'] === 'admin' && !empty($current['zone'])) {
        $where[] = 'LOWER(zone) = LOWER(?)'; $vals[] = $current['zone'];
    }
    $sql  = 'SELECT * FROM agents' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY "nomAgent" ASC';
    $stmt = $db->prepare($sql);
    $stmt->execute($vals);
    respond(200, array_map('formatAgent', $stmt->fetchAll()));
}

if ($m === 'POST') {
    requireRole(['superadmin', 'admin', 'support'], $current);
    $b     = body();
    // Impose la zone de l'admin scopé : sinon un appel direct à l'API
    // permettrait de créer un agent dans une zone qui n'est pas la sienne.
    if ($current['role'] === 'admin' && !empty($current['zone'])) {
        $b['zone'] = $current['zone'];
    }
    $newId = $b['id'] ?? bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO agents (id,"nomAgent","nomResponsable",identifiant,numero,anydesk,
         "numeroCaisse",anydesk_serveur,"teamCaisse","teamServeur",redeploiement,
         "redeploieVersId","redeploieVersNom",localisation,date,statut,zone,feuillet,"createdBy",public_token)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $newId,
        $b['nomAgent'] ?? '', $b['nomResponsable'] ?? null,
        $b['identifiant'] ?? null, $b['numero'] ?? null,
        $b['anydesk'] ?? null, $b['numeroCaisse'] ?? null,
        $b['anydesk_serveur'] ?? null,
        $b['teamCaisse'] ?? null, $b['teamServeur'] ?? null,
        $b['redeploiement'] ?? null,
        $b['redeploieVersId'] ?? null, $b['redeploieVersNom'] ?? null,
        isset($b['localisation']) ? json_encode($b['localisation']) : null,
        $b['date'] ?? date('Y-m-d'),
        $b['statut'] ?? 'Actif',
        $b['zone'] ?? '',
        $b['feuillet'] ?? null,
        $current['user_id'],
        bin2hex(random_bytes(16)),
    ]);
    $stmt = $db->prepare('SELECT * FROM agents WHERE id = ?');
    $stmt->execute([$newId]);
    publishEvent('agents');
    auditAgent($db, $current, 'CREATE', $newId, 'Agent créé : ' . ($b['nomAgent'] ?? ''));
    respond(201, formatAgent($stmt->fetch()));
}

if ($m === 'PUT' && $id) {
    requireRole(['superadmin', 'admin', 'support'], $current);
    $zoneChk = $db->prepare('SELECT zone FROM agents WHERE id = ?');
    $zoneChk->execute([$id]);
    $zoneRow = $zoneChk->fetch();
    if (!$zoneRow) respond(404, ['error' => 'Agent non trouvé']);
    enforceAgentZone($current, $zoneRow['zone'] ?? null);
    $b = body(); $fields = []; $vals = [];
    // Un admin scopé ne peut pas non plus déplacer l'agent hors de sa propre
    // zone via une modification du champ zone.
    if ($current['role'] === 'admin' && !empty($current['zone']) && array_key_exists('zone', $b)) {
        $b['zone'] = $current['zone'];
    }
    $strMap = [
        'nomAgent'=>'"nomAgent"', 'nomResponsable'=>'"nomResponsable"',
        'identifiant'=>'identifiant', 'numero'=>'numero', 'anydesk'=>'anydesk',
        'numeroCaisse'=>'"numeroCaisse"', 'anydesk_serveur'=>'anydesk_serveur',
        'teamCaisse'=>'"teamCaisse"', 'teamServeur'=>'"teamServeur"',
        'redeploiement'=>'redeploiement',
        'redeploieVersId'=>'"redeploieVersId"', 'redeploieVersNom'=>'"redeploieVersNom"',
        'date'=>'date', 'statut'=>'statut', 'zone'=>'zone', 'feuillet'=>'feuillet',
    ];
    foreach ($strMap as $jsKey => $dbCol) {
        if (array_key_exists($jsKey, $b)) { $fields[] = "$dbCol = ?"; $vals[] = $b[$jsKey]; }
    }
    if (array_key_exists('localisation', $b)) {
        $fields[] = 'localisation = ?';
        $vals[]   = $b['localisation'] ? json_encode($b['localisation']) : null;
    }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    $fields[] = '"updatedAt" = NOW()';
    $vals[]   = $id;
    $db->prepare('UPDATE agents SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);
    $stmt = $db->prepare('SELECT * FROM agents WHERE id = ?');
    $stmt->execute([$id]);
    publishEvent('agents');
    auditAgent($db, $current, 'UPDATE', $id, 'Champs modifiés : ' . implode(', ', array_keys($b)));
    respond(200, formatAgent($stmt->fetch()));
}

if ($m === 'PATCH' && $id) {
    requireRole(['superadmin', 'admin', 'support'], $current);
    $b      = body();
    $statut = $b['statut'] ?? null;
    $allowed = ['Actif', 'Inactif', 'Redéployé', 'À redéployer'];
    if (!$statut || !in_array($statut, $allowed)) respond(400, ['error' => 'Statut invalide']);
    $zoneChk = $db->prepare('SELECT zone FROM agents WHERE id = ?');
    $zoneChk->execute([$id]);
    $zoneRow = $zoneChk->fetch();
    if (!$zoneRow) respond(404, ['error' => 'Agent non trouvé']);
    enforceAgentZone($current, $zoneRow['zone'] ?? null);
    $db->prepare('UPDATE agents SET statut = ?, "updatedAt" = NOW() WHERE id = ?')->execute([$statut, $id]);
    $stmt = $db->prepare('SELECT * FROM agents WHERE id = ?');
    $stmt->execute([$id]);
    publishEvent('agents');
    auditAgent($db, $current, 'UPDATE', $id, 'Statut changé : ' . $statut);
    respond(200, formatAgent($stmt->fetch()));
}

if ($m === 'DELETE' && $id) {
    requireRole(['superadmin', 'admin'], $current);
    $before = $db->prepare('SELECT "nomAgent", zone FROM agents WHERE id = ?');
    $before->execute([$id]);
    $beforeRow = $before->fetch();
    if (!$beforeRow) respond(404, ['error' => 'Agent non trouvé']);
    enforceAgentZone($current, $beforeRow['zone'] ?? null);
    $nomAgent = $beforeRow['nomAgent'] ?? $beforeRow['nomagent'] ?? '';
    $db->prepare('DELETE FROM agents WHERE id = ?')->execute([$id]);
    publishEvent('agents');
    auditAgent($db, $current, 'DELETE', $id, 'Agent supprimé : ' . ($nomAgent ?: $id));
    respond(200, ['message' => 'Agent supprimé']);
}

respond(405, ['error' => 'Méthode non autorisée']);
