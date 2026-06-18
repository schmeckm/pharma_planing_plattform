@echo off
REM Hard Allocation Platform — wrapper for PowerShell start script.
REM Examples:
REM   start                  -> shows help
REM   start dev              -> backend + cockpit + frontend (local)
REM   start docker           -> docker compose up
REM   start docker:down
REM   start stop
REM   start status
REM   start test

setlocal
set ARGS=%*
if "%ARGS%"=="" set ARGS=help

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %ARGS%
endlocal
