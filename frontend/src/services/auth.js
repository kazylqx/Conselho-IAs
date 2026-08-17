/**
 * ============================================================================
 *  AUTENTICACAO — Google e e-mail/senha
 * ============================================================================
 * Envolve o SDK do Firebase e traduz os codigos de erro para mensagens que a
 * pessoa entenda (o padrao vem em ingles e com codigo tecnico).
 */

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, firebaseConfigurado, googleProvider } from './firebase.js';

/** Traduz os códigos do Firebase para português. */
const MENSAGENS = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/missing-password': 'Digite sua senha.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'Não encontrei conta com esse e-mail.',
  'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
  'auth/cancelled-popup-request': 'Outra janela de login já estava aberta.',
  'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere o pop-up e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com o Firebase. Verifique sua internet.',
  'auth/operation-not-allowed':
    'Esse método de login não está habilitado no Firebase Console (Authentication → Sign-in method).',
  'auth/unauthorized-domain':
    'Este domínio não está autorizado no Firebase Console (Authentication → Settings → Authorized domains).',
};

/** Erro de autenticação já com mensagem amigável. */
export class AuthError extends Error {
  constructor(codigo, mensagemOriginal) {
    super(MENSAGENS[codigo] ?? `Não consegui concluir (${codigo || mensagemOriginal}).`);
    this.name = 'AuthError';
    this.code = codigo;
  }
}

function garantirConfigurado() {
  if (!firebaseConfigurado) {
    throw new AuthError(
      'auth/not-configured',
      'Firebase não configurado: preencha as variáveis VITE_FIREBASE_* no .env do frontend.',
    );
  }
}

function tratar(erro) {
  throw new AuthError(erro?.code ?? '', erro?.message ?? String(erro));
}

/** Login com a conta Google (janela pop-up). */
export async function entrarComGoogle() {
  garantirConfigurado();
  try {
    const { user } = await signInWithPopup(auth, googleProvider());
    return user;
  } catch (erro) {
    return tratar(erro);
  }
}

/** Login com e-mail e senha. */
export async function entrarComEmail(email, senha) {
  garantirConfigurado();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), senha);
    return user;
  } catch (erro) {
    return tratar(erro);
  }
}

/**
 * Cria conta com e-mail e senha (e já grava o nome de exibição).
 * @param {string} nome
 */
export async function criarConta(nome, email, senha) {
  garantirConfigurado();
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    const apelido = nome?.trim();
    if (apelido) await updateProfile(user, { displayName: apelido });
    return user;
  } catch (erro) {
    return tratar(erro);
  }
}

/** Envia e-mail de redefinição de senha. */
export async function recuperarSenha(email) {
  garantirConfigurado();
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (erro) {
    tratar(erro);
  }
}

/** Encerra a sessão. */
export async function sair() {
  if (!firebaseConfigurado) return;
  await signOut(auth);
}

/** Observa o estado do login. Devolve a função de cancelamento. */
export function observarLogin(callback) {
  if (!firebaseConfigurado) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
