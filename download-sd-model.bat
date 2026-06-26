@echo off
setlocal
set DEST=%~dp0sd-webui-forge\models\Stable-diffusion
set OUT=%DEST%\v1-5-pruned-emaonly.safetensors
set URL=https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors

if not exist "%DEST%" mkdir "%DEST%"

if exist "%OUT%" (
  echo Checkpoint already downloaded: %OUT%
  exit /b 0
)

echo Downloading Stable Diffusion 1.5 checkpoint (~4 GB)...
echo This is a one-time download. Please wait.
curl.exe -L --progress-bar -o "%OUT%" "%URL%"
if errorlevel 1 (
  echo Download failed.
  exit /b 1
)
echo Done: %OUT%
