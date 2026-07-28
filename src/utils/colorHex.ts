const COLOR_MAP: Record<string, string> = {
  'azul': '#3B82F6',
  'azul claro': '#60A5FA',
  'azul royal': '#1D4ED8',
  'azul escuro': '#1E3A5F',
  'azul marinho': '#1E3A5F',
  'vermelho': '#EF4444',
  'verde': '#22C55E',
  'verde claro': '#4ADE80',
  'verde escuro': '#166534',
  'verde bandeira': '#15803D',
  'verde limao': '#84CC16',
  'verde limão': '#84CC16',
  'verde militar': '#4B5320',
  'preto': '#111827',
  'branco': '#F9FAFB',
  'off white': '#F5F5EF',
  'bege': '#E8D9BE',
  'creme': '#F2E8D5',
  'amarelo': '#EAB308',
  'roxo': '#8B5CF6',
  'lilas': '#C4B5FD',
  'lilás': '#C4B5FD',
  'rosa': '#EC4899',
  'rosa claro': '#F9A8D4',
  'pink': '#DB2777',
  'cinza': '#6B7280',
  'cinza claro': '#9CA3AF',
  'cinza escuro': '#374151',
  'chumbo': '#4B5563',
  'laranja': '#F97316',
  'marrom': '#92400E',
  'dourado': '#D4A15A',
  'ouro': '#D4A15A',
  'prata': '#C0C0C0',
  'prateado': '#C0C0C0',
  'inox': '#B8BCC4',
  'vinho': '#7F1D1D',
  'bordo': '#6B0F1A',
  'bordô': '#6B0F1A',
  'grafite': '#374151',
  'natural': '#D9C79E',
  'transparente': '#E5E7EB',
  'cristal': '#E5E7EB',
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
