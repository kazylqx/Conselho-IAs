/**
 * ============================================================================
 *  LISTA DE MODELOS DISPONIVEIS
 * ============================================================================
 * Ids de modelo mudam sem aviso (e a Google desativa modelo antigo para conta
 * nova). Este script pergunta a cada provedor o que a SUA chave pode usar e
 * confere se os modelos do agents.config.js ainda existem.
 *
 *   npm run modelos:list             -> lista tudo + checagem da configuracao
 *   npm run modelos:list -- flash    -> filtra os ids que contenham "flash"
 *
 * Nenhuma chave eh impressa. Nao gasta credito de geracao (so lista).
 */

import 'dotenv/config';
import { agents, judge } from '../src/agents.config.js';

const filtro = process.argv.slice(2).join(' ').trim().toLowerCase();
const aplicaFiltro = (id) => !filtro || id.toLowerCase().includes(filtro);

/** Modelos por provedor, preenchido conforme as consultas respondem. */
const disponiveis = { groq: null, google: null, openrouter: null };

function titulo(texto) {
  console.log(`\n===== ${texto} =====`);
}

// ---------------------------------------------------------------------------
// Groq
// ---------------------------------------------------------------------------
async function listarGroq() {
  titulo('GROQ');
  if (!process.env.GROQ_API_KEY) {
    console.log('GROQ_API_KEY não definida: pulando.');
    return;
  }

  try {
    const resposta = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      console.log(`HTTP ${resposta.status}: ${JSON.stringify(dados).slice(0, 200)}`);
      return;
    }

    const ids = (dados.data ?? []).map((m) => m.id).sort();
    disponiveis.groq = ids;

    // Modelos de audio/moderacao nao servem para o debate.
    const texto = ids.filter((id) => !/whisper|orpheus|guard|safeguard|tts/i.test(id));
    console.log(texto.filter(aplicaFiltro).map((id) => `  ${id}`).join('\n') || '  (nada com esse filtro)');
    console.log(`\n  ${texto.length} modelo(s) de texto · ${ids.length} no total`);
  } catch (erro) {
    console.log(`erro: ${erro.message}`);
  }
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------
async function listarGemini() {
  titulo('GEMINI (só os que suportam generateContent)');
  if (!process.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY não definida: pulando.');
    return;
  }

  try {
    const resposta = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } },
    );
    const dados = await resposta.json();

    if (!resposta.ok) {
      console.log(`HTTP ${resposta.status}: ${JSON.stringify(dados).slice(0, 200)}`);
      return;
    }

    const ids = (dados.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      .sort();

    disponiveis.google = ids;

    // Para debate interessa texto: tira imagem, áudio, embedding e afins.
    const texto = ids.filter((id) => !/image|imagen|tts|audio|live|embed|veo|aqa/i.test(id));
    console.log(texto.filter(aplicaFiltro).map((id) => `  ${id}`).join('\n') || '  (nada com esse filtro)');
    console.log(`\n  ${texto.length} modelo(s) de texto · ${ids.length} com generateContent`);
    console.log(
      '  Obs.: aparecer aqui não garante acesso — a Google recusa alguns modelos antigos\n' +
        '  para contas novas ("no longer available to new users"). Confirme com npm run providers:check.',
    );
  } catch (erro) {
    console.log(`erro: ${erro.message}`);
  }
}

// ---------------------------------------------------------------------------
// OpenRouter
// ---------------------------------------------------------------------------
async function listarOpenRouter() {
  titulo('OPENROUTER (modelos gratuitos, sufixo :free)');

  try {
    // Endpoint publico: nao precisa de chave para listar.
    const resposta = await fetch('https://openrouter.ai/api/v1/models');
    const dados = await resposta.json();

    if (!resposta.ok) {
      console.log(`HTTP ${resposta.status}`);
      return;
    }

    const todos = (dados.data ?? []).map((m) => ({
      id: m.id,
      ctx: m.context_length ?? 0,
    }));

    disponiveis.openrouter = todos.map((m) => m.id);

    const gratuitos = todos
      .filter((m) => m.id.endsWith(':free'))
      .sort((a, b) => b.ctx - a.ctx);

    const lista = gratuitos.filter((m) => aplicaFiltro(m.id));
    console.log(
      lista.map((m) => `  ${m.id}  (contexto ${m.ctx.toLocaleString('pt-BR')})`).join('\n') ||
        '  (nada com esse filtro)',
    );
    console.log(`\n  ${gratuitos.length} modelo(s) gratuito(s) · ${todos.length} no total`);
  } catch (erro) {
    console.log(`erro: ${erro.message}`);
  }
}

// ---------------------------------------------------------------------------
// Confere a configuracao atual
// ---------------------------------------------------------------------------
function conferirConfiguracao() {
  titulo('MODELOS USADOS EM agents.config.js');

  const usados = [
    ...agents.filter((a) => a.enabled !== false).map((a) => ({ ...a, papel: 'debatedor' })),
    { ...judge, papel: 'juiz' },
  ];

  let problemas = 0;

  for (const item of usados) {
    const lista = disponiveis[item.provider];
    const nome = `${item.name} (${item.papel}) · ${item.provider} · ${item.model}`;

    if (!lista) {
      console.log(`•  ${nome}\n   não deu para verificar (provedor sem chave ou consulta falhou)`);
      continue;
    }

    if (lista.includes(item.model)) {
      console.log(`✅ ${nome}`);
    } else {
      problemas += 1;
      const parecidos = lista
        .filter((id) => {
          const base = item.model.split(/[:/]/).pop().replace(/[\d.]+/g, '');
          return base.length > 3 && id.includes(base.slice(0, 6));
        })
        .slice(0, 5);

      console.log(`❌ ${nome}\n   este id NÃO existe na lista do provedor.`);
      if (parecidos.length) console.log(`   parecidos: ${parecidos.join(', ')}`);
    }
  }

  console.log(
    problemas
      ? `\n${problemas} modelo(s) para corrigir em src/agents.config.js.\n`
      : '\nTodos os modelos configurados existem no provedor.\n',
  );
}

await listarGroq();
await listarGemini();
await listarOpenRouter();
conferirConfiguracao();
