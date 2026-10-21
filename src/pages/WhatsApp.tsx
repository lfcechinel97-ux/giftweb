import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import AnaliseConversas from "./whatsapp/AnaliseConversas";

/* /whatsapp: área das conversas do comercial (Datacrazy). Por enquanto só
   admin -- o AdminGuard deixa entrar qualquer usuário interno, então o
   papel é conferido aqui (e de novo no RLS e na edge function). */
export default function WhatsApp() {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useUserRole();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sistema")} title="Voltar ao sistema">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          <h1 className="font-semibold">WhatsApp comercial</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : isAdmin ? (
          <AnaliseConversas />
        ) : (
          <p className="text-center text-muted-foreground py-12">Acesso restrito a administradores.</p>
        )}
      </main>
    </div>
  );
}
