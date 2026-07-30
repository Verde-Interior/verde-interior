/**
 * Seed de teste da aba Equipe no staging.
 * Cria empresas fictícias em São Paulo + agenda variada pra HOJE com
 * cenários que exercitam todos os estados: atrasado, em visita,
 * adiantado, no horário e concluído.
 *
 * Uso (da raiz do projeto):
 *   node --env-file=.env apps/ponto/scripts/seed-equipe-test.js
 *
 * Rode todo dia útil de manhã antes de testar — os tempos são calculados
 * relativos ao momento em que o script roda.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_STAGING_URL;
const KEY = process.env.SUPABASE_STAGING_SERVICE_KEY;

if (!URL || !KEY) {
  console.error('❌ Env vars faltando. Rode: node --env-file=.env apps/ponto/scripts/seed-equipe-test.js');
  process.exit(1);
}

const supa = createClient(URL, KEY, { auth: { persistSession: false } });

// Empresas fictícias em SP com coordenadas reais espalhadas
const EMPRESAS = [
  { nome_empresa: 'TESTE Alpha Tech',      endereco: 'Av. Paulista, 1000',        bairro: 'Bela Vista',    lat: -23.5613, lng: -46.6565 },
  { nome_empresa: 'TESTE Beta Consulting', endereco: 'R. Harmonia, 500',          bairro: 'Vila Madalena', lat: -23.5453, lng: -46.6939 },
  { nome_empresa: 'TESTE Gamma Studios',   endereco: 'Av. Ibirapuera, 3000',      bairro: 'Moema',         lat: -23.6009, lng: -46.6688 },
  { nome_empresa: 'TESTE Delta Systems',   endereco: 'R. dos Pinheiros, 200',     bairro: 'Pinheiros',     lat: -23.5637, lng: -46.6873 },
  { nome_empresa: 'TESTE Epsilon Labs',    endereco: 'R. Oscar Freire, 725',      bairro: 'Jardins',       lat: -23.5619, lng: -46.6667 },
  { nome_empresa: 'TESTE Zeta Corp',       endereco: 'R. João Cachoeira, 300',    bairro: 'Itaim Bibi',    lat: -23.5824, lng: -46.6767 },
  { nome_empresa: 'TESTE Eta Ventures',    endereco: 'R. Fidêncio Ramos, 100',    bairro: 'Vila Olímpia',  lat: -23.5936, lng: -46.6842 },
  { nome_empresa: 'TESTE Theta Solutions', endereco: 'Av. Berrini, 1500',         bairro: 'Berrini',       lat: -23.6008, lng: -46.6968 },
  { nome_empresa: 'TESTE Iota Digital',    endereco: 'R. Augusta, 2500',          bairro: 'Cerqueira César', lat: -23.5581, lng: -46.6608 },
  { nome_empresa: 'TESTE Kappa Group',     endereco: 'Av. Faria Lima, 3900',      bairro: 'Itaim Bibi',    lat: -23.5867, lng: -46.6836 },
];

const HOJE = new Date().toISOString().slice(0, 10);

// Formato HH:MM a partir de minutos absolutos desde meia-noite
function toHM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// Retorna ISO timestamp para minutos atrás (a partir de agora)
function isoMinsAgo(mins) {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

// Cenários — cada colaborador recebe um conjunto de visitas com hora
// relativa ao "agora" em que o script roda, testando um estado da aba.
const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

function scenarios() {
  return [
    // Bruno (id=3): você quer olhar como usuário — 2 concluídas + 1 futura
    {
      funcId: '3',
      visitas: [
        { emp: 0, hora: toHM(nowMins - 240), ordem: 0, status: 'concluido', checkinMinAgo: 220, checkoutMinAgo: 170 },
        { emp: 4, hora: toHM(nowMins - 120), ordem: 1, status: 'concluido', checkinMinAgo: 110, checkoutMinAgo: 60 },
        { emp: 6, hora: toHM(nowMins + 120), ordem: 2, status: 'publicado' },
      ],
    },
    // Carlos (id=4): ATRASADO — próxima visita já passou 40min sem check-in
    {
      funcId: '4',
      visitas: [
        { emp: 1, hora: toHM(nowMins - 40),  ordem: 0, status: 'publicado' },
        { emp: 5, hora: toHM(nowMins + 90),  ordem: 1, status: 'publicado' },
      ],
    },
    // Pedro (id=7): TRABALHANDO — em execução dentro do tempo
    {
      funcId: '7',
      visitas: [
        { emp: 2, hora: toHM(nowMins - 30),  ordem: 0, status: 'em_execucao', checkinMinAgo: 25 },
        { emp: 7, hora: toHM(nowMins + 90),  ordem: 1, status: 'publicado' },
      ],
    },
    // Peterson (id=8): ATRASADO NA VISITA ATUAL — passou muito do duracao_estimada
    {
      funcId: '8',
      visitas: [
        { emp: 3, hora: toHM(nowMins - 180), ordem: 0, status: 'em_execucao', checkinMinAgo: 175 },
      ],
    },
    // Larissa (id=14): CONCLUÍDA — todas do dia feitas
    {
      funcId: '14',
      visitas: [
        { emp: 8, hora: toHM(nowMins - 300), ordem: 0, status: 'concluido', checkinMinAgo: 280, checkoutMinAgo: 220 },
        { emp: 9, hora: toHM(nowMins - 180), ordem: 1, status: 'concluido', checkinMinAgo: 160, checkoutMinAgo: 100 },
      ],
    },
    // Kawany (id=17): ADIANTADO — próxima ainda a mais de 30min
    {
      funcId: '17',
      visitas: [
        { emp: 4, hora: toHM(nowMins + 60),  ordem: 0, status: 'publicado' },
      ],
    },
    // Nicole (id=15): NO HORÁRIO — próxima nos próximos ~10min
    {
      funcId: '15',
      visitas: [
        { emp: 5, hora: toHM(nowMins + 5),   ordem: 0, status: 'publicado' },
      ],
    },
  ];
}

async function run() {
  console.log('── Seed Equipe Test (staging) ──');
  console.log(`URL:  ${URL}`);
  console.log(`Data: ${HOJE}\n`);

  // 1. Insere/atualiza empresas de teste
  console.log('1. Criando empresas TESTE...');
  const empIds = [];
  for (const e of EMPRESAS) {
    // Verifica se já existe pelo nome
    const { data: existente } = await supa.from('clientes').select('id').eq('nome_empresa', e.nome_empresa).maybeSingle();
    if (existente) {
      empIds.push(existente.id);
      console.log(`  ✓ ${e.nome_empresa} (já existia)`);
      continue;
    }
    const { data, error } = await supa.from('clientes').insert({
      ...e,
      ativo: true,
      data_cadastro: HOJE,
      contato_nome: 'Contato Teste',
      contato_telefone: '11900000000',
    }).select('id').single();
    if (error) { console.error(`  ❌ ${e.nome_empresa}:`, error.message); continue; }
    empIds.push(data.id);
    console.log(`  ✓ ${e.nome_empresa}`);
  }
  console.log('');

  // 2. Limpa agenda de teste anterior (só as de HOJE ligadas a essas empresas)
  console.log('2. Limpando agenda TESTE anterior de hoje...');
  const { data: agAntigas } = await supa.from('agenda')
    .select('id').eq('data_agendada', HOJE).in('cliente_id', empIds);
  if (agAntigas?.length) {
    const agIds = agAntigas.map(a => a.id);
    await supa.from('relatorios').delete().in('agendamento_id', agIds);
    await supa.from('agenda').delete().in('id', agIds);
    console.log(`  ✓ ${agAntigas.length} agenda(s) e seus relatorios removidos`);
  } else {
    console.log('  (nada a limpar)');
  }
  console.log('');

  // 3. Insere cenários
  console.log('3. Criando cenários por colaborador...');
  const scens = scenarios();
  for (const s of scens) {
    console.log(`  Colaborador id=${s.funcId} — ${s.visitas.length} visita(s):`);
    for (const v of s.visitas) {
      const clienteId = empIds[v.emp];
      if (!clienteId) { console.error(`    ❌ cliente index ${v.emp} não existe`); continue; }

      const { data: ag, error: agE } = await supa.from('agenda').insert({
        cliente_id: clienteId,
        funcionario_id: s.funcId,
        data_agendada: HOJE,
        hora_estimada_chegada: v.hora,
        duracao_estimada_min: 60,
        ordem_rota: v.ordem,
        status: v.status,
        publicado_em: new Date().toISOString(),
      }).select('id').single();
      if (agE) { console.error(`    ❌ agenda:`, agE.message); continue; }

      // Cria relatorio se em_execucao ou concluido
      if (v.status === 'em_execucao' || v.status === 'concluido') {
        const cli = EMPRESAS[v.emp];
        const relPayload = {
          agendamento_id: ag.id,
          funcionario_id: s.funcId,
          checkin_at:  isoMinsAgo(v.checkinMinAgo ?? 5),
          checkin_lat: cli.lat,
          checkin_lng: cli.lng,
          status: v.status === 'concluido' ? 'concluido' : 'em_andamento',
        };
        if (v.status === 'concluido') {
          relPayload.checkout_at  = isoMinsAgo(v.checkoutMinAgo ?? 0);
          relPayload.checkout_lat = cli.lat;
          relPayload.checkout_lng = cli.lng;
          relPayload.relato = 'Visita de teste — dados gerados por seed.';
          relPayload.assinatura_responsavel_nome = 'Teste Assinatura';
          relPayload.assinatura_responsavel_img  = 'https://example.com/placeholder.png';
        }
        const { error: relE } = await supa.from('relatorios').insert(relPayload);
        if (relE) console.error(`    ❌ relatorio:`, relE.message);
      }
      console.log(`    ✓ ${EMPRESAS[v.emp].nome_empresa} — ${v.hora} — ${v.status}`);
    }
  }

  console.log('\n✓ Seed concluído. Faça login com bruno/verde123 e teste a aba Equipe.');
  console.log('  Cenários esperados:');
  console.log('  - Bruno (você): 2 concluídas + 1 futura → "No horário" ou próxima');
  console.log('  - Carlos: 🔴 Atrasado (deveria chegar há 40min)');
  console.log('  - Pedro:  🟢 Em visita (Gamma Studios)');
  console.log('  - Peterson: 🔴 Atrasado na visita atual');
  console.log('  - Larissa: ✅ Agenda concluída');
  console.log('  - Kawany:  🔵 Adiantado');
  console.log('  - Nicole:  ⚪ No horário');
}

run().catch(err => { console.error(err); process.exit(1); });
