param (
    [string]$RenderUrl = "https://xupply-d.onrender.com"
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Compilador de APK Xupply para Render  " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend URL configurada: $RenderUrl" -ForegroundColor Yellow

$rootDir = $PSScriptRoot
$webDir = Join-Path $rootDir "app\web"
$androidDir = Join-Path $webDir "android"
$outputDir = Join-Path $rootDir "dist-apk"

# Configurar JAVA_HOME compatible con Capacitor 8 (JDK 21)
$jdk21Paths = @(
    (Get-Item -Path "C:\Program Files\Java\jdk-21*" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName),
    "C:\Program Files\Java\latest\jdk-21",
    "C:\Program Files\Java\jdk-21",
    "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot",
    (Get-Item -Path "C:\Program Files\Eclipse Adoptium\jdk-21*" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName)
)
$jdk21 = $jdk21Paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($jdk21) {
    $env:JAVA_HOME = $jdk21
    $env:PATH = "$jdk21\bin;$env:PATH"
    Write-Host "Utilizando JDK: $jdk21" -ForegroundColor DarkGray
}

# Configurar ANDROID_HOME si existe
$defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (Test-Path $defaultSdk) {
    $env:ANDROID_HOME = $defaultSdk
    $env:ANDROID_SDK_ROOT = $defaultSdk
    $localProp = Join-Path $androidDir "local.properties"
    $cleanSdk = $defaultSdk.Replace('\', '/')
    "sdk.dir=$cleanSdk" | Set-Content -Path $localProp -Encoding UTF8
    Write-Host "Utilizando Android SDK: $defaultSdk" -ForegroundColor DarkGray
}

# 1. Compilar Frontend Vite con VITE_API_URL
Write-Host "`n[1/4] Compilando frontend web..." -ForegroundColor Green
$env:VITE_API_URL = $RenderUrl
Push-Location $webDir
try {
    npm run build
} finally {
    Pop-Location
}

# 2. Sincronizar Capacitor con el proyecto Android
Write-Host "`n[2/4] Sincronizando con Capacitor Android..." -ForegroundColor Green
Push-Location $webDir
try {
    npx cap sync android
} finally {
    Pop-Location
}

# 3. Compilar APK con Gradle
Write-Host "`n[3/4] Compilando APK con Gradle..." -ForegroundColor Green
Push-Location $androidDir
try {
    .\gradlew.bat assembleDebug
} finally {
    Pop-Location
}

# 4. Copiar APK a carpeta dist-apk
Write-Host "`n[4/4] Empaquetando archivo APK..." -ForegroundColor Green
$sourceApk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"

if (Test-Path $sourceApk) {
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    $targetApk = Join-Path $outputDir "Xupply.apk"
    Copy-Item -Path $sourceApk -Destination $targetApk -Force
    $publicApk = Join-Path $webDir "public\Xupply.apk"
    Copy-Item -Path $sourceApk -Destination $publicApk -Force
    $distApk = Join-Path $webDir "dist\Xupply.apk"
    if (Test-Path (Join-Path $webDir "dist")) {
        Copy-Item -Path $sourceApk -Destination $distApk -Force
    }
    $sizeMb = [math]::Round(((Get-Item $targetApk).Length / 1MB), 2)

    Write-Host "`n=========================================" -ForegroundColor Green
    Write-Host "   APK GENERADO CON ÉXITO!               " -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "Ubicación: $targetApk" -ForegroundColor White
    Write-Host "Tamaño:    $sizeMb MB" -ForegroundColor White
    Write-Host "Backend:   $RenderUrl" -ForegroundColor White
    Write-Host "`nPara instalar en tu teléfono:" -ForegroundColor Cyan
    Write-Host "1. Conecta tu celular por USB o envíate 'dist-apk/Xupply.apk' (ej. por WhatsApp, Telegram o Drive)." -ForegroundColor Gray
    Write-Host "2. Ábrelo en Android y selecciona 'Instalar'." -ForegroundColor Gray
    Write-Host "3. Si tu URL en Render es distinta a $RenderUrl, puedes cambiarla desde la app en el botón 'Servidor' en la pantalla de inicio de sesión." -ForegroundColor Gray
} else {
    Write-Error "No se encontró el archivo APK generado en $sourceApk"
}
