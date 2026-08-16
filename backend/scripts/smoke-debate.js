/**
 * ============================================================================
 *  TESTE RAPIDO DO ORQUESTRADOR (sem HTTP, sem WebSocket)
 * ============================================================================
 * Roda um debate inteiro no terminal e imprime cada evento. Serve para conferir
 * prompts, parsing e tratamento de erro sem subir o servidor.
 *
 *   npm run debate:teste                      -> modo simulado (MOCK_AI=true)
 *   npm run debate:teste -- --real "pergunta" -> usa as APIs reais do .env
 */

import 'dotenv/config';
import { runDebate } from '../src/agents/orchestrator.js';

const argumentos = process.argv.slice(2);
const usarApiReal = argumentos.includes('--real');
const pergunta =
  argumentos.filter((arg) => arg !== '--real').join(' ') ||
  'Vale mais a pena aprender um framework novo ou aprofundar no que já se usa?';

// Sem --real, força o modo simulado para não gastar credito de API.
if (!usarApiReal) process.env.MOCK_AI = 'true';

/** Imprime o evento de forma legivel. */
function imprimir(type, payload) {
  const etiqueta = `[${type}]`.padEnd(20);

  switch (type) {
    case 'round_started':
      console.log(`\n=============== ${payload.label} ===============`);
      break;
    case 'agent_typing':
      console.log(`${etiqueta} ${payload.agentId} está digitando...`);
      break;
    case 'agent_response':
    case 'agent_debate':
      console.log(`${etiqueta} ${payload.agentId} (${payload.durationMs}ms)`);
      console.log(`${payload.content.slice(0, 600)}\n`);
      if (payload.structured) {
        console.log(`  -> posição: ${payload.structured.position ?? 'não identificada'}`);
        console.log(`  -> parsing ok: ${payload.structured.parsed}\n`);
      }
      break;
    case 'agent_error':
      console.log(`${etiqueta} ⚠️  ${payload.message} (${payload.code})`);
      break;
    case 'confidence_update':
      console.log(`${etiqueta} ${payload.confidence}% — ${payload.reason}`);
      break;
    case 'final_verdict':
      console.log('\n=============== VEREDITO ===============');
      console.log(payload.verdict.finalAnswer);
      console.log(`\nConfiança: ${payload.verdict.confidence}%`);
      console.log('Consenso:', payload.verdict.consensusPoints);
      console.log('Discordâncias:', payload.verdict.disagreementPoints);
      break;
    case 'debate_completed':
      console.log(`\n${etiqueta} concluído em ${Math.round(payload.durationMs / 1000)}s`);
      if (payload.failures?.length) console.log('Falhas:', payload.failures);
      break;
    default:
      console.log(`${etiqueta} ${JSON.stringify(payload).slice(0, 200)}`);
  }
}

console.log(`\nPergunta: ${pergunta}`);
console.log(`Modo: ${usarApiReal ? 'APIs reais' : 'simulado (mock)'}\n`);

try {
  await runDebate({
    debateId: 'teste-local',
    question: pergunta,
    emit: (type, payload) => imprimir(type, payload),
  });
  process.exit(0);
} catch (error) {
  console.error('\n❌ O debate falhou:', error.message);
  process.exit(1);
}
