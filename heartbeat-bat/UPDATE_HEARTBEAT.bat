@echo off
:: ============================================================
::  BETNABISO - Mise a jour Heartbeat
::  Remplace heartbeat.ps1 par la version a connexion persistante
::  (WebSocket vers le service de presence) et redemarre la
::  tache planifiee existante (caisse et/ou serveur).
::  Ne demande PAS l'AGENT_ID : la tache deja installee est conservee.
:: ============================================================

:: Auto-elevation : relance ce script en administrateur si necessaire
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Droits administrateur requis, elevation en cours...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

title BETNABISO - Mise a jour Heartbeat

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-heartbeat.ps1" -ScriptDir "%SCRIPT_DIR%"

pause
