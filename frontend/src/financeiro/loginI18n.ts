import { lerIdioma, type Idioma } from './idiomaFinanceiro'

/** Textos do login / toasts de validação — respeitam mf-idioma (persiste no logoff). */
export function textosLogin(idioma: Idioma = lerIdioma()) {
  const en = idioma === 'en'
  return {
    titulo: en ? 'Sign in' : 'Entrar',
    subtitulo: en ? 'Use your corporate e-mail' : 'Acesse com seu e-mail corporativo',
    email: en ? 'E-mail' : 'E-mail',
    senha: en ? 'Password' : 'Senha',
    mostrarSenha: en ? 'Show password' : 'Mostrar senha',
    ocultarSenha: en ? 'Hide password' : 'Ocultar senha',
    entrar: en ? 'Sign in to Meridian' : 'Entrar no Meridian',
    entrarCurto: en ? 'Sign in' : 'Acessar',
    entrando: en ? 'Signing in…' : 'Entrando…',
    acesso: en ? 'Access' : 'Acesso',
    credenciaisInvalidas: en ? 'Incorrect e-mail or password' : 'E-mail ou senha incorretos',
    preencha: (campo: 'email' | 'senha' | 'ambos') => {
      if (en) {
        if (campo === 'ambos') return 'Fill in e-mail and password.'
        if (campo === 'email') return 'Fill in the e-mail field.'
        return 'Fill in the password field.'
      }
      if (campo === 'ambos') return 'Preencha o campo e-mail e senha.'
      if (campo === 'email') return 'Preencha o campo e-mail.'
      return 'Preencha o campo senha.'
    },
  }
}
