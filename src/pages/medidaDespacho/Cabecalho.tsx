import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AZUL_ESCURO } from "./ui";

const ABAS = [
  { para: "/medidadespacho", rotulo: "Calculadora" },
  { para: "/medidadespacho/calibrar", rotulo: "Calibração" },
];

export default function Cabecalho({ subtitulo }: { subtitulo: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <img src="/logos/giftweb-logo.png" alt="Gift Web Brindes" className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl" style={{ color: AZUL_ESCURO }}>Volumes de despacho</h1>
          <p className="hidden text-xs text-slate-500 sm:block">{subtitulo}</p>
        </div>
        {email && <span className="hidden text-sm text-slate-500 md:inline">{email}</span>}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 px-4">
        {ABAS.map((a) => (
          <Link
            key={a.para}
            to={a.para}
            className={`border-b-2 px-3 pb-2 text-sm font-semibold transition ${
              pathname === a.para ? "border-[#1464D2] text-[#1464D2]" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
    </header>
  );
}
