export const PALETA_CORES: Record<string, string> = {
  preto: '#000000',
  branco: '#ffffff',
  vermelho: '#e53935',
  azul: '#1e88e5',
  verde: '#43a047',
  amarelo: '#fdd835',
  cinza: '#757575',
  cinza_claro: '#bdbdbd',
  cinza_escuro: '#424242',
  roxo: '#8e24aa',
  rosa: '#d81b60',
  laranja: '#fb8c00',
  ciano: '#00acc1',
  marrom: '#6d4c41',
  ouro: '#d4af37',
  prata: '#c0c0c0',
  transparente: 'transparent'
};

export function normalizeColorName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolveColor(colorValue: unknown, fallback: string = '#ffffff'): string {
  if (typeof colorValue !== 'string') {
    return fallback;
  }
  const clean = colorValue.trim();
  if (clean.startsWith('#') || clean.startsWith('rgb(') || clean.startsWith('rgba(')) {
    return clean;
  }
  const norm = normalizeColorName(clean);
  if (PALETA_CORES[norm]) {
    return PALETA_CORES[norm];
  }
  return clean || fallback;
}
