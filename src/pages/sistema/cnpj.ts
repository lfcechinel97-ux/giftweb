// Lookup de CNPJ via APIs públicas gratuitas com suporte a CORS no navegador
// (CNPJ.ws -> Open CNPJ.a -> BrasilAPI -> MinhaReceita)

export interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual?: string;
  email?: string;
  ddd_telefone_1?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}

export function onlyDigits(v: string): string {
  return (v || "").replace(/\D+/g, "");
}

export function isValidCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calcDigit = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(base[i]) * w, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calcDigit(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

export function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calcDigit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  return calcDigit(9) === Number(d[9]) && calcDigit(10) === Number(d[10]);
}

export function cnpjMask(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function cpfMask(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

// Aliases for backward compatibility
export const maskCNPJ = cnpjMask;
export const maskCPF = cpfMask;

export interface CepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export async function fetchCEP(cep: string): Promise<CepData | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.erro) return null;
    return {
      logradouro: j.logradouro || "",
      bairro: j.bairro || "",
      localidade: j.localidade || "",
      uf: j.uf || "",
    };
  } catch {
    return null;
  }
}

const cnpjCache = new Map<string, CnpjData>();

export function clearCnpjCache(): void {
  cnpjCache.clear();
}

function formatCep(cep?: string | null): string {
  const d = onlyDigits(cep || "").slice(0, 8);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function joinLogradouro(tipo?: string | null, nome?: string | null): string {
  const t = (tipo || "").trim();
  const n = (nome || "").trim();
  if (!n) return "";
  if (!t || n.toUpperCase().startsWith(t.toUpperCase() + " ")) return n;
  return `${t} ${n}`;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 7000): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseCnpjWs(j: Record<string, unknown>, digits: string): CnpjData | null {
  const est = (j["estabelecimento"] as Record<string, unknown> | undefined) ?? {};
  const razao = String(j["razao_social"] || "").trim();
  const fantasia = String(est["nome_fantasia"] || "").trim();
  if (!razao && !fantasia) return null;
  const ies = Array.isArray(est["inscricoes_estaduais"])
    ? (est["inscricoes_estaduais"] as Array<Record<string, unknown>>)
    : [];
  const ieAtiva = ies.find((x) => x["ativo"] === true) ?? ies[0];
  const cidade = (est["cidade"] as Record<string, unknown> | undefined) ?? {};
  const estado = (est["estado"] as Record<string, unknown> | undefined) ?? {};
  const tel = `${String(est["ddd1"] || "")}${String(est["telefone1"] || "")}`;
  return {
    cnpj: String(est["cnpj"] || digits),
    razao_social: razao,
    nome_fantasia: fantasia,
    inscricao_estadual: ieAtiva ? String(ieAtiva["inscricao_estadual"] || "") : "",
    email: String(est["email"] || ""),
    ddd_telefone_1: tel,
    cep: formatCep(String(est["cep"] || "")),
    logradouro: joinLogradouro(String(est["tipo_logradouro"] || ""), String(est["logradouro"] || "")),
    numero: String(est["numero"] || ""),
    complemento: String(est["complemento"] || ""),
    bairro: String(est["bairro"] || ""),
    municipio: String(cidade["nome"] || ""),
    uf: String(estado["sigla"] || ""),
  };
}

function parseOpenCnpja(j: Record<string, unknown>, digits: string): CnpjData | null {
  const company = (j["company"] as Record<string, unknown> | undefined) ?? {};
  const addr = (j["address"] as Record<string, unknown> | undefined) ?? {};
  const razao = String(company["name"] || "").trim();
  const fantasia = String(j["alias"] || "").trim();
  if (!razao && !fantasia) return null;
  const phones = Array.isArray(j["phones"]) ? (j["phones"] as Array<Record<string, unknown>>) : [];
  const p0 = phones[0];
  const tel = p0 ? `${String(p0["area"] || "")}${String(p0["number"] || "")}` : "";
  const emails = Array.isArray(j["emails"]) ? (j["emails"] as Array<Record<string, unknown>>) : [];
  const e0 = emails[0];
  const regs = Array.isArray(j["registrations"]) ? (j["registrations"] as Array<Record<string, unknown>>) : [];
  const regAtiva = regs.find((x) => x["enabled"] === true) ?? regs[0];
  return {
    cnpj: String(j["taxId"] || digits),
    razao_social: razao,
    nome_fantasia: fantasia,
    inscricao_estadual: regAtiva ? String(regAtiva["number"] || "") : "",
    email: e0 ? String(e0["address"] || "") : "",
    ddd_telefone_1: tel,
    cep: formatCep(String(addr["zip"] || "")),
    logradouro: String(addr["street"] || ""),
    numero: String(addr["number"] || ""),
    complemento: String(addr["details"] || ""),
    bairro: String(addr["district"] || ""),
    municipio: String(addr["city"] || ""),
    uf: String(addr["state"] || ""),
  };
}

function parseBrasilApiFormat(j: Record<string, unknown>, digits: string): CnpjData | null {
  const razao = String(j["razao_social"] || "").trim();
  const fantasia = String(j["nome_fantasia"] || "").trim();
  if (!razao && !fantasia) return null;
  return {
    cnpj: String(j["cnpj"] || digits),
    razao_social: razao,
    nome_fantasia: fantasia,
    email: String(j["email"] || ""),
    ddd_telefone_1: String(j["ddd_telefone_1"] || ""),
    cep: formatCep(String(j["cep"] || "")),
    logradouro: joinLogradouro(
      String(j["descricao_tipo_de_logradouro"] || ""),
      String(j["logradouro"] || ""),
    ),
    numero: String(j["numero"] || ""),
    complemento: String(j["complemento"] || ""),
    bairro: String(j["bairro"] || ""),
    municipio: String(j["municipio"] || ""),
    uf: String(j["uf"] || ""),
  };
}

export async function fetchCNPJ(cnpj: string): Promise<CnpjData | null> {
  const digits = onlyDigits(cnpj);
  if (!isValidCNPJ(digits)) return null;

  const cached = cnpjCache.get(digits);
  if (cached) return cached;

  const providers: Array<{
    url: string;
    parse: (j: Record<string, unknown>, d: string) => CnpjData | null;
  }> = [
    { url: `https://publica.cnpj.ws/cnpj/${digits}`, parse: parseCnpjWs },
    { url: `https://open.cnpja.com/office/${digits}`, parse: parseOpenCnpja },
    { url: `https://brasilapi.com.br/api/cnpj/v1/${digits}`, parse: parseBrasilApiFormat },
    { url: `https://minhareceita.org/${digits}`, parse: parseBrasilApiFormat },
  ];

  for (const provider of providers) {
    const json = await fetchJsonWithTimeout(provider.url);
    if (!json) continue;
    const parsed = provider.parse(json, digits);
    if (parsed) {
      cnpjCache.set(digits, parsed);
      return parsed;
    }
  }

  return null;
}
