const messages = {
  authentication_required: "Entre para continuar.",
  check_email: "Verifique seu e-mail para confirmar sua conta antes de entrar.",
  invalid_credentials: "E-mail ou senha incorretos.",
  invalid_email: "Informe um e-mail válido.",
  invalid_name: "Informe um nome com pelo menos dois caracteres.",
  invalid_password: "Use pelo menos oito caracteres para sua senha.",
  password_mismatch: "As senhas não coincidem.",
  rate_limited: "Muitas tentativas. Aguarde um instante e tente novamente.",
  signup_failed: "Não foi possível criar sua conta. Tente novamente.",
  callback_failed: "O link de confirmação é inválido ou expirou.",
} as const;

export type AuthMessageCode = keyof typeof messages;

export function getAuthMessage(code?: string) {
  if (!code || !(code in messages)) {
    return null;
  }

  return messages[code as AuthMessageCode];
}
