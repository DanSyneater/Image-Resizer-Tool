@echo off
title Stable Diffusion WebUI Forge (API on port 7860)
cd /d "%~dp0sd-webui-forge"
echo Starting SD WebUI Forge with API enabled...
echo Keep this window open while generating images in the Image Resizer app.
echo.
call webui-user.bat
