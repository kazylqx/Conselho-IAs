/**
 * Erro com status HTTP, para as rotas responderem o codigo certo
 * sem precisar de if/else espalhado.
 */
export class HttpError extends Error {
  /**
   * @param {number} status codigo HTTP (400, 404, 429...)
   * @param {string} message mensagem exibida ao cliente
   * @param {string} [code]  codigo curto para o frontend tratar
   */
  constructor(status, message, code = 'error') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (mensagem, code = 'bad_request') => new HttpError(400, mensagem, code);
export const unauthorized = (mensagem, code = 'unauthorized') => new HttpError(401, mensagem, code);
export const notFound = (mensagem, code = 'not_found') => new HttpError(404, mensagem, code);
export const tooManyRequests = (mensagem, code = 'too_many_requests') =>
  new HttpError(429, mensagem, code);
