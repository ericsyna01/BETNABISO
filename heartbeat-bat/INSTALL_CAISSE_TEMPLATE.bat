@echo off
:: ============================================================
::  BETNABISO - Installation Heartbeat (CAISSE)
::  Installe une tache planifiee en arriere-plan, sans fenetre
::  visible. A executer UNE SEULE FOIS par machine.
::  Remplacer AGENT_ID par l'identifiant reel de l'agent
::  Exemple : set AGENT_ID=2020079
:: ============================================================

set AGENT_ID=REMPLACER_ICI

:: Auto-elevation : relance ce script en administrateur si necessaire
:: (Register-ScheduledTask exige des droits admin)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Droits administrateur requis, elevation en cours...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Chemin du dossier sans le backslash final (evite un guillemet mal interprete)
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

title BETNABISO - Installation Heartbeat Caisse

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-task.ps1" -AgentId "%AGENT_ID%" -Type caisse -ScriptDir "%SCRIPT_DIR%"

pause
