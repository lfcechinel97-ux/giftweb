import { Outlet, useNavigate } from 'react-router-dom';
import { Package, Star, Globe, Plus, LogOut, Layers, Image, CircleDot, BookOpen } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const menuItems = [
  { icon: Package, label: 'Produtos', path: '/admin/produtos' },
  { icon: Layers, label: 'Categorias', path: '/admin/categorias' },
  { icon: CircleDot, label: 'Cat. Imagens', path: '/admin/categorias-imagens' },
  { icon: Image, label: '🖼 Banners', path: '/admin/banners' },
  { icon: Star, label: '⭐ Vitrine', path: '/admin/vitrine' },
  { icon: BookOpen, label: '📖 Catálogos', path: '/admin/catalogos' },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[220px] min-h-screen bg-[hsl(228,40%,8%)] text-white fixed left-0 top-0 flex flex-col z-50">
        <div className="px-5 py-6 border-b border-white/10">
          <h2 className="text-lg font-bold tracking-tight">Gift Web</h2>
          <p className="text-xs text-white/50">Painel Admin</p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/[0.08] transition-colors"
              activeClassName="!bg-green-500 !text-white font-medium"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/[0.08] transition-colors"
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span>Ver Site</span>
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <div className="ml-[220px] flex-1 min-h-screen bg-muted/40">
        {/* Header */}
        <header className="h-14 bg-background border-b flex items-center justify-between px-6 sticky top-0 z-40">
          <h1 className="text-sm font-semibold text-foreground">Gift Web Admin</h1>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => navigate('/admin/produtos/novo')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Produto
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
