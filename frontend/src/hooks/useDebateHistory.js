/**
 * ============================================================================
 *  useDebateHistory — historico do usuario logado
 * ============================================================================
 * Com Firebase configurado, a lista vem do Firestore em tempo real
 * (users/{uid}/debates) — debate novo aparece sem recarregar e cada pessoa ve
 * apenas o que e seu.
 *
 * Sem Firebase, cai para o histórico do backend (modo anônimo), para o projeto
 * continuar rodando localmente sem depender de nuvem.
 *
 * A exclusao eh otimista e adiada: o item sai da lista na hora, o aviso com
 * "Desfazer" aparece por alguns segundos e SO DEPOIS o apagamento acontece de
 * verdade (Firestore + backend). Assim o desfazer eh real, nao teatro.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { apagarResumo, assinarHistorico } from '../services/userHistory.js';
import { useAuth } from '../contexts/AuthProvider.jsx';

/** Tempo que o usuário tem para desfazer a exclusão. */
export const JANELA_DESFAZER_MS = 6000;

/** Evento interno: "o histórico mudou, recarreguem" (usado no modo anônimo). */
const EVENTO_MUDANCA = 'conselho:historico-mudou';

export function avisarMudancaNoHistorico() {
  window.dispatchEvent(new CustomEvent(EVENTO_MUDANCA));
}

/**
 * @param {number} [limit] quantos debates trazer
 */
export function useDebateHistory(limit = 20) {
  const { usuario, habilitado, carregando: carregandoLogin } = useAuth();
  const uid = usuario?.uid ?? null;

  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Item aguardando confirmação de exclusão (mostra o aviso de desfazer). */
  const [pendente, setPendente] = useState(null);

  /** id -> { timer, debate } */
  const pendentes = useRef(new Map());

  /** Remove da lista o que está em processo de exclusão. */
  const semPendentes = useCallback(
    (lista) => lista.filter((item) => !pendentes.current.has(item.id)),
    [],
  );

  // ---------------------------------------------------------------- Firestore
  useEffect(() => {
    if (!habilitado) return undefined;

    if (carregandoLogin) {
      setLoading(true);
      return undefined;
    }

    if (!uid) {
      // Sem login: nada para mostrar (a tela pede para entrar).
      setDebates([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const cancelar = assinarHistorico(
      uid,
      (lista) => {
        setDebates(semPendentes(lista.slice(0, limit)));
        setError(null);
        setLoading(false);
      },
      (erro) => {
        setError(
          erro.code === 'permission-denied'
            ? 'Sem permissão para ler o histórico. Publique as regras do Firestore (firestore.rules).'
            : `Não consegui carregar seu histórico: ${erro.message}`,
        );
        setLoading(false);
      },
      Math.max(limit, 20),
    );

    return cancelar;
  }, [habilitado, carregandoLogin, uid, limit, semPendentes]);

  // ------------------------------------------------- modo anônimo (sem Firebase)
  const recarregarDoBackend = useCallback(async () => {
    try {
      const dados = await api.history(limit);
      setDebates(semPendentes(dados.debates ?? []));
      setError(null);
    } catch (erro) {
      setError(erro.message);
    } finally {
      setLoading(false);
    }
  }, [limit, semPendentes]);

  useEffect(() => {
    if (habilitado) return undefined;
    recarregarDoBackend();

    const aoMudar = () => recarregarDoBackend();
    window.addEventListener(EVENTO_MUDANCA, aoMudar);
    return () => window.removeEventListener(EVENTO_MUDANCA, aoMudar);
  }, [habilitado, recarregarDoBackend]);

  /** Recarrega manualmente (no Firestore o tempo real já cuida disso). */
  const refresh = useCallback(() => {
    if (habilitado) return;
    recarregarDoBackend();
  }, [habilitado, recarregarDoBackend]);

  /** Apaga de verdade: fim da janela de desfazer. */
  const confirmarExclusao = useCallback(
    async (id) => {
      const registro = pendentes.current.get(id);
      pendentes.current.delete(id);
      setPendente((atual) => (atual?.id === id ? null : atual));
      if (!registro) return;

      try {
        if (uid) await apagarResumo(uid, id);
        // O backend guarda a transcrição: apagar lá também.
        await api.deleteDebate(id).catch(() => {});
        if (!habilitado) avisarMudancaNoHistorico();
      } catch (erro) {
        setError(`Não foi possível excluir: ${erro.message}`);
        refresh();
      }
    },
    [uid, habilitado, refresh],
  );

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
        // Volta para a lista sem esperar o Firestore reemitir.
        if (registro.debate?.question) {
          setDebates((atual) =>
            [...atual, registro.debate].sort(
              (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0),
            ),
          );
        }
      }

      setPendente((atual) => (atual?.id === alvo ? null : atual));
      refresh();
    },
    [pendente, refresh],
  );

  // Se a tela sair com exclusão pendente, cumpre a promessa em vez de deixar
  // o item em limbo.
  useEffect(
    () => () => {
      for (const [id, registro] of pendentes.current.entries()) {
        clearTimeout(registro.timer);
        if (uid) apagarResumo(uid, id).catch(() => {});
        api.deleteDebate(id).catch(() => {});
      }
      pendentes.current.clear();
    },
    [uid],
  );

  return { debates, loading, error, refresh, remover, desfazer, pendente };
}
