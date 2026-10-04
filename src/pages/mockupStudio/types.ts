export type Tecnica = "laser" | "dtf_uv" | "dtf_textil";

export const TECNICAS: { id: Tecnica; nome: string; descricao: string }[] = [
  { id: "laser", nome: "Gravação a Laser", descricao: "Acabamento prateado, acabamento metálico real." },
  { id: "dtf_uv", nome: "DTF UV", descricao: "Cores originais, brilho e leve relevo de verniz." },
  { id: "dtf_textil", nome: "DTF Têxtil", descricao: "Cores originais, acabamento fosco sobre tecido." },
];

export interface LogoOriginal {
  file: File;
  url: string;
  nome: string;
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

/** Posição/tamanho/ângulo da logo sobre o produto, em % das dimensões da
 * foto -- nunca em pixels ou mm. xPct/yPct são o CENTRO da logo (não o
 * canto), porque é assim que a rotação do Fabric funciona e o que
 * gerarComposicao usa pra desenhar. */
export interface CaixaPosicao {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  anguloGraus: number;
}

export interface ResultadoMockup {
  url: string;
}
