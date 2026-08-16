/**
 * ============================================================================
 *  FORMATACAO DE TEXTO
 * ============================================================================
 * As IAs respondem em texto com marcacoes leves (**negrito**, `codigo`, listas).
 * Em vez de puxar uma biblioteca de markdown inteira, renderizamos o essencial
 * aqui — e sem `dangerouslySetInnerHTML`, entao nao ha risco de HTML injetado.
 */

import { Fragment } from 'react';

/** Renderiza marcacoes inline: **negrito** e `codigo`. */
function renderInline(texto) {
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((parte) => parte !== '');

  return partes.map((parte, indice) => {
    if (/^\*\*[^*]+\*\*$/.test(parte)) {
      return <strong key={indice}>{parte.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(parte)) {
      return <code key={indice}>{parte.slice(1, -1)}</code>;
    }
    return <Fragment key={indice}>{parte}</Fragment>;
  });
}

/**
 * Texto de uma IA renderizado em paragrafos e listas.
 * @param {{ text: string, className?: string }} props
 */
export function RichText({ text, className = '' }) {
  if (!text) return null;

  const linhas = String(text).split(/\r?\n/);
  const blocos = [];
  let listaAtual = null;

  const fecharLista = () => {
    if (listaAtual) {
      blocos.push({ tipo: 'lista', itens: listaAtual });
      listaAtual = null;
    }
  };

  for (const linha of linhas) {
    const limpa = linha.trim();

    if (!limpa) {
      fecharLista();
      continue;
    }

    const marcador = /^[-*•]\s+(.*)$/.exec(limpa);
    if (marcador) {
      listaAtual = listaAtual ?? [];
      listaAtual.push(marcador[1]);
      continue;
    }

    fecharLista();
    blocos.push({ tipo: 'paragrafo', texto: limpa });
  }
  fecharLista();

  return (
    <div className={`rich-text ${className}`.trim()}>
      {blocos.map((bloco, indice) =>
        bloco.tipo === 'lista' ? (
          <ul key={indice}>
            {bloco.itens.map((item, i) => (
              <li key={i}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={indice}>{renderInline(bloco.texto)}</p>
        ),
      )}
    </div>
  );
}

/** Corta o texto sem cortar palavra no meio. */
export function resumir(texto, limite = 120) {
  if (!texto) return '';
  if (texto.length <= limite) return texto;
  const cortado = texto.slice(0, limite);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return `${cortado.slice(0, ultimoEspaco > 40 ? ultimoEspaco : limite)}…`;
}
