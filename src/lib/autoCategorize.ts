import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// REGRAS baseadas nos nomes REAIS dos produtos XBZ
// Ordem é crítica: regras mais específicas primeiro
// Um produto cai na PRIMEIRA regra que bater
// ─────────────────────────────────────────────────────────────────────────────

type Rule = {
  slug:        string;
  label:       string;
  startsWith?: string[];
  includes?:   string[];
  fallback?:   boolean;
};

const RULES: Rule[] = [
  // ── 01 · GARRAFAS E SQUEEZES ──────────────────────────────────────────────
  {
    slug: 'garrafas-squeezes',
    label: 'Garrafas e Squeezes',
    startsWith: ['garrafa', 'squeeze'],
    includes: [
      'garrafa térmica', 'garrafa termica',
      'garrafa alumínio', 'garrafa aluminio',
      'garrafa plástica', 'garrafa plastica',
      'garrafa inox', 'garrafa vidro',
      'squeeze inox', 'squeeze plástico', 'squeeze plastico',
      'squeeze térmica', 'squeeze termica',
      'chaleira térmica', 'chaleira termica',
      'garrafa 2 em 1',
    ],
  },
  // ── 02 · CANECAS E COPOS ──────────────────────────────────────────────────
  {
    slug: 'canecas-copos',
    label: 'Canecas e Copos',
    startsWith: ['caneca', 'copo'],
    includes: [
      'caneca porcelana', 'caneca inox', 'caneca acrílica', 'caneca acrilica',
      'caneca plástica', 'caneca plastica', 'caneca vidro', 'caneca térmica',
      'caneca termica', 'caneca esmaltada', 'caneca bambu',
      'copo térmico', 'copo termico', 'copo inox', 'copo plástico',
      'copo plastico', 'copo acrílico', 'copo acrilico', 'copo long drink',
      'copo dupla parede', 'copo americano', 'copo cerveja',
      'tumbler', 'taça', 'taca',
    ],
  },
  // ── 03 · BAR E BEBIDAS ────────────────────────────────────────────────────
  {
    slug: 'bar-bebidas',
    label: 'Bar e Bebidas',
    includes: [
      'abridor', 'saca-rolha', 'saca rolha', 'sommelier',
      'kit vinho', 'porta vinho', 'bolsa vinho', 'vinho',
      'coqueteleira', 'kit bar', 'dosador',
      'jarra vidro', 'jarra borosi', 'decantador',
      'kit cerveja', 'abridor garrafa', 'petisqueira',
      'kit queijo', 'tábua queijo', 'tabua queijo',
      'porta rolha',
    ],
  },
  // ── 04 · COZINHA ──────────────────────────────────────────────────────────
  {
    slug: 'cozinha',
    label: 'Cozinha',
    includes: [
      'tábua de corte', 'tabua de corte', 'tábua churrasco', 'tabua churrasco',
      'kit churrasco', 'faca', 'avental',
      'marmita', 'pote', 'jogo americano',
      'kit cozinha', 'talheres', 'colher', 'garfo',
      'espremedor', 'ralador', 'concha',
      'cafeteira', 'prensa francesa', 'porta cápsula', 'porta capsula',
      'kit café', 'kit cafe',
    ],
  },
  // ── 05 · BOLSAS TÉRMICAS ──────────────────────────────────────────────────
  {
    slug: 'bolsas-termicas',
    label: 'Bolsas Térmicas',
    includes: [
      'bolsa térmica', 'bolsa termica',
      'lancheira', 'cooler bag', 'bag térmica', 'bag termica',
      'bolsa isotérmica', 'bolsa isotermica',
    ],
  },
  // ── 06 · SACOLAS ──────────────────────────────────────────────────────────
  {
    slug: 'sacolas',
    label: 'Sacolas',
    startsWith: ['sacola'],
    includes: [
      'sacola tnt', 'sacola nylon', 'sacola papel',
      'sacola algodão', 'sacola algodao',
      'sacola poliéster', 'sacola poliester',
      'sacola portátil', 'sacola portatil',
      'ecobag', 'eco bag', 'tote bag',
      'sacolinha', 'sacochila',
    ],
  },
  // ── 07 · MOCHILAS E BOLSAS ────────────────────────────────────────────────
  {
    slug: 'mochilas-bolsas',
    label: 'Mochilas e Bolsas',
    startsWith: ['mochila', 'bolsa'],
    includes: [
      'mochila oxford', 'mochila nylon', 'mochila pu',
      'mochila couro', 'mochila 14l', 'mochila 18l',
      'mochila 26l', 'mochila notebook', 'mochila executiva',
      'bolsa executiva', 'bolsa notebook', 'bolsa transversal',
      'bolsa couro', 'bolsa pu', 'bolsa multifuncional',
      'bolsa esportiva', 'mini bolsa',
      'pasta executiva', 'pasta', 'portfólio', 'portfolio',
      'pochete',
    ],
  },
  // ── 08 · MALAS E FRASQUEIRAS ──────────────────────────────────────────────
  {
    slug: 'malas-frasqueiras',
    label: 'Malas e Frasqueiras',
    startsWith: ['mala', 'frasqueira'],
    includes: [
      'mala de bordo', 'mala abs', 'mala viagem',
      'mala executiva', 'frasqueira',
    ],
  },
  // ── 09 · VIAGEM ───────────────────────────────────────────────────────────
  {
    slug: 'viagem',
    label: 'Viagem',
    includes: [
      'kit viagem', 'travesseiro de viagem', 'travesseiro inflável',
      'tag bagagem', 'tag de mala', 'tag identificador',
      'tapa olhos', 'máscara de dormir', 'mascara de dormir',
      'cadeado viagem', 'porta passaporte',
      'necessaire viagem', 'kit de viagem',
    ],
  },
  // ── 10 · ESTOJOS E NÉCESSAIRES ────────────────────────────────────────────
  {
    slug: 'estojos-necessaires',
    label: 'Estojos e Nécessaires',
    startsWith: ['nécessaire', 'necessaire', 'estojo'],
    includes: [
      'nécessaire pu', 'nécessaire couro', 'nécessaire poliéster',
      'necessaire pu', 'necessaire couro', 'necessaire poliester',
      'estojo escolar', 'estojo pen drive', 'estojo caneta',
      'porta lápis', 'porta lapis', 'porta caneta',
    ],
  },
  // ── 11 · ORGANIZADORES ────────────────────────────────────────────────────
  {
    slug: 'organizadores',
    label: 'Organizadores',
    startsWith: ['organizador'],
    includes: [
      'organizador de mesa', 'organizador de cabos', 'organizador plástico',
      'organizador acrílico', 'organizador acrilico',
      'porta documentos', 'porta cartão', 'porta cartao',
      'porta objetos', 'suporte de mesa',
      'porta retrato', 'porta foto',
      'caixa organizadora',
    ],
  },
  // ── 12 · CUIDADOS PESSOAIS ────────────────────────────────────────────────
  {
    slug: 'cuidados-pessoais',
    label: 'Cuidados Pessoais',
    startsWith: ['espelho', 'kit manicure', 'kit higiene'],
    includes: [
      'espelho', 'escova de cabelo', 'escova de dente',
      'kit manicure', 'kit higiene', 'kit dental',
      'kit barbearia', 'kit skincare',
      'protetor solar', 'hidratante',
      'pente', 'porta escova',
      'cortador de unha', 'lima de unha',
      'home spray', 'difusor de aromas', 'kit aromas',
      'aromatizador',
    ],
  },
  // ── 13 · MODA ─────────────────────────────────────────────────────────────
  {
    slug: 'moda',
    label: 'Moda',
    startsWith: ['boné', 'bone', 'camiseta', 'camisa', 'chapéu', 'chapeu'],
    includes: [
      'boné', 'bone', 'camiseta', 'camisa polo', 'polo',
      'chapéu', 'chapeu', 'chapéu bucket', 'bucket hat',
      'viseira', 'gorro', 'touca',
      'meias', 'cinto', 'lenço', 'lenco',
      'pulseira', 'bracelete',
      'pochete esportiva',
      'toalha de microfibra', 'toalha microfibra',
    ],
  },
  // ── 14 · GUARDA-CHUVA ─────────────────────────────────────────────────────
  {
    slug: 'guarda-chuva',
    label: 'Guarda-Chuva',
    startsWith: ['guarda-chuva', 'guarda chuva', 'sombrinha', 'capa de chuva'],
    includes: [
      'guarda-chuva', 'guarda chuva',
      'sombrinha', 'capa de chuva',
      'capa chuva descartável', 'capa chuva descartavel',
    ],
  },
  // ── 16 · EXPOSITORES ──────────────────────────────────────────────────────
  {
    slug: 'expositores',
    label: 'Expositores',
    startsWith: ['display', 'expositor', 'totem'],
    includes: [
      'display', 'expositor', 'totem',
      'porta folheto', 'porta revista', 'porta panfleto',
      'plaquinha metálica', 'plaquinha metalica', 'plaquinha',
      'porta recado', 'clip display',
    ],
  },
  // ── 18 · CARREGADORES ─────────────────────────────────────────────────────
  {
    slug: 'carregadores',
    label: 'Carregadores',
    startsWith: ['carregador', 'power bank', 'powerbank'],
    includes: [
      'carregador portátil', 'carregador portatil',
      'carregador wireless', 'carregador sem fio',
      'power bank', 'powerbank',
      'carregador solar', 'carregador veicular',
    ],
  },
  // ── 19 · CAIXA DE SOM ─────────────────────────────────────────────────────
  {
    slug: 'caixa-som',
    label: 'Caixa de Som',
    startsWith: ['caixa de som', 'speaker'],
    includes: [
      'caixa de som', 'speaker', 'alto-falante', 'alto falante',
      'caixinha bluetooth', 'caixa bluetooth',
      'amplificador sonoro',
    ],
  },
  // ── 20 · FONES DE OUVIDO ──────────────────────────────────────────────────
  {
    slug: 'fones-ouvido',
    label: 'Fones de Ouvido',
    startsWith: ['fone'],
    includes: [
      'fone de ouvido', 'fone bluetooth', 'fone estéreo', 'fone estereo',
      'headphone', 'headset', 'earphone', 'earbuds',
      'tws', 'fone sem fio', 'in-ear',
    ],
  },
  // ── 21 · ACESSÓRIOS DE CELULAR ────────────────────────────────────────────
  {
    slug: 'acessorios-celular',
    label: 'Acessórios de Celular',
    includes: [
      'suporte veicular', 'suporte celular', 'suporte para celular',
      'cabo usb', 'cabo de dados', 'cabo lightning', 'cabo tipo-c',
      'pop socket', 'popsocket',
      'protetor de tela', 'capa celular',
      'suporte magnético', 'suporte magnetico',
      'anel para celular', 'ring holder',
    ],
  },
  // ── 22 · INFORMÁTICA ──────────────────────────────────────────────────────
  {
    slug: 'informatica',
    label: 'Informática',
    startsWith: ['mouse', 'teclado', 'pen drive', 'pendrive'],
    includes: [
      'mouse', 'mousepad', 'mouse pad',
      'teclado', 'teclado bluetooth',
      'pen drive', 'pendrive',
      'hub usb', 'usb hub',
      'webcam', 'suporte notebook',
      'notebook', 'embalagem pen drive', 'embalagem kraft pen drive',
    ],
  },
  // ── 24 · BLOCOS E CADERNETAS (antes de escritório — mais específico) ──────
  {
    slug: 'blocos-cadernetas',
    label: 'Blocos e Cadernetas',
    startsWith: ['caderneta', 'bloco de anotações', 'bloco de notas'],
    includes: [
      'caderneta', 'caderneta pu', 'caderneta couro',
      'bloco de anotações', 'bloco de notas', 'bloco anotações',
      'bloco com suporte', 'bloco autoadesivo',
      'agenda', 'planner', 'caderno fichário', 'caderno fich',
      'caderno couchê', 'caderno couche',
    ],
  },
  // ── 23 · ESCRITÓRIO ───────────────────────────────────────────────────────
  {
    slug: 'escritorio',
    label: 'Escritório',
    includes: [
      'grampeador', 'perfurador', 'tesoura',
      'clips', 'post-it', 'post it', 'autoadesivo',
      'borracha', 'apontador', 'régua', 'regua',
      'calculadora', 'porta papel', 'porta clips',
      'organizador de escritório', 'kit escritório', 'kit escritorio',
    ],
  },
  // ── 25 · CANETAS ──────────────────────────────────────────────────────────
  {
    slug: 'canetas',
    label: 'Canetas',
    startsWith: ['caneta', 'lápis', 'lapis', 'lapiseira'],
    includes: [
      'caneta metal', 'caneta plástica', 'caneta plastica',
      'caneta ecológica', 'caneta ecologica',
      'caneta touch', 'caneta esferográfica', 'caneta esferografica',
      'caneta gel', 'caneta executiva', 'caneta bambu',
      'lápis', 'lapis', 'lapiseira',
      'marcador', 'marca texto', 'marca-texto',
      'conjunto caneta', 'pacote caneta', 'pacote com caneta',
    ],
  },
  // ── 26 · CHAVEIROS ────────────────────────────────────────────────────────
  {
    slug: 'chaveiros',
    label: 'Chaveiros',
    startsWith: ['chaveiro'],
    includes: [
      'chaveiro metal', 'chaveiro madeira', 'chaveiro acrílico',
      'chaveiro acrilico', 'chaveiro couro', 'chaveiro led',
      'chaveiro abridor', 'chaveiro canivete',
      'chaveiro emborrachado',
    ],
  },
  // ── 27 · FERRAMENTAS ──────────────────────────────────────────────────────
  {
    slug: 'ferramentas',
    label: 'Ferramentas',
    startsWith: ['kit ferramenta', 'trena'],
    includes: [
      'ferramenta', 'trena', 'nível', 'nivel',
      'martelo', 'chave de fenda', 'chave inglesa',
      'alicate', 'canivete', 'faca canivete',
      'kit ferramentas', 'multi ferramenta',
    ],
  },
  // ── 28 · LANTERNAS E LUMINÁRIAS ───────────────────────────────────────────
  {
    slug: 'lanternas-luminarias',
    label: 'Lanternas e Luminárias',
    startsWith: ['lanterna', 'luminária', 'luminaria'],
    includes: [
      'lanterna', 'luminária', 'luminaria',
      'luz led', 'abajur', 'luminoso',
      'lanterna led', 'lanterna recarregável',
    ],
  },
  // ── 29 · VENTILAÇÃO E CLIMATIZADORES ──────────────────────────────────────
  {
    slug: 'ventilacao-climatizadores',
    label: 'Ventilação e Climatizadores',
    startsWith: ['ventilador', 'climatizador', 'umidificador'],
    includes: [
      'ventilador', 'mini ventilador', 'ventilador usb',
      'climatizador', 'climatizador portátil', 'climatizador portatil',
      'umidificador', 'ar condicionado',
    ],
  },
  // ── 17 · ELETRÔNICOS — genérico, antes do fallback ────────────────────────
  {
    slug: 'eletronicos',
    label: 'Eletrônicos',
    includes: [
      'usb hub', 'hub usb', 'relógio de mesa', 'relogio de mesa',
      'aspirador de pó', 'aspirador de po',
      'régua eletrônica', 'digital', 'bluetooth',
      'eletrônico', 'eletronico',
    ],
  },
  // ── 15 · DIVERSOS — fallback final ────────────────────────────────────────
  { slug: 'diversos', label: 'Diversos', fallback: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÃO DE MATCH
// ─────────────────────────────────────────────────────────────────────────────

export function matchRule(productName: string): string {
  const name = productName.toLowerCase().trim();

  for (const rule of RULES) {
    if (rule.fallback) return 'diversos';

    const hitStart = rule.startsWith?.some(kw => name.startsWith(kw.toLowerCase()));
    const hitIncl  = rule.includes?.some(kw => name.includes(kw.toLowerCase()));

    if (hitStart || hitIncl) return rule.slug;
  }

  return 'diversos';
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW — sem salvar nada no banco
// ─────────────────────────────────────────────────────────────────────────────

export async function previewCategorization(): Promise<{
  counts:  Record<string, number>;
  samples: Record<string, string[]>;
  total:   number;
}> {
  const { data: products } = await supabase
    .from('products_cache')
    .select('id, nome')
    .eq('is_variante', false)
    .eq('ativo', true);

  if (!products) return { counts: {}, samples: {}, total: 0 };

  const counts:  Record<string, number>   = {};
  const samples: Record<string, string[]> = {};

  for (const p of products) {
    const slug = matchRule(p.nome ?? '');
    counts[slug]  = (counts[slug] ?? 0) + 1;
    if (!samples[slug]) samples[slug] = [];
    if (samples[slug].length < 3) samples[slug].push(p.nome);
  }

  return { counts, samples, total: products.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTAR — salva vínculos na tabela product_spotlight_categories
// ─────────────────────────────────────────────────────────────────────────────

export async function autoCategorizeProducts(): Promise<{
  inserted: number;
  errors:   string[];
}> {
  const errors: string[] = [];

  // 1. Buscar produtos ativos (pais)
  const { data: products, error: prodErr } = await supabase
    .from('products_cache')
    .select('id, nome')
    .eq('is_variante', false)
    .eq('ativo', true);

  if (prodErr || !products) {
    return { inserted: 0, errors: [`Erro ao buscar produtos: ${prodErr?.message}`] };
  }

  // 2. Buscar categorias base do banco para mapear slug → uuid
  const { data: baseCategories, error: catErr } = await supabase
    .from('spotlight_categories')
    .select('id, slug')
    .eq('category_type', 'base')
    .eq('active', true);

  if (catErr || !baseCategories) {
    return { inserted: 0, errors: [`Erro ao buscar categorias: ${catErr?.message}`] };
  }

  const slugToId = new Map(baseCategories.map(c => [c.slug, c.id]));

  // 3. Mapear cada produto à sua categoria
  const inserts: Array<{ product_id: string; category_id: string; position: number }> = [];

  for (const p of products) {
    const slug = matchRule(p.nome ?? '');
    const categoryId = slugToId.get(slug);

    if (!categoryId) {
      errors.push(`Categoria '${slug}' não encontrada para: ${p.nome}`);
      continue;
    }

    inserts.push({ product_id: p.id, category_id: categoryId, position: 0 });
  }

  if (inserts.length === 0) {
    return { inserted: 0, errors };
  }

  // 4. Upsert em lotes de 500
  let inserted = 0;
  const BATCH = 500;

  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH);
    const { error: upsertErr } = await supabase
      .from('product_spotlight_categories')
      .upsert(batch, { onConflict: 'product_id,category_id', ignoreDuplicates: true });

    if (upsertErr) {
      errors.push(`Erro lote ${Math.floor(i / BATCH) + 1}: ${upsertErr.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, errors };
}
