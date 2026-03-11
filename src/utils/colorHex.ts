const COLOR_MAP: Record<string, string> = {
  'azul': '#3B82F6',
  'azul claro': '#3B82F6',
  'azul royal': '#3B82F6',
  'azul marinho': '#1E3A5F',
  'vermelho': '#EF4444',
  'verde': '#22C55E',
  'preto': '#1F2937',
  'branco': '#F9FAFB',
  'amarelo': '#EAB308',
  'roxo': '#8B5CF6',
  'rosa': '#EC4899',
  'cinza': '#6B7280',
  'laranja': '#F97316',
  'marrom': '#92400E',
  'dourado': '#F59E0B',
  'prata': '#9CA3AF',
  'vinho': '#7F1D1D',
  'grafite': '#374151',
};

export function getCorHex(cor: string | null | undefined): string {
  if (!cor) return '#94A3B8';
  const normalized = cor.toLowerCase().trim();
  // Direct match
  if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];
  // Partial match
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return hex;
  }
  return '#94A3B8';
}

export function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}
