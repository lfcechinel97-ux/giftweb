import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Suspense, useCallback, useEffect } from "react";
import {
  FileText, ShoppingCart, Boxes, Package, Globe, User, Users, Settings, ChevronDown, Kanban, LayoutDashboard, Wallet,
  ShoppingBag, LogOut,
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
  { icon: ShoppingBag, label: "Compras", path: "/sistema/compras", chunk: () => import("./Compras.tsx") },
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
    if (perfilCarregando || vendedores.length === 0) return;
    if (!vendedorId) {
      // Sem vendedor vinculado, não herda o vendedor de quem usou o navegador antes.
      if (!isAdmin && currentVendedor) setCurrentVendedor(null);
      return;
    }
    if (currentVendedor?.id === vendedorId) return;
    if (isAdmin && currentVendedor) return;
    const v = vendedores.find(x => x.id === vendedorId);
    if (v) setCurrentVendedor(v);
  }, [perfilCarregando, vendedorId, vendedores, currentVendedor, isAdmin, setCurrentVendedor]);
  const podeTrocarVendedor = isAdmin || !vendedorId;

  // No topo sempre aparece quem está logado, não o vendedor selecionado.
  const nomeLogado = nomeUsuario
    || vendedores.find(v => v.id === vendedorId)?.nome
    || (email ? email.split("@")[0] : "");

  const sair = async () => {
    try { localStorage.removeItem("sistema_vendedor_v1"); } catch { /* armazenamento bloqueado */ }
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
      {/* Recolhida (só ícones) e abre POR CIMA do conteúdo ao passar o mouse —
          o conteúdo não se desloca, só ganha a largura que a barra ocupava. */}
      <aside
        className="group/menu w-[68px] hover:w-[230px] hover:shadow-[8px_0_24px_-8px_rgba(0,0,0,0.35)] h-screen text-white fixed left-0 top-0 flex flex-col z-50 overflow-hidden transition-[width,box-shadow] duration-200 ease-out"
        style={{ background: "var(--gw-sidebar)" }}
      >
        <div className="h-[76px] px-[14px] flex items-center gap-3 border-b border-white/10 shrink-0">
          <img src="/logos/giftweb-logo.png" alt="GiftWeb" className="h-10 w-10 shrink-0" />
          <div className="min-w-0 whitespace-nowrap opacity-0 group-hover/menu:opacity-100 transition-opacity duration-150">
            <h2 className="text-lg leading-tight tracking-tight" style={{ fontFamily: "inherit", fontWeight: 600, letterSpacing: "-0.02em" }}>
              <span style={{ color: "#fff" }}>Gift</span>
              <span style={{ color: "var(--gw-blue-vivid)" }}>Web</span>
            </h2>
            <p className="text-[11px] text-white/40">Sistema do Vendedor</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {menu.filter(item => !item.soAdmin || isAdmin).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              onMouseEnter={() => prefetch(item)}
              onFocus={() => prefetch(item)}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14px] font-medium text-white/70 hover:bg-[var(--gw-sidebar-hover)] hover:text-white transition-colors"
              activeClassName="!text-white !font-semibold gw-nav-ativo"
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="whitespace-nowrap opacity-0 group-hover/menu:opacity-100 transition-opacity duration-150">
                {item.label}
              </span>
            </NavLink>
          ))}

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Ver Site"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/[0.08] transition-colors mt-4"
          >
            <Globe className="h-[18px] w-[18px] shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover/menu:opacity-100 transition-opacity duration-150">Ver Site</span>
          </a>
        </nav>

        {/* Usuário logado — fica no rodapé do menu (a barra do topo saiu). */}
        <div className="px-3 py-3 border-t border-white/10 shrink-0">
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 rounded-[10px] px-[7px] py-1.5 text-left transition-colors hover:bg-[var(--gw-sidebar-hover)]" title={nomeLogado}>
              <span
                className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[13px] font-bold text-white shrink-0"
                style={{ background: "var(--gw-primary)" }}
              >
                {iniciais(nomeLogado || "?")}
              </span>
              <span className="flex flex-col items-start leading-tight min-w-0 flex-1 whitespace-nowrap opacity-0 group-hover/menu:opacity-100 transition-opacity duration-150">
                <span className="text-[13.5px] font-semibold truncate max-w-full text-white">
                  {perfilCarregando ? "…" : nomeLogado}
                </span>
                <span className="text-[11.5px] text-white/50">
                  {perfilCarregando ? "…" : ROTULO_PAPEL[papel]}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-white/50 opacity-0 group-hover/menu:opacity-100 transition-opacity duration-150" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-[13px] font-semibold truncate">{nomeUsuario || email}</span>
              {nomeUsuario && email && <span className="block text-[11.5px] text-muted-foreground truncate">{email}</span>}
              <span className="block text-[11.5px] text-muted-foreground">Perfil: {ROTULO_PAPEL[papel]}</span>
            </DropdownMenuLabel>
            {podeTrocarVendedor && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-[12px] font-semibold">Vendedor dos lançamentos</span>
                  <span className="block text-[11.5px] text-muted-foreground">Atual: {vendedorAtualNome}</span>
                </DropdownMenuLabel>
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
      </aside>

      <div className="ml-[68px] flex-1 min-w-0 min-h-screen flex flex-col">

        <main className="p-6 flex-1 min-w-0">
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
