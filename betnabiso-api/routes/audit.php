<?php
$current = requireAuth();
requireRole(['superadmin', 'admin'], $current);
$m  = method();
$db = getDB();

if ($m === 'GET') {
    $limit  = min((int)(param('limit') ?? 200), 500);
    $resource = param('resource');
    $where = $resource ? 'WHERE resource = ?' : '';
    $vals  = $resource ? [$resource] : [];
    $stmt  = $db->prepare(
        "SELECT id, trim(\"userId\") AS \"userId\", \"userNom\", \"userRole\",
                action, resource, \"resourceId\", details,
                \"createdAt\"
         FROM audit_logs $where
         ORDER BY \"createdAt\" DESC LIMIT $limit"
    );
    $stmt->execute($vals);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        if (!empty($r['createdat'])) {
            $r['createdAt'] = date('c', strtotime($r['createdat']));
            unset($r['createdat']);
        }
    }
    respond(200, $rows);
}

respond(405, ['error' => 'Méthode non autorisée']);
