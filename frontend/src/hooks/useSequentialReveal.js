/**
 * ============================================================================
 *  useSequentialReveal — a conversa acontece por TURNOS
 * ============================================================================
 * O backend escalona os agentes, mas as respostas voltam quando cada modelo
 * termina — e com latências parecidas elas chegam praticamente juntas. Se a UI
 * renderizar o array cru, o usuário recebe três blocos de texto de uma vez.
 *
 * Aqui a lista de eventos vira uma fila de TURNOS. Cada fala tem duas fases:
 *
 *   1. anúncio   -> "Cassandra está formulando…" (só ela, mais ninguém)
 *   2. revelação -> a resposta entra na tela
 *
 * Assim existe sempre UMA coisa acontecendo, com quem tem a palavra
 * identificado: leitura de sessão/call em vez de despejo de cards.
 *
 * A decisão de cada passo mora em `calcularPasso`, uma função pura — é o que
 * permite testar o ritmo com relógio virtual, sem navegador.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Ritmo de cada tipo de item, em ms.
 *  anuncio = tempo do "está formulando" no ar antes da fala aparecer
 *  espera  = pausa depois de revelar, antes do próximo turno começar
 */
export const RITMO = {
  message: { anuncio: 1000, espera: 420 },
  error: { anuncio: 520, espera: 360 },
  search: { anuncio: 0, espera: 560 },
  round: { anuncio: 0, espera: 760 },
  system: { anuncio: 0, espera: 380 },
};

const PADRAO = { anuncio: 0, espera: 460 };
const PISO_ANUNCIO = 320;
const PISO_ESPERA = 180;

/**
 * Encurta as fases quando a fila acumula (aba em segundo plano, respostas em
 * rajada), respeitando um piso para nunca virar despejo.
 */
function ajustar(base, naFila, piso) {
  if (!base) return 0;
  // Pressão suave: só a partir do terceiro item na fila o ritmo acelera.
  const fator = 1 + Math.max(0, naFila - 2) / 4;
  return Math.max(piso, Math.round(base / fator));
}

/**
 * Decide o próximo passo da fila. Pura de propósito: mesma entrada, mesma saída.
 *
 * @param {object} params
 * @param {Array}  params.items            timeline completa
 * @param {number} params.visiveis         quantos itens já estão na tela
 * @param {string|null} params.anunciandoKey  key do item em anúncio (ou null)
 * @param {boolean} params.enabled         false = revela tudo de uma vez
 * @param {number} params.agora            timestamp atual (ms)
 * @param {number} params.inicioDoTurno    quando o anúncio atual começou
 * @param {number} params.ultimaRevelacao  quando a última fala foi revelada
 * @returns {{tipo: 'reset'|'ocioso'|'bloco'|'anunciar'|'revelar', ate?: number, item?: object, esperaMs?: number}}
 */
export function calcularPasso({
  items = [],
  visiveis = 0,
  anunciandoKey = null,
  enabled = true,
  agora = 0,
  inicioDoTurno = 0,
  ultimaRevelacao = 0,
}) {
  if (visiveis > items.length) return { tipo: 'reset', ate: items.length };
  if (visiveis >= items.length) return { tipo: 'ocioso' };

  const proximo = items[visiveis];

  // Histórico (debate antigo, página recarregada): entra em bloco, sem encenação.
  if (!enabled || proximo?.fromSnapshot) {
    let indice = visiveis;
    while (indice < items.length && (!enabled || items[indice]?.fromSnapshot)) indice += 1;
    return { tipo: 'bloco', ate: indice };
  }

  const naFila = items.length - visiveis;
  const ritmo = RITMO[proximo?.kind] ?? PADRAO;
  const anuncioMs = ajustar(ritmo.anuncio, naFila, PISO_ANUNCIO);
  const esperaMs = ajustar(ritmo.espera, naFila, PISO_ESPERA);

  // Fase 1: anunciar quem vai falar (depois da pausa entre turnos).
  if (anuncioMs > 0 && anunciandoKey !== proximo.key) {
    const desdeUltima = agora - ultimaRevelacao;
    return { tipo: 'anunciar', item: proximo, esperaMs: Math.max(0, esperaMs - desdeUltima) };
  }

  // Fase 2: revelar. Desconta o tempo já decorrido para que um evento novo
  // chegando no meio não reinicie a contagem (senão a fila nunca andaria).
  const total = anuncioMs > 0 ? anuncioMs : esperaMs;
  const referencia = anuncioMs > 0 ? inicioDoTurno : ultimaRevelacao;
  return { tipo: 'revelar', item: proximo, esperaMs: Math.max(0, total - (agora - referencia)) };
}

/**
 * @param {Array<{kind: string, key: string, fromSnapshot?: boolean}>} items
 * @param {object} [options]
 * @param {boolean} [options.enabled]
 * @returns {{visibleItems: Array, announcing: object|null, isRevealing: boolean, pending: number}}
 */
/**
 * Quantos itens já podem entrar no PRIMEIRO render, sem esperar efeito nenhum.
 * Evita o flash de tela vazia ao abrir um debate do histórico (e faz a sala
 * renderizar completa também fora do navegador).
 */
function contarInstantaneos(items = [], enabled = true) {
  if (!enabled) return items.length;
  let indice = 0;
  while (indice < items.length && items[indice]?.fromSnapshot) indice += 1;
  return indice;
}

export function useSequentialReveal(items = [], { enabled = true } = {}) {
  const [visiveis, setVisiveis] = useState(() => contarInstantaneos(items, enabled));
  /** Item em anúncio agora (fase 1 do turno). */
  const [anunciando, setAnunciando] = useState(null);

  /** Marcos de tempo (refs: não devem provocar re-render). */
  const inicioDoTurno = useRef(0);
  const ultimaRevelacao = useRef(0);

  useEffect(() => {
    const passo = calcularPasso({
      items,
      visiveis,
      anunciandoKey: anunciando?.key ?? null,
      enabled,
      agora: Date.now(),
      inicioDoTurno: inicioDoTurno.current,
      ultimaRevelacao: ultimaRevelacao.current,
    });

    switch (passo.tipo) {
      case 'reset':
        setVisiveis(passo.ate);
        setAnunciando(null);
        return undefined;

      case 'ocioso':
        if (anunciando) setAnunciando(null);
        return undefined;

      case 'bloco':
        ultimaRevelacao.current = Date.now();
        if (anunciando) setAnunciando(null);
        setVisiveis(passo.ate);
        return undefined;

      case 'anunciar': {
        const timer = setTimeout(() => {
          inicioDoTurno.current = Date.now();
          setAnunciando(passo.item);
        }, passo.esperaMs);
        return () => clearTimeout(timer);
      }

      case 'revelar':
      default: {
        const timer = setTimeout(() => {
          ultimaRevelacao.current = Date.now();
          setAnunciando(null);
          setVisiveis((atual) => atual + 1);
        }, passo.esperaMs);
        return () => clearTimeout(timer);
      }
    }
  }, [items, visiveis, anunciando, enabled]);

  const visibleItems = useMemo(() => items.slice(0, visiveis), [items, visiveis]);

  return {
    visibleItems,
    announcing: anunciando,
    isRevealing: visiveis < items.length,
    pending: Math.max(0, items.length - visiveis),
  };
}
