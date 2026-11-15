@echo off
chcp 65001 >nul
title Instalador de Escritorio - HallyRentCar Admin
echo ========================================================
echo   Creando acceso directo de HallyRentCar en Escritorio
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); ^
   $shortcutPath = Join-Path $desktop 'HallyRentCar Admin.lnk'; ^
   $icoSource = '%~dp0public\icons\hallyrentcar.ico'; ^
   $appDataDir = Join-Path $env:LOCALAPPDATA 'HallyRentCar'; ^
   New-Item -ItemType Directory -Force -Path $appDataDir | Out-Null; ^
   $icoDest = Join-Path $appDataDir 'hallyrentcar.ico'; ^
   if (Test-Path $icoSource) { Copy-Item $icoSource $icoDest -Force }; ^
   $edgePaths = @(\"$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe\", \"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe\", \"$env:ProgramFiles\Google\Chrome\Application\chrome.exe\"); ^
   $browser = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1; ^
   $wsh = New-Object -ComObject WScript.Shell; ^
   $sc = $wsh.CreateShortcut($shortcutPath); ^
   if ($browser) { ^
     $sc.TargetPath = $browser; ^
     $sc.Arguments = '--app=https://hallyrentcar.vercel.app/admin/dashboard?source=desktop'; ^
   } else { ^
     $sc.TargetPath = 'https://hallyrentcar.vercel.app/admin/dashboard?source=desktop'; ^
   } ^
   if (Test-Path $icoDest) { $sc.IconLocation = \"$icoDest,0\" }; ^
   $sc.Description = 'HallyRentCar - Panel Administrativo'; ^
   $sc.Save(); ^
   Write-Host '¡Listo! Se ha creado el icono HallyRentCar Admin en tu Escritorio.' -ForegroundColor Green"

echo.
pause
