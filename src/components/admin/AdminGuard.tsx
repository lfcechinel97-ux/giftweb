import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/admin/login'); return; }
      const { data } = await supabase.from('admin_users')
        .select('id').eq('id', user.id).single();
      if (!data) { await supabase.auth.signOut(); navigate('/admin/login'); return; }
      setOk(true);
    })();
  }, [navigate]);

  if (!ok) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Verificando acesso...
    </div>
  );
  return <>{children}</>;
}
