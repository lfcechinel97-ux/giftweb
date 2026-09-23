import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, Kanban, ShoppingCart, BarChart3 } from 'lucide-react';
import { rememberAdminAccess } from '@/lib/adminAccessCache';

const AZUL_ESCURO = '#0E2A57';
const VERDE = '#19A84A';

const DESTAQUES = [
  { icone: ShoppingCart, texto: 'Orçamentos e pedidos em um só lugar' },
  { icone: Kanban, texto: 'Produção acompanhada etapa por etapa' },
  { icone: BarChart3, texto: 'Resultados do mês sempre à mão' },
];

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err || !data.user) { setError('E-mail ou senha incorretos.'); setLoading(false); return; }
      const { data: admin, error: adminErr } = await supabase
        .from('admin_users').select('id').eq('id', data.user.id).maybeSingle();
      if (adminErr) {
        setError('Erro ao verificar acesso. Tente novamente em instantes.');
        setLoading(false);
        return;
      }
      if (!admin) {
        await supabase.auth.signOut();
        setError('Este usuário não tem acesso ao sistema.');
        setLoading(false);
        return;
      }
      rememberAdminAccess(data.user.id);
      // O vendedor salvo no navegador é de quem entrou antes; cada login recomeça pelo próprio.
      try { localStorage.removeItem('sistema_vendedor_v1'); } catch { /* armazenamento bloqueado */ }
      navigate('/sistema');
    } catch (e) {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* Painel da marca */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white"
        style={{ background: `radial-gradient(120% 90% at 15% 10%, #1B4A8F 0%, ${AZUL_ESCURO} 55%, #081A38 100%)` }}
      >
        <div
          className="pointer-events-none absolute -right-32 -bottom-32 h-[420px] w-[420px] rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${VERDE} 0%, transparent 70%)` }}
        />
        <div
          className="pointer-events-none absolute -left-20 top-1/3 h-[260px] w-[260px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }}
        />

        <img src="/logos/giftweb-logo.png" alt="GiftWeb Brindes" className="relative h-24 w-24 drop-shadow-xl" />

        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight" style={{ color: '#FFFFFF' }}>
            Tudo da GiftWeb,<br />
            <span style={{ color: '#5BD37E' }}>do orçamento à entrega.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-[15px] text-white/85">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icone className="h-[18px] w-[18px]" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} GiftWeb Brindes</p>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center px-6 py-12" style={{ background: '#F5F7FA' }}>
        <div className="w-full max-w-[400px]">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <img src="/logos/giftweb-logo.png" alt="GiftWeb Brindes" className="mb-6 h-20 w-20 lg:hidden" />
            <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: AZUL_ESCURO }}>
              Bem-vindo de volta
            </h1>
            <p className="mt-1.5 text-[15px] text-slate-500">Entre com seu e-mail e senha para acessar o sistema.</p>
          </div>

          <form
            onSubmit={handleLogin}
            className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-12px_rgba(14,42,87,0.18)]"
          >
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">E-mail</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="voce@giftwebbrindes.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-[15px] text-slate-900 outline-none transition focus:border-[#1464D2] focus:bg-white focus:ring-4 focus:ring-[#1464D2]/10"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Senha</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-[15px] text-slate-900 outline-none transition focus:border-[#1464D2] focus:bg-white focus:ring-4 focus:ring-[#1464D2]/10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {mostrarSenha ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </span>
            </label>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(25,168,74,0.7)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-70"
              style={{ backgroundColor: VERDE }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-slate-400">
            Esqueceu a senha? Fale com o administrador do sistema.
          </p>
        </div>
      </main>
    </div>
  );
}
