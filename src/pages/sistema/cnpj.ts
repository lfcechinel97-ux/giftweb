// Lookup de CNPJ via BrasilAPI (gratuito, sem key)
// docs: https://brasilapi.com.br/docs#tag/CNPJ

export interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
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

export async function fetchCNPJ(cnpj: string): Promise<CnpjData | null> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!res.ok) return null;
    const j = await res.json();
    return {
      cnpj: j.cnpj,
      razao_social: j.razao_social || "",
      nome_fantasia: j.nome_fantasia || "",
      email: j.email,
      ddd_telefone_1: j.ddd_telefone_1,
      cep: j.cep,
      logradouro: j.logradouro,
      numero: j.numero,
      complemento: j.complemento,
      bairro: j.bairro,
      municipio: j.municipio,
      uf: j.uf,
    };
  } catch {
    return null;
  }
}
