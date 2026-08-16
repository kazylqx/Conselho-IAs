/**
 * Estado do backend: online/offline, modo simulado e se a busca web está ligada.
 * Serve para avisar o usuário quando algo não está configurado.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, backendUrl } from '../services/api.js';

export function useBackendStatus() {
  const [status, setStatus] = useState({ loading: true, online: false, mockMode: false });

  const verificar = useCallback(async () => {
    try {
      const dados = await api.health();
      setStatus({
        loading: false,
        online: true,
        mockMode: Boolean(dados.mockMode),
        webSearch: Boolean(dados.webSearchImplemented),
        url: backendUrl,
      });
    } catch (erro) {
      setStatus({ loading: false, online: false, mockMode: false, error: erro.message, url: backendUrl });
    }
  }, []);

  useEffect(() => {
    verificar();
  }, [verificar]);

  return { ...status, verificar };
}
