import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const cargoPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargo = fs.readFileSync(cargoPath, 'utf8');

cargo = cargo.replace(
  /^(version\s*=\s*")[^"]*(")/m,
  `$1${pkg.version}$2`
);

fs.writeFileSync(cargoPath, cargo);
console.log(`Synced version to ${pkg.version} in Cargo.toml`);

const tauriPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
tauri.version = pkg.version;
fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');
console.log(`Synced version to ${pkg.version} in tauri.conf.json`);
