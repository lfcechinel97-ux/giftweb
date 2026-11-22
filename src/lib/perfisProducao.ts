/* Troca rápida de perfil da produção ("estilo Netflix").
 *
 * Num computador da produção, cada operador entra UMA vez com o próprio
 * login; a sessão dele fica guardada aqui. Depois, trocar de pessoa é só
 * clicar no perfil: a sessão é trocada na hora (supabase.auth.setSession),
 * sem recarregar a página -- e o histórico do PCP passa a sair no nome de
 * quem está mexendo.
 *
 * Só perfis com papel "produção" são guardados (admin/comercial nunca ficam
 * disponíveis pra troca sem senha).
 */
import type { Session } from "@supabase/supabase-js";

export interface PerfilSalvo {
  userId: string;
  email: string;
  nome: string;
  accessToken: string;
  refreshToken: string;
  salvoEm: string;
}

const CHAVE = "gw_perfis_producao_v1";

export function lerPerfisSalvos(): PerfilSalvo[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter(p => p?.userId && p?.refreshToken) : [];
  } catch {
    return [];
  }
}

function gravar(lista: PerfilSalvo[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
    window.dispatchEvent(new Event("gw-perfis-producao"));
  } catch { /* armazenamento bloqueado */ }
}

/** Guarda/atualiza a sessão do operador (chamado ao entrar e a cada token novo). */
export function salvarPerfil(session: Session, nome: string) {
  const lista = lerPerfisSalvos().filter(p => p.userId !== session.user.id);
  lista.push({
    userId: session.user.id,
    email: session.user.email ?? "",
    nome: nome || (session.user.email ?? "").split("@")[0],
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    salvoEm: new Date().toISOString(),
  });
  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  gravar(lista);
}

/** Só atualiza os tokens de quem já está na lista (renovação automática). */
export function atualizarTokens(session: Session) {
  const lista = lerPerfisSalvos();
  const p = lista.find(x => x.userId === session.user.id);
  if (!p) return;
  if (p.refreshToken === session.refresh_token && p.accessToken === session.access_token) return;
  p.accessToken = session.access_token;
  p.refreshToken = session.refresh_token;
  gravar(lista);
}

export function removerPerfil(userId: string) {
  gravar(lerPerfisSalvos().filter(p => p.userId !== userId));
}
