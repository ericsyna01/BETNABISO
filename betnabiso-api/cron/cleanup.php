<?php
/**
 * Cron : nettoyage des données temporaires
 * Planification (crontab VPS) : tous les lundis à 03h00
 *   0 3 * * 1  php /var/www/betnabiso-api/cron/cleanup.php
 *
 * Actions :
 *  - Supprime les tentatives de connexion > 7 jours
 *  - Supprime les notifications lues > 30 jours
 *  - Supprime les sessions expirées (sécurité complémentaire à la purge inline)
 */

require __DIR__ . '/bootstrap.php';

try {
    $db = getDB();

    // ── Tentatives de connexion anciennes ─────────────────────────────────────
    $stmt = $db->prepare(
        "DELETE FROM login_attempts WHERE last_attempt < NOW() - INTERVAL 7 DAY"
    );
    $stmt->execute();
    $nAttempts = $stmt->rowCount();

    // ── Notifications lues ou traitées depuis > 30 jours ─────────────────────
    $stmt = $db->prepare(
        "DELETE FROM notifications
         WHERE statut IN ('lue', 'traitée')
           AND \"createdAt\" < NOW() - INTERVAL 30 DAY"
    );
    $stmt->execute();
    $nNotifs = $stmt->rowCount();

    // ── Sessions expirées ─────────────────────────────────────────────────────
    $stmt = $db->exec("DELETE FROM sessions WHERE expires_at < NOW()");
    $nSessions = is_int($stmt) ? $stmt : 0;

    cronLog("cleanup.php : {$nAttempts} tentatives, {$nNotifs} notifications, {$nSessions} sessions supprimées");

} catch (Throwable $e) {
    cronLog("cleanup.php ERREUR : " . $e->getMessage());
    exit(1);
}
