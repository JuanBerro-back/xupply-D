/**
 * Auditoría de arquitectura: rutas congeladas + límites entre módulos.
 *
 * - El inventario de rutas (backend y frontend) se guarda en
 *   `scripts/snapshots/routes.json`. Cualquier alta, baja o cambio de path
 *   debe actualizarse de forma explícita con `npm run check:structure:update`.
 * - Ningún módulo puede importar internos de otro módulo. Las entradas públicas
 *   (`*.routes.ts` / `routes.tsx`) sí pueden referirse entre sí porque son la
 *   superficie de ensamblaje, no implementación.
 * - `shared/` no puede importar módulos.
 * - `app.ts` y `App.tsx` solo ensamblan routers/rutas (y los widgets de layout).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = join(root, 'scripts', 'snapshots', 'routes.json');
const update = process.argv.includes('--update');

const backendSrc = join(root, 'app', 'backend', 'src');
const frontendSrc = join(root, 'app', 'frontend', 'src');
const problems = [];

function read(file) {
  return readFileSync(file, 'utf8');
}

function rel(file) {
  return relative(root, file).split(sep).join('/');
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    })
    .sort();
}

function isInside(file, dir) {
  const value = relative(dir, file);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function domainOf(file, base) {
  return relative(base, file).split(sep)[0];
}

function collectBackendRoutes() {
  const appSource = read(join(backendSrc, 'app.ts'));
  const mounts = [...appSource.matchAll(/app\.use\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
  const direct = [...appSource.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)]
    .map((m) => `${m[1].toUpperCase()} ${m[2]}`)
    .sort();

  const endpoints = [];
  const modulesDir = join(backendSrc, 'modules');
  for (const file of walk(modulesDir)) {
    if (!file.endsWith('.routes.ts')) continue;
    const domain = domainOf(file, modulesDir);
    for (const match of read(file).matchAll(/\brouter\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      endpoints.push(`${domain} ${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  return { mounts, direct, endpoints: endpoints.sort() };
}

function collectFrontendRoutes() {
  const routes = [];
  const modulesDir = join(frontendSrc, 'modules');
  for (const file of walk(modulesDir)) {
    if (file.split(sep).pop() !== 'routes.tsx') continue;
    const domain = domainOf(file, modulesDir);
    const source = read(file);
    for (const match of source.matchAll(/\bpath=(["'])([^"']+)\1/g)) {
      routes.push(`${domain} ${match[2]}`);
    }
    for (const _match of source.matchAll(/<Route\s+index\b/g)) {
      routes.push(`${domain} (index)`);
    }
  }
  return routes.sort();
}

function checkBoundaries(label, srcRoot, isRouteEntry) {
  const modulesDir = join(srcRoot, 'modules');
  const sharedDir = join(srcRoot, 'shared');
  const specs = [
    /\bfrom\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /\bimport\s+['"](\.[^'"]+)['"]/g,
  ];

  for (const file of walk(srcRoot)) {
    const inModules = isInside(file, modulesDir);
    const inShared = isInside(file, sharedDir);
    if (!inModules && !inShared) continue;

    const sourceDomain = inModules ? domainOf(file, modulesDir) : 'shared';
    const source = read(file);
    const found = [];
    for (const pattern of specs) {
      for (const match of source.matchAll(pattern)) found.push(match[1]);
    }

    for (const spec of found) {
      const target = resolve(dirname(file), spec);
      const targetInModules = isInside(target, modulesDir);
      if (!targetInModules) continue;
      const targetDomain = domainOf(target, modulesDir);
      if (inShared) {
        problems.push(`${label}: ${rel(file)} importa el módulo ${targetDomain} (${spec})`);
      } else if (targetDomain !== sourceDomain && !(isRouteEntry(file) && isRouteEntry(target))) {
        problems.push(`${label}: ${rel(file)} cruza al módulo ${targetDomain} (${spec})`);
      }
    }
  }
}

function checkAssembler(file, isAllowed) {
  const source = read(file);
  const patterns = [
    /\bfrom\s*'(\.\/modules\/[^']+)'/g,
    /\bimport\s*\(\s*'(\.\/modules\/[^']+)'\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (!isAllowed(match[1])) problems.push(`${rel(file)} importa interno de módulo: ${match[1]}`);
    }
  }
}

function compareList(label, expected, actual) {
  const before = new Set(expected);
  const after = new Set(actual);
  const addedItems = actual.filter((item) => !before.has(item));
  const removedItems = expected.filter((item) => !after.has(item));
  if (!addedItems.length && !removedItems.length) return;
  problems.push(`${label} cambiado (usa --update si es intencional):`);
  for (const item of removedItems) problems.push(`  - ${item}`);
  for (const item of addedItems) problems.push(`  + ${item}`);
}

checkBoundaries('backend', backendSrc, (file) => /(^|[\\/])[^\\/]+\.routes(\.ts)?$/.test(file));
checkBoundaries('frontend', frontendSrc, (file) => /(^|[\\/])routes(\.tsx)?$/.test(file));
checkAssembler(join(backendSrc, 'app.ts'), (spec) => spec.endsWith('.routes'));
checkAssembler(
  join(frontendSrc, 'App.tsx'),
  (spec) => /\/routes$/.test(spec) || /\/components\//.test(spec)
);

const snapshot = {
  version: 1,
  backend: collectBackendRoutes(),
  frontend: collectFrontendRoutes(),
};

if (update) {
  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Snapshot actualizado: ${rel(snapshotPath)}`);
  process.exit(0);
}

if (!existsSync(snapshotPath)) {
  problems.push(`Falta ${rel(snapshotPath)}. Genera el snapshot con: npm run check:structure:update`);
} else {
  const expected = JSON.parse(read(snapshotPath));
  compareList('rutas frontend', expected.frontend, snapshot.frontend);
  compareList('montajes backend', expected.backend.mounts, snapshot.backend.mounts);
  compareList('rutas directas backend', expected.backend.direct, snapshot.backend.direct);
  compareList('endpoints backend', expected.backend.endpoints, snapshot.backend.endpoints);
}

if (problems.length) {
  console.error(`Auditoría de estructura fallida (${problems.length} problema/s):`);
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(
  `Estructura OK: ${snapshot.backend.endpoints.length} endpoints backend, ` +
    `${snapshot.frontend.length} rutas frontend, sin imports cruzados.`
);
