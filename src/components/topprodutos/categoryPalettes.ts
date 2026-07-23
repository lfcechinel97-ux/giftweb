// Paletas pastel por categoria. Cada categoria tem 3-4 tons que rotacionam entre os tiles,
// dando composições visuais diferentes por seção sem cair no cinza padrão de e-commerce.

export interface Tile {
  bg: string;        // cor de fundo do tile
  ink: string;       // cor do texto sobre o tile (nome/preço)
  accent: string;    // cor do rótulo/badge
  accentInk: string; // texto do rótulo
}

// tons calmos, coerentes com a identidade Navy + Green
const PALETTES: Record<string, Tile[]> = {
  "garrafas-agua": [
    { bg: "#E8EEF4", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" }, // névoa azul
    { bg: "#F1E9DE", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" }, // areia
    { bg: "#DCE6DA", ink: "#1F3323", accent: "#1F3323", accentInk: "#FFFFFF" }, // eucalipto
    { bg: "#F5F3EE", ink: "#0B1F3A", accent: "#22C55E", accentInk: "#FFFFFF" }, // off-white
  ],
  "copos-cafe-cerveja": [
    { bg: "#EFE4D6", ink: "#3E2A1B", accent: "#3E2A1B", accentInk: "#FFFFFF" }, // creme torrado
    { bg: "#E4CFB6", ink: "#3E2A1B", accent: "#3E2A1B", accentInk: "#FFFFFF" }, // chantilly
    { bg: "#D9C2A6", ink: "#3E2A1B", accent: "#22C55E", accentInk: "#FFFFFF" }, // caramelo
    { bg: "#F2ECE3", ink: "#3E2A1B", accent: "#3E2A1B", accentInk: "#FFFFFF" },
  ],
  "guarda-chuvas": [
    { bg: "#DCE3EC", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" }, // céu chuvoso
    { bg: "#C7D1DE", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" }, // aço claro
    { bg: "#EDEDED", ink: "#0B1F3A", accent: "#22C55E", accentInk: "#FFFFFF" }, // névoa
    { bg: "#B9C4D2", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" },
  ],
  "kit-churrasco-vinho": [
    { bg: "#E3D2C4", ink: "#3A1F1F", accent: "#3A1F1F", accentInk: "#FFFFFF" }, // madeira
    { bg: "#C8A78A", ink: "#3A1F1F", accent: "#3A1F1F", accentInk: "#FFFFFF" }, // caramelo escuro
    { bg: "#B5836B", ink: "#FFFFFF", accent: "#FFFFFF", accentInk: "#3A1F1F" }, // couro
    { bg: "#E9DDD1", ink: "#3A1F1F", accent: "#22C55E", accentInk: "#FFFFFF" },
  ],
  "som-power-bank": [
    { bg: "#E5E7EB", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" }, // grafite claro
    { bg: "#111827", ink: "#F8FAFC", accent: "#22C55E", accentInk: "#FFFFFF" }, // preto tech
    { bg: "#D1D5DB", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" },
    { bg: "#F3F4F6", ink: "#0B1F3A", accent: "#22C55E", accentInk: "#FFFFFF" },
  ],
  "sacola-tnt-algodao": [
    { bg: "#EDE6D6", ink: "#2A2E1F", accent: "#2A2E1F", accentInk: "#FFFFFF" }, // linho
    { bg: "#D8CEB6", ink: "#2A2E1F", accent: "#2A2E1F", accentInk: "#FFFFFF" }, // aveia
    { bg: "#C9B99A", ink: "#2A2E1F", accent: "#22C55E", accentInk: "#FFFFFF" }, // juta
    { bg: "#F0EBDF", ink: "#2A2E1F", accent: "#2A2E1F", accentInk: "#FFFFFF" },
  ],
  "caderneta-caneta": [
    { bg: "#F1EAD9", ink: "#3B2A1A", accent: "#3B2A1A", accentInk: "#FFFFFF" }, // papel
    { bg: "#DFD3B8", ink: "#3B2A1A", accent: "#3B2A1A", accentInk: "#FFFFFF" }, // craft
    { bg: "#C9BFA3", ink: "#3B2A1A", accent: "#22C55E", accentInk: "#FFFFFF" },
    { bg: "#EBE3CE", ink: "#3B2A1A", accent: "#3B2A1A", accentInk: "#FFFFFF" },
  ],
  "mochilas-bolsa-necessaire": [
    { bg: "#D9DEE5", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" }, // urbano
    { bg: "#C4CCD7", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" },
    { bg: "#E7DFD3", ink: "#3E2A1B", accent: "#22C55E", accentInk: "#FFFFFF" }, // trilha
    { bg: "#B0BAC7", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" },
  ],
};

const FALLBACK: Tile[] = [
  { bg: "#F1E9DE", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" },
  { bg: "#E8EEF4", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" },
  { bg: "#DCE6DA", ink: "#1F3323", accent: "#22C55E", accentInk: "#FFFFFF" },
  { bg: "#F5F3EE", ink: "#0B1F3A", accent: "#0B1F3A", accentInk: "#FFFFFF" },
];

export const getTile = (categoria: string, index: number): Tile => {
  const pal = PALETTES[categoria] ?? FALLBACK;
  return pal[index % pal.length];
};

export const getPalette = (categoria: string): Tile[] => PALETTES[categoria] ?? FALLBACK;
