<?php
/**
 * Cron : nettoyage des présences fantômes
 * Planification (crontab VPS) : toutes les 5 minutes (minute step 5)
 *   php /var/www/betnabiso-api/cron/presence.php
 *
 * Supprime les entrées présence inactives depuis plus de 5 minutes.
 * Harmless : le GET /presence filtre déjà à 2 min, mais cela évite que la table grossisse.
 */

require __DIR__ . '/bootstrap.php';

try {
    $db   = getDB();
    $stmt = $db->prepare(
        "DELETE FROM presence WHERE last_seen < NOW() - INTERVAL '5 minutes'"
    );
    $stmt->execute();
    $n = $stmt->rowCount();
    cronLog("presence.php : $n entrée(s) fantôme(s) supprimée(s)");
} catch (Throwable $e) {
    cronLog("presence.php ERREUR : " . $e->getMessage());
    exit(1);
}
