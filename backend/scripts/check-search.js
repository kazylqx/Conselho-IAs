/**
 * ============================================================================
 *  CHECAGEM DA BUSCA NA WEB (Tavily)
 * ============================================================================
 * Faz UMA busca real e mostra o que voltou. Serve para confirmar que a chave
 * esta valida antes de rodar um debate inteiro.
 *
 *   npm run busca:check
 *   npm run busca:check -- "sua consulta aqui"
 *
 * Custo: 1 credito Tavily (search_depth basic).
 * A chave nunca eh impressa — so o resultado da busca.
 */

import 'dotenv/config';
import { webSearch, isWebSearchAvailable, needsFreshData } from '../src/agents/webSearch.js';

const consulta =
  process.argv.slice(2).join(' ').trim() || 'qual a versão LTS atual do Node.js';

console.log('\nChecagem da busca na web');
console.log(`  provedor:        ${process.env.WEB_SEARCH_PROVIDER || '(vazio → padrão tavily)'}`);
console.log(`  chave presente:  ${Boolean(process.env.WEB_SEARCH_API_KEY)}`);
console.log(`  profundidade:    ${process.env.WEB_SEARCH_DEPTH || 'basic'}`);
console.log(`  disponível:      ${isWebSearchAvailable()}`);
console.log(`  consulta:        "${consulta}"`);
console.log(`  parece depender de dado atual: ${needsFreshData(consulta)}\n`);

if (!isWebSearchAvailable()) {
  console.log(
    '❌ Busca desligada. Preencha WEB_SEARCH_API_KEY no backend/.env ' +
      '(chave gratuita em https://app.tavily.com) e rode de novo.\n',
  );
  process.exit(1);
}

const resposta = await webSearch(consulta, { maxResults: 5 });

if (!resposta.implemented) {
  console.log(`❌ A busca falhou: ${resposta.note}\n`);
  process.exit(1);
}

if (!resposta.results.length) {
  console.log('⚠️  A chave funciona, mas esta consulta não retornou resultados.\n');
  process.exit(0);
}

console.log(`✅ ${resposta.results.length} resultado(s) · ${resposta.credits ?? '?'} crédito(s) · ${resposta.durationMs}ms\n`);

resposta.results.forEach((item, indice) => {
  console.log(`[${indice + 1}] ${item.title}`);
  console.log(`    ${item.source}${item.publishedAt ? ` · ${item.publishedAt}` : ''}`);
  console.log(`    ${item.url}`);
  console.log(`    ${item.snippet.slice(0, 160)}…\n`);
});

console.log('A busca está pronta: os agentes vão receber fontes numeradas nos prompts.\n');
