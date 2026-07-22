<?php
/**
 * Cron : suppression des photos jointes (signalements agents + interventions)
 * après 15 jours, pour ne pas saturer le stockage.
 * Planification (crontab VPS) : tous les jours à 03h30
 *   30 3 * * * php /var/www/betnabiso-api/cron/cleanup-media.php
 *
 * Les fichiers sont dans /var/www/betnabiso-api/media/. Une fois trop
 * anciens, le fichier est supprimé du disque ET la référence en base est
 * mise à NULL (sinon l'app afficherait une image cassée indéfiniment).
 */

require __DIR__ . '/bootstrap.php';

$MEDIA_DIR = __DIR__ . '/../media/';
$CUTOFF    = date('Y-m-d H:i:s', strtotime('-15 days'));

function deleteMediaFile(?string $url, string $mediaDir): bool {
    if (!$url) return false;
    $name = basename(parse_url($url, PHP_URL_PATH) ?: '');
    $path = $mediaDir . $name;
    if ($name !== '' && is_file($path)) {
        return @unlink($path);
    }
    return false;
}

try {
    $db = getDB();
    $deletedFiles = 0;

    // ── Photos des signalements agents (notifications.photoUrl) ──────────────
    $stmt = $db->prepare('SELECT id, photoUrl FROM notifications WHERE photoUrl IS NOT NULL AND "createdAt" < ?');
    $stmt->execute([$CUTOFF]);
    foreach ($stmt->fetchAll() as $row) {
        if (deleteMediaFile($row['photoUrl'], $MEDIA_DIR)) $deletedFiles++;
    }
    $nNotifs = $db->prepare('UPDATE notifications SET photoUrl = NULL WHERE photoUrl IS NOT NULL AND "createdAt" < ?');
    $nNotifs->execute([$CUTOFF]);

    // ── Pièces jointes des interventions ──────────────────────────────────────
    $stmt = $db->prepare('SELECT id, "pieceJointe" FROM interventions WHERE "pieceJointe" IS NOT NULL AND "createdAt" < ?');
    $stmt->execute([$CUTOFF]);
    foreach ($stmt->fetchAll() as $row) {
        if (deleteMediaFile($row['pieceJointe'], $MEDIA_DIR)) $deletedFiles++;
    }
    $nInterv = $db->prepare('UPDATE interventions SET "pieceJointe" = NULL WHERE "pieceJointe" IS NOT NULL AND "createdAt" < ?');
    $nInterv->execute([$CUTOFF]);

    cronLog("cleanup-media.php : {$deletedFiles} fichier(s) supprimé(s), "
        . "{$nNotifs->rowCount()} notification(s) et {$nInterv->rowCount()} intervention(s) nettoyée(s)");

} catch (Throwable $e) {
    cronLog("cleanup-media.php ERREUR : " . $e->getMessage());
    exit(1);
}
