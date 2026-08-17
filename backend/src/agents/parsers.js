/**
 * ============================================================================
 *  PARSERS
 * ============================================================================
 * Modelos de linguagem nao garantem formato. Estas funcoes extraem os dados
 * estruturados que a UI precisa e SEMPRE devolvem algo utilizavel, mesmo quando
 * o modelo ignora o formato pedido.
 */

/**
 * Rotulos esperados na resposta da rodada 2.
 *
 * Os modelos reais nao seguem o formato ao pe da letra: escrevem
 * "**POSIÇÃO:**", "### DISCORDÂNCIAS", "- CONCORDÂNCIAS -", as vezes sem os
 * dois-pontos, e modelos de raciocinio chegam a repetir as instrucoes dentro da
 * resposta ("Exact labels: CONCORDÂNCIAS:, DISCORDÂNCIAS:, ..."), o que envenenava
 * o parsing. Por isso os rotulos sao ancorados em INICIO DE LINHA: um rotulo
 * citado no meio de uma frase deixa de ser confundido com o cabecalho da secao.
 */
const ROTULOS_DEBATE = [
  { key: 'agreements', fonte: 'CONCORD[ÂA]NCIAS?' },
  { key: 'disagreements', fonte: 'DISCORD[ÂA]NCIAS?' },
  { key: 'position', fonte: 'POSI[ÇC][ÃA]O' },
  { key: 'updatedAnswer', fonte: 'RESPOSTA\\s+ATUALIZADA' },
];

/** Monta o regex do rotulo tolerando markdown e ausencia de dois-pontos. */
function regexDoRotulo(fonte) {
  //  ^  espaços/marcadores (>, *, #, -, _) · **negrito** · RÓTULO · **  · [:–—-]?
  return new RegExp(`^[ \\t>*#_\\-]*\\**\\s*(?:${fonte})\\s*\\**\\s*[:\\-–—]?`, 'gim');
}

/**
 * Extrai as secoes da resposta de debate (rodada 2).
 *
 * @param {string} texto resposta bruta do modelo
 * @returns {{agreements: string, disagreements: string, position: 'MANTENHO'|'REVISO'|null, updatedAnswer: string, parsed: boolean}}
 */
export function parseDebateResponse(texto = '') {
  /** Todas as ocorrencias de todos os rotulos, em ordem de posicao no texto. */
  const ocorrencias = [];

  for (const rotulo of ROTULOS_DEBATE) {
    const regex = regexDoRotulo(rotulo.fonte);
    let match;
    while ((match = regex.exec(texto)) !== null) {
      ocorrencias.push({
        key: rotulo.key,
        start: match.index,
        contentStart: match.index + match[0].length,
      });
      // Rotulo pode casar vazio (linha só com o nome): evita loop infinito.
      if (match.index === regex.lastIndex) regex.lastIndex += 1;
    }
  }

  // Sem nenhum rotulo: devolve o texto inteiro como resposta atualizada.
  if (!ocorrencias.length) {
    return {
      agreements: '',
      disagreements: '',
      position: null,
      updatedAnswer: texto.trim(),
      parsed: false,
    };
  }

  ocorrencias.sort((a, b) => a.start - b.start);

  // Conteudo de cada ocorrencia = até o próximo rótulo (qualquer um) ou fim.
  const comConteudo = ocorrencias.map((atual, indice) => {
    const fim = ocorrencias[indice + 1]?.start ?? texto.length;
    return { ...atual, conteudo: texto.slice(atual.contentStart, fim).trim() };
  });

  // Rótulo repetido (eco das instruções + seção real): fica o de maior conteúdo.
  const melhores = {};
  for (const ocorrencia of comConteudo) {
    const atual = melhores[ocorrencia.key];
    if (!atual || ocorrencia.conteudo.length > atual.conteudo.length) {
      melhores[ocorrencia.key] = ocorrencia;
    }
  }

  const secoes = Object.fromEntries(
    Object.entries(melhores).map(([chave, ocorrencia]) => [chave, ocorrencia.conteudo]),
  );

  return {
    agreements: secoes.agreements || '',
    disagreements: secoes.disagreements || '',
    position: normalizarPosicao(secoes.position, texto),
    updatedAnswer: secoes.updatedAnswer || texto.trim(),
    parsed: true,
  };
}

/** Remove acentos e deixa em maiusculas, para comparar sem surpresa. */
function semAcento(texto = '') {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza a posicao para MANTENHO / REVISO.
 * Se a secao POSICAO nao vier legivel, procura a palavra no texto inteiro
 * (varios modelos escrevem "mantenho minha resposta" no meio do paragrafo).
 */
function normalizarPosicao(secaoPosicao, textoCompleto = '') {
  const daSecao = semAcento(secaoPosicao ?? '');
  if (daSecao.includes('REVIS')) return 'REVISO';
  if (daSecao.includes('MANTEN') || daSecao.includes('MANTE')) return 'MANTENHO';

  // Último recurso: a palavra aparece em algum lugar da resposta.
  const completo = semAcento(textoCompleto);
  const temRevisao = /\bREVIS(O|EI|ANDO|AR)\b/.test(completo);
  const temManutencao = /\bMANTEN(HO|DO)\b|\bMANTE(NHO|M)\b/.test(completo);

  if (temRevisao && !temManutencao) return 'REVISO';
  if (temManutencao && !temRevisao) return 'MANTENHO';
  return null;
}

/** Respostas que significam "nao quero buscar nada". */
const RECUSAS_DE_BUSCA = /^(nenhuma?|nao|não|n\/a|-|nada|nenhuma busca)\.?$/i;

/**
 * Detecta o pedido de busca do agente na rodada 2 ("BUSCAR: <consulta>").
 *
 * @param {string} texto resposta bruta do modelo
 * @returns {{query: string|null, cleaned: string}}
 *          query = consulta pedida (null se nao pediu);
 *          cleaned = texto sem a linha do pedido
 */
export function extractSearchRequest(texto = '') {
  const match = /^[\s>*-]*BUSCAR\s*:\s*(.+)$/im.exec(texto);
  if (!match) return { query: null, cleaned: texto };

  // Limpa markdown e, nas pontas, aspas e pontuacao em qualquer ordem
  // (modelos escrevem coisas como: BUSCAR: **"node lts atual".**)
  const consulta = match[1]
    .replace(/\*\*/g, '')
    .trim()
    .replace(/^[\s"'«“‘]+/, '')
    .replace(/[\s"'»”’.;,]+$/, '')
    .trim();

  const cleaned = texto.replace(match[0], '').trim();

  if (!consulta || RECUSAS_DE_BUSCA.test(consulta)) return { query: null, cleaned };

  // Consulta gigante costuma ser o modelo confundindo o formato: corta.
  return { query: consulta.slice(0, 200), cleaned };
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
 * Normaliza a lista de fontes citadas pelo juiz.
 * Aceita numeros ([1, 2]), strings ("[1]", "1", "https://..."), ou objetos
 * ({ n: 1 } / { url: '...' }) — modelos variam muito nesse campo.
 *
 * @param {*} valor
 * @returns {Array<number|string>} numeros de fonte e/ou URLs
 */
function normalizarRefsDeFonte(valor) {
  const bruto = Array.isArray(valor) ? valor : valor == null ? [] : [valor];
  const refs = [];

  for (const item of bruto) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      refs.push(Math.trunc(item));
      continue;
    }

    if (item && typeof item === 'object') {
      if (item.url) refs.push(String(item.url).trim());
      else if (item.n != null) refs.push(Math.trunc(Number(item.n)));
      continue;
    }

    const texto = String(item ?? '').trim();
    if (!texto) continue;

    const url = /https?:\/\/\S+/i.exec(texto);
    if (url) {
      refs.push(url[0].replace(/[),.]+$/, ''));
      continue;
    }

    // "[3]" ou "3" ou "fonte 3"
    const numero = /(\d{1,3})/.exec(texto);
    if (numero) refs.push(Number.parseInt(numero[1], 10));
  }

  // Remove duplicatas mantendo a ordem.
  return [...new Set(refs)];
}

/**
 * Interpreta o veredito do juiz.
 *
 * @param {string} texto resposta bruta do juiz
 * @returns {{finalAnswer: string, confidence: number, consensusPoints: string[], disagreementPoints: string[], sourceRefs: Array<number|string>, caveats: string, parsed: boolean, rawText: string}}
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
      // Última tentativa: pega "[1]", "[2]" citados no texto solto.
      sourceRefs: normalizarRefsDeFonte((texto.match(/\[(\d{1,3})\]/g) ?? []).map((m) => m)),
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

  const fontes =
    dados.fontes_usadas ??
    dados.fontesUsadas ??
    dados.fontes ??
    dados.sources ??
    dados.sources_used ??
    [];

  return {
    finalAnswer: String(finalAnswer).trim() || 'O juiz não retornou uma resposta final.',
    confidence: clampConfianca(dados.confianca ?? dados.confiança ?? dados.confidence, 50),
    consensusPoints: normalizarLista(consenso),
    disagreementPoints: normalizarLista(discordancia),
    sourceRefs: normalizarRefsDeFonte(fontes),
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
 * @param {Array} [params.sources] fontes coletadas no debate (entram como "consultadas")
 */
export function buildFallbackVerdict({
  finalAnswers = [],
  confidence = 30,
  reason = '',
  sources = [],
}) {
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
    // Sem juiz não há citação: mostramos tudo que o debate consultou.
    sources: sources.slice(0, 6),
    sourcesFromRegistry: sources.length > 0,
    caveats:
      'Veredito gerado automaticamente pelo backend porque o agente juiz falhou. ' +
      'Confiança reduzida de propósito.',
    parsed: false,
    fallback: true,
  };
}
