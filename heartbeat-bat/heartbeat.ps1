param(
    [Parameter(Mandatory=$true)][string]$AgentId,
    [Parameter(Mandatory=$true)][ValidateSet('caisse','serveur')][string]$Type
)

$WsUri   = 'wss://opsamabel.tech/ws-presence'
$Key     = 'AMBT2026!HB'
$LogFile = "$env:LOCALAPPDATA\BETNABISO\heartbeat_$Type.log"

# Empeche deux instances simultanees pour le meme agent/type
$mutex = New-Object System.Threading.Mutex($false, "Global\BETNABISO_Heartbeat_${Type}_${AgentId}")
if (-not $mutex.WaitOne(0)) { exit }

function Write-Log([string]$msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
    if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 2MB) {
        (Get-Content $LogFile -Tail 500) | Set-Content $LogFile
    }
}

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# Decalage aleatoire au demarrage pour eviter que toutes les machines se connectent en meme temps
Start-Sleep -Seconds (Get-Random -Minimum 0 -Maximum 6)

$backoffSeconds = 5

while ($true) {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket

    try {
        # Delai maximum uniquement pour l'etablissement de la connexion et l'envoi initial,
        # pas pour la boucle de reception qui elle doit rester ouverte indefiniment.
        $connectCts = New-Object System.Threading.CancellationTokenSource
        $connectCts.CancelAfter(10000)

        $ws.ConnectAsync([Uri]$WsUri, $connectCts.Token).GetAwaiter().GetResult()

        $authMsg  = @{ agentId = $AgentId; type = $Type; key = $Key } | ConvertTo-Json -Compress
        $sendBuf  = [System.Text.Encoding]::UTF8.GetBytes($authMsg)
        $sendSeg  = New-Object System.ArraySegment[byte] (,$sendBuf)
        $ws.SendAsync($sendSeg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $connectCts.Token).GetAwaiter().GetResult() | Out-Null

        Write-Log 'Connecte, authentification envoyee'
        $backoffSeconds = 5

        $recvBuf = New-Object byte[] 1024
        $recvSeg = New-Object System.ArraySegment[byte] (,$recvBuf)

        # Boucle de reception : ne sert qu'a detecter la fermeture de connexion
        # (le serveur envoie des pings protocolaires auxquels .NET repond seul).
        while ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
            $result = $ws.ReceiveAsync($recvSeg, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
            if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
                Write-Log "Ferme par le serveur : $($result.CloseStatus) $($result.CloseStatusDescription)"
                break
            } elseif ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Text) {
                $msg = [System.Text.Encoding]::UTF8.GetString($recvBuf, 0, $result.Count)
                Write-Log "Recu : $msg"
            }
        }
    } catch {
        $detail = ''
        $ex = $_.Exception
        while ($ex) {
            $detail += " -> $($ex.GetType().Name): $($ex.Message)"
            $ex = $ex.InnerException
        }
        Write-Log "Erreur :$detail"
    } finally {
        try { $ws.Dispose() } catch {}
    }

    Write-Log "Deconnecte, nouvelle tentative dans ${backoffSeconds}s"
    Start-Sleep -Seconds $backoffSeconds
    $backoffSeconds = [Math]::Min($backoffSeconds * 2, 60)
}
