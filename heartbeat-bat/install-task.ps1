param(
    [Parameter(Mandatory=$true)][string]$AgentId,
    [Parameter(Mandatory=$true)][ValidateSet('caisse','serveur')][string]$Type,
    [Parameter(Mandatory=$true)][string]$ScriptDir
)

$ErrorActionPreference = 'Stop'

try {
    $InstallDir = "$env:LOCALAPPDATA\BETNABISO"

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    Copy-Item -Path (Join-Path $ScriptDir 'heartbeat.ps1') -Destination "$InstallDir\heartbeat.ps1" -Force

    Copy-Item -Path (Join-Path $ScriptDir 'heartbeat_launcher.vbs') -Destination "$InstallDir\heartbeat_launcher.vbs" -Force

    $taskName = "BETNABISO_Heartbeat_$Type"

    # Lancement via wscript (fenetre reellement invisible) plutot que powershell -WindowStyle Hidden,
    # qui peut laisser une fenetre/entree dans la barre des taches quand demarre par le Planificateur.
    $argument = "`"$InstallDir\heartbeat_launcher.vbs`" `"$AgentId`" `"$Type`""

    $action   = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument $argument
    $trigger  = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

    Start-ScheduledTask -TaskName $taskName

    Write-Host ""
    Write-Host " ========================================="
    Write-Host "  Installation terminee"
    Write-Host "  Agent : $AgentId"
    Write-Host "  Type  : $Type"
    Write-Host "  Le monitoring tourne desormais en tache de fond,"
    Write-Host "  sans fenetre visible, et redemarre automatiquement"
    Write-Host "  a chaque ouverture de session."
    Write-Host " ========================================="
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host " ========================================="
    Write-Host "  ECHEC DE L'INSTALLATION"
    Write-Host "  Message  : $($_.Exception.Message)"
    Write-Host "  Type     : $($_.Exception.GetType().FullName)"
    Write-Host "  Ligne    : $($_.InvocationInfo.ScriptLineNumber) -> $($_.InvocationInfo.Line.Trim())"
    Write-Host "  Categorie: $($_.CategoryInfo.Category) ($($_.CategoryInfo.Activity))"
    Write-Host " ========================================="
    Write-Host ""
    exit 1
}