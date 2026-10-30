import React, { useState } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface LoginViewProps {
  onLoginSuccess: (user: { uid: string; email: string }) => void;
  showAppLoader: (title: string, text: string) => void;
  hideAppLoader: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  showAppLoader,
  hideAppLoader
}) => {
  const [signupMode, setSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupCompany, setSignupCompany] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    showAppLoader(
      signupMode ? 'Criando conta' : 'Entrando no sistema',
      signupMode ? 'Registrando seu acesso...' : 'Validando suas credenciais...'
    );

    try {
      if (signupMode) {
        const nome = signupName.trim();
        const empresa = signupCompany.trim();
        if (!nome || !empresa) {
          throw { code: 'validation', message: 'Por favor, preencha seu nome e empresa.' };
        }

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const status = cleanEmail.toLowerCase() === 'juniorfran777@gmail.com' ? 'adm' : 'bloqueado';

        try {
          await setDoc(
            doc(db, 'users', cred.user.uid),
            {
              uid: cred.user.uid,
              email: cleanEmail,
              nome,
              empresa,
              status,
              grupo: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn('Firestore user doc write notice:', dbErr);
        }

        alert(
          status === 'adm'
            ? 'Cadastro concluído!'
            : 'Cadastro concluído com sucesso! Sua conta está "Aguardando Liberação" de um administrador.'
        );

        onLoginSuccess({
          uid: cred.user.uid,
          email: cleanEmail
        });
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        onLoginSuccess({
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail
        });
      }
    } catch (e: any) {
      let m = e.message || 'Falha na autenticação.';
      if (e.code === 'validation') m = e.message;
      else if (e.code === 'auth/email-already-in-use') m = 'Este e-mail já está em uso.';
      else if (e.code === 'auth/invalid-email') m = 'E-mail inválido.';
      else if (
        ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential'].includes(e.code)
      ) {
        m = 'E-mail ou senha incorretos.';
      }
      setErrorMessage(m);
    } finally {
      setLoading(false);
      hideAppLoader();
    }
  };

  const handleDemoAccess = () => {
    // Allows immediate testing of the system without requiring Firebase credentials
    onLoginSuccess({
      uid: 'demo_user_superfacil',
      email: 'juniorfran777@gmail.com'
    });
  };

  return (
    <div id="loginView" className="login-shell">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">PS</div>
          <div>
            <h1 id="authTitle">{signupMode ? 'Criar Conta' : 'Acesso ao Sistema'}</h1>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Busca de Produtos e Clientes
            </div>
          </div>
        </div>

        <p id="authSubtitle">
          {signupMode
            ? 'Cadastre-se para acessar o sistema de produtos e clientes.'
            : 'Entre com a mesma conta do sistema original. Os dados só são carregados depois da autenticação e validação do perfil.'}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!signupMode ? 'active' : ''}`}
            id="tabLogin"
            onClick={() => {
              setSignupMode(false);
              setErrorMessage(null);
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`auth-tab ${signupMode ? 'active' : ''}`}
            id="tabSignup"
            onClick={() => {
              setSignupMode(true);
              setErrorMessage(null);
            }}
          >
            Cadastrar
          </button>
        </div>

        {errorMessage && (
          <div id="loginError">
            <div className="error">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {signupMode && (
            <div id="signupExtra" className="signup-extra">
              <input
                id="signupName"
                type="text"
                placeholder="Seu nome"
                autoComplete="name"
                value={signupName}
                onChange={e => setSignupName(e.target.value)}
              />
              <input
                id="signupCompany"
                type="text"
                placeholder="Empresa"
                value={signupCompany}
                onChange={e => setSignupCompany(e.target.value)}
              />
            </div>
          )}

          <input
            id="email"
            type="email"
            placeholder="E-mail"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <input
            id="password"
            type="password"
            placeholder="Senha (mínimo 6 caracteres)"
            autoComplete={signupMode ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button
            id="loginBtn"
            className="primary"
            style={{ width: '100%', marginTop: '8px' }}
            type="submit"
            disabled={loading}
          >
            {loading
              ? signupMode
                ? 'Criando...'
                : 'Entrando...'
              : signupMode
              ? 'Criar Conta'
              : 'Entrar no Sistema'}
          </button>
        </form>

        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleDemoAccess}
            style={{
              background: 'transparent',
              border: '1px dashed #93c5fd',
              color: '#2563eb',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            ⚡ Acesso Rápido de Teste (juniorfran777@gmail.com)
          </button>
        </div>

        <div className="hint">
          Novos cadastros seguem o padrão do sistema original: usuários comuns ficam{' '}
          <b>Aguardando Liberação</b> até a aprovação do administrador.
        </div>
      </div>
    </div>
  );
};
