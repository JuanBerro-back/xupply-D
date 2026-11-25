@echo off
title Xupply
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar-Xupply.ps1"
pause