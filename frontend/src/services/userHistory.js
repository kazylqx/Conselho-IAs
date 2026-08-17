/**
 * ============================================================================
 *  HISTORICO POR USUARIO (Firestore)
 * ============================================================================
 * Cada pessoa tem sua subcolecao:  users/{uid}/debates/{debateId}
 *
 * Aqui fica apenas o RESUMO do debate (pergunta, status, confianca e o comeco da
 * resposta final). A transcricao completa continua no backend e e buscada por id
 * quando o debate e aberto. Duas razoes:
 *
 *  1. custo: sao 2 escritas por debate em vez de uma por evento (o plano
 *     gratuito do Firestore da 20 mil escritas/dia);
 *  2. simplicidade: o backend continua a fonte da verdade da transcricao.
 *
 * As regras em firestore.rules garantem que ninguem le nem escreve fora do
 * proprio uid — e limitam os campos aceitos.
 *
 * O SDK do Firestore entra por import dinamico (carregarFirestore) para nao
 * pesar no carregamento inicial do site.
 */

import { carregarFirestore, firebaseConfigurado } from './firebase.js';

/** Campos permitidos pelas regras do Firestore (mantenha em sincronia). */
function montarResumo(debate) {
  const resumo = {
    id: debate.id,
    question: String(debate.question ?? '').slice(0, 2000),
    status: debate.status ?? 'running',
    createdAt: debate.createdAt ?? Date.now(),
  };

  if (debate.completedAt !== undefined) resumo.completedAt = debate.completedAt;
  if (debate.confidence !== undefined) resumo.confidence = debate.confidence;
  if (debate.preview !== undefined) {
    resumo.preview = debate.preview == null ? null : String(debate.preview).slice(0, 500);
  }
  if (debate.mock !== undefined) resumo.mock = Boolean(debate.mock);
  if (debate.agentCount !== undefined) resumo.agentCount = debate.agentCount;

  return resumo;
}

/** Normaliza um documento do Firestore para o formato que a UI espera. */
function paraDebate(documento) {
  const dados = documento.data();
  return {
    ...dados,
    id: dados.id ?? documento.id,
    // A UI usa datas legíveis por `new Date(...)`: número ou ISO servem.
    createdAt: dados.createdAt ?? null,
  };
}

/**
 * Cria/atualiza o resumo de um debate (merge: chamadas repetidas são seguras).
 * @param {string} uid
 * @param {object} debate
 */
export async function salvarResumo(uid, debate) {
  if (!firebaseConfigurado || !uid || !debate?.id) return;

  const fs = await carregarFirestore();
  if (!fs) return;

  const referencia = fs.doc(fs.db, 'users', uid, 'debates', debate.id);
  await fs.setDoc(referencia, montarResumo(debate), { merge: true });
}

/**
 * Escuta o histórico em tempo real (debate novo aparece sem recarregar).
 *
 * Retorna a função de cancelamento na hora, mesmo com o SDK ainda carregando:
 * se o componente desmontar antes do import terminar, a escuta nem começa.
 *
 * @param {string} uid
 * @param {(debates: Array) => void} aoAtualizar
 * @param {(erro: Error) => void} [aoFalhar]
 * @param {number} [maximo]
 * @returns {() => void} cancela a escuta
 */
export function assinarHistorico(uid, aoAtualizar, aoFalhar, maximo = 100) {
  if (!firebaseConfigurado || !uid) {
    aoAtualizar([]);
    return () => {};
  }

  let cancelarEscuta = () => {};
  let cancelado = false;

  (async () => {
    try {
      const fs = await carregarFirestore();
      if (!fs || cancelado) return;

      const consulta = fs.query(
        fs.collection(fs.db, 'users', uid, 'debates'),
        fs.orderBy('createdAt', 'desc'),
        fs.limit(maximo),
      );

      const parar = fs.onSnapshot(
        consulta,
        (snapshot) => aoAtualizar(snapshot.docs.map(paraDebate)),
        (erro) => {
          console.warn('[firestore] falha ao ouvir o histórico:', erro.message);
          aoFalhar?.(erro);
        },
      );

      // Corrida possível: o desmonte pode acontecer durante o await acima.
      if (cancelado) parar();
      else cancelarEscuta = parar;
    } catch (erro) {
      console.warn('[firestore] não consegui abrir o histórico:', erro.message);
      aoFalhar?.(erro);
    }
  })();

  return () => {
    cancelado = true;
    cancelarEscuta();
  };
}

/**
 * Remove o resumo do histórico do usuário.
 * @param {string} uid
 * @param {string} debateId
 */
export async function apagarResumo(uid, debateId) {
  if (!firebaseConfigurado || !uid || !debateId) return;

  const fs = await carregarFirestore();
  if (!fs) return;

  await fs.deleteDoc(fs.doc(fs.db, 'users', uid, 'debates', debateId));
}
