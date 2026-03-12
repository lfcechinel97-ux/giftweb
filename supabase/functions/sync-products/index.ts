import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MOCK_PRODUCTS = [
  {"CodigoAmigavel": "9139A-AZU", "Nome": "Squeeze Alumínio 500ml", "CorWebPrincipal": "Azul", "ImageLink": "https://placehold.co/400", "PrecoVenda": "15.00", "QuantidadeDisponivel": "100"},
  {"CodigoAmigavel": "9139A-VRM", "Nome": "Squeeze Alumínio 500ml", "CorWebPrincipal": "Vermelho", "ImageLink": "https://placehold.co/400", "PrecoVenda": "15.00", "QuantidadeDisponivel": "80"},
  {"CodigoAmigavel": "9139A-PRE", "Nome": "Squeeze Alumínio 500ml", "CorWebPrincipal": "Preto", "ImageLink": "https://placehold.co/400", "PrecoVenda": "15.00", "QuantidadeDisponivel": "60"},
  {"CodigoAmigavel": "00033-4GB", "Nome": "Pen Drive 4GB", "CorWebPrincipal": "", "ImageLink": "https://placehold.co/400", "PrecoVenda": "8.00", "QuantidadeDisponivel": "200"},
  {"CodigoAmigavel": "17011C", "Nome": "Garrafa Inox 750ml", "CorWebPrincipal": "Laranja", "ImageLink": "https://placehold.co/400", "PrecoVenda": "25.00", "QuantidadeDisponivel": "50"}
]

function getCategoria(nome: string): string {
  const n = nome.toUpperCase()
  if (n.includes('CANECA') || n.includes('COPO') ||
      n.includes('TACA') || n.includes('TAÇA')) return 'copos'
  if (n.includes('GARRAFA') || n.includes('SQUEEZE') ||
      n.includes('TERMICA')) return 'garrafas'
  if (n.includes('MOCHILA')) return 'mochilas'
  if (n.includes('BOLSA') || n.includes('SACOLA')) return 'bolsas'
  if (n.includes('CANETA') || n.includes('BLOCO') ||
      n.includes('CADERNO') || n.includes('AGENDA')) return 'escritorio'
  if (n.includes('KIT')) return 'kits'
  return 'outros'
}

function getSlug(nome: string, codigo: string): string {
  const base = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const codigoSanitizado = codigo.toLowerCase().replace(/\//g, '-')
  return base + '-' + codigoSanitizado
}

function getBusca(p: any): string {
  return [p.Nome ?? '', p.Descricao ?? '',
          p.CorWebPrincipal ?? '', p.CodigoAmigavel ?? '']
    .join(' ').toLowerCase()
}

function getImageUrls(p: any): string[] {
  return [
    p.ImageLink, p.ImageLink2, p.ImageLink3, p.ImageLink4,
    p.imageLink, p.imageLink2, p.imageLink3, p.imageLink4
  ]
    .filter((url: any) => url && typeof url === 'string' && url.trim() !== '')
    .filter((url: string, index: number, self: string[]) => self.indexOf(url) === index)
    .slice(0, 4)
}

function getCodigoPrefixo(codigo: string): string {
  if (codigo.includes('/')) {
    return codigo.split('/')[0]
  }
  const partes = codigo.split('-')
  if (partes.length >= 2) {
    const sufixo = partes[partes.length - 1]
    // Agrupa se sufixo tiver 1-3 letras + dígito opcional (códigos de cor como AZI, BC2, VM2, VD)
    // NÃO agrupa se sufixo começar com número como 4GB, 8GB, 16GB
    const codigoDeCor = /^[A-Za-z]{1,3}[0-9]?$/.test(sufixo)
    if (codigoDeCor) {
      return partes.slice(0, -1).join('-')
    }
  }
  return codigo
}

const CHUNK_SIZE = 500

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Check if mock mode
  let useMock = false
  try {
    const body = await req.json()
    if (body && body.mock === true) {
      useMock = true
    }
  } catch (_) {
    // no body or invalid JSON, proceed normally
  }

  try {
    let produtos: any[]

    if (useMock) {
      console.log('[SYNC] MOCK MODE - using fake data')
      produtos = MOCK_PRODUCTS
    } else {
      console.log('[SYNC] Stage 1: Fetching from XBZ API...')
      const apiUrl = Deno.env.get('XBZ_API_URL')
      if (!apiUrl) throw new Error('XBZ_API_URL nao configurada')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25000)

      let apiResponse: Response
      try {
        apiResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        })
        clearTimeout(timeout)
      } catch (fetchErr) {
        clearTimeout(timeout)
        throw new Error('Falha ao chamar API XBZ: ' + (fetchErr as Error).message)
      }

      if (!apiResponse.ok) {
        const body = await apiResponse.text()
        throw new Error('API retornou status ' + apiResponse.status + ': ' + body.slice(0, 200))
      }

      const data = await apiResponse.json()
      produtos = Array.isArray(data) ? data : data.produtos ?? data.data ?? []
    }

    console.log('[SYNC] Stage 1 OK - produtos:', produtos.length)
    if (!produtos.length) throw new Error('API retornou lista vazia')

    console.log('[SYNC] Stage 2: Grouping by prefix...')
    // Chave única = codigo + cor (para produtos com mesmo código mas cores diferentes)
    const produtosMap = new Map<string, any>()
    for (const p of produtos) {
      const codigo = p.CodigoAmigavel ?? p.codigoAmigavel ?? ''
      if (!codigo) continue
      const cor = p.CorWebPrincipal ?? p.corWebPrincipal ?? ''
      const chave = codigo + '||' + cor.toUpperCase()
      produtosMap.set(chave, p)
    }

    // Gerar codigo_amigavel único garantindo sem colisão
    const codigosUsados = new Set<string>()
    const codigosUnicos = new Map<string, string>() // chave -> codigoUnico
    for (const [chave, p] of produtosMap.entries()) {
      const codigo = p.CodigoAmigavel ?? p.codigoAmigavel ?? ''
      const cor = p.CorWebPrincipal ?? p.corWebPrincipal ?? ''

      let codigoUnico = codigo
      if (cor) {
        const sufixoBase = cor
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 4)

        let sufixo = sufixoBase
        let tentativa = codigo + '-' + sufixo
        let contador = 2
        while (codigosUsados.has(tentativa)) {
          sufixo = sufixoBase.slice(0, 3) + contador
          tentativa = codigo + '-' + sufixo
          contador++
        }
        codigoUnico = tentativa
      }

      codigosUsados.add(codigoUnico)
      codigosUnicos.set(chave, codigoUnico)
    }

    const groups = new Map<string, string[]>()
    for (const codigoUnico of codigosUnicos.values()) {
      const prefix = getCodigoPrefixo(codigoUnico)
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix)!.push(codigoUnico)
    }

    const paiDeCodigo = new Map<string, string>()
    const isPai = new Set<string>()
    const isVariante = new Set<string>()

    for (const [_prefix, codigos] of groups) {
      if (codigos.length === 1) {
        isPai.add(codigos[0])
      } else {
        codigos.sort()
        const paiCodigo = codigos[0]
        isPai.add(paiCodigo)
        for (const variante of codigos.slice(1)) {
          isVariante.add(variante)
          paiDeCodigo.set(variante, paiCodigo)
        }
      }
    }

  console.log('[SYNC] Stage 2 OK - pais:', isPai.size, 'variantes:', isVariante.size)

  console.log('[SYNC] Stage 3: Preparing records...')
  // 1. DEFINIR registros primeiro
  const agora = new Date().toISOString()
  const codigosUsados = new Set<string>()
  
  const registros = Array.from(produtosMap.entries()).map(([chave, p]) => {
    const codigo = p.CodigoAmigavel ?? p.codigoAmigavel ?? ''
    const cor = p.CorWebPrincipal ?? p.corWebPrincipal ?? ''
    const nome = p.Nome ?? p.nome ?? codigo
    const precoStr = p.PrecoVenda ?? p.precoVenda ?? '0'
    const preco = parseFloat(precoStr) || 0
    const estoqueStr = p.QuantidadeDisponivel ?? p.quantidadeDisponivel ?? '0'
    const estoque = parseInt(estoqueStr) || 0
    const altura = parseFloat(p.Altura ?? p.altura ?? '0') || null
    const largura = parseFloat(p.Largura ?? p.largura ?? '0') || null
    const profundidade = parseFloat(p.Profundidade ?? p.profundidade ?? '0') || null
    const peso = parseFloat(p.Peso ?? p.peso ?? '0') || null
    const imageUrls = getImageUrls(p)
    const hasImage = imageUrls.length > 0 && !imageUrls[0].includes('placehold.co')

    // Gerar codigo_amigavel único garantindo sem colisão
    let codigoUnico = codigo
    if (cor) {
      const sufixoBase = cor
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 4)
      
      let sufixo = sufixoBase
      let tentativa = codigo + '-' + sufixo
      let contador = 2
      while (codigosUsados.has(tentativa)) {
        sufixo = sufixoBase.slice(0, 3) + contador
        tentativa = codigo + '-' + sufixo
        contador++
      }
      codigoUnico = tentativa
    }
    codigosUsados.add(codigoUnico)

    return {
      codigo_amigavel: codigoUnico,
      nome,
      slug: getSlug(nome, codigoUnico),
      categoria: getCategoria(nome),
      cor: cor || null,
      descricao: p.Descricao ?? p.descricao ?? null,
      preco_custo: preco,
      estoque,
      marca: p.Marca ?? p.marca ?? null,
      altura,
      largura,
      profundidade,
      peso,
      image_url: imageUrls[0] ?? null,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
      has_image: hasImage,
      busca: getBusca(p),
      site_link: p.SiteLink ?? p.siteLink ?? null,
      ultima_sync: agora,
      ativo: true,
    }
  })
  console.log('[SYNC] Stage 3 OK -', registros.length, 'registros preparados')

  console.log('[SYNC] Stage 3b: Removing old records without suffix...')
  // 2. REMOVER registros antigos sem sufixo que agora têm variações
  const prefixosComVariacao = new Set<string>()
  for (const r of registros) {
    const prefixo = getCodigoPrefixo(r.codigo_amigavel)
    if (prefixo !== r.codigo_amigavel) {
      prefixosComVariacao.add(prefixo)
    }
  }
  if (prefixosComVariacao.size > 0) {
    const { error: deleteError } = await supabaseClient
      .from('products_cache')
      .delete()
      .in('codigo_amigavel', Array.from(prefixosComVariacao))
    if (deleteError) {
      console.error('[SYNC] Stage 3b DELETE error:', deleteError)
    } else {
      console.log('[SYNC] Stage 3b OK - deleted', prefixosComVariacao.size, 'old records')
    }
  }

  console.log('[SYNC] Stage 3c: Upserting all products...')
  // 3. FAZER O UPSERT
  for (let i = 0; i < registros.length; i += CHUNK_SIZE) {
    const chunk = registros.slice(i, i + CHUNK_SIZE)
    const { error } = await supabaseClient
      .from('products_cache')
      .upsert(chunk, { onConflict: 'codigo_amigavel' })
    if (error) throw new Error('Upsert Stage 3c falhou: ' + JSON.stringify(error))
  }
  console.log('[SYNC] Stage 3c OK -', registros.length, 'produtos salvos')

    console.log('[SYNC] Stage 4: Setting produto_pai in batch...')
    const paiCodigos = Array.from(isPai)
    const idDeCodigo = new Map<string, string>()

    for (let i = 0; i < paiCodigos.length; i += CHUNK_SIZE) {
      const chunk = paiCodigos.slice(i, i + CHUNK_SIZE)
      const { data: rows, error } = await supabaseClient
        .from('products_cache')
        .select('id, codigo_amigavel')
        .in('codigo_amigavel', chunk)
      if (error) throw new Error('Fetch pais falhou: ' + JSON.stringify(error))
      for (const row of (rows ?? [])) {
        idDeCodigo.set(row.codigo_amigavel, row.id)
      }
    }

    const paisCodigos = Array.from(isPai)
    for (let i = 0; i < paisCodigos.length; i += CHUNK_SIZE) {
      const chunk = paisCodigos.slice(i, i + CHUNK_SIZE)
      await supabaseClient
        .from('products_cache')
        .update({ produto_pai: null, is_variante: false })
        .in('codigo_amigavel', chunk)
    }

    const variantePorPai = new Map<string, string[]>()
    for (const [variante, paiCodigo] of paiDeCodigo.entries()) {
      if (!variantePorPai.has(paiCodigo)) variantePorPai.set(paiCodigo, [])
      variantePorPai.get(paiCodigo)!.push(variante)
    }

    for (const [paiCodigo, variantesCodigos] of variantePorPai.entries()) {
      const paiId = idDeCodigo.get(paiCodigo)
      if (!paiId) continue
      await supabaseClient
        .from('products_cache')
        .update({ produto_pai: paiId, is_variante: true })
        .in('codigo_amigavel', variantesCodigos)
    }

    console.log('[SYNC] Stage 4 OK')

    const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabaseClient
      .from('products_cache')
      .update({ ativo: false })
      .lt('ultima_sync', limite)

    await supabaseClient.from('sync_log').insert({
      total_products: registros.length,
      status: useMock ? 'success-mock' : 'success',
    })

    console.log('[SYNC] DONE - total:', registros.length, useMock ? '(MOCK)' : '')

    return new Response(
      JSON.stringify({ success: true, total: registros.length, mock: useMock }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[SYNC] FATAL:', err)
    try {
      await createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      ).from('sync_log').insert({
        total_products: 0,
        status: 'error',
        erro: (err as Error).message,
      })
    } catch (_) { /* ignore */ }
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
