@echo off
title Fix SD WebUI Forge Python deps
cd /d "%~dp0sd-webui-forge"
set PY=venv\Scripts\python.exe
if not exist "%PY%" (
  echo Run start-sd-webui.bat first to create the venv.
  pause
  exit /b 1
)
"%PY%" -m pip install setuptools==69.5.1 "numpy==1.26.4" "pillow<11" opencv-python-headless==4.10.0.84
"%PY%" -m pip install --no-build-isolation "https://github.com/openai/CLIP/archive/d50d76daa670286dd6cacf3bcd80b5e4823fc8e1.zip" 2>nul
echo Dependencies pinned. You can run start-sd-webui.bat now.
pause
