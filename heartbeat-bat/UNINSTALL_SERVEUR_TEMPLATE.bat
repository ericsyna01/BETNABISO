@echo off
:: ============================================================
::  BETNABISO - Desinstallation Heartbeat (SERVEUR)
::  Arrete et supprime la tache planifiee + les fichiers installes.
:: ============================================================

:: Auto-elevation : relance ce script en administrateur si necessaire
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Droits administrateur requis, elevation en cours...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

title BETNABISO - Desinstallation Heartbeat Serveur

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-task.ps1" -Type serveur -RemoveFiles

pause
