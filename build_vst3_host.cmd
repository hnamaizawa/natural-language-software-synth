@echo off
setlocal
cd /d "%~dp0"

where cmake >nul 2>nul || (
  echo [ERROR] CMake was not found. Install CMake and Visual Studio 2022 Desktop development with C++.
  exit /b 1
)
where git >nul 2>nul || (
  echo [ERROR] Git was not found. The pinned VST3 SDK and miniaudio dependencies are fetched by CMake.
  exit /b 1
)

set BUILD_DIR=native\vst3_host\build
cmake -S native\vst3_host -B "%BUILD_DIR%" -G "Visual Studio 17 2022" -A x64 || exit /b 1
cmake --build "%BUILD_DIR%" --config Release || exit /b 1

echo.
echo [OK] VST3 host built:
echo %CD%\%BUILD_DIR%\Release\nlss_vst3_host.exe
endlocal
