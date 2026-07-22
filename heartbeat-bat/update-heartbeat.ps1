param(
    [Parameter(Mandatory=$true)][string]$ScriptDir,
    [string]$SourceFile = 'heartbeat.ps1'
)

$ErrorActionPreference = 'Stop'
$InstallDir = "$env:LOCALAPPDATA\BETNABISO"

try {
    if (-not (Test-Path $InstallDir)) {
        Write-Host ""
        Write-Host " ========================================="
        Write-Host "  Aucune installation heartbeat trouvee sur cette machine"
        Write-Host "  ($InstallDir absent) - rien a mettre a jour."
        Write-Host " ========================================="
        Write-Host ""
        exit 0
    }

    Copy-Item -Path (Join-Path $ScriptDir $SourceFile) -Destination "$InstallDir\heartbeat.ps1" -Force

    $updated = @()
    foreach ($type in @('caisse', 'serveur')) {
        $taskName = "BETNABISO_Heartbeat_$type"
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task) {
            # Stopper l'instance en cours pour forcer le rechargement du nouveau script
            Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -like "*heartbeat.ps1*" -and $_.CommandLine -like "*-Type*$type*" } |
                ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

            Start-ScheduledTask -TaskName $taskName
            $updated += $type
        }
    }

    Write-Host ""
    Write-Host " ========================================="
    Write-Host "  heartbeat.ps1 mis a jour (source : $SourceFile)"
    if ($updated.Count -gt 0) {
        Write-Host "  Tache(s) redemarree(s) : $($updated -join ', ')"
    } else {
        Write-Host "  Fichier copie mais aucune tache planifiee active trouvee."
    }
    Write-Host " ========================================="
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host " ========================================="
    Write-Host "  ECHEC DE LA MISE A JOUR"
    Write-Host "  Message  : $($_.Exception.Message)"
    Write-Host "  Ligne    : $($_.InvocationInfo.ScriptLineNumber) -> $($_.InvocationInfo.Line.Trim())"
    Write-Host " ========================================="
    Write-Host ""
    exit 1
}
