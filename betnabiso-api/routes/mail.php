<?php
// Proxy IMAP — implémentation socket pure (PHP 8.4+ sans extension imap)
$current = requireAuth();
$m       = method();
$b       = body();
$action  = param('action');

/**
 * Anti-SSRF : ce proxy IMAP connecte le serveur à un hôte/port choisis par le
 * client (chaque utilisateur configure sa propre boîte mail), donc on ne peut
 * pas se limiter à une liste blanche de providers. On bloque en revanche toute
 * résolution vers une IP privée/loopback/lien-local, qui ne peut correspondre à
 * aucune vraie boîte mail externe et servirait uniquement à faire dialoguer le
 * serveur avec son propre réseau interne (Redis, autres VPS, métadonnées cloud…).
 */
function assertNotInternalHost(string $host): void {
    $ips = [];
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        $ips = [$host];
    } else {
        $ips = array_filter([gethostbyname($host)], fn($ip) => $ip !== $host);
    }
    if (!$ips) throw new \RuntimeException('Hôte introuvable');
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new \RuntimeException('Connexion à une adresse interne refusée');
        }
    }
}

/* ══════════════════════════════════════════════════════════════
   Client IMAP léger via stream_socket_client (SSL/TLS natif)
   ══════════════════════════════════════════════════════════════ */
class ImapClient {
    private $sock;
    private int $seq = 0;

    public function __construct(string $host, int $port, bool $ssl) {
        assertNotInternalHost($host);
        $ctx  = stream_context_create(['ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
            'allow_self_signed'=> false,
        ]]);
        $addr = ($ssl ? 'ssl' : 'tcp') . "://$host:$port";
        $this->sock = @stream_socket_client($addr, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$this->sock) throw new \RuntimeException("Connexion impossible : $errstr");
        stream_set_timeout($this->sock, 20);
        $this->readLine(); // greeting
    }

    private function readLine(): string {
        $line = fgets($this->sock);
        return ($line === false) ? '' : $line;
    }

    /** Lit toutes les lignes jusqu'à la réponse taguée, gère les littéraux {N} */
    private function readTag(string $tag): string {
        $out = '';
        while (!feof($this->sock)) {
            $line = $this->readLine();
            if ($line === '') continue;
            // Littéral IMAP : {N}\r\n → lire N octets ensuite
            if (preg_match('/\{(\d+)\}\r\n$/', $line, $lm)) {
                $out .= $line;
                $remain = (int)$lm[1];
                while ($remain > 0 && !feof($this->sock)) {
                    $chunk = fread($this->sock, min($remain, 8192));
                    if ($chunk === false) break;
                    $out   .= $chunk;
                    $remain -= strlen($chunk);
                }
                continue;
            }
            $out .= $line;
            if (preg_match('/^' . preg_quote($tag, '/') . ' (OK|NO|BAD)/i', $line)) break;
        }
        return $out;
    }

    public function cmd(string $cmd): string {
        $tag = 'T' . str_pad(++$this->seq, 4, '0', STR_PAD_LEFT);
        fwrite($this->sock, "$tag $cmd\r\n");
        return $this->readTag($tag);
    }

    public function login(string $user, string $pass): void {
        // Les deux champs finissent entre guillemets dans une commande IMAP en
        // clair terminée par \r\n : un retour chariot/saut de ligne non filtré
        // permettrait d'injecter une commande IMAP supplémentaire.
        $user = str_replace(["\r", "\n", '\\', '"'], ['', '', '\\\\', '\\"'], $user);
        $pass = str_replace(["\r", "\n", '\\', '"'], ['', '', '\\\\', '\\"'], $pass);
        $resp = $this->cmd("LOGIN \"$user\" \"$pass\"");
        if (!preg_match('/T\d+ OK/i', $resp)) {
            // Extraire le message d'erreur du serveur
            preg_match('/T\d+ (?:NO|BAD)\s*\[?[^\]]*\]?\s*(.+)/i', $resp, $m);
            $detail = isset($m[1]) ? trim(strip_tags($m[1])) : $resp;
            throw new \RuntimeException("Authentification échouée : " . mb_substr($detail, 0, 200));
        }
    }

    public function selectInbox(): int {
        $resp = $this->cmd('SELECT INBOX');
        preg_match('/\* (\d+) EXISTS/i', $resp, $m);
        return (int)($m[1] ?? 0);
    }

    /** Récupère les en-têtes d'une plage de messages */
    public function fetchHeaders(int $from, int $to): array {
        if ($from < 1 || $to < $from) return [];
        $resp = $this->cmd("FETCH $from:$to (FLAGS INTERNALDATE RFC822.HEADER)");
        return $this->parseHeaderBlocks($resp);
    }

    /** Récupère le corps d'un message */
    public function fetchBody(int $num): array {
        $resp = $this->cmd("FETCH $num (BODY[] FLAGS)");
        return $this->parseFullMessage($resp);
    }

    public function setFlag(int $num, string $flag, bool $add): void {
        $op = $add ? '+FLAGS' : '-FLAGS';
        $this->cmd("STORE $num $op (\\$flag)");
    }

    public function logout(): void {
        @fwrite($this->sock, "Z001 LOGOUT\r\n");
        @fclose($this->sock);
    }

    /* ── Parseurs ─────────────────────────────────────────────── */

    private function parseHeaderBlocks(string $raw): array {
        $messages = [];
        // Split on "* N FETCH"
        $parts = preg_split('/(?=\* \d+ FETCH)/i', $raw);
        foreach ($parts as $part) {
            if (!preg_match('/^\* (\d+) FETCH/i', $part, $m)) continue;
            $num     = (int)$m[1];
            $flags   = '';
            $date    = '';
            $headers = '';

            if (preg_match('/FLAGS \(([^)]*)\)/i', $part, $fm))   $flags = $fm[1];
            if (preg_match('/INTERNALDATE "([^"]+)"/i', $part, $dm)) $date = $dm[1];

            // Header block après RFC822.HEADER {N}
            if (preg_match('/RFC822\.HEADER \{(\d+)\}\r?\n(.*)/si', $part, $hm)) {
                $headers = substr($hm[2], 0, (int)$hm[1]);
            }

            $from    = $this->headerField($headers, 'From');
            $subject = $this->headerField($headers, 'Subject');
            $msgDate = $this->headerField($headers, 'Date');

            $messages[] = [
                'uid'      => $num,
                'num'      => $num,
                'from'     => $this->extractEmail($from),
                'fromName' => $this->extractName($from),
                'subject'  => $this->decodeHeader($subject) ?: '(sans objet)',
                'date'     => $this->parseDate($msgDate ?: $date),
                'seen'     => str_contains($flags, '\\Seen'),
                'flagged'  => str_contains($flags, '\\Flagged'),
            ];
        }
        return $messages;
    }

    private function parseFullMessage(string $raw): array {
        $seen = str_contains($raw, '\\Seen');

        // Extraire le bloc littéral BODY[]
        $fullMsg = '';
        if (preg_match('/BODY\[\] \{(\d+)\}\r?\n(.*)/si', $raw, $m)) {
            $fullMsg = substr($m[2], 0, (int)$m[1]);
        }

        // Séparer en-tête / corps
        $parts   = preg_split('/\r?\n\r?\n/', $fullMsg, 2);
        $rawHdr  = $parts[0] ?? '';
        $rawBody = $parts[1] ?? '';

        // Détecter l'encodage du corps
        $cte = strtolower(trim($this->headerField($rawHdr, 'Content-Transfer-Encoding')));
        $ct  = strtolower($this->headerField($rawHdr, 'Content-Type'));

        if ($cte === 'base64')            $rawBody = base64_decode(str_replace(["\r","\n"], '', $rawBody));
        elseif ($cte === 'quoted-printable') $rawBody = quoted_printable_decode($rawBody);

        // Si multipart, extraire la première partie text/plain ou text/html
        if (str_contains($ct, 'multipart')) {
            preg_match('/boundary="?([^";\r\n]+)"?/i', $ct, $bm);
            if (isset($bm[1])) {
                $rawBody = $this->extractMultipart($fullMsg, trim($bm[1]));
            }
        }

        $from    = $this->headerField($rawHdr, 'From');
        $subject = $this->headerField($rawHdr, 'Subject');
        $date    = $this->headerField($rawHdr, 'Date');

        return [
            'from'     => $this->extractEmail($from),
            'fromName' => $this->extractName($from),
            'subject'  => $this->decodeHeader($subject) ?: '(sans objet)',
            'date'     => $this->parseDate($date),
            'body'     => $rawBody,
            'seen'     => $seen,
            'flagged'  => false,
        ];
    }

    private function extractMultipart(string $msg, string $boundary): string {
        $parts = explode('--' . $boundary, $msg);
        $html = ''; $text = '';
        foreach ($parts as $part) {
            $subParts = preg_split('/\r?\n\r?\n/', ltrim($part), 2);
            if (count($subParts) < 2) continue;
            [$hdr, $body] = $subParts;
            $ct  = strtolower($this->headerField($hdr, 'Content-Type'));
            $cte = strtolower(trim($this->headerField($hdr, 'Content-Transfer-Encoding')));
            if ($cte === 'base64')            $body = base64_decode(str_replace(["\r","\n"], '', $body));
            elseif ($cte === 'quoted-printable') $body = quoted_printable_decode($body);
            if (str_contains($ct, 'text/html'))  $html = $body;
            if (str_contains($ct, 'text/plain') && !$text) $text = $body;
        }
        return $html ?: $text;
    }

    /* ── Helpers RFC 2047 ─────────────────────────────────────── */

    private function headerField(string $headers, string $field): string {
        // Unfold header (continuation lines)
        $headers = preg_replace('/\r?\n([ \t])/', ' ', $headers);
        if (preg_match('/^' . preg_quote($field, '/') . ':\s*(.+)$/mi', $headers, $m)) {
            return trim($m[1]);
        }
        return '';
    }

    private function decodeHeader(string $val): string {
        // RFC 2047 encoded-word: =?charset?encoding?text?=
        return preg_replace_callback(
            '/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/',
            function ($m) {
                $charset  = $m[1];
                $encoding = strtoupper($m[2]);
                $text     = $m[3];
                $decoded  = ($encoding === 'B') ? base64_decode($text) : quoted_printable_decode(str_replace('_', ' ', $text));
                return mb_convert_encoding($decoded, 'UTF-8', $charset);
            },
            $val
        ) ?? $val;
    }

    private function extractEmail(string $from): string {
        if (preg_match('/<([^>]+)>/', $from, $m)) return trim($m[1]);
        return trim($from);
    }

    private function extractName(string $from): string {
        $from = $this->decodeHeader($from);
        if (preg_match('/^"?([^"<]+)"?\s*</', $from, $m)) return trim($m[1], ' "');
        if (preg_match('/<([^>]+)>/', $from, $m)) return '';
        return trim($from);
    }

    private function parseDate(string $date): string {
        if (!$date) return date('c');
        $ts = @strtotime($date);
        return $ts ? date('c', $ts) : date('c');
    }
}

/* ── Connexion helper ─────────────────────────────────────────── */
function imapConnect(array $s): ImapClient {
    try {
        $client = new ImapClient($s['host'], (int)$s['port'], (bool)($s['ssl'] ?? true));
        $client->login($s['username'], $s['password']);
        return $client;
    } catch (\RuntimeException $e) {
        respond(401, ['error' => $e->getMessage(), 'hint' => 'Gmail : utilisez un mot de passe d\'application (pas votre mot de passe habituel). Activez IMAP dans Paramètres Gmail → Voir tous les paramètres → Transfert et POP/IMAP.']);
    }
}

/* ── Routes ──────────────────────────────────────────────────── */

if ($m === 'POST' && $action === 'test') {
    $s      = $b['settings'] ?? [];
    $client = imapConnect($s);
    $total  = $client->selectInbox();
    $client->logout();
    respond(200, ['ok' => true, 'total' => $total, 'unread' => 0]);
}

if ($m === 'POST' && $action === 'list') {
    $s       = $b['settings'] ?? [];
    $page    = max(1, (int)($b['page'] ?? 1));
    $perPage = 20;
    $client  = imapConnect($s);
    $total   = $client->selectInbox();

    $start = max(1, $total - ($page - 1) * $perPage);
    $end   = max(1, $start - $perPage + 1);

    $msgs  = [];
    if ($total > 0) {
        $msgs = $client->fetchHeaders($end, $start);
        $msgs = array_reverse($msgs); // plus récent en premier
    }
    $client->logout();
    respond(200, ['messages' => $msgs, 'total' => $total, 'page' => $page]);
}

if ($m === 'POST' && $action === 'read') {
    $s      = $b['settings'] ?? [];
    $num    = (int)($b['uid'] ?? 0);
    $client = imapConnect($s);
    $client->selectInbox();
    $data   = $client->fetchBody($num);
    $client->setFlag($num, 'Seen', true);
    $client->logout();
    respond(200, array_merge(['uid' => $num, 'num' => $num, 'flagged' => false], $data));
}

if ($m === 'POST' && $action === 'send') {
    $s       = $b['settings'] ?? [];
    // Un retour chariot/saut de ligne dans To/Subject/From permettrait d'ajouter
    // des en-têtes arbitraires (Bcc, Cc…) et de détourner le serveur mail du
    // compte en relais de spam — on les retire plutôt que de simplement les
    // encoder, aucun de ces champs n'a besoin d'être multi-lignes.
    $strip   = fn($v) => str_replace(["\r", "\n"], '', (string)$v);
    $to      = $strip($b['to']      ?? '');
    $subject = $strip($b['subject'] ?? '');
    $from    = $strip($s['username'] ?? '');
    $body2   = $b['body'] ?? '';
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) respond(400, ['error' => 'Destinataire invalide']);
    $headers = implode("\r\n", [
        "From: $from",
        "To: $to",
        "Subject: $subject",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: quoted-printable",
    ]);
    if (!@mail($to, $subject, $body2, $headers)) {
        respond(500, ['error' => "Envoi échoué (configurez sendmail ou utilisez SMTP)"]);
    }
    respond(200, ['ok' => true]);
}

respond(405, ['error' => 'Méthode non autorisée']);
