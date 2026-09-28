# Xupply - instalacion de PostgreSQL 18 (requiere PowerShell como ADMINISTRADOR)
# Ejecuta el instalador de PostgreSQL en modo silencioso y luego provisiona la BD.
param(
  [string]$SuperPassword = ''
)
$ErrorActionPreference = 'Stop'

$id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object System.Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Este script debe ejecutarse en una PowerShell ELEVADA (como Administrador).'
}

$installer = Join-Path $env:USERPROFILE 'postgresql_18.exe'
if (-not (Test-Path $installer)) {
  $installer = 'C:\Users\jdbpb\Desktop\tareas\xupply\postgresql_18.exe'
}
if (-not (Test-Path $installer)) {
  throw "Instalador no encontrado. Descarga PostgreSQL 18 y guardalo como: $env:USERPROFILE\postgresql_18.exe"
}

Write-Host "Instalando PostgreSQL 18 desde: $installer"
& $installer `
  --mode unattended `
  --unattendedmodeui none `
  --superpassword $SuperPassword `
  --serverport 5432 `
  --datadir "C:\Program Files\PostgreSQL\18\data" `
  --servicename postgresql-x64-18 `
  --locale en_US 2>&1
if ($LASTEXITCODE -ne 0) { throw "El instalador fallo con codigo $LASTEXITCODE" }

Write-Host "PostgreSQL instalado. Provisionando la base de datos..."
& (Join-Path $PSScriptRoot 'provision.ps1') -PostgresPassword $SuperPassword
Write-Host "Listo! Abre la aplicacion desde el acceso directo 'Xupply' en el Escritorio."