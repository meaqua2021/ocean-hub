@echo off
rem ============================================================
rem  ocean-hub start (pure bat, no console window, no .vbs)
rem  Double-click or boot shortcut: relaunch self hidden, then run node
rem  If port 5200 is already listening, exit quietly (no second instance)
rem  Stop: taskkill the node process, or flip the switch in the web console
rem  NOTE: keep this file ASCII-only, cmd codepage breaks on UTF-8 text
rem ============================================================
setlocal
set "ROOT=%~dp0"
set "HUB_PORT=5200"
if not "%~1"=="" set "HUB_PORT=%~1"

if /i "%~1"=="__hidden" goto :run
if /i "%~2"=="__hidden" goto :run

powershell -NoProfile -Command "if(Get-NetTCPConnection -State Listen -LocalPort %HUB_PORT% -ErrorAction SilentlyContinue){exit 10}" >nul 2>&1
if %errorlevel%==10 exit /b 0

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList %HUB_PORT%,'__hidden' -WindowStyle Hidden" >nul 2>&1
exit /b 0

:run
rem prefer bun (far lower rss than node), fall back to node
set "RUNTIME="
if exist "C:\Users\0\.bun\bin\bun.exe" set "RUNTIME=C:\Users\0\.bun\bin\bun.exe"
if not defined RUNTIME where bun.exe >nul 2>nul && set "RUNTIME=bun.exe"
if not defined RUNTIME if exist "C:\Program Files\nodejs\node.exe" set "RUNTIME=C:\Program Files\nodejs\node.exe"
if not defined RUNTIME set "RUNTIME=node.exe"
cd /d "%ROOT%"
if not exist "data\logs" mkdir "data\logs"
"%RUNTIME%" server\index.js>> "data\logs\hub.out.log" 2>>"data\logs\hub.err.log"
