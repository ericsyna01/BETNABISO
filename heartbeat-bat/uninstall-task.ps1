param(
    [Parameter(Mandatory=$true)][ValidateSet('caisse','serveur')][string]$Type,
    [switch]$RemoveFiles
)

$ErrorActionPreference = 'Stop'

try {
    $taskName   = "BETNABISO_Heartbeat_$Type"
    $InstallDir = "$env:LOCALAPPDATA\BETNABISO"

    # Arreter le processus en cours pour ce type
    Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*heartbeat.ps1*" -and $_.CommandLine -like "*-Type*$Type*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

    # Supprimer la tache planifiee
    $existed = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host " ========================================="
    if ($existed) {
        Write-Host "  Heartbeat $Type desinstalle"
        Write-Host "  Tache planifiee supprimee et processus arrete."
    } else {
        Write-Host "  Aucune tache '$taskName' trouvee"
        Write-Host "  (deja desinstallee, ou jamais installee sur ce type)"
    }

    if ($RemoveFiles) {
        Remove-Item -Path "$InstallDir\heartbeat_$Type.log" -Force -ErrorAction SilentlyContinue

        $otherType      = if ($Type -eq 'caisse') { 'serveur' } else { 'caisse' }
        $otherTaskExists = Get-ScheduledTask -TaskName "BETNABISO_Heartbeat_$otherType" -ErrorAction SilentlyContinue

        if (-not $otherTaskExists) {
            Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  Fichiers et dossier d'installation supprimes."
        } else {
            Write-Host "  Fichiers partages conserves (tache '$otherType' encore active sur cette machine)."
        }
    }
    Write-Host " ========================================="
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host " ========================================="
    Write-Host "  ECHEC DE LA DESINSTALLATION"
    Write-Host "  $($_.Exception.Message)"
    Write-Host " ========================================="
    Write-Host ""
    exit 1
}
