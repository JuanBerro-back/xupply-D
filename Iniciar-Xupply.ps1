# Xupply portable - inicia base de datos + abre la aplicacion
# No requiere instalar PostgreSQL ni Node en la maquina.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pgBin = Join-Path $root 'pg\bin'
$appDir = Join-Path $root 'app'
$dataDir = Join-Path $root 'pgdata'
$pgLog = Join-Path $root 'pg.log'
$sqlFile = Join-Path $appDir 'server\DB\xupply_schema_postgresql.sql'
$pw = $env:XUPPLY_DB_PASSWORD
if (-not $pw) { throw 'Define XUPPLY_DB_PASSWORD antes de iniciar Xupply.' }
$port = 5432

function Test-Port([int]$p) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $r = $c.ConnectAsync('127.0.0.1', $p).Wait(600)
    $c.Close()
    return $r
  } catch { return $false }
}

Write-Host '=== Xupply portable ==='

# 1) Crear cluster si no existe
if (Test-Path (Join-Path $dataDir 'PG_VERSION')) {
  Write-Host 'Cluster PostgreSQL ya existe.'
} else {
  Write-Host 'Inicializando cluster PostgreSQL (primera vez)...'
  $pwf = Join-Path $env:TEMP 'xupply_pw.txt'
  Set-Content -Path $pwf -Value $pw -NoNewline -Encoding Ascii
  & "$pgBin\initdb.exe" -D $dataDir -U postgres -A scram-sha-256 --pwfile=$pwf -E UTF8 --no-locale 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { throw 'initdb fallo' }
}

# 2) Arrancar PostgreSQL
if (Test-Port $port) {
  Write-Host "PostgreSQL ya esta corriendo en el puerto $port."
} else {
  Write-Host "Arrancando PostgreSQL en el puerto $port..."
  & "$pgBin\pg_ctl.exe" -D $dataDir -l $pgLog -o "-p $port" start 2>&1 | ForEach-Object { Write-Host $_ }
  $ok = $false
  for ($i = 0; $i -lt 40; $i++) {
    if (Test-Port $port) { $ok = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ok) { throw "PostgreSQL no arranco. Reinicia el PC o revisa: $pgLog" }
  Write-Host 'PostgreSQL arriba.'
}

# 3) Provision idempotente: rol juan_berroteran + base xupply + esquema
$env:PGPASSWORD = $pw
try {
  $role = & "$pgBin\psql.exe" -w -h localhost -p $port -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='juan_berroteran'"
  if ($role -ne '1') {
    & "$pgBin\psql.exe" -w -h localhost -p $port -U postgres -d postgres -c "CREATE ROLE juan_berroteran WITH LOGIN SUPERUSER PASSWORD '$pw'" | Out-Null
    Write-Host 'Rol juan_berroteran creado.'
  }
  $db = & "$pgBin\psql.exe" -w -h localhost -p $port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='xupply'"
  if ($db -ne '1') {
    & "$pgBin\psql.exe" -w -h localhost -p $port -U postgres -d postgres -c "CREATE DATABASE xupply OWNER juan_berroteran" | Out-Null
    Write-Host 'Base xupply creada.'
  }
  $c = & "$pgBin\psql.exe" -w -h localhost -p $port -U juan_berroteran -d xupply -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
  if (-not $c -or [int]$c -eq 0) {
    Write-Host 'Aplicando esquema y datos de prueba...'
    & "$pgBin\psql.exe" -w -h localhost -p $port -U juan_berroteran -d xupply -f $sqlFile -v ON_ERROR_STOP=1 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw 'Error aplicando el esquema' }
  }
  Write-Host "Base de datos lista ($c tablas)."
}
finally { Remove-Item Env:\PGPASSWORD }

# 4) Abrir la aplicacion Electron
Write-Host 'Abriendo Xupply...'
Push-Location $appDir
Start-Process (Join-Path $appDir 'node_modules\electron\dist\electron.exe') -ArgumentList '.' -WorkingDirectory $appDir
Pop-Location
Write-Host 'Listo.'