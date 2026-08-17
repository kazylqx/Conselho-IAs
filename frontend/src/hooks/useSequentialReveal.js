/**
 * ============================================================================
 *  useSequentialReveal — "uma coisa de cada vez"
 * ============================================================================
 * O backend escalona os agentes (staggerMs), mas as respostas voltam quando cada
 * modelo termina — as vezes tres de uma vez. Se a UI renderizar o array cru, o
 * usuario recebe um despejo de informacao.
 *
 * Este hook transforma a lista de eventos em uma FILA de apresentacao: revela um
 * item por vez, com um intervalo minimo entre eles, para dar ritmo de conversa.
 *
 * Regras:
 *  - item que veio do snapshot (debate antigo / recarregou a pagina) aparece na
 *    hora, em bloco: ninguem quer esperar 40s para reler um debate;
 *  - se a fila acumular (aba em segundo plano), o intervalo encurta para a UI
 *    nao ficar minutos atrasada;
 *  - `enabled: false` desliga a encenacao e mostra tudo (usado em replay).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

/** Intervalo padrao por tipo de item, em ms. */
const INTERVALO_POR_TIPO = {
  round: 720, // marcador de capítulo: pausa maior, o olho descansa
  message: 520,
  search: 420,
  error: 380,
  system: 320,
};

/**
 * @param {Array<{kind: string, fromSnapshot?: boolean}>} items
 * @param {object} [options]
 * @param {boolean} [options.enabled] false = revela tudo de uma vez
 * @returns {{visibleItems: Array, isRevealing: boolean, pending: number}}
 */
export function useSequentialReveal(items = [], { enabled = true } = {}) {
  const [visiveis, setVisiveis] = useState(0);

  /**
   * Momento da última revelação. Sem isso, cada evento novo recriaria o timer e
   * o tempo já esperado seria jogado fora — com eventos chegando rápido, a fila
   * nunca andaria (starvation).
   */
  const ultimaRevelacao = useRef(0);

  useEffect(() => {
    // Lista trocou de debate (ou foi reiniciada): volta o contador para o tamanho válido.
    if (visiveis > items.length) {
      setVisiveis(items.length);
      return undefined;
    }

    if (visiveis >= items.length) return undefined;

    const proximo = items[visiveis];
    const instantaneo = !enabled || proximo?.fromSnapshot;

    // Itens instantâneos entram em bloco (um único render).
    if (instantaneo) {
      let indice = visiveis;
      while (indice < items.length && (!enabled || items[indice]?.fromSnapshot)) indice += 1;
      ultimaRevelacao.current = Date.now();
      setVisiveis(indice);
      return undefined;
    }

    const naFila = items.length - visiveis;
    const base = INTERVALO_POR_TIPO[proximo?.kind] ?? 460;
    // Fila cheia = ritmo mais rápido (mínimo de 140ms para ainda dar sensação de sequência).
    const intervalo = Math.max(140, Math.round(base / (1 + (naFila - 1) / 3)));

    // Desconta o tempo que já passou desde a última revelação.
    const decorrido = Date.now() - ultimaRevelacao.current;
    const espera = Math.max(0, intervalo - decorrido);

    const timer = setTimeout(() => {
      ultimaRevelacao.current = Date.now();
      setVisiveis((atual) => atual + 1);
    }, espera);

    return () => clearTimeout(timer);
  }, [items, visiveis, enabled]);

  const visibleItems = useMemo(() => items.slice(0, visiveis), [items, visiveis]);

  return {
    visibleItems,
    isRevealing: visiveis < items.length,
    pending: Math.max(0, items.length - visiveis),
  };
}
