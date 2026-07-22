<?php
/**
 * Cron : alerte quand une machine (caisse/serveur) bascule en ligne → hors ligne
 * Planification (crontab VPS) : toutes les 2 minutes (minute step 2)
 *   php /var/www/betnabiso-api/cron/machine-offline.php
 *
 * Seuil hors ligne : doit rester cohérent avec HB_OFFLINE_THRESHOLD dans routes/heartbeat.php
 * Edge-triggered : une seule notification par episode hors ligne (offline_alerted_at),
 * remis a NULL automatiquement des qu'un ping reel est recu (voir routes/heartbeat.php).
 */

require __DIR__ . '/bootstrap.php';

const OFFLINE_SEUIL = 60;

try {
    $db = getDB();

    $stmt = $db->prepare(
        "SELECT ms.agent_id, ms.type, ms.last_seen, a.\"nomAgent\"
         FROM machine_status ms
         LEFT JOIN agents a ON a.id = ms.agent_id
         WHERE ms.offline_alerted_at IS NULL
           AND TIMESTAMPDIFF(SECOND, ms.last_seen, NOW()) > ?"
    );
    $stmt->execute([OFFLINE_SEUIL]);
    $newlyOffline = $stmt->fetchAll();

    foreach ($newlyOffline as $row) {
        $agentNom  = $row['nomAgent'] ?: $row['agent_id'];
        $typeLabel = $row['type'] === 'caisse' ? 'Caisse' : 'Serveur';

        $db->prepare(
            'INSERT INTO notifications (id, type, "agentNom", "requestedByRole", message, statut)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([
            bin2hex(random_bytes(16)),
            'machine_offline',
            $agentNom,
            'system',
            "$typeLabel hors ligne : $agentNom",
            'non_lue',
        ]);

        $db->prepare(
            'UPDATE machine_status SET offline_alerted_at = NOW() WHERE agent_id = ? AND type = ?'
        )->execute([$row['agent_id'], $row['type']]);

        cronLog("machine-offline.php [ALERTE] {$row['agent_id']} ($typeLabel) hors ligne — $agentNom");
    }

    if (count($newlyOffline) === 0) cronLog("machine-offline.php : aucune nouvelle machine hors ligne");

} catch (Throwable $e) {
    cronLog("machine-offline.php ERREUR : " . $e->getMessage());
    exit(1);
}
