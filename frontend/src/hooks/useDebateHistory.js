/**
 * ============================================================================
 *  useDebateHistory — lista de conversas + exclusao com "desfazer"
 * ============================================================================
 * A exclusao eh otimista e adiada: o item sai da lista na hora, um aviso com
 * "Desfazer" aparece por alguns segundos e SO DEPOIS o DELETE vai para o backend.
 * Assim o desfazer eh real (nada foi apagado ainda) em vez de teatro.
 *
 * Sidebar e pagina de historico sao instancias diferentes deste hook, entao
 * avisamos uma a outra por um evento de janela — mais simples que montar um
 * store global para duas telas.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

/** Tempo que o usuário tem para desfazer a exclusão. */
export const JANELA_DESFAZER_MS = 6000;

/** Evento interno: "o histórico mudou, recarreguem". */
const EVENTO_MUDANCA = 'conselho:historico-mudou';

export function avisarMudancaNoHistorico() {
  window.dispatchEvent(new CustomEvent(EVENTO_MUDANCA));
}

/**
 * @param {number} [limit] quantos debates trazer
 */
export function useDebateHistory(limit = 20) {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Item aguardando confirmação de exclusão (mostra o aviso de desfazer). */
  const [pendente, setPendente] = useState(null);

  /** id -> { timer, debate } */
  const pendentes = useRef(new Map());

  const refresh = useCallback(async () => {
    try {
      const dados = await api.history(limit);
      const emExclusao = pendentes.current;
      // Não traz de volta o que o usuário acabou de excluir.
      setDebates((dados.debates ?? []).filter((debate) => !emExclusao.has(debate.id)));
      setError(null);
    } catch (erro) {
      setError(erro.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Recarrega quando outra tela mexe no histórico.
  useEffect(() => {
    const aoMudar = () => refresh();
    window.addEventListener(EVENTO_MUDANCA, aoMudar);
    return () => window.removeEventListener(EVENTO_MUDANCA, aoMudar);
  }, [refresh]);

  /** Confirma a exclusão no backend (fim da janela de desfazer). */
  const confirmarExclusao = useCallback(async (id) => {
    const registro = pendentes.current.get(id);
    pendentes.current.delete(id);
    setPendente((atual) => (atual?.id === id ? null : atual));

    if (!registro) return;

    try {
      await api.deleteDebate(id);
      avisarMudancaNoHistorico();
    } catch (erro) {
      setError(`Não foi possível excluir: ${erro.message}`);
      refresh();
    }
  }, [refresh]);

  /** Remove da lista e abre a janela de desfazer. */
  const remover = useCallback(
    (debate) => {
      const id = typeof debate === 'string' ? debate : debate.id;
      const registro = typeof debate === 'string' ? { id } : debate;

      setDebates((atual) => atual.filter((item) => item.id !== id));

      const timer = setTimeout(() => confirmarExclusao(id), JANELA_DESFAZER_MS);
      pendentes.current.set(id, { timer, debate: registro });
      setPendente({ id, debate: registro });
    },
    [confirmarExclusao],
  );

  /** Cancela a exclusão e devolve o item para a lista. */
  const desfazer = useCallback(
    (id) => {
      const alvo = id ?? pendente?.id;
      if (!alvo) return;

      const registro = pendentes.current.get(alvo);
      if (registro) {
        clearTimeout(registro.timer);
        pendentes.current.delete(alvo);
      }

      setPendente((atual) => (atual?.id === alvo ? null : atual));
      refresh();
    },
    [pendente, refresh],
  );

  // Se o componente sair da tela com exclusão pendente, cumpre a promessa:
  // apaga de verdade em vez de deixar o item em limbo.
  useEffect(
    () => () => {
      for (const [id, registro] of pendentes.current.entries()) {
        clearTimeout(registro.timer);
        api.deleteDebate(id).catch(() => {});
      }
      pendentes.current.clear();
    },
    [],
  );

  return { debates, loading, error, refresh, remover, desfazer, pendente };
}
