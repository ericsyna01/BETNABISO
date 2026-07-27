<?php
require_once __DIR__ . '/config.php';

set_exception_handler(function(Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()]);
    exit;
});

$uri   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$parts = explode('/', trim($uri, '/'));
// Strip 'api' prefix when deployed under /api/
if (($parts[0] ?? '') === 'api') array_shift($parts);
$resource = $parts[0] ?? '';

$GLOBALS['path_id'] = $parts[1] ?? null;

match ($resource) {
    'auth'          => require __DIR__ . '/routes/auth.php',
    'users'         => require __DIR__ . '/routes/users.php',
    'agents'        => require __DIR__ . '/routes/agents.php',
    'interventions' => require __DIR__ . '/routes/interventions.php',
    'planning'      => require __DIR__ . '/routes/planning.php',
    'notifications' => require __DIR__ . '/routes/notifications.php',
    'zones'         => require __DIR__ . '/routes/zones.php',
    'messages'      => require __DIR__ . '/routes/messages.php',
    'groups'        => require __DIR__ . '/routes/groups.php',
    'uploads'       => require __DIR__ . '/routes/uploads.php',
    'evaluations'   => require __DIR__ . '/routes/evaluations.php',
    'audit'         => require __DIR__ . '/routes/audit.php',
    'locations'     => require __DIR__ . '/routes/locations.php',
    'escalade'      => require __DIR__ . '/routes/escalade.php',
    'presence'      => require __DIR__ . '/routes/presence.php',
    'mail'          => require __DIR__ . '/routes/mail.php',
    'missions'      => require __DIR__ . '/routes/missions.php',
    'heartbeat'     => require __DIR__ . '/routes/heartbeat.php',
    'self-service'  => require __DIR__ . '/routes/self-service.php',
    'creneaux'      => require __DIR__ . '/routes/creneaux.php',
    'type-labels'   => require __DIR__ . '/routes/type-labels.php',
    'sse'           => require __DIR__ . '/sse.php',
    default         => respond(404, ['error' => 'Ressource non trouvée']),
};
