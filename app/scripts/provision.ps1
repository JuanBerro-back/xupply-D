# Xupply - Provision de base de datos PostgreSQL
# Crea el rol administrador `juan_berroteran`, la base `xupply` y aplica el esquema.
param(
  [string]$Root = (Join-Path $PSScriptRoot '..'),
  [string]$DbUser = 'juan_berroteran',
  [string]$DbPassword = '',
  [string]$DbName = 'xupply',
  [int]$DbPort = 5432,
  [string]$PostgresSuperuser = 'postgres',
  [string]$PostgresPassword = ''
)
$ErrorActionPreference = 'Stop'

function Find-Psql {
  $c = Get-Command psql -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $base = 'C:\Program Files\PostgreSQL'
  if (Test-Path $base) {
    foreach ($d in (Get-ChildItem $base -Directory | Sort-Object Name -Descending)) {
      $p = Join-Path $d.FullName 'bin\psql.exe'
      if (Test-Path $p) { return $p }
    }
  }
  throw "psql no encontrado. Instala PostgreSQL 18 (ejecuta scripts/instalar-postgres.ps1 como Administrador) o agrega psql al PATH."
}
$psql = Find-Psql
Write-Host "psql detectado: $psql"

if (-not $PostgresPassword) {
  $sec = Read-Host "Password del superusuario PostgreSQL ($PostgresSuperuser)" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $PostgresPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

$env:PGPASSWORD = $PostgresPassword
try {
  $exists = & $psql -w -h localhost -p $DbPort -U $PostgresSuperuser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'"
  if ($exists -eq '1') {
    & $psql -w -h localhost -p $DbPort -U $PostgresSuperuser -d postgres -c "ALTER ROLE $DbUser WITH LOGIN SUPERUSER PASSWORD '$DbPassword'" | Out-Null
    Write-Host "Rol '$DbUser' actualizado (superusuario)."
  } else {
    & $psql -w -h localhost -p $DbPort -U $PostgresSuperuser -d postgres -c "CREATE ROLE $DbUser WITH LOGIN SUPERUSER PASSWORD '$DbPassword'" | Out-Null
    Write-Host "Rol '$DbUser' creado (superusuario)."
  }

  $dbExists = & $psql -w -h localhost -p $DbPort -U $PostgresSuperuser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
  if ($dbExists -ne '1') {
    & $psql -w -h localhost -p $DbPort -U $PostgresSuperuser -d postgres -c "CREATE DATABASE $DbName OWNER $DbUser" | Out-Null
    Write-Host "Base de datos '$DbName' creada (owner: $DbUser)."
  } else {
    Write-Host "Base de datos '$DbName' ya existe."
  }
}
finally {
  Remove-Item Env:\PGPASSWORD
}

$sqlFile = Join-Path $Root 'server\DB\xupply_schema_postgresql.sql'
$env:PGPASSWORD = $DbPassword
try {
  & $psql -w -h localhost -p $DbPort -U $DbUser -d $DbName -f $sqlFile -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Error aplicando esquema (codigo $LASTEXITCODE)" }
  Write-Host ""
  Write-Host "Base de datos lista!"
  Write-Host "  Conexion: postgres://${DbUser}:***@localhost:${DbPort}/${DbName}"
  Write-Host "  Usuarios de prueba (password: demo1234): admin, gerente, empleado, proveedor, domiciliario"
}
finally {
  Remove-Item Env:\PGPASSWORD
}