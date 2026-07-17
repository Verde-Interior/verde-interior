// Substitui __BUILD_TS__ no sw.js gerado pelo build com o timestamp atual.
// Isso garante que o browser detecte um novo service worker a cada deploy.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, '../dist/sw.js');
const ts = Date.now();

const content = readFileSync(swPath, 'utf8').replace('__BUILD_TS__', String(ts));
writeFileSync(swPath, content);

console.log(`✓ SW version: vi-ponto-${ts}`);
