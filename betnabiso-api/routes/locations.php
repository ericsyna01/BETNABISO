<?php
$current = requireAuth();
$m  = method();
$db = getDB();

/* POST /locations — technician updates own position */
if ($m === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $lat  = isset($body['lat'])  ? (float)$body['lat']  : null;
    $lng  = isset($body['lng'])  ? (float)$body['lng']  : null;
    if ($lat === null || $lng === null) respond(400, ['error' => 'lat/lng requis']);

    $nom  = trim($current['prenom'] . ' ' . $current['nom']);
    if (DB_DRIVER === 'pgsql') {
        $stmt = $db->prepare(
            'INSERT INTO tech_locations ("userId","userNom",lat,lng,"updatedAt")
             VALUES (?,?,?,?,NOW())
             ON CONFLICT ("userId") DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng,
             "userNom"=EXCLUDED."userNom", "updatedAt"=NOW()'
        );
    } else {
        $stmt = $db->prepare(
            'INSERT INTO tech_locations ("userId","userNom",lat,lng,"updatedAt")
             VALUES (?,?,?,?,NOW())
             ON DUPLICATE KEY UPDATE lat=VALUES(lat), lng=VALUES(lng),
             "userNom"=VALUES("userNom"), "updatedAt"=NOW()'
        );
    }
    $stmt->execute([trim($current['user_id']), $nom, $lat, $lng]);
    respond(200, ['ok' => true]);
}

/* GET /locations — admin/superadmin views all positions (last 30 min) */
if ($m === 'GET') {
    requireRole(['superadmin', 'admin'], $current);
    $cutoff = date('Y-m-d H:i:s', time() - 1800);
    $stmt = $db->prepare(
        'SELECT trim("userId") AS "userId", "userNom", lat, lng, "updatedAt"
         FROM tech_locations
         WHERE "updatedAt" > ?
         ORDER BY "userNom"'
    );
    $stmt->execute([$cutoff]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['lat'] = (float)$r['lat'];
        $r['lng'] = (float)$r['lng'];
        $updatedAt = $r['updatedAt'] ?? $r['updatedat'] ?? null;
        if (!empty($updatedAt)) {
            $r['updatedAt'] = date('c', strtotime($updatedAt));
            unset($r['updatedat']);
        }
    }
    respond(200, $rows);
}

respond(405, ['error' => 'Méthode non autorisée']);
