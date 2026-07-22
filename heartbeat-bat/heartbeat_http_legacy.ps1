param(
    [Parameter(Mandatory=$true)][string]$AgentId,
    [Parameter(Mandatory=$true)][ValidateSet('caisse','serveur')][string]$Type
)

$Api     = 'https://opsamabel.tech/api/heartbeat'
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

# Decalage aleatoire au demarrage pour eviter que toutes les machines pingent en meme temps
Start-Sleep -Seconds (Get-Random -Minimum 0 -Maximum 6)

$sleepSeconds = 20

while ($true) {
    try {
        $body = @{ agentId = $AgentId; type = $Type; key = $Key } | ConvertTo-Json -Compress
        $resp = Invoke-RestMethod -Uri $Api -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 10
        $sleepSeconds = if ($resp.nextPollSeconds) { [int]$resp.nextPollSeconds } else { 20 }
        Write-Log "Ping OK ($($resp.status), prochain dans ${sleepSeconds}s)"
    } catch {
        $errMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $apiBody = $reader.ReadToEnd()
                if ($apiBody) { $errMsg = "$errMsg | $apiBody" }
            } catch { }
        }
        Write-Log "Erreur : $errMsg"
        $sleepSeconds = 60
    }
    Start-Sleep -Seconds $sleepSeconds
}
