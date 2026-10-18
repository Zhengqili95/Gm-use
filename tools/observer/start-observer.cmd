@echo off
rem Start the vibe-learn observer and open it in the browser.
rem If the observer is already running, this just opens it and closes.
cd /d "%~dp0"
node server.js --open
if errorlevel 1 pause
