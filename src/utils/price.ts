export function getMarkup(precoCusto: number): number {
  if (precoCusto <= 1.0) return 6.0;
  if (precoCusto <= 3.0) return 4.8;
  if (precoCusto <= 8.0) return 3.8;
  if (precoCusto <= 15.0) return 3.0;
  if (precoCusto <= 25.0) return 2.5;
  if (precoCusto <= 40.0) return 2.1;
  if (precoCusto <= 70.0) return 1.8;
  return 1.6;
}

export function getDesconto(quantidade: number): number {
  if (quantidade >= 1000) return 0.16;
  if (quantidade >= 500) return 0.12;
  if (quantidade >= 300) return 0.09;
  if (quantidade >= 200) return 0.07;
  if (quantidade >= 100) return 0.04;
  return 0;
}

export function calcularPreco(precoCusto: number, quantidade: number): number {
  const precoBase = precoCusto * getMarkup(precoCusto);
  return precoBase * (1 - getDesconto(quantidade));
}

export function getPrecoMinimo(precoCusto: number): number {
  return calcularPreco(precoCusto, 1000);
}

export function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
