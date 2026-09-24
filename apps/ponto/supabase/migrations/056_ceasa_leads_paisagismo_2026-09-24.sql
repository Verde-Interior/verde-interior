-- ============================================================
-- 056_ceasa_leads_paisagismo_2026-09-24.sql
-- Leads prospectados pelo squad "escoamento-veiling" (Paula Prospecção,
-- rodada 2026-09-24, run 2026-09-24-110955) para o pipeline Ceasa/Holambra.
-- Motivo de compra: contrato de implantação/manutenção recorrente de
-- paisagismo (negócio principal da Verde Interior) — não escoamento de
-- flores do Veiling. Segmentos: escritórios, hospitais, escolas, clínicas,
-- hotéis, restaurantes, agências de eventos. Região: Grande São Paulo,
-- priorizando Faria Lima, Berrini, Jardins, JK, Lapa e Morumbi.
--
-- 34 leads qualificados (contato telefônico/e-mail/WhatsApp verificado).
-- 29 já têm abordagem individual pronta na observação (Wagner WhatsApp /
-- Elisa E-mail); os 5 de fit 3/5 entram sem abordagem pronta (equipe
-- decide manualmente se e como abordar).
--
-- Fonte: squads/escoamento-veiling/output/2026-09-24-110955/v1/prospeccoes-2026-09-24.md
--        squads/escoamento-veiling/output/2026-09-24-110955/abordagem-whatsapp-2026-09-24.md
--        squads/escoamento-veiling/output/2026-09-24-110955/abordagem-email-2026-09-24.md
--
-- Checagem de duplicado: nenhum dos 34 nomes abaixo colide com os leads já
-- existentes em ceasa_prospects (3 floriculturas da rodada de 2026-08-27,
-- migration 050 — segmento diferente). Ainda assim, revise
-- `SELECT nome_loja FROM ceasa_prospects` antes de aplicar, e use a
-- checagem de duplicado da própria tela (Pipeline Ceasa/Holambra) se
-- cadastrar algum manualmente depois.
-- ============================================================

INSERT INTO public.ceasa_prospects
  (nome_loja, tipo, telefones, email, preferencia_contato, endereco,
   produtos_interesse, observacoes, etapa, origem)
VALUES
  ('Delta BC', 'escritorio', '[{"numero":"(11) 3192-3900","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Faria Lima / Pinheiros', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Escritórios. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Localizado em Faria Lima, zona prioritária máxima. Espaço corporativo consolidado com múltiplos andares e áreas comuns necessitadas de paisagismo. Ticket recorrente de manutenção é alinhado com modelo de coworking.

Canal de abordagem sugerido pela Paula: Telefone

--- Abordagem sugerida ---
Assunto: Paisagismo para múltiplos andares em Faria Lima

Oi,

Espaço corporativo de vários andares como Delta BC tem recepção e áreas comuns que valem investimento em paisagismo — cada andar merecia verde.

Contrato de implantação + manutenção mensal para coworkings e escritórios multiandar: recepção impactante, corredores com plantas de baixa manutenção, e áreas de pausa (descompressão) que seus tenants apreciam. Trocamos sazonalmente, plantamos conforme seu padrão.

Já gerenciamos paisagismo de 6+ andares para empresas em Faria Lima.

Marque uma visita — posso ir numa sexta antes do horário de pico, fotografo tudo e envio proposta.

P.S. Se há restrições de espaço por andar, otimizamos com modelos suspensos ou estruturas verticais — mais verde, menos piso ocupado.', 'prospecto', 'Squad Veiling'),

  ('My Place Office', 'escritorio', '[{"numero":"(11) 94038-2318","rotulo":"Principal","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'Faria Lima', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Escritórios. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Coworking ao lado da estação Faria Lima, área de alto fluxo com recepção e áreas comuns amplas. Contrato recorrente é modelo de negócio típico para essa tipologia.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Vi que vocês têm um coworking bem movimentado ao lado da Faria Lima

A gente trabalha com paisagismo para recepções e áreas comuns — traz aquele toque de bem-estar que diferencia o espaço. Vocês já pensaram em potencializar isso?

Quer conhecer nosso portfólio com outros coworkings? Posso enviar alguns cases.

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Zabo FL Corporate', 'escritorio', '[{"numero":"(11) 2337-7674","rotulo":"Principal","whatsapp":false},{"numero":"(11) 94717-4417","rotulo":"WhatsApp direto","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'Faria Lima', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Escritórios. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Espaço corporativo em Faria Lima, 4509. Operação consolidada em zona prioritária com potencial de múltiplas áreas para paisagismo.

Canal de abordagem sugerido pela Paula: WhatsApp (94717-4417 é número pessoal/direto)

--- Abordagem sugerida ---
Oi! 👋 Bacana ter vocês em um espaço consolidado como o de vocês em Faria Lima

A Verde Interior atua com paisagismo corporativo — aquele que melhora o clima do escritório e impressiona quem entra. Pode ser um projeto de implantação ou manutenção contínua.

Libera uns minutinhos pra gente explorar o que faz sentido pra vocês?

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('iSpaces', 'escritorio', '[{"numero":"(11) 91226-4322","rotulo":"Principal","whatsapp":false}]'::jsonb, 'atendimento@ispaces.com.br', 'email', 'Jardins / Pamplona', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Escritórios. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Coworking em Rua Pamplona, Jardins (zona prioritária). Bem estabelecido no bairro de alto padrão, com demanda típica de paisagismo de recepção e circulação.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Recepção mais memorável para seus coworkers

Oi!

Passamos por Jardins a semana passada e percebemos que o iSpaces tem uma recepção que faz diferença — e com paisagismo estratégico, fica ainda mais impactante para quem chega.

A gente trabalha com coworkings em toda a Grande São Paulo: o paisagismo de entrada (e circulação) não é só visual — muda a primeira impressão de quem aluga uma sala com você. Contrato de implantação + manutenção mensal, sem surpresas.

Já ajudamos mais de 120 empresas de alto padrão por aqui.

Que tal a gente conversar por 15 minutos? Posso mostrar algumas referências de espaços similares e explicar como funciona a manutenção.

P.S. Levamos plantas de qualidade mesmo em edifícios de piso único — se o espaço é apertado, a gente adapta. Próxima semana fico de olho por lá.', 'prospecto', 'Squad Veiling'),

  ('Hospital Sírio-Libanês', 'hospital', '[{"numero":"(11) 3394-0200","rotulo":"Principal","whatsapp":false}]'::jsonb, 'faleconosco@hsl.org.br', 'email', 'Bela Vista', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Hospitais. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Instituição de saúde de máxima relevância, filantrópica de renome. Recepção e áreas comuns de alto padrão, múltiplos andares, fluxo contínuo. Unidade Itaim reforça proximidade às zonas prioritárias.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Paisagismo para ambientes de repouso hospitalar

Oi,

Hospitais como Sírio-Libanês precisam que cada detalhe de recepção e áreas comuns transmita cuidado. Paisagismo feito certo contribui com a experiência do paciente e da família.

A Verde Interior trabalha com contratos de manutenção em instituições de saúde: plantas de baixa manutenção em recepção, corredores e áreas de espera. Trocas mensais, sem comprometer a limpeza ou fluxo. Referências incluem hospitais privados e filantropias no eixo Jardins–Bela Vista.

Conversamos por 15 minutos? Explico nosso protocolo de higiene e como estruturamos o contrato para múltiplos andares.

P.S. Entendemos que ambiente hospitalar exige cuidado extra — trabalhamos com espécies de baixo potencial alergênico e ajustamos a seleção junto com o time de facilities de vocês.', 'prospecto', 'Squad Veiling'),

  ('Beneficência Portuguesa', 'hospital', '[{"numero":"(11) 3505-1000","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'São Paulo (zona central)', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Hospitais. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Hospital tradicional de grande porte. Instalações estruturadas com necessidade de paisagismo em áreas de recepção, circulação e áreas comuns. Contrato recorrente de alto volume.

Canal de abordagem sugerido pela Paula: Telefone (centralista corporativa)

--- Abordagem sugerida ---
Assunto: Paisagismo em hospital de grande porte

Oi,

Beneficência Portuguesa é instituição tradicional e exigente — recepção e áreas comuns precisam refletir esse cuidado com detalhe.

A Verde Interior oferece contrato de manutenção especializado em hospitais: plantas selecionadas, protocolo de higiene reforçado, e trocas quinzenais. Trabalham com nossa equipe sem interferir no fluxo de pacientes — a gente coordena visitas em horários específicos.

Mais de 120 instituições de saúde e corporativas em São Paulo confiam na gente.

Conversamos por telefone? Posso detalhar nosso protocolo para hospitais e apresentar referências de outras instituições.

P.S. Selecionamos espécies de baixa manutenção e baixo risco para ambiente hospitalar, e ajustamos o protocolo junto com o time de facilities de vocês.', 'prospecto', 'Squad Veiling'),

  ('Hospital Albert Einstein', 'hospital', '[{"numero":"(11) 2151-1233","rotulo":"Principal","whatsapp":false},{"numero":"(11) 3620-2550","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'Zona Sul', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Hospitais. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Hospital de excelência e grande escala. Múltiplas unidades e áreas comuns premium. Potencial de contrato de manutenção regional.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Sabemos que um hospital da sua magnitude (múltiplas unidades, áreas comuns premium) merece paisagismo à altura

Temos experiência com ambientes que exigem manutenção pontual, limpeza e bem-estar constante — desde implantação até suporte sazonal.

Podemos agendar uma conversa pra entender melhor as necessidades de vocês?

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Hospital Samaritano', 'hospital', '[{"numero":"(11) 3821-5300","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Higienópolis', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Hospitais. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Hospital privado consolidado, bairro nobre adjacente aos Jardins. Infraestrutura que demanda paisagismo recorrente.

Canal de abordagem sugerido pela Paula: Telefone

--- Abordagem sugerida ---
Assunto: Verde em ambiente hospitalar privado — protocolo de higiene

Oi,

Hospital privado em bairro nobre como Higienópolis pauta-se por excelência — paisagismo precisa reforçar essa mensagem sem comprometer segurança.

Oferecemos contrato especializado em saúde: plantas selecionadas, protocolo de higiene acima do padrão hospitalar, e manutenção que não interfere com fluxo crítico. Recepção e áreas de espera ganham vida — família de paciente sente a diferença.

Já atendemos hospitais privados em Higienópolis, Jardins e adjacências.

Marque uma conversa de 15 minutos — explico protocolo e referências que vocês podem consultar.

P.S. Se Samaritano tem áreas isoladas (CTI, cirurgias), a gente sugere paisagismo apenas em espaços abertos, seguindo o protocolo que o hospital definir.', 'prospecto', 'Squad Veiling'),

  ('Hospital Alvorada', 'hospital', '[{"numero":"(11) 2186-9900","rotulo":"Moema","whatsapp":false},{"numero":"(11) 2185-0500","rotulo":"Santo Amaro","whatsapp":false},{"numero":"(11) 2185-0300","rotulo":"Chácara Flora","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Múltiplas unidades (Moema, Santo Amaro, Chácara Flora)', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Hospitais. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Rede de hospitais com múltiplas unidades. Potencial de pacote de manutenção recorrente em várias localidades.

Canal de abordagem sugerido pela Paula: Telefone (unidade mais próxima da rota operacional)

--- Abordagem sugerida ---
Assunto: Contrato de paisagismo recorrente em múltiplas unidades

Oi,

Rede como Hospital Alvorada (Moema, Santo Amaro, Chácara Flora) merecia paisagismo consistente em todas as frentes — uniforme, profissional, sem quebra.

Somos especializados em contratos multi-unidade: coordenamos paisagismo em 3, 4, 5+ unidades simultaneamente. Manutenção mensal centralizada, mas adaptada ao perfil de cada hospital. Reduz custo administração da sua parte — a gente cuida de tudo.

Mais de 120 clientes em São Paulo, incluindo redes de saúde.

Podemos agendar uma conversa com sua equipe de facilities? 20 minutos para apresentar modelo multi-unidade.

P.S. Se há diferenças de infraestrutura entre unidades (uma com área externa, outra só interna), a gente customiza — nenhuma fica genérica.', 'prospecto', 'Squad Veiling'),

  ('Escola Morumbi', 'escola', '[{"numero":"(11) 3062-3264","rotulo":"Principal","whatsapp":false}]'::jsonb, 'contato@escolamorumbi.com.br', 'email', 'Jardins', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Escolas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Escola consolidada em Avenida Cidade Jardim (zona prioritária máxima). Ciclo escolar sazonal oferece oportunidade de contratos com retorno anual.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Renovar paisagismo com ciclo escolar do semestre

Oi,

Ciclo escolar oferece momento perfeito para reformar áreas de circulação e entrada. Na Escola Morumbi, isso faz diferença na recepção de pais e alunos.

Oferecemos contrato anual com reforço visual no início de cada semestre: paisagismo de entrada, áreas comuns e, se houver espaço, áreas externas. Tudo acompanhado pela manutenção mensal. Já atendemos escolas em Jardins e adjacências com esse modelo.

Qual seria o melhor momento para eu ir ao Morumbi e tirarmos fotos das áreas? Faço orçamento em 2 dias.

P.S. Se a escola tem pátio ou área ao ar livre, agregamos plantas que suportam sol direto — flor o ano todo, sem toxicidade para crianças.', 'prospecto', 'Squad Veiling'),

  ('Colégio Morumbi Sul', 'escola', '[{"numero":"(11) 3594-0600","rotulo":"Principal","whatsapp":false}]'::jsonb, 'faleconosco@morumbisul.com.br', 'email', 'Morumbi', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Escolas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Colégio de qualidade em Morumbi (zona prioritária). Potencial de contrato anual ou sazonal para manutenção de áreas externas/pátios.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Paisagismo anual para pátios e áreas externas

Oi,

Colégio de porte como Morumbi Sul tem pátios e áreas comuns que merecem atenção — paisagismo bem estruturado muda a experiência diária de alunos e professores.

Fazemos contrato anual com foco em áreas externas/pátios: plantas que resistem a sol, revitalização sazonal e manutenção mensal. Evitamos espécies tóxicas e priorizamos durabilidade — cobrem a demanda de todo o semestre sem surpresa.

Mais de 120 instituições educacionais e corporativas confiam na gente.

Posso ir ao Morumbi Sul uma manhã, tirar medidas e apresentar opções? Sem compromisso.

P.S. Se há áreas com espaço limitado, a gente otimiza com vasos inteligentes — dura meses sem ocupar piso.', 'prospecto', 'Squad Veiling'),

  ('Colégio Anglo Morumbi', 'escola', '[{"numero":"(11) 3740-1000","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Morumbi', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Escolas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Colégio de marca consolidada em Morumbi. Infraestrutura corporativa que demanda paisagismo recorrente. Decisor tipicamente direção/administração.

Canal de abordagem sugerido pela Paula: Telefone (ramal de administração/facilities)

--- Abordagem sugerida ---
Assunto: Paisagismo corporativo para marca consolidada

Oi,

Colégio Anglo tem infraestrutura corporativa forte — paisagismo em áreas comuns e recepção precisa estar à altura da marca.

Contrato de implantação + manutenção anual para colégios: áreas comuns impactantes, ciclo sazonal sincronizado com semestre escolar, e protocolo seguro (sem espécies tóxicas). Já trabalhamos com escolas de marca no eixo Morumbi–Jardins.

Vou ao Anglo uma manhã fotografar o espaço e montar proposta? Sem compromisso.

P.S. Se há auditório ou sala de eventos, paisagismo estratégico muda a acústica e a sensação da sala — agregamos se fizer sentido.', 'prospecto', 'Squad Veiling'),

  ('Escola Waldorf São Paulo', 'escola', '[{"numero":"(11) 3044-2004","rotulo":"Principal","whatsapp":false}]'::jsonb, 'escola@waldorf.com.br', 'email', 'Vila Olímpia', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Escolas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Escola waldorf com filosofia de bem-estar/natureza em Vila Olímpia (zona prioritária). Alta probabilidade de interesse em paisagismo como componente pedagógico.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Paisagismo como ferramenta pedagógica e bem-estar

Oi,

Filosofia Waldorf coloca bem-estar e conexão com natureza no centro — paisagismo estratégico em espaços comuns fortalece essa proposta.

A Verde Interior trabalha com escolas que entendem o valor pedagógico das plantas: contrato de implantação em áreas internas e externas, manutenção mensal, e consultoria sobre variedades que promovem aprendizado sensorial. Sem pesticidas, sem tóxicos — alinhado com valores Waldorf.

Podemos marcar um café rápido (15 minutos) para eu conhecer o espaço e entender melhor como vocês pensam paisagismo?

P.S. Temos parceria com viveiros que cultivam plantas responsáveis — se a escola quiser árvores frutíferas ou medicinais, a gente consegue.', 'prospecto', 'Squad Veiling'),

  ('Colégio Guilherme Dumont Vilares', 'escola', '[{"numero":"(11) 3743-5531","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Morumbi', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Escolas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Colégio de porte em Morumbi (bairro prioritário). Demanda típica de paisagismo em áreas comuns e externas.

Canal de abordagem sugerido pela Paula: Telefone

--- Abordagem sugerida ---
Assunto: Renovação verde em áreas comuns e pátios

Oi,

Colégio de porte como Guilherme Dumont Vilares tem espaços que pedem cuidado paisagístico — áreas comuns e pátios são palco da rotina de quem estuda lá.

Oferecemos contrato anual focado em áreas comuns/externas: plantas que resistem à rotina escolar, florais sazonais na entrada, e manutenção que não interfere com aulas. Coordenamos para não ocupar espaço de circulação.

Atendemos dezenas de colégios em São Paulo.

Posso ir um final de semana fotografar as áreas e trazer proposta?

P.S. Se há espaço para um pequeno jardim pedagógico ou horta, a gente monta estrutura integrada — paisagismo + aprendizado.', 'prospecto', 'Squad Veiling'),

  ('Colégio Franciscano João XXIII', 'escola', '[{"numero":"(11) 3751-0036","rotulo":"Principal","whatsapp":false},{"numero":"(11) 3751-1366","rotulo":"Secundário","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Morumbi', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 3/5 — Escolas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Colégio franciscano em Morumbi. Infraestrutura religiosa que pode demandar paisagismo de recepção. Escala menor que colégios anteriores.

Canal de abordagem sugerido pela Paula: Telefone

(Fit 3/5 — sem rascunho de abordagem pronto; time decide manualmente.)', 'prospecto', 'Squad Veiling'),

  ('Clínica Odontológica Berrini / CIO Brooklin', 'clinica', '[{"numero":"(11) 5102-2314","rotulo":"Principal","whatsapp":false},{"numero":"(11) 99911-2370","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, 'atendimento@ciobrooklin.com.br', 'whatsapp', 'Berrini / Brooklin', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Clínicas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Clínica de 25 anos em Brooklin, Av. Luís Carlos Berrini (zona prioritária máxima). Ambiente de recepção/espera de alto padrão demanda paisagismo de entrada.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 25 anos de tradição em um espaço premium de Brooklin — parabéns pela consistência

Aquela recepção moderna que vocês têm merece uma paisagem à altura. Trazemos bem-estar desde a entrada, relaxando paciente e impressionando clientes.

Quer ver como a gente faz isso? Posso marcar um horário pra conversar.

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Clínica Morumbi', 'clinica', '[{"numero":"(11) 96952-2461","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'Morumbi', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Clínicas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Clínica multidisciplinar em Morumbi (zona prioritária). Ambiente de recepção/espera que demanda paisagismo.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Vimos que vocês têm uma clínica multidisciplinar em Morumbi — ótima localização

Paisagismo corporativo em recepções melhora a percepção do paciente. Temos opções de implantação ou manutenção — o que faz mais sentido aí?

Bora conversar sobre isso? Mande um palpite de horário que se encaixa.

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Centro Médico Jardim São Paulo', 'clinica', '[{"numero":"(11) 99442-1322","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'Jardins', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Clínicas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Centro médico em Jardins (zona prioritária). Recepção de múltiplas especialidades demanda ambiente atrativo.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Centro médico em Jardins, com múltiplas especialidades — que espaço interessante

A gente trabalha com paisagismo que transforma recepções em ambientes acolhedores. Paciente desestressado é paciente que volta.

Quer explorar ideias pra vocês? Me marca um tempo.

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Clínica Solaris Jardim', 'clinica', '[{"numero":"(11) 99223-6262","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'Jardins', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Clínicas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Clínica em Jardins. Localização premium, ambiente de recepção/espera que se beneficia de paisagismo.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Clínica premium em Jardim — excelente escolha de localização

Paisagismo corporativo é diferencial pra ambientes assim. Reforça bem-estar desde a entrada e diferencia vocês da concorrência.

Quer conhecer nossos cases em clínicas similares?

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Buddha Spa Berrini', 'clinica', '[{"numero":"(11) 5505-2095","rotulo":"Principal","whatsapp":false},{"numero":"(11) 93450-3344","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'Berrini / Cidade Monções', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Clínicas. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Centro de bem-estar/spa premium em Berrini. Ambiente que reforça bem-estar é receptor natural de paisagismo de alto padrão.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Centro de bem-estar em Berrini — lugar perfeito pra nossa conversa

Paisagismo é extensão natural de um espaço que já respira bem-estar. A gente cria ambientes que amplificam isso — interior e exterior.

Posso enviar referências de spas que trabalhamos? Quer ver?

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Pulso Hotel Faria Lima', 'hotel', '[{"numero":"(11) 3035-3070","rotulo":"Principal","whatsapp":false}]'::jsonb, 'reservas.fl@pulsohotel.com.br', 'email', 'Pinheiros / Faria Lima', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Hotéis. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Hotel boutique de referência em Faria Lima (zona prioritária máxima). Recepção, lobby e áreas comuns de alto padrão demandam paisagismo premium.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Recepção e lobby com paisagismo boutique

Oi,

Hotel boutique como Pulso carrega sua marca em cada detalhe — recepção e lobby precisam de paisagismo que reforce identidade e bem-vindo.

Oferecemos contrato de manutenção de recepção e áreas comuns para hotéis: plantas de qualidade premium, troca quinzenal de flores sazonais, limpeza e podas profissionais. Trabalhamos com outros hotéis 4-5 estrelas em São Paulo.

Que tal marcarmos uma visita rápida para eu entender o conceito do Pulso e apresentar uma proposta?

P.S. Se há vagas em entrada ou circulação, levamos plantas de entorno corporativo que combinam com estética boutique.', 'prospecto', 'Squad Veiling'),

  ('Estanplaza Funchal', 'hotel', '[{"numero":"(11) 3059-3277","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Vila Olímpia / JK', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Hotéis. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Hotel de cadeia consolidada em Vila Olímpia, frente ao Shopping JK (zona prioritária). Infraestrutura para eventos corporativos demanda paisagismo de alto padrão.

Canal de abordagem sugerido pela Paula: Telefone (centralista corporativa)

--- Abordagem sugerida ---
Assunto: Paisagismo premium para hotel de eventos

Oi,

Hotel em frente ao JK que hospeda executivos e monta eventos corporativos merecia paisagismo que impressione — cada detalhe conta quando há audiência.

Contrato de paisagismo de alto padrão para hotéis de eventos: recepção elegante, áreas de espera impactantes, e florais personalizados para eventos corporativos que vocês hospedam. Trocas mensais, consultoria estética, tudo integrado com ritmo de eventos do hotel.

Atendemos outros hotéis de referência na Grande São Paulo.

Que tal marcarmos uma conversa rápida e uma visita ao Estanplaza? 20 minutos e já sei como estruturar a proposta.

P.S. Para eventos corporativos especiais, podemos fazer montagens temáticas — flores e plantas alinham com marca do cliente — agregamos se fizer sentido.', 'prospecto', 'Squad Veiling'),

  ('Uniclass Hotel Lapa', 'hotel', '[{"numero":"(11) 3611-8555","rotulo":"Principal","whatsapp":false},{"numero":"(11) 98960-4408","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, 'lapa@uniclasshotel.com.br', 'whatsapp', 'Lapa', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Hotéis. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Hotel 3 estrelas em Lapa (zona prioritária). Localização em região histórica com demanda crescente.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Hotel em Lapa com demanda crescente — ótimo momento pra investir em diferencial

Paisagismo em recepções e áreas comuns traz um toque que hóspede sente na hora. Eleva a percepção do valor sem grande custo.

Quer conversar como isso funciona na prática? Tenho um horário disponível.

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Marigot', 'restaurante', '[]'::jsonb, 'berrini@marigot.com.br', 'email', 'Berrini', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Restaurantes. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Restaurante de marca consolidada em Berrini (zona prioritária). Ambiente de salão que se beneficia de paisagismo de entrada e circulação. Endereço: Rua Heinrich Hertz, 14.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Paisagismo de entrada para atrair mais clientes

Oi,

Marca como Marigot depende de primeira impressão — entrada que chama atenção em Berrini é competitiva. Paisagismo estratégico funciona.

Contrato de implantação + manutenção mensal para restaurantes de alto padrão: paisagismo na entrada (que é seu cartão de visita), arranjos nas mesas (se couber), e podas regulares. Trocamos sazonalmente e mantemos tudo impecável. Já atendemos restaurantes gourmet e bares de marca em São Paulo.

Posso passar em Berrini e tirarmos fotos do espaço? Mando orçamento em 48h.

P.S. Plantas na entrada não atraem praga — usamos variedades certificadas e adubos específicos para ambientes internos/semi-internos.', 'prospecto', 'Squad Veiling'),

  ('Zucco Cucina', 'restaurante', '[{"numero":"(11) 5181-1092","rotulo":"Principal","whatsapp":false},{"numero":"(11) 5181-1858","rotulo":"Secundário","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Morumbi Shopping', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Restaurantes. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Restaurante italiano em Morumbi Shopping (zona prioritária). Ambiente gourmet em shopping de alto padrão demanda paisagismo premium.

Canal de abordagem sugerido pela Paula: Telefone

--- Abordagem sugerida ---
Assunto: Paisagismo gourmet para restaurante italiano premium

Oi,

Zucco em Morumbi Shopping oferece experiência gourmet — paisagismo na entrada e circulação é parte dessa narrativa.

Contrato de manutenção para restaurantes italianos de alto padrão: plantas que combinam com aconchego italiano, arranjos que sugerem fazenda/terroir, e podas profissionais mensais. Entrada é sua melhor propaganda — florais sazonais mantêm visual fresco e atraem.

Trabalhamos com restaurantes de marca em Morumbi, Jardins e Berrini.

Posso passar no Morumbi Shopping e vermos juntos como otimizar o espaço?

P.S. Se há espaço para arranjos nas mesas (como flores de água ou vasos pequenos), agregamos — comunica qualidade e cuidado com detalhe.', 'prospecto', 'Squad Veiling'),

  ('Le Jardin (Rosewood São Paulo)', 'restaurante', '[{"numero":"(11) 3797-0500","rotulo":"Principal","whatsapp":false}]'::jsonb, 'saopaulo.restaurantes@rosewoodhotels.com', 'email', 'Jardins', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Restaurantes. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Restaurante de luxo no hotel Rosewood em Jardins (zona prioritária). Ambiente de alto padrão com demanda de paisagismo premium.

Canal de abordagem sugerido pela Paula: E-mail corporativo

--- Abordagem sugerida ---
Assunto: Paisagismo de luxo para cinco estrelas

Oi,

Rosewood é sinônimo de excelência — paisagismo em Le Jardin precisa estar à altura. Sabemos o padrão que vocês mantêm.

Trabalhamos com hotéis e restaurantes 5 estrelas em São Paulo: contrato premium de paisagismo que inclui implantação de espécies selecionadas, manutenção quinzenal, florais personalizados e consultoria estética. Cada detalhe reforça a marca Rosewood.

Mais de 120 empresas de alto padrão confiam na gente — incluindo outros hotéis internacionais.

Podemos conversar? 15 minutos para eu apresentar nosso portfólio de cinco estrelas.

P.S. Se Le Jardin tem áreas externas ou jardim internalizado, agregamos consultoria de paisagismo estruturado — a gente faz tudo integrado.', 'prospecto', 'Squad Veiling'),

  ('Murakami', 'restaurante', '[{"numero":"(11) 3064-8868","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Alameda Lorena / Jardins', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 3/5 — Restaurantes. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Restaurante em Alameda Lorena, Jardins. Localização de bairro nobre com demanda de paisagismo de entrada. Contrato recorrente moderado.

Canal de abordagem sugerido pela Paula: Telefone

(Fit 3/5 — sem rascunho de abordagem pronto; time decide manualmente.)', 'prospecto', 'Squad Veiling'),

  ('Sky Hall Garden', 'restaurante', '[{"numero":"(11) 3061-3865","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'Jardim Paulista', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 3/5 — Restaurantes. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Restaurante em Rua Haddock Lobo, 1327, Jardim Paulista. Localização adjacente aos Jardins com potencial de paisagismo.

Canal de abordagem sugerido pela Paula: Telefone

(Fit 3/5 — sem rascunho de abordagem pronto; time decide manualmente.)', 'prospecto', 'Squad Veiling'),

  ('Lui Eventos', 'outros', '[{"numero":"(11) 5198-4816","rotulo":"Principal","whatsapp":false},{"numero":"(11) 99308-5873","rotulo":"WhatsApp","whatsapp":true},{"numero":"(11) 94524-8771","rotulo":"WhatsApp 2","whatsapp":true}]'::jsonb, 'luieventos@luieventos.com.br', 'whatsapp', 'Avenida Paulista / Bela Vista', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Agências de Eventos. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Agência de eventos consolidada há 15+ anos em Avenida Paulista. Fornecimento pontual de paisagismo por evento + volume sazonal, alto potencial de ticket recorrente anual.

Canal de abordagem sugerido pela Paula: WhatsApp (99308-5873 ou 94524-8771)

--- Abordagem sugerida ---
Oi! 👋 Agência consolidada há 15+ anos em Paulista — visível que vocês sabem o que fazem

Imagino que em alguns eventos vocês precisam de paisagismo pontual. A gente trabalha com fornecimento rápido e de qualidade pra eventos corporativos.

Quer saber mais sobre como a gente pode ser parceira de vocês?

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Agência Vision', 'outros', '[{"numero":"(11) 5042-2004","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, 'email@agenciavision.com', 'whatsapp', 'Brooklin', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 5/5 — Agências de Eventos. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Agência de eventos corporativa em Brooklin (adjacente a Berrini/zona prioritária). Fornecimento por evento, volume sazonal com potencial de retenção anual. Endereço: Rua Miguel Sutil, 370.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Agência de eventos corporativa em Brooklin — legal saber que vocês estão aí

Alguns eventos demandam aquele toque verde na ambientação. Fornecimento ágil, qualidade garantida e sem dor de cabeça.

Posso enviar um portefólio de eventos que já fizemos? Bora explorar?

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Raphael Pires Decoração', 'outros', '[{"numero":"(11) 96094-6440","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'São Paulo', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Agências de Eventos. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Decorador independente com base em São Paulo. Modelo de negócio pontual por evento com potencial de retenção. Maior flexibilidade que agências consolidadas.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Decorador independente em São Paulo — sempre bom conhecer quem trabalha com design

Imagino que em alguns projetos seus clientes pedem aquela composição com plantas e paisagismo. A gente fornece com agilidade e qualidade.

Quer trocar umas ideias sobre possíveis parcerias? Me chama.

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Ali Festa', 'outros', '[{"numero":"(11) 94873-0024","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'São Paulo', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 4/5 — Agências de Eventos. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Agência de decoração com contato WhatsApp verificado. Modelo pontual por evento com potencial de volume sazonal. Endereço: Av. Milton Da Rocha, 337.

Canal de abordagem sugerido pela Paula: WhatsApp

--- Abordagem sugerida ---
Oi! 👋 Agência de decoração — sempre tem aquela demanda por verde nos eventos

Fornecimento de plantas e paisagismo pontual pra decoração é coisa que a gente faz bem. Pode ser um evento ou um volume sazonal.

Que tal marcar um tempo pra explorar como podemos trabalhar juntas?

Equipe Verde Interior 🌿
Responda SAIR para não receber mais mensagens.', 'prospecto', 'Squad Veiling'),

  ('Balaio de Emoções', 'outros', '[{"numero":"(11) 99740-1482","rotulo":"WhatsApp","whatsapp":true}]'::jsonb, NULL, 'whatsapp', 'São Paulo', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 3/5 — Agências de Eventos. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Agência de decoração com contato WhatsApp. Modelo pontual por evento. Menor escala que Lui Eventos / Agência Vision.

Canal de abordagem sugerido pela Paula: WhatsApp

(Fit 3/5 — sem rascunho de abordagem pronto; time decide manualmente.)', 'prospecto', 'Squad Veiling'),

  ('Vivo Desejo', 'outros', '[{"numero":"(11) 29524537","rotulo":"Principal","whatsapp":false}]'::jsonb, NULL, 'telefone', 'São Paulo', 'Paisagismo corporativo (implantação/manutenção)', 'Fit 3/5 — Agências de Eventos. Motivo de compra: contrato de implantação/manutenção recorrente de paisagismo.

Racional: Decoradora de festas com 40 anos de mercado. Modelo pontual por evento. Contato telefônico verificado, mas sem WhatsApp/e-mail público.

Canal de abordagem sugerido pela Paula: Telefone

(Fit 3/5 — sem rascunho de abordagem pronto; time decide manualmente.)', 'prospecto', 'Squad Veiling');
