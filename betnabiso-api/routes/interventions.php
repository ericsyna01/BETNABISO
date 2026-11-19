<?php
$current = requireAuth();
$m       = method();
$db      = getDB();
$id      = $GLOBALS['path_id'] ?? param('id');
$action  = param('action');

// Migration défensive : colonnes ajoutées après la mise en prod initiale de la table,
// pour tracer les interventions créées à partir d'un signalement libre-service (QR code).
try {
    if (DB_DRIVER === 'pgsql') {
        $db->exec('ALTER TABLE interventions ADD COLUMN IF NOT EXISTS "viaSignalement" BOOLEAN DEFAULT FALSE');
        $db->exec('ALTER TABLE interventions ADD COLUMN IF NOT EXISTS "signalementNotifId" VARCHAR(64)');
    } else {
        if (!$db->query("SHOW COLUMNS FROM interventions LIKE 'viaSignalement'")->fetch()) {
            $db->exec('ALTER TABLE interventions ADD COLUMN viaSignalement TINYINT(1) DEFAULT 0');
        }
        if (!$db->query("SHOW COLUMNS FROM interventions LIKE 'signalementNotifId'")->fetch()) {
            $db->exec('ALTER TABLE interventions ADD COLUMN signalementNotifId VARCHAR(64)');
        }
    }
} catch (Throwable $e) {}

// Migration défensive : message vocal joint au signalement d'origine (self-service.php),
// pour que le technicien assigné puisse l'écouter lui aussi (avant, seuls support/admin
// y avaient accès via la notification d'origine — jamais transmis à l'intervention créée).
try {
    if (DB_DRIVER === 'pgsql') {
        $db->exec('ALTER TABLE interventions ADD COLUMN IF NOT EXISTS "audioMessage" VARCHAR(255)');
    } else {
        if (!$db->query("SHOW COLUMNS FROM interventions LIKE 'audioMessage'")->fetch()) {
            $db->exec('ALTER TABLE interventions ADD COLUMN audioMessage VARCHAR(255)');
        }
    }
} catch (Throwable $e) {}

// Migration défensive : suivi des interventions "En cours" bloquées en attente
// (agent injoignable, pièce manquante...). Les colonnes portent l'état courant
// pour l'affichage des listes sans jointure ; la table garde l'historique des
// mini-rapports successifs.
try {
    if (DB_DRIVER === 'pgsql') {
        $db->exec('ALTER TABLE interventions ADD COLUMN IF NOT EXISTS "attenteMotif" VARCHAR(32)');
        $db->exec('ALTER TABLE interventions ADD COLUMN IF NOT EXISTS "attenteNote" TEXT');
        $db->exec('ALTER TABLE interventions ADD COLUMN IF NOT EXISTS "attenteDepuis" TIMESTAMP');
        $db->exec('ALTER TABLE interventions ADD COLUMN IF NOT EXISTS "attenteMaj" TIMESTAMP');
        $db->exec('CREATE TABLE IF NOT EXISTS intervention_suivis (
            id VARCHAR(64) PRIMARY KEY,
            "interventionId" VARCHAR(64) NOT NULL,
            "auteurId" VARCHAR(64),
            "auteurNom" VARCHAR(255),
            type VARCHAR(16) NOT NULL,
            motif VARCHAR(32),
            note TEXT,
            "createdAt" TIMESTAMP DEFAULT NOW()
        )');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_suivis_interv ON intervention_suivis ("interventionId")');
    } else {
        foreach (['attenteMotif' => 'VARCHAR(32)', 'attenteNote' => 'TEXT',
                  'attenteDepuis' => 'DATETIME', 'attenteMaj' => 'DATETIME'] as $col => $type) {
            if (!$db->query("SHOW COLUMNS FROM interventions LIKE '$col'")->fetch()) {
                $db->exec("ALTER TABLE interventions ADD COLUMN $col $type NULL");
            }
        }
        $db->exec('CREATE TABLE IF NOT EXISTS intervention_suivis (
            id VARCHAR(64) PRIMARY KEY,
            interventionId VARCHAR(64) NOT NULL,
            auteurId VARCHAR(64),
            auteurNom VARCHAR(255),
            type VARCHAR(16) NOT NULL,
            motif VARCHAR(32),
            note TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_suivis_interv (interventionId)
        )');
    }
} catch (Throwable $e) {}

const ATTENTE_MOTIFS = ['agent', 'materiel', 'reseau', 'tiers', 'autre'];

function auditLog(PDO $db, array $current, string $act, string $resId, string $details = ''): void {
    try {
        $db->prepare(
            'INSERT INTO audit_logs (id,"userId","userNom","userRole",action,resource,"resourceId",details,"createdAt")
             VALUES (?,?,?,?,?,?,?,?,NOW())'
        )->execute([
            bin2hex(random_bytes(16)), trim($current['user_id']),
            $current['prenom'].' '.$current['nom'], $current['role'],
            $act, 'intervention', $resId, $details,
        ]);
    } catch (Exception $e) {}
}

/**
 * Même principe que agents.php::enforceAgentZone — un admin scopé à une zone
 * ne doit voir/modifier que les interventions des agents de SA zone.
 */
function enforceInterventionZone(array $current, ?string $agentZone): void {
    if ($current['role'] !== 'admin' || empty($current['zone'])) return;
    if (strcasecmp(trim($current['zone']), trim((string)$agentZone)) !== 0) {
        respond(403, ['error' => 'Accès refusé : cette intervention n\'est pas dans votre zone']);
    }
}

function formatInterv(array $i): array {
    $i = trimIds($i);
    $i['deplacementRequis']  = (bool)($i['deplacementrequis']  ?? $i['deplacementRequis']  ?? false);
    $i['deplacementValide']  = (bool)($i['deplacementvalide']  ?? $i['deplacementValide']  ?? false);
    $i['deplacementRefuse']  = (bool)($i['deplacementrefuse']  ?? $i['deplacementRefuse']  ?? false);
    $i['deplacementTermine'] = (bool)($i[strtolower('deplacementTermine')] ?? $i['deplacementTermine'] ?? false);
    $i['viaSignalement']     = (bool)($i['viasignalement'] ?? $i['viaSignalement'] ?? false);
    // Normaliser les clés PostgreSQL (minuscules) en camelCase
    $camel = [
        'agentid'=>'agentId','agentnom'=>'agentNom','agentzone'=>'agentZone',
        'technicieniid'=>'technicienId','technicienid'=>'technicienId',
        'techniciennom'=>'technicienNom',
        'assignedbyid'=>'assignedById','assignedbynom'=>'assignedByNom',
        'assignedat'=>'assignedAt','dateplanifiee'=>'datePlanifiee',
        'datedebut'=>'dateDebut','datefin'=>'dateFin',
        'deplacementrequis'=>'deplacementRequis','deplacementnote'=>'deplacementNote',
        'deplacementrequestedby'=>'deplacementRequestedBy',
        'deplacementrequestedat'=>'deplacementRequestedAt',
        'deplacementvalide'=>'deplacementValide',
        'deplacementvalideby'=>'deplacementValideBy',
        'deplacementvalideat'=>'deplacementValideAt',
        'deplacementrefuse'=>'deplacementRefuse',
        'deplacementrefuseby'=>'deplacementRefuseBy',
        'chauffeurid'=>'chauffeurId','chauffeurnom'=>'chauffeurNom',
        'updatedat'=>'updatedAt','piecejointe'=>'pieceJointe',
        'datepplanifiee'=>'datePlanifiee',
        'viasignalement'=>'viaSignalement','signalementnotifid'=>'signalementNotifId','audiomessage'=>'audioMessage',
        'attentemotif'=>'attenteMotif','attentenote'=>'attenteNote',
        'attentedepuis'=>'attenteDepuis','attentemaj'=>'attenteMaj',
    ];
    // Ajout dynamique de la clé lowercase pour deplacementTermine (MySQL retourne tout en minuscules)
    $camel[strtolower('deplacementTermine')] = 'deplacementTermine';
    $out = [];
    foreach ($i as $k => $v) {
        $key = $camel[$k] ?? $k;
        $out[$key] = $v;
    }
    // Convertir dates en ISO 8601
    foreach (['assignedAt','datePlanifiee','dateDebut','dateFin',
              'deplacementRequestedAt','deplacementValideAt','updatedAt',
              'attenteDepuis','attenteMaj'] as $f) {
        if (!empty($out[$f])) $out[$f] = date('c', strtotime($out[$f]));
    }
    // Nullifier les chaînes vides
    foreach (['dateFin','assignedById','assignedByNom','assignedAt','datePlanifiee',
              'duree','observations','pieceJointe','deplacementNote',
              'deplacementRequestedBy','deplacementRequestedAt',
              'deplacementValideBy','deplacementValideAt',
              'deplacementRefuseBy','chauffeurId','chauffeurNom','signalementNotifId','audioMessage',
              'attenteMotif','attenteNote','attenteDepuis','attenteMaj'] as $f) {
        if (isset($out[$f]) && $out[$f] === '') $out[$f] = null;
    }
    if (isset($out['duree'])) $out['duree'] = $out['duree'] ? (int)$out['duree'] : null;
    return $out;
}

if ($m === 'GET') {
    if ($action === 'reassignments') {
        requireRole(['superadmin', 'admin'], $current);
        $stmt = $db->query(
            'SELECT
                trim(id)                AS id,
                trim("interventionId")  AS "interventionId",
                "agentNom", "agentZone",
                trim("fromTechId")      AS "fromTechId",   "fromTechNom",
                trim("toTechId")        AS "toTechId",     "toTechNom",
                trim("reassignedById")  AS "reassignedById","reassignedByNom",
                "assignedAt", "reassignedAt"
             FROM reassignment_logs
             ORDER BY "reassignedAt" DESC'
        );
        respond(200, array_map(function($r) {
            $assignedTs   = !empty($r['assignedAt'])   ? strtotime($r['assignedAt'])   : null;
            $reassignedTs = !empty($r['reassignedAt']) ? strtotime($r['reassignedAt']) : null;
            $r['minutesBefore'] = ($assignedTs && $reassignedTs)
                ? (int)round(($reassignedTs - $assignedTs) / 60)
                : null;
            if (!empty($r['assignedAt']))   $r['assignedAt']   = date('c', $assignedTs);
            if (!empty($r['reassignedAt'])) $r['reassignedAt'] = date('c', $reassignedTs);
            return $r;
        }, $stmt->fetchAll()));
    }

    if ($action === 'tech-monthly-stats') {
        $monthStart     = date('Y-m-01 00:00:00');
        $nextMonthStart = date('Y-m-01 00:00:00', strtotime('+1 month'));
        $stmt = $db->prepare(
            'SELECT
                trim("technicienId") AS "technicienId",
                "technicienNom",
                COUNT(*) AS total,
                COUNT(CASE WHEN statut = \'Terminée\' THEN 1 END) AS terminees,
                COUNT(CASE WHEN statut = \'Échec\' THEN 1 END) AS echecs,
                COUNT(CASE WHEN statut IN (\'En cours\', \'Assignée\') THEN 1 END) AS "enCours",
                ROUND(AVG(CASE WHEN duree IS NOT NULL THEN duree END), 1) AS dureemoy
             FROM interventions
             WHERE "dateDebut" >= ?
               AND "dateDebut" <  ?
               AND "technicienId" IS NOT NULL AND trim("technicienId") <> \'\'
             GROUP BY trim("technicienId"), "technicienNom"
             ORDER BY terminees DESC, total DESC'
        );
        $stmt->execute([$monthStart, $nextMonthStart]);
        respond(200, array_map(function($r) {
            return [
                'technicienId'  => $r['technicienId'],
                'technicienNom' => $r['technicienNom'],
                'total'         => (int)$r['total'],
                'terminees'     => (int)$r['terminees'],
                'echecs'        => (int)$r['echecs'],
                'enCours'       => (int)$r['enCours'],
                'dureeMoy'      => $r['dureemoy'] !== null ? (float)$r['dureemoy'] : null,
            ];
        }, $stmt->fetchAll()));
    }

    if ($action === 'stats') {
        $rows = $db->query(
            "SELECT statut, COUNT(*) as cnt FROM interventions GROUP BY statut"
        )->fetchAll();
        $all  = (int)$db->query('SELECT COUNT(*) FROM interventions')->fetchColumn();
        $byStatut = array_column($rows, 'cnt', 'statut');
        respond(200, [
            'total'     => $all,
            'assignees' => (int)($byStatut['Assignée'] ?? 0),
            'terminees' => (int)($byStatut['Terminée'] ?? 0),
            'enCours'   => (int)($byStatut['En cours'] ?? 0),
            'echecs'    => (int)($byStatut['Échec'] ?? 0),
        ]);
    }
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM interventions WHERE id = ?');
        $stmt->execute([$id]);
        $i = $stmt->fetch();
        if (!$i) respond(404, ['error' => 'Intervention non trouvée']);
        if ($action === 'suivis') {
            if ($current['role'] === 'technicien' && trim($i['technicienid'] ?? $i['technicienId'] ?? '') !== trim($current['user_id'])) {
                respond(403, ['error' => 'Interdit']);
            }
            enforceInterventionZone($current, $i['agentzone'] ?? $i['agentZone'] ?? null);
            $s = $db->prepare(
                'SELECT id, "auteurId", "auteurNom", type, motif, note, "createdAt"
                 FROM intervention_suivis WHERE "interventionId" = ? ORDER BY "createdAt" DESC'
            );
            $s->execute([$id]);
            respond(200, array_map(fn($r) => [
                'id'        => trim($r['id']),
                'auteurId'  => trim((string)($r['auteurid'] ?? $r['auteurId'] ?? '')),
                'auteurNom' => $r['auteurnom'] ?? $r['auteurNom'] ?? null,
                'type'      => $r['type'],
                'motif'     => $r['motif'] ?: null,
                'note'      => $r['note'] ?: null,
                'createdAt' => date('c', strtotime($r['createdat'] ?? $r['createdAt'])),
            ], $s->fetchAll()));
        }
        // Un technicien/chauffeur ne peut pas lire le détail d'une intervention
        // qui n'est pas la sienne en devinant simplement son id.
        if ($current['role'] === 'technicien' && trim($i['technicienid'] ?? $i['technicienId'] ?? '') !== trim($current['user_id'])) {
            respond(403, ['error' => 'Interdit']);
        }
        if ($current['role'] === 'chauffeur' && trim($i['chauffeurid'] ?? $i['chauffeurId'] ?? '') !== trim($current['user_id'])) {
            respond(403, ['error' => 'Interdit']);
        }
        enforceInterventionZone($current, $i['agentzone'] ?? $i['agentZone'] ?? null);
        respond(200, formatInterv($i));
    }
    $where = []; $vals = [];
    if ($current['role'] === 'technicien') {
        $where[] = '"technicienId" = ?'; $vals[] = $current['user_id'];
    }
    if ($current['role'] === 'chauffeur') {
        $where[] = '"deplacementRequis" = 1';
        $where[] = '"deplacementValide" = 1';
        $where[] = '"chauffeurId" = ?'; $vals[] = $current['user_id'];
    }
    // Idem agents.php : un admin scopé ne doit recevoir que les interventions
    // de sa zone, pas seulement un affichage filtré côté client.
    if ($current['role'] === 'admin' && !empty($current['zone'])) {
        $where[] = 'LOWER("agentZone") = LOWER(?)'; $vals[] = $current['zone'];
    }
    foreach (['agentId','technicienId','agentZone','type','statut'] as $f) {
        $v = param($f);
        if ($v) { $where[] = "\"$f\" = ?"; $vals[] = $v; }
    }
    if ($df = param('dateDebut')) { $where[] = '"dateDebut" >= ?'; $vals[] = $df; }
    if ($dt = param('dateFin'))   { $where[] = '"dateDebut" <= ?'; $vals[] = $dt . ' 23:59:59'; }
    $sql  = 'SELECT * FROM interventions' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY "dateDebut" DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($vals);
    respond(200, array_map('formatInterv', $stmt->fetchAll()));
}

if (($m === 'POST' || $m === 'PATCH') && $id && $action) {
    // Rediriger vers le bloc PATCH ci-dessous
    $m = 'PATCH';
}

if ($m === 'POST') {
    // Un chauffeur (ou tout autre rôle hors de cette liste) n'a aucune raison de
    // créer une intervention ni de l'assigner à un technicien de son choix.
    requireRole(['superadmin', 'admin', 'support', 'technicien'], $current);
    $b = body();
    // La vraie zone de l'agent vient de la table agents, pas de la valeur
    // envoyée par le client : sinon un admin scopé pourrait créer une
    // intervention pour un agent d'une autre zone en falsifiant agentZone.
    $agentRow = null;
    if (!empty($b['agentId'])) {
        $agentStmt = $db->prepare('SELECT zone FROM agents WHERE id = ?');
        $agentStmt->execute([$b['agentId']]);
        $agentRow = $agentStmt->fetch();
    }
    if (!$agentRow) respond(404, ['error' => 'Agent introuvable']);
    enforceInterventionZone($current, $agentRow['zone'] ?? null);
    // Verrou atomique anti double-affectation : si cette intervention vient d'un
    // signalement QR, on ne la crée que si on arrive à faire basculer la
    // notification de "non traitée" à "traitée" nous-mêmes. Si un autre membre
    // du support a déjà cliqué "assigner" sur le même signalement entre-temps,
    // 0 ligne est affectée ici et on refuse plutôt que de créer un doublon.
    if (!empty($b['signalementNotifId'])) {
        $claim = $db->prepare("UPDATE notifications SET statut = 'traitée' WHERE id = ? AND statut != 'traitée'");
        $claim->execute([$b['signalementNotifId']]);
        if ($claim->rowCount() === 0) {
            respond(409, ['error' => 'Ce signalement a déjà été pris en charge par un autre membre du support']);
        }
        // Prévenir tout de suite les autres sessions support/admin que ce
        // signalement vient d'être pris, avant même la fin de la création.
        publishEvent('notifications');
    }
    $newId   = $b['id'] ?? bin2hex(random_bytes(16));
    $techId  = ($current['role'] === 'technicien') ? $current['user_id'] : ($b['technicienId'] ?? null);
    $techNom = ($current['role'] === 'technicien') ? ($current['prenom'] . ' ' . $current['nom']) : ($b['technicienNom'] ?? null);
    $db->prepare(
        'INSERT INTO interventions (id,"agentId","agentNom","agentZone","technicienId","technicienNom",
         "assignedById","assignedByNom","assignedAt",priorite,"datePlanifiee",type,"dateDebut",
         description,statut,observations,"pieceJointe","audioMessage","viaSignalement","signalementNotifId","updatedAt")
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())'
    )->execute([
        $newId,
        $b['agentId'], $b['agentNom'], $agentRow['zone'] ?? ($b['agentZone'] ?? null),
        $techId, $techNom,
        $b['assignedById'] ?? null, $b['assignedByNom'] ?? null,
        // Toujours dater l'affectation dès qu'un technicien est choisi à la création,
        // même si le formulaire d'origine n'a pas transmis assignedAt explicitement —
        // sinon le temps passé avant une éventuelle réaffectation ne peut pas être calculé.
        $techId ? (toTsDate($b['assignedAt'] ?? null) ?? date('Y-m-d H:i:s')) : null,
        $b['priorite'] ?? 'Normale',
        toTsDate($b['datePlanifiee'] ?? null),
        $b['type'],
        toTsDate($b['dateDebut'] ?? null) ?? date('Y-m-d H:i:s'),
        $b['description'],
        $b['statut'] ?? 'Assignée',
        $b['observations'] ?? null,
        $b['pieceJointe'] ?? null,
        $b['audioMessage'] ?? null,
        !empty($b['viaSignalement']) ? 1 : 0,
        $b['signalementNotifId'] ?? null,
    ]);
    $stmt = $db->prepare('SELECT * FROM interventions WHERE id = ?');
    $stmt->execute([$newId]);
    $created = formatInterv($stmt->fetch());
    auditLog($db, $current, 'CREATE', $newId, "agent={$b['agentNom']}");
    // Notifier le technicien assigné
    if ($techId) {
        try {
            $db->prepare(
                'INSERT INTO notifications (id, type, "agentId", "agentNom", "technicienId", "interventionId", "requestedById", "requestedByNom", "requestedByRole", message, statut)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                bin2hex(random_bytes(16)),
                'intervention_assignee',
                $b['agentId'] ?? null,
                $b['agentNom'] ?? null,
                $techId,
                $newId,
                $current['user_id'],
                $current['prenom'] . ' ' . $current['nom'],
                $current['role'],
                'Nouvelle intervention assignée : ' . ($b['type'] ?? '') . ' pour ' . ($b['agentNom'] ?? 'agent'),
                'non_lue'
            ]);
        } catch (Exception $e) {}
        publishEvent('notifications');
    }
    publishEvent('interventions');
    respond(201, $created);
}

if ($m === 'PUT' && $id) {
    $zoneChk = $db->prepare('SELECT "technicienId", "agentZone" FROM interventions WHERE id = ?');
    $zoneChk->execute([$id]);
    $zoneRow = $zoneChk->fetch();
    if (!$zoneRow) respond(404, ['error' => 'Intervention non trouvée']);
    $isOwner = trim($zoneRow['technicienid'] ?? $zoneRow['technicienId'] ?? '') === trim($current['user_id'] ?? '');
    $isAdmin = in_array($current['role'], ['superadmin', 'admin'], true);
    if (!$isOwner && !$isAdmin) respond(403, ['error' => 'Interdit']);
    enforceInterventionZone($current, $zoneRow['agentzone'] ?? $zoneRow['agentZone'] ?? null);
    $b = body();
    $fields = []; $vals = [];
    $dateFields = ['assignedAt','datePlanifiee','dateDebut','dateFin','deplacementRequestedAt'];
    // Un technicien ne peut faire avancer que SA PROPRE intervention (prise en
    // charge, clôture, échec) : la réaffectation, le changement d'agent/priorité
    // etc. restent réservés à admin/superadmin (ou à l'action dédiée "reassign").
    $map = $isAdmin
        ? ['agentId','agentNom','agentZone','technicienId','technicienNom',
           'assignedById','assignedByNom','assignedAt','priorite','datePlanifiee',
           'type','dateDebut','dateFin','duree','description','statut','observations',
           'pieceJointe','deplacementRequis','deplacementNote','deplacementRequestedBy','deplacementRequestedAt']
        : ['statut','dateDebut','dateFin','duree','observations'];
    foreach ($map as $f) {
        if (array_key_exists($f, $b)) {
            $fields[] = "\"$f\" = ?";
            if ($f === 'deplacementRequis') $vals[] = (int)$b[$f];
            elseif (in_array($f, $dateFields)) $vals[] = toTsDate($b[$f]);
            else $vals[] = $b[$f] ?? null;
        }
    }
    // Une intervention clôturée n'est plus en attente : on efface l'état courant
    // (l'historique des mini-rapports reste dans intervention_suivis).
    if (in_array($b['statut'] ?? '', ['Terminée', 'Échec'], true)) {
        $fields[] = '"attenteMotif" = NULL';
        $fields[] = '"attenteNote" = NULL';
        $fields[] = '"attenteDepuis" = NULL';
        $fields[] = '"attenteMaj" = NULL';
    }
    if (($b['statut'] ?? '') === 'Terminée') {
        $curr    = $db->prepare('SELECT "dateDebut", "dateFin" FROM interventions WHERE id = ?');
        $curr->execute([$id]);
        $row     = $curr->fetch();
        $dateFin = toTsDate($b['dateFin'] ?? null) ?? date('Y-m-d H:i:s');
        $duree   = (int)round((strtotime($dateFin) - strtotime($row['datedebut'] ?? $row['dateDebut'])) / 60);
        if (!array_key_exists('dateFin', $b))  { $fields[] = '"dateFin" = ?'; $vals[] = $dateFin; }
        if (!array_key_exists('duree', $b))    { $fields[] = 'duree = ?';     $vals[] = $duree; }
    }
    if (!$fields) respond(400, ['error' => 'Aucun champ à mettre à jour']);
    $fields[] = '"updatedAt" = NOW()';
    $vals[] = $id;
    $db->prepare('UPDATE interventions SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);
    $stmt = $db->prepare('SELECT * FROM interventions WHERE id = ?');
    $stmt->execute([$id]);
    publishEvent('interventions');
    respond(200, formatInterv($stmt->fetch()));
}

if ($m === 'PATCH' && $id) {
    $b = body();
    // Zone de l'intervention ciblée, lue une seule fois : les actions
    // réservées à admin/superadmin/support ci-dessous vérifient qu'un admin
    // scopé n'agit pas sur une intervention hors de sa zone.
    $zoneStmt = $db->prepare('SELECT "agentZone" FROM interventions WHERE id = ?');
    $zoneStmt->execute([$id]);
    $zoneRow = $zoneStmt->fetch();
    if (!$zoneRow) respond(404, ['error' => 'Intervention non trouvée']);
    $interventionZone = $zoneRow['agentzone'] ?? $zoneRow['agentZone'] ?? null;

    if ($action === 'attente' || $action === 'reprendre') {
        // Le technicien assigné documente pourquoi son intervention reste
        // ouverte ; le support/admin peut aussi le faire (ex. agent injoignable
        // de leur côté).
        $rowStmt = $db->prepare('SELECT "technicienId", statut, "attenteDepuis" FROM interventions WHERE id = ?');
        $rowStmt->execute([$id]);
        $row = $rowStmt->fetch();
        $isOwner = trim($row['technicienid'] ?? $row['technicienId'] ?? '') === trim($current['user_id']);
        if (!$isOwner && !in_array($current['role'], ['superadmin', 'admin', 'support'], true)) {
            respond(403, ['error' => 'Interdit']);
        }
        enforceInterventionZone($current, $interventionZone);
        if (($row['statut'] ?? '') !== 'En cours') {
            respond(409, ['error' => 'Seule une intervention en cours peut être mise en attente']);
        }
        $auteurNom = $current['prenom'] . ' ' . $current['nom'];
        if ($action === 'attente') {
            $motif = $b['motif'] ?? '';
            $note  = trim((string)($b['note'] ?? ''));
            if (!in_array($motif, ATTENTE_MOTIFS, true)) respond(400, ['error' => 'Motif invalide']);
            if ($note === '') respond(400, ['error' => 'Le mini-rapport est obligatoire']);
            $note = mb_substr($note, 0, 1000);
            $alreadyWaiting = !empty($row['attentedepuis'] ?? $row['attenteDepuis'] ?? null);
            $db->prepare(
                'UPDATE interventions SET "attenteMotif"=?, "attenteNote"=?, "attenteMaj"=NOW()'
                . ($alreadyWaiting ? '' : ', "attenteDepuis"=NOW()') . ' WHERE id=?'
            )->execute([$motif, $note, $id]);
        } else {
            $motif = null;
            $note  = trim((string)($b['note'] ?? '')) ?: null;
            $db->prepare(
                'UPDATE interventions SET "attenteMotif"=NULL, "attenteNote"=NULL, "attenteDepuis"=NULL, "attenteMaj"=NULL WHERE id=?'
            )->execute([$id]);
        }
        $db->prepare(
            'INSERT INTO intervention_suivis (id, "interventionId", "auteurId", "auteurNom", type, motif, note, "createdAt")
             VALUES (?,?,?,?,?,?,?,NOW())'
        )->execute([
            bin2hex(random_bytes(16)), $id, trim($current['user_id']), $auteurNom,
            $action === 'attente' ? 'attente' : 'reprise', $motif, $note,
        ]);
    } elseif ($action === 'assign') {
        requireRole(['superadmin', 'admin', 'support'], $current);
        enforceInterventionZone($current, $interventionZone);
        $db->prepare(
            'UPDATE interventions SET "technicienId"=?,"technicienNom"=?,"assignedById"=?,"assignedByNom"=?,"assignedAt"=NOW(),statut=?,priorite=?,"datePlanifiee"=? WHERE id=?'
        )->execute([
            $b['technicienId'], $b['technicienNom'],
            $current['user_id'], $current['prenom'] . ' ' . $current['nom'],
            'Assignée', $b['priorite'] ?? 'Normale', toTsDate($b['datePlanifiee'] ?? null), $id,
        ]);
    } elseif ($action === 'reassign') {
        requireRole(['superadmin', 'admin', 'support'], $current);
        enforceInterventionZone($current, $interventionZone);
        // Lire l'ancien technicien + date d'affectation avant la mise à jour
        $stmtOld = $db->prepare(
            'SELECT "technicienId" AS fromtechid, "technicienNom" AS fromtechnom,
                    "agentNom" AS agentnom, "agentZone" AS agentzone,
                    "assignedAt" AS assignedat
             FROM interventions WHERE id = ?'
        );
        $stmtOld->execute([$id]);
        $old = $stmtOld->fetch();
        // Journaliser la réaffectation (optionnel — ne bloque pas si la table est absente)
        try {
            // Créer la table si elle n'existe pas
            if (DB_DRIVER === 'pgsql') {
                $db->exec('CREATE TABLE IF NOT EXISTS reassignment_logs (
                    id VARCHAR(64) PRIMARY KEY,
                    "interventionId" VARCHAR(64),
                    "agentNom" VARCHAR(255),
                    "agentZone" VARCHAR(255),
                    "fromTechId" VARCHAR(64),
                    "fromTechNom" VARCHAR(255),
                    "toTechId" VARCHAR(64),
                    "toTechNom" VARCHAR(255),
                    "reassignedById" VARCHAR(64),
                    "reassignedByNom" VARCHAR(255),
                    "assignedAt" TIMESTAMP,
                    "reassignedAt" TIMESTAMP DEFAULT NOW()
                )');
            } else {
                $db->exec('CREATE TABLE IF NOT EXISTS reassignment_logs (
                    id VARCHAR(64) PRIMARY KEY,
                    interventionId VARCHAR(64),
                    agentNom VARCHAR(255),
                    agentZone VARCHAR(255),
                    fromTechId VARCHAR(64),
                    fromTechNom VARCHAR(255),
                    toTechId VARCHAR(64),
                    toTechNom VARCHAR(255),
                    reassignedById VARCHAR(64),
                    reassignedByNom VARCHAR(255),
                    assignedAt DATETIME,
                    reassignedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )');
            }
            $db->prepare(
                'INSERT INTO reassignment_logs
                 (id,"interventionId","agentNom","agentZone","fromTechId","fromTechNom","toTechId","toTechNom","reassignedById","reassignedByNom","assignedAt")
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)'
            )->execute([
                bin2hex(random_bytes(16)), $id,
                $old['agentnom']   ?? '', $old['agentzone']   ?? '',
                trim($old['fromtechid'] ?? ''), $old['fromtechnom'] ?? '',
                trim($b['technicienId']  ?? ''), $b['technicienNom'] ?? '',
                trim($current['user_id']), $current['prenom'] . ' ' . $current['nom'],
                $old['assignedat'] ?? null,
            ]);
        } catch (Exception $e) { /* log optionnel, ne bloque pas la réaffectation */ }
        // Réaffectation effective — on redate aussi "assignedAt" pour qu'une
        // éventuelle réaffectation ultérieure mesure le délai depuis CETTE
        // affectation, et non depuis l'affectation d'origine.
        $db->prepare('UPDATE interventions SET "technicienId"=?,"technicienNom"=?,statut=?,"assignedAt"=NOW() WHERE id=?')
           ->execute([$b['technicienId'], $b['technicienNom'], 'Assignée', $id]);
    } elseif ($action === 'deplacement') {
        /* Bloquer si un déplacement est déjà en cours ou validé */
        $chk = $db->prepare('SELECT "deplacementRequis" AS deplacementrequis, "deplacementValide" AS deplacementvalide, "chauffeurId" AS chauffeurid FROM interventions WHERE id=?');
        $chk->execute([$id]);
        $row = $chk->fetch();
        if ($row['deplacementrequis'] || $row['deplacementvalide'] || !empty(trim((string)($row['chauffeurid'] ?? '')))) {
            respond(409, ['error' => 'Un déplacement est déjà en cours pour cette intervention']);
        }
        $db->prepare(
            'UPDATE interventions SET "deplacementRequis"=1,"deplacementNote"=?,"deplacementRequestedBy"=?,"deplacementRequestedAt"=NOW() WHERE id=?'
        )->execute([$b['note'] ?? null, $current['user_id'], $id]);

        // Notification pour admins/superadmin
        $iStmt = $db->prepare('SELECT "agentId","agentNom" FROM interventions WHERE id=?');
        $iStmt->execute([$id]);
        $iRow = $iStmt->fetch();
        $db->prepare(
            'INSERT INTO notifications (id, type, "agentId", "agentNom", "interventionId", "requestedById", "requestedByNom", "requestedByRole", message, statut)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            bin2hex(random_bytes(16)),
            'deplacement_requis',
            $iRow['agentid'] ?? null,
            $iRow['agentnom'] ?? null,
            $id,
            $current['user_id'],
            $current['prenom'] . ' ' . $current['nom'],
            $current['role'],
            'Demande de déplacement pour ' . ($iRow['agentnom'] ?? 'agent'),
            'non_lue'
        ]);
    } elseif ($action === 'valider-deplacement') {
        requireRole(['superadmin', 'admin'], $current);
        enforceInterventionZone($current, $interventionZone);
        $db->prepare(
            'UPDATE interventions SET "deplacementValide"=1,"deplacementValideBy"=?,"deplacementValideAt"=NOW(),"chauffeurId"=?,"chauffeurNom"=? WHERE id=?'
        )->execute([$current['prenom'] . ' ' . $current['nom'], $b['chauffeurId'] ?? null, $b['chauffeurNom'] ?? null, $id]);
    } elseif ($action === 'refuser-deplacement') {
        requireRole(['superadmin', 'admin'], $current);
        enforceInterventionZone($current, $interventionZone);
        $db->prepare(
            'UPDATE interventions SET "deplacementRefuse"=1,"deplacementValide"=0,"deplacementValideBy"=NULL,"deplacementValideAt"=NULL,"deplacementRefuseBy"=?,"chauffeurId"=NULL,"chauffeurNom"=NULL WHERE id=?'
        )->execute([$current['prenom'] . ' ' . $current['nom'], $id]);
    } elseif ($action === 'resolve-deplacement') {
        requireRole(['superadmin', 'admin'], $current);
        enforceInterventionZone($current, $interventionZone);
        $db->prepare(
            'UPDATE interventions SET "deplacementRequis"=0,"deplacementNote"=NULL,"deplacementRequestedBy"=NULL,"deplacementRequestedAt"=NULL,"deplacementValide"=0,"deplacementValideBy"=NULL,"deplacementValideAt"=NULL,"deplacementRefuse"=0,"deplacementRefuseBy"=NULL,"deplacementTermine"=0,"chauffeurId"=NULL,"chauffeurNom"=NULL WHERE id=?'
        )->execute([$id]);
    } elseif ($action === 'chauffeur-statut') {
        /* Démarrer le transport uniquement (Assignée → En cours) */
        if ($current['role'] !== 'chauffeur') respond(403, ['error' => 'Interdit']);
        $check = $db->prepare('SELECT id FROM interventions WHERE id=? AND trim("chauffeurId")=?');
        $check->execute([$id, trim($current['user_id'])]);
        if (!$check->fetch()) respond(403, ['error' => 'Non autorisé']);
        $db->prepare('UPDATE interventions SET statut=? WHERE id=?')->execute(['En cours', $id]);
    } elseif ($action === 'terminer-transport') {
        if ($current['role'] !== 'chauffeur') respond(403, ['error' => 'Interdit']);
        $check = $db->prepare('SELECT id FROM interventions WHERE id=? AND trim("chauffeurId")=?');
        $check->execute([$id, trim($current['user_id'])]);
        if (!$check->fetch()) respond(403, ['error' => 'Non autorisé']);
        /* On garde chauffeurId/chauffeurNom pour l'historique du chauffeur.
           deplacementTermine=1 indique que la livraison est faite. */
        $db->prepare(
            'UPDATE interventions SET deplacementTermine=1, statut=\'En cours\' WHERE id=?'
        )->execute([$id]);
    }
    $db->prepare('UPDATE interventions SET "updatedAt" = NOW() WHERE id = ?')->execute([$id]);
    $stmt = $db->prepare('SELECT * FROM interventions WHERE id = ?');
    $stmt->execute([$id]);
    publishEvent('interventions');
    respond(200, formatInterv($stmt->fetch()));
}

if ($m === 'DELETE' && $id) {
    requireRole(['superadmin'], $current);
    $db->prepare('DELETE FROM interventions WHERE id = ?')->execute([$id]);
    auditLog($db, $current, 'DELETE', $id);
    respond(200, ['message' => 'Intervention supprimée']);
}

respond(405, ['error' => 'Méthode non autorisée']);
