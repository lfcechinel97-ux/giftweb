import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  FileText, ShoppingCart, Boxes, Package, Globe, User, Users, Settings, ChevronDown, Kanban, LayoutDashboard, Wallet,
  Search as SearchIcon, Bell, BarChart3, LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSistema } from "@/contexts/SistemaContext";
import { useUserRole, ROTULO_PAPEL } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

const menu: { icon: typeof LayoutDashboard; label: string; path: string; chunk: () => Promise<unknown>; soAdmin?: boolean }[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/sistema/dashboard", chunk: () => import("./Dashboard.tsx") },
  { icon: Wallet, label: "Fluxo de vendas", path: "/sistema/vendas", chunk: () => import("./Vendas.tsx"), soAdmin: true },
  { icon: FileText, label: "Orçamentos", path: "/sistema/orcamentos", chunk: () => import("./Orcamentos.tsx") },
  { icon: ShoppingCart, label: "Pedidos", path: "/sistema/pedidos", chunk: () => import("./Pedidos.tsx") },
  { icon: Kanban, label: "PCP", path: "/sistema/pcp", chunk: () => import("./PCP.tsx") },
  { icon: Boxes, label: "Estoque", path: "/sistema/estoque", chunk: () => import("./Estoque.tsx") },
  { icon: Package, label: "Produtos", path: "/sistema/produtos", chunk: () => import("./ProdutosCatalogo.tsx") },
  { icon: Users, label: "Clientes", path: "/sistema/clientes", chunk: () => import("./Clientes.tsx") },
  { icon: Settings, label: "Configurações", path: "/sistema/configuracoes", chunk: () => import("./Configuracoes.tsx") },
];

/** "Guilherme Oliveira" -> "GO"; nome único -> duas primeiras letras. */
const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

/* Esqueleto de transição de rota — mantém o layout, sem tela branca */
const RouteSkeleton = () => (
  <div className="space-y-4">
    <div className="animate-pulse h-8 w-64 rounded bg-muted" />
    {[0, 1, 2].map(i => (
      <div key={i} className="animate-pulse h-24 rounded-xl bg-muted" />
    ))}
  </div>
);

export default function SistemaLayout() {
  const { vendedores, currentVendedor, setCurrentVendedor, loading } = useSistema();
  const { isAdmin, papel, nome: nomeUsuario, email, vendedorId, isLoading: perfilCarregando } = useUserRole();

  /* Usuário vinculado a um vendedor assina o histórico com ele. Só o admin
     pode trocar de vendedor à vontade; os demais ficam presos ao próprio. */
  useEffect(() => {
    if (!vendedorId || vendedores.length === 0) return;
    if (currentVendedor?.id === vendedorId) return;
    if (isAdmin && currentVendedor) return;
    const v = vendedores.find(x => x.id === vendedorId);
    if (v) setCurrentVendedor(v);
  }, [vendedorId, vendedores, currentVendedor, isAdmin, setCurrentVendedor]);
  const podeTrocarVendedor = isAdmin || !vendedorId;

  const sair = async () => {
    await supabase.auth.signOut();
    // Recarrega do zero para não sobrar cache (papéis, listas) do usuário anterior.
    window.location.href = "/admin/login";
  };
  const vendedorAtualId = currentVendedor?.id;
  const vendedorAtualNome = currentVendedor?.nome ?? "Selecionar vendedor";
  const setVendedorAtualId = (id: string) => {
    const v = vendedores.find(x => x.id === id) ?? null;
    setCurrentVendedor(v);
  };
  const navigate = useNavigate();
  const loc = useLocation();
  const [buscaGlobal, setBuscaGlobal] = useState("");
  

  /* Pré-carregamento no hover: SOMENTE o chunk de código da rota (leve).
     Buscar dados por movimento de mouse multiplicava requisições sem ganho. */
  const prefetch = useCallback((item: typeof menu[number]) => {
    item.chunk().catch(() => undefined);
  }, []);


  useEffect(() => {
    if (loc.pathname === "/sistema" || loc.pathname === "/sistema/") {
      navigate("/sistema/dashboard", { replace: true });
    }
  }, [loc.pathname, navigate]);

  return (
    <div className="sistema-theme flex min-h-screen bg-background">
      <aside
        className="w-[230px] min-h-screen text-white fixed left-0 top-0 flex flex-col z-50"
        style={{ background: "var(--gw-sidebar)" }}
      >
        <div className="px-5 py-6 border-b border-white/10">
          <h2 className="text-xl tracking-tight" style={{ fontFamily: "inherit", fontWeight: 600, letterSpacing: "-0.02em" }}>
            <span style={{ color: "#fff" }}>Gift</span>
            <span style={{ color: "var(--gw-blue-vivid)" }}>Web</span>
          </h2>
          <p className="text-xs text-white/40 mt-0.5">Sistema do Vendedor</p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {menu.filter(item => !item.soAdmin || isAdmin).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onMouseEnter={() => prefetch(item)}
              onFocus={() => prefetch(item)}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14px] font-medium text-white/70 hover:bg-[var(--gw-sidebar-hover)] hover:text-white transition-colors"
              activeClassName="!text-white !font-semibold gw-nav-ativo"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}


          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/[0.08] transition-colors mt-4"
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span>Ver Site</span>
          </a>
        </nav>

        {/* Card de rodapé da barra lateral */}
        <div className="px-3 pb-3">
          <div className="rounded-[12px] p-4 bg-white/[0.06] border border-white/10">
            <BarChart3 className="h-5 w-5 mb-2" style={{ color: "var(--gw-blue-vivid)" }} />
            <p className="text-[13px] font-semibold leading-snug text-white">
              Mais vendas<br />para a sua empresa
            </p>
            <p className="text-[11.5px] leading-snug text-white/45 mt-1.5">
              Ferramentas simples para grandes resultados.
            </p>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-white/10 text-[11px] text-white/40">
          Gift Web Brindes © {new Date().getFullYear()}
        </div>
      </aside>

      <div className="ml-[230px] flex-1 min-w-0 min-h-screen flex flex-col">
        <header
          className="h-[60px] flex items-center gap-4 px-6 sticky top-0 z-40"
          style={{ background: "var(--gw-surface)", borderBottom: "1px solid var(--gw-border)" }}
        >
          {/* Busca global — leva para a lista de pedidos já filtrada.
              Pedidos é a tela que o time mais usa; clientes e produtos entram
              aqui quando as respectivas telas aceitarem ?busca=. */}
          <form
            className="relative flex-1 max-w-[640px]"
            onSubmit={e => {
              e.preventDefault();
              const t = buscaGlobal.trim();
              navigate(t ? `/sistema/pedidos?busca=${encodeURIComponent(t)}` : "/sistema/pedidos");
            }}
          >
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--gw-text-muted)" }} />
            <input
              value={buscaGlobal}
              onChange={e => setBuscaGlobal(e.target.value)}
              placeholder="Buscar pedidos, clientes ou produtos..."
              className="h-10 w-full rounded-[10px] pl-10 pr-3 text-[14px] outline-none transition-colors focus:border-[var(--gw-primary)]"
              style={{ background: "var(--gw-surface-alt)", border: "1px solid var(--gw-border)", color: "var(--gw-text)" }}
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              aria-label="Notificações"
              onClick={() => navigate("/sistema/pcp")}
              title="Itens atrasados aparecem no PCP"
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors hover:bg-[var(--gw-surface-alt)]"
              style={{ color: "var(--gw-text-secondary)" }}
            >
              <Bell className="h-[18px] w-[18px]" />
            </button>

            <span className="h-6 w-px" style={{ background: "var(--gw-border)" }} />

            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-[var(--gw-surface-alt)]">
                <span
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[13px] font-bold text-white shrink-0"
                  style={{ background: "var(--gw-primary)" }}
                >
                  {iniciais(vendedorAtualNome)}
                </span>
                <span className="hidden sm:flex flex-col items-start leading-tight min-w-0">
                  <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--gw-text)" }}>
                    {vendedorAtualNome}
                  </span>
                  <span className="text-[11.5px]" style={{ color: "var(--gw-text-muted)" }}>
                    {perfilCarregando ? "…" : ROTULO_PAPEL[papel]}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--gw-text-muted)" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-[13px] font-semibold truncate">{nomeUsuario || email}</span>
                {nomeUsuario && email && <span className="block text-[11.5px] text-muted-foreground truncate">{email}</span>}
                <span className="block text-[11.5px] text-muted-foreground">Perfil: {ROTULO_PAPEL[papel]}</span>
              </DropdownMenuLabel>
              {podeTrocarVendedor && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Trocar vendedor</DropdownMenuLabel>
                  {loading && vendedores.length === 0 ? (
                    <DropdownMenuItem disabled>Carregando vendedores...</DropdownMenuItem>
                  ) : vendedores.length === 0 ? (
                    <DropdownMenuItem disabled>Nenhum cadastrado</DropdownMenuItem>
                  ) : vendedores.map(v => (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => setVendedorAtualId(v.id)}
                      className={v.id === vendedorAtualId ? "bg-muted" : ""}
                    >
                      {v.nome}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate("/sistema/configuracoes?aba=usuarios")}>
                  <Users className="h-3.5 w-3.5 mr-2" /> Usuários e acessos
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate("/sistema/configuracoes")}>
                <Settings className="h-3.5 w-3.5 mr-2" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void sair()}>
                <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-6 flex-1 min-w-0">
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
