import { supabase } from '@/integrations/supabase/client';

/**
 * Mapeamento de palavras-chave → slug da categoria base (spotlight_categories).
 * Ordem importa: a primeira correspondência vence.
 */
const KEYWORD_MAP: Array<{ keywords: string[]; slug: string }> = [
  // Garrafas e Squeezes
  { keywords: ['garrafa', 'squeeze', 'térmica', 'termica'], slug: 'garrafas-squeezes' },
  // Canecas e Copos
  { keywords: ['caneca', 'copo', 'taça', 'taca', 'xícara', 'xicara'], slug: 'canecas-copos' },
  // Bar e Bebidas
  { keywords: ['bar', 'abridor', 'saca-rolha', 'coqueteleira', 'balde de gelo', 'cerveja'], slug: 'bar-bebidas' },
  // Cozinha
  { keywords: ['cozinha', 'avental', 'tábua', 'tabua', 'pote', 'lancheira'], slug: 'cozinha' },
  // Bolsas Térmicas
  { keywords: ['bolsa térmica', 'bolsa termica', 'cooler', 'ice bag'], slug: 'bolsas-termicas' },
  // Sacolas
  { keywords: ['sacola', 'ecobag', 'eco bag', 'sacola tnt'], slug: 'sacolas' },
  // Mochilas e Bolsas (após bolsas térmicas para evitar conflito)
  { keywords: ['mochila', 'bolsa', 'pasta', 'maleta'], slug: 'mochilas-bolsas' },
  // Malas e Frasqueiras
  { keywords: ['mala', 'frasqueira', 'trolley'], slug: 'malas-frasqueiras' },
  // Viagem
  { keywords: ['viagem', 'tag mala', 'travesseiro', 'almofada pescoço', 'necessaire viagem'], slug: 'viagem' },
  // Estojos e Nécessaires
  { keywords: ['estojo', 'nécessaire', 'necessaire'], slug: 'estojos-necessaires' },
  // Organizadores
  { keywords: ['organizador', 'porta-cartão', 'porta cartão', 'porta documento'], slug: 'organizadores' },
  // Cuidados Pessoais
  { keywords: ['cuidado pessoal', 'espelho', 'lixa', 'kit manicure', 'protetor solar'], slug: 'cuidados-pessoais' },
  // Moda
  { keywords: ['camiseta', 'boné', 'bone', 'chapéu', 'chapeu', 'viseira', 'cachecol'], slug: 'moda' },
  // Guarda-Chuva
  { keywords: ['guarda-chuva', 'guarda chuva', 'sombrinha', 'umbrella'], slug: 'guarda-chuva' },
  // Expositores
  { keywords: ['expositor', 'display', 'banner', 'wind banner'], slug: 'expositores' },
  // Eletrônicos
  { keywords: ['eletrônico', 'eletronico', 'led', 'luminária usb', 'gadget'], slug: 'eletronicos' },
  // Carregadores
  { keywords: ['carregador', 'power bank', 'powerbank', 'cabo usb'], slug: 'carregadores' },
  // Caixa de Som
  { keywords: ['caixa de som', 'caixinha de som', 'speaker', 'alto-falante'], slug: 'caixa-som' },
  // Fones de Ouvido
  { keywords: ['fone', 'fones', 'earphone', 'headphone', 'earbuds'], slug: 'fones-ouvido' },
  // Acessórios de Celular
  { keywords: ['suporte celular', 'porta celular', 'pop socket', 'anel celular', 'case celular'], slug: 'acessorios-celular' },
  // Informática
  { keywords: ['pen drive', 'pendrive', 'mouse pad', 'mousepad', 'mouse', 'hub usb', 'teclado'], slug: 'informatica' },
  // Escritório
  { keywords: ['escritório', 'escritorio', 'porta-caneta', 'porta caneta', 'calculadora', 'clip', 'régua'], slug: 'escritorio' },
  // Blocos e Cadernetas
  { keywords: ['bloco', 'caderneta', 'caderno', 'agenda', 'post-it', 'sticky note'], slug: 'blocos-cadernetas' },
  // Canetas
  { keywords: ['caneta', 'lapiseira', 'marca texto', 'marcador', 'lápis', 'lapis'], slug: 'canetas' },
  // Chaveiros
  { keywords: ['chaveiro', 'porta-chave', 'porta chave'], slug: 'chaveiros' },
  // Ferramentas
  { keywords: ['ferramenta', 'chave de fenda', 'alicate', 'trena', 'lanterna ferramenta', 'kit ferramenta'], slug: 'ferramentas' },
  // Lanternas e Luminárias
  { keywords: ['lanterna', 'luminária', 'luminaria', 'abajur', 'luz'], slug: 'lanternas-luminarias' },
  // Ventilação e Climatizadores
  { keywords: ['ventilador', 'climatizador', 'mini ventilador', 'leque'], slug: 'ventilacao-climatizadores' },
  // Diversos (fallback)
  { keywords: [], slug: 'diversos' },
];

/**
 * Normaliza string para comparação: lowercase, sem acentos.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Retorna o slug da categoria base para um nome de produto.
 */
export function detectBaseCategory(productName: string): string {
  const normalized = normalize(productName);

  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.length === 0) continue; // skip fallback
    for (const kw of entry.keywords) {
      if (normalized.includes(normalize(kw))) {
        return entry.slug;
      }
    }
  }

  return 'diversos';
}

/**
 * Preview: retorna um resumo de quantos produtos cairiam em cada categoria,
 * sem gravar nada no banco.
 */
export function previewCategorization(
  products: Array<{ id: string; nome: string }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) {
    const slug = detectBaseCategory(p.nome);
    counts[slug] = (counts[slug] || 0) + 1;
  }
  return counts;
}

/**
 * Auto-categoriza uma lista de produtos na tabela product_spotlight_categories.
 * Busca as categorias base do banco, mapeia cada produto e insere os vínculos.
 * Ignora conflitos (produto já categorizado na mesma categoria).
 */
export async function autoCategorizeProducts(
  products: Array<{ id: string; nome: string }>
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];

  // Buscar categorias base do banco
  const { data: baseCategories, error: catError } = await supabase
    .from('spotlight_categories')
    .select('id, slug')
    .eq('category_type', 'base')
    .eq('active', true);

  if (catError || !baseCategories) {
    return { inserted: 0, errors: [`Erro ao buscar categorias: ${catError?.message}`] };
  }

  const slugToId = new Map(baseCategories.map((c) => [c.slug, c.id]));

  // Mapear produtos → categorias
  const inserts: Array<{ product_id: string; category_id: string }> = [];

  for (const product of products) {
    const slug = detectBaseCategory(product.nome);
    const categoryId = slugToId.get(slug);

    if (!categoryId) {
      errors.push(`Categoria '${slug}' não encontrada para produto '${product.nome}'`);
      continue;
    }

    inserts.push({ product_id: product.id, category_id: categoryId });
  }

  if (inserts.length === 0) {
    return { inserted: 0, errors };
  }

  // Inserir em lotes de 500, ignorando duplicatas
  let inserted = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    const { error: insertError, count } = await supabase
      .from('product_spotlight_categories')
      .upsert(batch, { onConflict: 'product_id,category_id', ignoreDuplicates: true })
      .select();

    if (insertError) {
      errors.push(`Erro no lote ${i / BATCH_SIZE + 1}: ${insertError.message}`);
    } else {
      inserted += count ?? batch.length;
    }
  }

  return { inserted, errors };
}
