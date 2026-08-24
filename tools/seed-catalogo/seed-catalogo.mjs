/**
 * seed-catalogo.mjs
 *
 * Lê as fotos de "Plantas PNG Fundo Branco" do OneDrive, faz upload
 * para o Supabase Storage (bucket: catalogo) e insere os registros
 * na tabela catalogo_itens.
 *
 * Uso:
 *   node tools/seed-catalogo/seed-catalogo.mjs
 *
 * Pré-requisito: SUPABASE_SERVICE_KEY no arquivo .env deste script
 * (a anon key não tem permissão para criar buckets e fazer upload).
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

// lê .env local se existir
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const SUPABASE_URL      = 'https://mcaqxfogzvrqqnoixptv.supabase.co';
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY; // service_role key

const FOTOS_DIR = join(
  'C:/Users/betof/OneDrive - VERDE INTERIOR PAISAGISMO LIMITADA',
  'Menu Verde Interior/Fotos Orçamentos/Plantas PNG Fundo Branco'
);

const BUCKET = 'catalogo';

if (!SUPABASE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY no ambiente antes de rodar este script.');
  console.error('   Windows PowerShell: $env:SUPABASE_SERVICE_KEY = "sua-service-role-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Garante que o bucket existe (público para leitura).
 */
async function garantirBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const existe = buckets?.some(b => b.name === BUCKET);
  if (!existe) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Erro ao criar bucket: ${error.message}`);
    console.log(`✅ Bucket "${BUCKET}" criado.`);
  } else {
    console.log(`ℹ️  Bucket "${BUCKET}" já existe.`);
  }
}

/**
 * Remove acentos e caracteres especiais para gerar uma chave válida no Storage.
 */
function slugificar(nome) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[''`´]/g, '')            // remove apóstrofos
    .replace(/[^a-zA-Z0-9._\-() ]/g, '') // mantém só alfanumérico e alguns símbolos seguros
    .trim();
}

/**
 * Faz upload de um arquivo para o Storage.
 * Retorna a URL pública ou null em caso de erro.
 */
async function uploadFoto(caminhoLocal, nomeNoStorage) {
  const bytes = await readFile(caminhoLocal);
  const ext   = extname(nomeNoStorage).toLowerCase();
  const mime  = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const chaveStorage = slugificar(nomeNoStorage);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`plantas/${chaveStorage}`, bytes, {
      contentType: mime,
      upsert: true,
    });

  if (error) {
    console.warn(`  ⚠️  Upload falhou (${nomeNoStorage}): ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`plantas/${chaveStorage}`);
  return data.publicUrl;
}

/**
 * Extrai nome da planta e nome do vaso a partir do nome do arquivo.
 * Formato esperado: "Planta - Vaso.ext"  ou  "Planta - Vaso (variação).ext"
 */
function parsearNomeArquivo(nomeArquivo) {
  const semExt = basename(nomeArquivo, extname(nomeArquivo));
  const sepIdx = semExt.indexOf(' - ');
  if (sepIdx === -1) {
    return { planta: semExt.trim(), vaso: null };
  }
  return {
    planta: semExt.slice(0, sepIdx).trim(),
    vaso:   semExt.slice(sepIdx + 3).trim(),
  };
}

/**
 * Verifica se já existe um item com o mesmo nome para evitar duplicatas.
 */
async function itemJaExiste(nome) {
  const { data } = await supabase
    .from('catalogo_itens')
    .select('id')
    .eq('nome', nome)
    .limit(1)
    .single();
  return !!data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🌿 Iniciando seed do catálogo...\n');

  await garantirBucket();

  const arquivos = (await readdir(FOTOS_DIR))
    .filter(f => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(f).toLowerCase()));

  console.log(`\n📂 ${arquivos.length} fotos encontradas em:\n   ${FOTOS_DIR}\n`);

  let inseridos = 0;
  let ignorados = 0;
  let erros     = 0;

  for (const arquivo of arquivos) {
    const { planta, vaso } = parsearNomeArquivo(arquivo);
    const nomeFinal = vaso ? `${planta} — ${vaso}` : planta;

    process.stdout.write(`  → ${nomeFinal} ... `);

    if (await itemJaExiste(nomeFinal)) {
      console.log('já existe, ignorado.');
      ignorados++;
      continue;
    }

    const caminhoLocal  = join(FOTOS_DIR, arquivo);
    const nomeStorage   = arquivo; // mantém nome original no Storage
    const fotoUrl       = await uploadFoto(caminhoLocal, nomeStorage);

    if (!fotoUrl) { erros++; continue; }

    const { error } = await supabase.from('catalogo_itens').insert({
      tipo:      'planta',
      categoria: 'escritorio', // todas as combos PNG são de escritório
      nome:      nomeFinal,
      foto_url:  fotoUrl,
      ativo:     true,
    });

    if (error) {
      console.log(`❌ Erro no insert: ${error.message}`);
      erros++;
    } else {
      console.log('✅');
      inseridos++;
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`✅ Inseridos : ${inseridos}`);
  console.log(`⏭️  Ignorados : ${ignorados}`);
  console.log(`❌ Erros     : ${erros}`);
  console.log('─────────────────────────────────\n');
  console.log('Seed concluído. Verifique os registros em catalogo_itens no Supabase.');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
