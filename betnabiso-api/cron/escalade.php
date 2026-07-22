<?php
/**
 * Cron : escalade automatique des interventions en retard
 * Planification (crontab VPS) : tous les jours à 6h00
 *   0 6 * * *  php /var/www/betnabiso-api/cron/escalade.php
 *
 * Règles :
 *  - Assignée depuis > 48h sans démarrage → passage à "Échec" + notification admin
 *  - Assignée depuis > 24h sans démarrage → notification d'alerte uniquement
 */

require __DIR__ . '/bootstrap.php';

try {
    $db = getDB();

    // ── 1. Interventions en retard > 48h → Échec ─────────────────────────────
    $stmt = $db->prepare(
        "SELECT TRIM(id) AS id, \"agentNom\", \"technicienId\", \"technicienNom\",
                \"datePlanifiee\", \"dateDebut\"
         FROM interventions
         WHERE statut = 'Assignée'
           AND TIMESTAMPDIFF(SECOND, COALESCE(\"datePlanifiee\", \"dateDebut\"), NOW()) / 3600 >= 48"
    );
    $stmt->execute();
    $retard48 = $stmt->fetchAll();

    foreach ($retard48 as $i) {
        // Passer en Échec
        $db->prepare(
            "UPDATE interventions SET statut = 'Échec' WHERE TRIM(id) = ?"
        )->execute([$i['id']]);

        // Notification admin
        $db->prepare(
            'INSERT INTO notifications
               (id, type, "agentNom", "interventionId", "requestedByRole", message, statut)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            bin2hex(random_bytes(16)),
            'agent_modification',
            $i['agentNom'],
            $i['id'],
            'system',
            'Intervention passée en Échec automatiquement (retard > 48h) — ' . $i['agentNom'],
            'non_lue',
        ]);

        cronLog("escalade.php [ECHEC] intervention {$i['id']} — {$i['agentNom']} (retard > 48h)");
    }

    // ── 2. Interventions en retard entre 24h et 48h → alerte ─────────────────
    $stmt = $db->prepare(
        "SELECT TRIM(id) AS id, \"agentNom\", \"technicienNom\"
         FROM interventions
         WHERE statut = 'Assignée'
           AND TIMESTAMPDIFF(SECOND, COALESCE(\"datePlanifiee\", \"dateDebut\"), NOW()) / 3600 BETWEEN 24 AND 47"
    );
    $stmt->execute();
    $retard24 = $stmt->fetchAll();

    foreach ($retard24 as $i) {
        // Vérifier qu'on n'a pas déjà envoyé une alerte aujourd'hui pour cette intervention
        $exists = $db->prepare(
            "SELECT 1 FROM notifications
             WHERE \"interventionId\" = ?
               AND type = 'agent_modification'
               AND message LIKE '%alerte retard%'
               AND DATE(\"createdAt\") = CURRENT_DATE
             LIMIT 1"
        );
        $exists->execute([$i['id']]);
        if ($exists->fetch()) continue;

        $db->prepare(
            'INSERT INTO notifications
               (id, type, "agentNom", "interventionId", "requestedByRole", message, statut)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            bin2hex(random_bytes(16)),
            'agent_modification',
            $i['agentNom'],
            $i['id'],
            'system',
            'Alerte retard : intervention non démarrée depuis > 24h — ' . $i['agentNom'] . ' / ' . $i['technicienNom'],
            'non_lue',
        ]);

        cronLog("escalade.php [ALERTE] intervention {$i['id']} — {$i['agentNom']} (retard 24-48h)");
    }

    $total = count($retard48) + count($retard24);
    if ($total === 0) cronLog("escalade.php : aucune intervention en retard");

} catch (Throwable $e) {
    cronLog("escalade.php ERREUR : " . $e->getMessage());
    exit(1);
}
