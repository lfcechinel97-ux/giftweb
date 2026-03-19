import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err || !data.user) { setError('Credenciais inválidas.'); setLoading(false); return; }
    const { data: admin } = await supabase
      .from('admin_users').select('id').eq('id', data.user.id).single();
    if (!admin) {
      await supabase.auth.signOut();
      setError('Acesso não autorizado.');
      setLoading(false);
      return;
    }
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
            ⚙
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Gift Web Brindes</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
