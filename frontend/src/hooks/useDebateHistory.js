/** Busca o histórico de debates (resumos) e permite recarregar. */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

/**
 * @param {number} [limit] quantos debates trazer
 */
export function useDebateHistory(limit = 20) {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const dados = await api.history(limit);
      setDebates(dados.debates ?? []);
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

  /** Remove um debate (otimista: tira da lista antes da confirmação). */
  const remover = useCallback(async (id) => {
    setDebates((atual) => atual.filter((debate) => debate.id !== id));
    try {
      await api.deleteDebate(id);
    } catch (erro) {
      setError(erro.message);
      refresh();
    }
  }, [refresh]);

  return { debates, loading, error, refresh, remover };
}
