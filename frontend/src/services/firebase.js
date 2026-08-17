/**
 * ============================================================================
 *  FIREBASE — inicializacao unica (Auth + Firestore)
 * ============================================================================
 * A configuracao vem de variaveis VITE_FIREBASE_*. Elas NAO sao segredo: a chave
 * web identifica o projeto e e feita para ficar no navegador. Quem protege os
 * dados sao as regras do Firestore (ver firestore.rules na raiz do repo).
 *
 * Se as variaveis nao estiverem preenchidas, o app continua funcionando em modo
 * anonimo: sem login, sem historico por usuario. Nada de tela branca.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** true quando o projeto do Firebase esta configurado no .env. */
export const firebaseConfigurado = Boolean(config.apiKey && config.projectId && config.appId);

let app = null;
let auth = null;

if (firebaseConfigurado) {
  app = initializeApp(config);
  auth = getAuth(app);
  // Interface do Firebase (e-mails de recuperação, tela do Google) em português.
  auth.languageCode = 'pt-BR';
} else {
  console.warn(
    '[firebase] variáveis VITE_FIREBASE_* ausentes: o app segue sem login e sem ' +
      'histórico por usuário.',
  );
}

export { app, auth };

/**
 * Firestore carregado sob demanda. O SDK do Firestore é a parte mais pesada do
 * Firebase; deixá-lo fora do carregamento inicial mantém a landing leve para
 * quem abre o site no celular. Só quem vai ver histórico paga esse download.
 */
let firestorePromise = null;

export async function carregarFirestore() {
  if (!firebaseConfigurado) return null;

  if (!firestorePromise) {
    firestorePromise = import('firebase/firestore').then((modulo) => ({
      ...modulo,
      db: modulo.getFirestore(app),
    }));
  }

  return firestorePromise;
}

/** Provedor do Google, com seleção de conta a cada login. */
export function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * ID token do usuário logado, para o backend validar.
 * @param {boolean} [forcarRenovacao]
 * @returns {Promise<string|null>}
 */
export async function obterIdToken(forcarRenovacao = false) {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forcarRenovacao);
  } catch (erro) {
    console.warn('[firebase] não consegui obter o token:', erro.message);
    return null;
  }
}
