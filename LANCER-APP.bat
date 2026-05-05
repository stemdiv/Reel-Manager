@echo off
title YouTube Playlist Manager
echo.
echo  ====================================
echo   YouTube Playlist Manager
echo  ====================================
echo.
echo  Demarrage du serveur local...
echo  L'app va s'ouvrir dans ton navigateur.
echo.
echo  NE FERME PAS cette fenetre tant que
echo  tu utilises l'app !
echo.
echo  Pour arreter : ferme cette fenetre
echo  ====================================
echo.

cd /d "%~dp0"

:: Ouvre le navigateur
start "" "http://localhost:8080/youtube-playlist-manager.html"

:: Lance un serveur HTTP via PowerShell (pas besoin de Python)
powershell -ExecutionPolicy Bypass -Command ^
  "$listener = New-Object System.Net.HttpListener; " ^
  "$listener.Prefixes.Add('http://localhost:8080/'); " ^
  "$listener.Start(); " ^
  "Write-Host ''; " ^
  "Write-Host '  Serveur demarre sur http://localhost:8080'; " ^
  "Write-Host '  Appuie sur Ctrl+C ou ferme cette fenetre pour arreter.'; " ^
  "Write-Host ''; " ^
  "$docRoot = (Get-Location).Path; " ^
  "while ($listener.IsListening) { " ^
  "  $ctx = $listener.GetContext(); " ^
  "  $req = $ctx.Request; " ^
  "  $resp = $ctx.Response; " ^
  "  $localPath = $req.Url.LocalPath.TrimStart('/'); " ^
  "  if ($localPath -eq '') { $localPath = 'youtube-playlist-manager.html'; } " ^
  "  $filePath = Join-Path $docRoot $localPath; " ^
  "  if (Test-Path $filePath) { " ^
  "    $bytes = [System.IO.File]::ReadAllBytes($filePath); " ^
  "    $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); " ^
  "    switch ($ext) { " ^
  "      '.html' { $resp.ContentType = 'text/html; charset=utf-8'; } " ^
  "      '.js'   { $resp.ContentType = 'application/javascript'; } " ^
  "      '.css'  { $resp.ContentType = 'text/css'; } " ^
  "      '.json' { $resp.ContentType = 'application/json'; } " ^
  "      default { $resp.ContentType = 'application/octet-stream'; } " ^
  "    } " ^
  "    $resp.ContentLength64 = $bytes.Length; " ^
  "    $resp.OutputStream.Write($bytes, 0, $bytes.Length); " ^
  "  } else { " ^
  "    $resp.StatusCode = 404; " ^
  "    $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found'); " ^
  "    $resp.OutputStream.Write($msg, 0, $msg.Length); " ^
  "  } " ^
  "  $resp.OutputStream.Close(); " ^
  "  Write-Host \"  $($req.HttpMethod) $($req.Url.LocalPath)\"; " ^
  "}"

pause
