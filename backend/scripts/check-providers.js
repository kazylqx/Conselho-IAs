/**
 * ============================================================================
 *  CHECAGEM DE CHAVES E PROVEDORES
 * ============================================================================
 * Faz uma chamada minima para cada agente configurado e diz o que esta faltando.
 * Serve para conferir as chaves logo depois de preencher o .env (ou o painel da
 * SquareCloud), sem precisar rodar um debate inteiro.
 *
 *   npm run providers:check
 *
 * Nenhuma chave eh impressa: o script mostra apenas o NOME da variavel.
 */

import 'dotenv/config';
import { agents, judge } from '../src/agents.config.js';
import { callModel } from '../src/agents/providers.js';

// Este script sempre testa as APIs reais, mesmo com MOCK_AI=true no .env.
process.env.MOCK_AI = 'false';

const alvos = [
  ...agents.filter((agent) => agent.enabled !== false).map((agent) => ({ ...agent, papel: 'debatedor' })),
  { ...judge, papel: 'juiz' },
];

console.log('\nChecando os provedores configurados em src/agents.config.js\n');

let falhas = 0;

for (const config of alvos) {
  const variavel = config.apiKeyEnv ?? '(padrão do provedor)';
  const temChave = Boolean(process.env[config.apiKeyEnv]);
  const etiqueta = `${config.name} (${config.papel}) · ${config.provider} · ${config.model}`;

  if (!temChave) {
    falhas += 1;
    console.log(`❌ ${etiqueta}\n   ${variavel} não está definida no ambiente.\n`);
    continue;
  }

  try {
    // 300 tokens: pouco o suficiente para ser barato, folgado o bastante para
    // modelo de raciocinio (gpt-oss e afins gastam tokens "pensando" antes).
    const resposta = await callModel({
      config: { ...config, maxTokens: 300, retries: 0, timeoutMs: 30000 },
      system: 'Responda apenas com a palavra OK.',
      prompt: 'OK',
    });

    if (resposta.usedFallback) {
      console.log(
        `⚠️  ${etiqueta}\n   o primário falhou, mas a RESERVA respondeu: ` +
          `${resposta.provider}/${resposta.model} (${resposta.durationMs}ms).`,
      );
      for (const tentativa of resposta.attempts ?? []) {
        console.log(`   ↳ ${tentativa.provider}/${tentativa.model}: ${tentativa.code}`);
      }
      console.log('');
    } else {
      console.log(`✅ ${etiqueta}\n   ${variavel} funcionando (${resposta.durationMs}ms).\n`);
    }
  } catch (error) {
    falhas += 1;
    console.log(`❌ ${etiqueta}\n   ${error.code}: ${error.message}\n`);

    if (String(error.message).includes('Missing Authentication header')) {
      console.log(
        '   Dica: no OpenRouter essa mensagem costuma significar formato de chave inválido ' +
          '(a chave começa com "sk-or-v1-").\n',
      );
    }
    if (String(error.message).includes('model not found') || error.status === 404) {
      console.log('   Dica: o id do modelo mudou. Ajuste o campo `model` do agente.\n');
    }
  }
}

if (falhas) {
  console.log(`${falhas} agente(s) com problema. O debate roda mesmo assim, sem eles.\n`);
  process.exit(1);
}

console.log('Todos os agentes responderam. O conselho está pronto.\n');
