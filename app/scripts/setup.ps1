# Xupply Desktop - construccion de dependencias
# Instala dependencias y compila server/ y web/.
param([string]$PostgresPassword = "")
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'

foreach ($dir in @('server', 'web')) {
  Write-Host "=== npm install: $dir ==="
  Push-Location (Join-Path $root $dir)
  npm install 2>&1 | Select-Object -Last 3
  if ($LASTEXITCODE -ne 0) { throw "npm install fallo en $dir" }
  Write-Host "=== build: $dir ==="
  npm run build 2>&1 | Select-Object -Last 5
  if ($LASTEXITCODE -ne 0) { throw "build fallo en $dir" }
  Pop-Location
}

Write-Host "=== npm install: electron ==="
Push-Location $root
npm install 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) { throw "npm install fallo (electron)" }
Pop-Location

if ($PostgresPassword) {
  & (Join-Path $PSScriptRoot 'provision.ps1') -PostgresPassword $PostgresPassword
}

Write-Host ""
Write-Host "Construccion completa. Inicia con el acceso directo 'Xupply' del Escritorio o con: npm start"