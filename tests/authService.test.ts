import { describe, it, expect } from 'vitest';
import { 
  signUpWithEmail, 
  signInWithEmail, 
  sendPasswordResetEmail, 
  updatePassword,
  signInWithGmailOtp,
  verifyEmailOtp 
} from '../services/authService';

describe('authService - Validação de Autenticação Segura (Etapa 2)', () => {
  it('rejeita e-mails inválidos ou senhas curtas sem transmitir para a rede', async () => {
    // E-mail inválido
    const res1 = await signUpWithEmail('emailinvalido', 'senha1234', 'Teste');
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('e-mail válido');

    // Senha com menos de 6 caracteres
    const res2 = await signUpWithEmail('valido@email.com', '123', 'Teste');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('6 caracteres');
  });

  it('rejeita credenciais vazias no login', async () => {
    const res = await signInWithEmail('', '');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('valida formato de e-mail ao solicitar redefinição de senha', async () => {
    const res = await sendPasswordResetEmail('nao_e_email');
    expect(res.success).toBe(false);
    expect(res.error).toContain('e-mail válido');
  });

  it('valida tamanho mínimo de nova senha', async () => {
    const res = await updatePassword('123');
    expect(res.success).toBe(false);
    expect(res.error).toContain('6 caracteres');
  });

  it('valida e-mail ao solicitar código de confirmação Gmail OTP', async () => {
    const res = await signInWithGmailOtp('emailinvalido');
    expect(res.success).toBe(false);
    expect(res.error).toContain('e-mail válida');
  });

  it('rejeita código de confirmação vazio na verificação de OTP', async () => {
    const res = await verifyEmailOtp('teste@gmail.com', '');
    expect(res.success).toBe(false);
    expect(res.error).toContain('código de confirmação');
  });
});
