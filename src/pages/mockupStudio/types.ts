export type Tecnica = "laser" | "dtf_uv" | "dtf_textil";

export const TECNICAS: { id: Tecnica; nome: string; descricao: string }[] = [
  { id: "laser", nome: "Gravação a Laser", descricao: "Logo monocromática, simulação prateada sobre aço inox." },
  { id: "dtf_uv", nome: "DTF UV", descricao: "Impressão colorida com brilho e leve relevo de verniz." },
  { id: "dtf_textil", nome: "DTF Têxtil", descricao: "Impressão colorida para aplicação sobre tecido." },
];

export interface LogoOriginal {
  file: File;
  url: string;
  nome: string;
}

export interface LogoTratada {
  /** Resultado do tratamento desta etapa — hoje é processamento determinístico
   * local (ex.: conversão pra escala de cinza no laser); a remoção de fundo
   * e o tratamento real por IA entram via Lovable AI (servidor). */
  url: string;
  tecnica: Tecnica;
  avisoQualidade?: string;
}

export interface VisaoProduto {
  id: string;
  nome: string;
  fotoUrl: string;
}

export interface ProdutoMockup {
  id: string;
  nome: string;
  codigoAmigavel: string;
  visoes: VisaoProduto[];
}
