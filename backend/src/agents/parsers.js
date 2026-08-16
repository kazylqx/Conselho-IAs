/**
 * ============================================================================
 *  PARSERS
 * ============================================================================
 * Modelos de linguagem nao garantem formato. Estas funcoes extraem os dados
 * estruturados que a UI precisa e SEMPRE devolvem algo utilizavel, mesmo quando
 * o modelo ignora o formato pedido.
 */

/** Rotulos esperados na resposta da rodada 2 (aceitam variacao de acento). */
const ROTULOS_DEBATE = [
  { key: 'agreements', regex: /CONCORD[ÂA]NCIAS?\s*:?/i },
  { key: 'disagreements', regex: /DISCORD[ÂA]NCIAS?\s*:?/i },
  { key: 'position', regex: /POSI[ÇC][ÃA]O\s*:?/i },
  { key: 'updatedAnswer', regex: /RESPOSTA\s+ATUALIZADA\s*:?/i },
];

/**
 * Extrai as secoes da resposta de debate (rodada 2).
 *
 * @param {string} texto resposta bruta do modelo
 * @returns {{agreements: string, disagreements: string, position: 'MANTENHO'|'REVISO'|null, updatedAnswer: string, parsed: boolean}}
 */
export function parseDebateResponse(texto = '') {
  const encontrados = [];

  for (const rotulo of ROTULOS_DEBATE) {
    const match = rotulo.regex.exec(texto);
    if (match) {
      encontrados.push({
        key: rotulo.key,
        start: match.index,
        contentStart: match.index + match[0].length,
      });
    }
  }

  // Sem nenhum rotulo: devolve o texto inteiro como resposta atualizada.
  if (!encontrados.length) {
    return {
      agreements: '',
      disagreements: '',
      position: null,
      updatedAnswer: texto.trim(),
      parsed: false,
    };
  }

  encontrados.sort((a, b) => a.start - b.start);

  const secoes = {};
  encontrados.forEach((atual, indice) => {
    const proximo = encontrados[indice + 1];
    const fim = proximo ? proximo.start : texto.length;
    secoes[atual.key] = texto.slice(atual.contentStart, fim).trim();
  });

  // Normaliza a posicao para MANTENHO / REVISO.
  let position = null;
  const posicaoBruta = (secoes.position || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (posicaoBruta.includes('REVIS')) position = 'REVISO';
  else if (posicaoBruta.includes('MANTEN') || posicaoBruta.includes('MANTE')) position = 'MANTENHO';

  return {
    agreements: secoes.agreements || '',
    disagreements: secoes.disagreements || '',
    position,
    updatedAnswer: secoes.updatedAnswer || texto.trim(),
    parsed: true,
  };
}

/**
 * true quando a secao de discordancias equivale a "nenhuma".
 * Regra: precisa comecar com uma negacao E ser curta — uma negacao seguida de
 * um paragrafo longo normalmente esconde uma ressalva de verdade
 * ("nenhuma discordância central, mas o número citado por X está errado...").
 */
export function semDiscordancia(textoDiscordancia = '') {
  const limpo = textoDiscordancia
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!limpo) return true;
  const comecaComNegacao = /^(nenhuma|nenhum|nao ha|nao existe|nada|n\/a|sem discordancias?)\b/.test(
    limpo,
  );
  return comecaComNegacao && limpo.length < 120;
}

/** Remove cercas de codigo e tenta isolar o objeto JSON dentro do texto. */
function extrairJson(texto = '') {
  const semCercas = texto
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const inicio = semCercas.indexOf('{');
  const fim = semCercas.lastIndexOf('}');
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;

  const candidato = semCercas.slice(inicio, fim + 1);

  try {
    return JSON.parse(candidato);
  } catch {
    // Segunda tentativa: remove virgulas sobrando antes de } ou ]
    try {
      return JSON.parse(candidato.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

/** Garante array de strings limpas. */
function normalizarLista(valor) {
  if (Array.isArray(valor)) {
    return valor
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter(Boolean);
  }
  if (typeof valor === 'string' && valor.trim()) {
    // Aceita string com itens separados por linha ou por ";"
    return valor
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean);
  }
  return [];
}

/** Limita a confianca ao intervalo 0-100 (inteiro). */
export function clampConfianca(valor, padrao = 50) {
  const numero = Number.parseFloat(valor);
  if (!Number.isFinite(numero)) return padrao;
  // Aceita 0.85 como 85%.
  const escalado = numero > 0 && numero <= 1 ? numero * 100 : numero;
  return Math.max(0, Math.min(100, Math.round(escalado)));
}

/**
 * Interpreta o veredito do juiz.
 *
 * @param {string} texto resposta bruta do juiz
 * @returns {{finalAnswer: string, confidence: number, consensusPoints: string[], disagreementPoints: string[], caveats: string, parsed: boolean, rawText: string}}
 */
export function parseJudgeVerdict(texto = '') {
  const dados = extrairJson(texto);

  if (!dados) {
    // O juiz respondeu em texto livre: aproveitamos o texto como resposta final.
    const confiancaNoTexto = /(\d{1,3})\s*%/.exec(texto);
    return {
      finalAnswer: texto.trim() || 'O juiz não retornou uma resposta legível.',
      confidence: confiancaNoTexto ? clampConfianca(confiancaNoTexto[1], 50) : 50,
      consensusPoints: [],
      disagreementPoints: [],
      caveats: 'O veredito não veio no formato JSON esperado; o texto foi usado como está.',
      parsed: false,
      rawText: texto,
    };
  }

  const finalAnswer =
    dados.resposta_final ??
    dados.respostaFinal ??
    dados.final_answer ??
    dados.answer ??
    '';

  const consenso = dados.pontos_de_consenso ?? dados.consenso ?? dados.consensus_points ?? [];
  const discordancia =
    dados.pontos_de_discordancia ??
    dados.pontos_de_discordância ??
    dados.discordancias ??
    dados.disagreement_points ??
    [];

  return {
    finalAnswer: String(finalAnswer).trim() || 'O juiz não retornou uma resposta final.',
    confidence: clampConfianca(dados.confianca ?? dados.confiança ?? dados.confidence, 50),
    consensusPoints: normalizarLista(consenso),
    disagreementPoints: normalizarLista(discordancia),
    caveats: String(dados.ressalvas ?? dados.caveats ?? '').trim(),
    parsed: true,
    rawText: texto,
  };
}

/**
 * Veredito de emergencia: usado quando o juiz falha (timeout, erro de API...).
 * Assim o debate sempre termina com alguma conclusao em vez de morrer no meio.
 *
 * @param {object} params
 * @param {Array<{agent: object, text: string, structured?: object}>} params.finalAnswers
 * @param {number} params.confidence confianca heuristica calculada pelo backend
 * @param {string} [params.reason] motivo da falha do juiz
 */
export function buildFallbackVerdict({ finalAnswers = [], confidence = 30, reason = '' }) {
  const consenso = [];
  const discordancias = [];

  for (const item of finalAnswers) {
    const estruturado = item.structured;
    if (estruturado?.agreements) {
      consenso.push(`${item.agent.name}: ${estruturado.agreements}`);
    }
    if (estruturado?.disagreements && !semDiscordancia(estruturado.disagreements)) {
      discordancias.push(`${item.agent.name}: ${estruturado.disagreements}`);
    }
  }

  const melhorResposta = finalAnswers[0]?.text?.trim();

  return {
    finalAnswer: melhorResposta
      ? `O juiz não conseguiu consolidar o debate${reason ? ` (${reason})` : ''}. ` +
        `Resposta mais recente de ${finalAnswers[0].agent.name} usada como conclusão provisória:\n\n${melhorResposta}`
      : `O debate não produziu resposta utilizável${reason ? ` (${reason})` : ''}.`,
    confidence: Math.min(confidence, 45),
    consensusPoints: consenso.slice(0, 5),
    disagreementPoints: discordancias.slice(0, 5),
    caveats:
      'Veredito gerado automaticamente pelo backend porque o agente juiz falhou. ' +
      'Confiança reduzida de propósito.',
    parsed: false,
    fallback: true,
  };
}
