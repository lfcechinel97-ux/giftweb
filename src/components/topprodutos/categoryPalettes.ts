// Paleta neutra global — fundo branco, texto navy, azul de destaque como CTA visual.
// Mantemos a assinatura para não quebrar os consumidores existentes.

export interface Tile {
  bg: string;        // fundo do tile
  ink: string;       // cor de texto
  accent: string;    // badge/destaque
  accentInk: string; // texto do badge
}

const NEUTRAL: Tile = {
  bg: "#FFFFFF",
  ink: "#0B1F3A",     // navy
  accent: "#2563EB",  // azul destaque
  accentInk: "#FFFFFF",
};

const NEUTRAL_ALT: Tile = {
  bg: "#F8FAFC",      // cinza muito claro
  ink: "#0B1F3A",
  accent: "#2563EB",
  accentInk: "#FFFFFF",
};

const PALETTE: Tile[] = [NEUTRAL, NEUTRAL_ALT, NEUTRAL, NEUTRAL_ALT];

export const getTile = (_categoria: string, index: number): Tile =>
  PALETTE[index % PALETTE.length];

export const getPalette = (_categoria: string): Tile[] => PALETTE;
