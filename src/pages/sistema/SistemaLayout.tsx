import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  FileText, ShoppingCart, Boxes, Package, Globe, User, Users, Settings, ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSistema } from "@/contexts/SistemaContext";

const menu = [
  { icon: FileText, label: "Orçamentos", path: "/sistema/orcamentos" },
  { icon: ShoppingCart, label: "Pedidos", path: "/sistema/pedidos" },
  { icon: Boxes, label: "Estoque", path: "/sistema/estoque" },
  { icon: Package, label: "Produtos", path: "/sistema/produtos" },
  { icon: Users, label: "Clientes", path: "/sistema/clientes" },
  { icon: Settings, label: "Configurações", path: "/sistema/configuracoes" },
];

export default function SistemaLayout() {
  const { vendedores, currentVendedor, setCurrentVendedor } = useSistema();
  const vendedorAtualId = currentVendedor?.id;
  const vendedorAtualNome = currentVendedor?.nome ?? "Selecionar vendedor";
  const setVendedorAtualId = (id: string) => {
    const v = vendedores.find(x => x.id === id) ?? null;
    setCurrentVendedor(v);
  };
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loc.pathname === "/sistema" || loc.pathname === "/sistema/") {
      navigate("/sistema/orcamentos", { replace: true });
    }
  }, [loc.pathname, navigate]);

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="w-[230px] min-h-screen bg-[hsl(228,40%,8%)] text-white fixed left-0 top-0 flex flex-col z-50">
        <div className="px-5 py-6 border-b border-white/10">
          <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: "inherit", letterSpacing: "-0.02em" }}>
            <span style={{ color: "hsl(142,71%,45%)" }}>Gift</span>
            <span style={{ color: "#fff" }}> Web</span>
          </h2>
          <p className="text-xs text-white/40 mt-0.5">Sistema do Vendedor</p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {menu.map(item => (
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/[0.08] transition-colors mt-4"
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span>Ver Site</span>
          </a>
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-white/40">
          Gift Web Brindes © {new Date().getFullYear()}
        </div>
      </aside>

      <div className="ml-[230px] flex-1 min-h-screen flex flex-col">
        <header className="h-14 bg-background border-b flex items-center justify-between px-6 sticky top-0 z-40">
          <h1 className="text-sm font-semibold text-foreground">Sistema Gift Web</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors">
                <User className="h-4 w-4" />
                <span className="font-medium">{vendedorAtualNome}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Trocar vendedor</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {vendedores.length === 0 ? (
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/sistema/configuracoes")}>
                <Settings className="h-3.5 w-3.5 mr-2" /> Gerenciar vendedores
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
