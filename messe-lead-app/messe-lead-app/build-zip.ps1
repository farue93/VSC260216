# ═══════════════════════════════════════════════════
# OCTRION Messe-Lead-App — ZIP-Build für Vertrieb
# ═══════════════════════════════════════════════════
# Erstellt eine ZIP-Datei mit allen nötigen App-Dateien
# Aufruf: .\build-zip.ps1

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputZip = Join-Path $scriptDir "OCTRION-Lead-App.zip"

# Temp-Ordner erstellen
$tempDir = Join-Path $env:TEMP "octrion-lead-app-build"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null
$appDir = Join-Path $tempDir "OCTRION-Lead-App"
New-Item -ItemType Directory -Path $appDir | Out-Null

Write-Host "Sammle App-Dateien..." -ForegroundColor Cyan

# Hauptdatei
Copy-Item (Join-Path $scriptDir "oktopus-lead-app.html") $appDir

# Bilder
$images = @(
    "13459_OCTRION_Bildmarke_RGB_lila.png",
    "ctrion_text.png",
    "letter_c.png", "letter_t.png", "letter_r.png",
    "letter_i.png", "letter_o2.png", "letter_n.png"
)
foreach ($img in $images) {
    Copy-Item (Join-Path $scriptDir $img) $appDir
}

# Video
$video = Join-Path $scriptDir "OCTRION-Image-Video-04.mp4"
if (Test-Path $video) {
    Copy-Item $video $appDir
    Write-Host "  + Video (32 MB)" -ForegroundColor DarkGray
}

# Tesseract OCR (offline)
$tessDir = Join-Path $scriptDir "tesseract"
if (Test-Path $tessDir) {
    $destTess = Join-Path $appDir "tesseract"
    New-Item -ItemType Directory -Path $destTess | Out-Null
    Copy-Item (Join-Path $tessDir "*") $destTess
    Write-Host "  + Tesseract OCR (21 MB)" -ForegroundColor DarkGray
}

# README erstellen
$readme = @"
OCTRION Lead-App — Offline-Version
═══════════════════════════════════

So startest du die App:

1. Diesen Ordner auf dein Gerät kopieren (Tablet/Handy/Laptop)
2. Die Datei "oktopus-lead-app.html" im Browser öffnen
   - Chrome, Edge oder Firefox empfohlen
   - Auf Android: mit "Dateien"-App navigieren und antippen
   - Auf iOS: Chrome verwenden (nicht Safari)
3. Fertig — die App funktioniert komplett offline

Daten speichern:
- Alle Kontakte werden automatisch im Browser gespeichert
- Nach der Messe: Einstellungen → "Kontakte exportieren (JSON)"
- Die exportierte Datei per Mail/Teams an die Zentrale schicken

WICHTIG:
- Browser-Cache NICHT löschen (sonst gehen gespeicherte Kontakte verloren)
- Bei Updates: Nur die HTML-Datei ersetzen, Kontakte bleiben erhalten

Version: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
"@
$readme | Out-File -FilePath (Join-Path $appDir "LIES_MICH.txt") -Encoding UTF8

# ZIP erstellen
if (Test-Path $outputZip) { Remove-Item $outputZip -Force }
Compress-Archive -Path $appDir -DestinationPath $outputZip -CompressionLevel Optimal

# Aufräumen
Remove-Item $tempDir -Recurse -Force

$size = [math]::Round((Get-Item $outputZip).Length / 1MB, 1)
Write-Host ""
Write-Host "✓ ZIP erstellt: $outputZip ($size MB)" -ForegroundColor Green
Write-Host "  → Diese Datei an Vertriebler verteilen" -ForegroundColor Yellow
