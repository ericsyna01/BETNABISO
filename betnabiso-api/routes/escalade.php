<?php
$current = requireAuth();
requireRole(['superadmin', 'admin'], $current);
$m  = method();
$db = getDB();

/* GET /escalade — returns interventions assigned >6h without being "En cours" or "Terminée" */
if ($m === 'GET') {
    $seuil = (int)(param('heures') ?? 6);
    $stmt  = $db->prepare(
        "SELECT TRIM(id) AS id, \"agentNom\", \"agentZone\", statut,
                \"createdAt\",
                EXTRACT(EPOCH FROM (NOW() - \"createdAt\")) / 3600.0 AS \"dureeH\"
         FROM interventions
         WHERE statut NOT IN ('Terminée', 'Échec')
           AND EXTRACT(EPOCH FROM (NOW() - \"createdAt\")) / 3600 >= :seuil
         ORDER BY \"createdAt\" ASC"
    );
    $stmt->execute([':seuil' => $seuil]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['dureeH'] = round((float)$r['dureeH'], 1);
        if (!empty($r['createdat'])) {
            $r['createdAt'] = date('c', strtotime($r['createdat']));
            unset($r['createdat']);
        }
    }
    respond(200, $rows);
}

respond(405, ['error' => 'Méthode non autorisée']);
