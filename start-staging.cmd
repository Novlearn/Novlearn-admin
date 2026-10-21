@echo off
cd /d "%~dp0"
node scripts/run-staging-admin.mjs
if errorlevel 1 pause
