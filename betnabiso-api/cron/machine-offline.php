<?php
/**
 * DÉSACTIVÉ : ce cron générait une notification "machine hors ligne" par
 * simple coupure réseau mobile/ADSL (60s de seuil), noyant les vraies pannes
 * sous le bruit (même décision et même constat que sur amabeltech, où ce
 * cron a été retiré du crontab après ~650 notifications en une journée).
 * Laissé en place mais neutralisé, au cas où quelqu'un le redéclenche par
 * erreur depuis un vieux crontab.
 *
 * Ancien fonctionnement (conservé ci-dessous en commentaire pour référence) :
 * alerte quand une machine (caisse/serveur) bascule en ligne → hors ligne,
 * planifié toutes les 2 minutes, edge-triggered via offline_alerted_at.
 */

require __DIR__ . '/bootstrap.php';
cronLog("machine-offline.php : désactivé (notifications hors-ligne supprimées, trop de bruit)");
exit(0);

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
