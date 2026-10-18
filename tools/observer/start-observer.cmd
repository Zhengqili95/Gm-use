@echo off
rem Start the vibe-learn observer and open it in the browser.
cd /d "%~dp0"
node server.js --open
pause
