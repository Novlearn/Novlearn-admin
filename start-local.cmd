@echo off
cd /d "%~dp0"
node scripts/start-local-core.mjs
if errorlevel 1 pause
