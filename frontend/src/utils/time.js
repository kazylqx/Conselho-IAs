/** Helpers de data/hora em portugues, sem dependencia externa. */

/** "agora", "há 5 min", "há 3 h", "ontem", "12 de mar." */
export function tempoRelativo(iso) {
  if (!iso) return '';
  const data = new Date(iso);
  const segundos = Math.round((Date.now() - data.getTime()) / 1000);

  if (segundos < 45) return 'agora';
  if (segundos < 3600) return `há ${Math.round(segundos / 60)} min`;
  if (segundos < 86400) return `há ${Math.round(segundos / 3600)} h`;
  if (segundos < 172800) return 'ontem';
  if (segundos < 2592000) return `há ${Math.round(segundos / 86400)} dias`;

  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** Hora no formato 14:32. */
export function horaCurta(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Data e hora completas. */
export function dataHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Duracao em ms -> "2,4 s". */
export function duracao(ms) {
  if (!ms && ms !== 0) return '';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}
