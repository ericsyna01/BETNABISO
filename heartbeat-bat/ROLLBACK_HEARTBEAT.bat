@echo off
:: ============================================================
::  BETNABISO - Rollback Heartbeat
::  Revient a l'ancienne version (ping HTTP) en cas de probleme
::  avec la version WebSocket. Ne demande pas l'AGENT_ID : la
::  tache deja installee est conservee.
:: ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Droits administrateur requis, elevation en cours...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

title BETNABISO - Rollback Heartbeat (retour HTTP)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-heartbeat.ps1" -ScriptDir "%SCRIPT_DIR%" -SourceFile "heartbeat_http_legacy.ps1"

pause
