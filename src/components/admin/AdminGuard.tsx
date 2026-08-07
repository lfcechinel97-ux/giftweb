import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { clearAdminAccess, hasFreshAdminAccess, rememberAdminAccess } from '@/lib/adminAccessCache';

type State =
  | { status: 'loading' }
  | { status: 'ok' }
  | { status: 'error'; message: string };

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  /* `navigate` muda de identidade a cada troca de rota. Se ele ficasse nas
     dependências do efeito, a verificação rodava de novo e o guard voltava
     para "Verificando acesso...", DESMONTANDO toda a árvore do /sistema
     (contexto, listas, caches) a cada clique no menu. */
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;


  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setState({ status: 'loading' });

      // 1) Read session from local storage first (no network)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        clearAdminAccess();
        if (!cancelled) navigateRef.current('/admin/login');
        return;
      }

      if (attempt === 0 && hasFreshAdminAccess(session.user.id)) {
        setState({ status: 'ok' });
        return;
      }

      // 2) Verify admin row with timeout + transient-error tolerance
      try {
        const queryPromise = supabase
          .from('admin_users')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        const timeout = new Promise<{ data: null; error: { message: string; transient: true } }>(
          (resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: null,
                  error: { message: 'Tempo esgotado verificando acesso.', transient: true },
                }),
              8000
            )
        );

        const { data, error } = (await Promise.race([queryPromise, timeout])) as any;

        if (cancelled) return;

        if (error) {
          // Transient/network error — do NOT sign out; let user retry
          setState({
            status: 'error',
            message: 'Não foi possível verificar seu acesso agora. Tente novamente.',
          });
          return;
        }

        if (!data) {
          clearAdminAccess();
          await supabase.auth.signOut();
          navigateRef.current('/admin/login');
          return;
        }

        rememberAdminAccess(session.user.id);
        setState({ status: 'ok' });
      } catch (e: any) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: 'Erro de rede ao verificar seu acesso. Tente novamente.',
        });
      }
    };

    check();

    // React to sign-in/out events
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearAdminAccess();
        navigateRef.current('/admin/login');
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [attempt]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Verificando acesso...
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex flex-col gap-4 items-center justify-center text-center px-4">
        <p className="text-muted-foreground">{state.message}</p>
        <Button onClick={() => setAttempt((a) => a + 1)}>Tentar novamente</Button>
      </div>
    );
  }

  return <>{children}</>;
}
