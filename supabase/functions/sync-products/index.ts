import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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
  return base + '-' + codigo.toLowerCase()
}

function getBusca(p: any): string {
  return [p.Nome ?? '', p.Descricao ?? '',
          p.CorWebPrincipal ?? '', p.CodigoAmigavel ?? '']
    .join(' ').toLowerCase()
}

function getImageUrls(p: any): string[] {
  const urls = [
    p.ImageLink, p.ImageLink2, p.ImageLink3, p.ImageLink4,
    p.imageLink, p.imageLink2, p.imageLink3, p.imageLink4
  ]
    .filter((url: any) => url && typeof url === 'string' && url.trim() !== '')
    .filter((url: string, index: number, self: string[]) => self.indexOf(url) === index)
    .slice(0, 4)
  return urls
}

function getCodigoPrefixo(codigo: string): string {
  const partes = codigo.split('-')
  if (partes.length > 1) return partes[0]
  return codigo
}

const CHUNK_SIZE = 500

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const apiUrl = Deno.env.get('XBZ_API_URL')
    if (!apiUrl) throw new Error(
      'XBZ_API_URL nao configurada nas variaveis de ambiente'
    )

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok)
      throw new Error('API retornou status ' + response.status)

    const data = await response.json()
    const produtos = Array.isArray(data)
      ? data
      : data.produtos ?? data.data ?? []

    if (!produtos.length)
      throw new Error('API retornou lista vazia')

    const agora = new Date().toISOString()

    const registros = produtos
      .map((p: any) => {
        const codigo = p.CodigoAmigavel ?? p.codigoAmigavel ?? ''
        const nome   = p.Nome ?? p.nome ?? codigo
        const imageLink = p.ImageLink ?? p.imageLink ?? ''
        const imageUrls = getImageUrls(p)
        return {
          codigo_amigavel: codigo,
          slug:        getSlug(nome, codigo),
          nome,
          descricao:   p.Descricao ?? p.descricao ?? '',
          image_url:   imageLink,
          image_urls:  imageUrls,
          has_image:   !!(imageLink && imageLink.trim() !== ''),
          site_link:   p.SiteLink ?? p.siteLink ?? '',
          cor:         p.CorWebPrincipal ?? p.corWebPrincipal ?? '',
          categoria:   getCategoria(nome),
          marca:       'XBZ',
          preco_custo: parseFloat(p.PrecoVenda ?? p.precoVenda ?? 0),
          estoque:     parseInt(
            p.QuantidadeDisponivel ?? p.quantidadeDisponivel ?? 0
          ),
          peso:        parseFloat(p.Peso ?? p.peso ?? 0) || null,
          altura:      parseFloat(p.Altura ?? p.altura ?? 0) || null,
          largura:     parseFloat(p.Largura ?? p.largura ?? 0) || null,
          profundidade: parseFloat(
            p.Profundidade ?? p.profundidade ?? 0
          ) || null,
          ativo:       true,
          busca:       getBusca(p),
          updated_at:  agora,
          ultima_sync: agora,
          // Pass 1: no grouping yet
          is_variante: false,
          produto_pai: null,
        }
      })
      .filter((p: any) => p.codigo_amigavel !== '')

    // Deduplicate by codigo_amigavel (keep last occurrence)
    const deduped = new Map<string, any>()
    for (const r of registros) {
      deduped.set(r.codigo_amigavel, r)
    }
    const registrosUnicos = Array.from(deduped.values())

    // === PASS 1: Upsert all products without produto_pai ===
    for (let i = 0; i < registrosUnicos.length; i += CHUNK_SIZE) {
      const chunk = registrosUnicos.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase
        .from('products_cache')
        .upsert(chunk, { onConflict: 'codigo_amigavel' })
      if (error) throw error
    }

    // === PASS 2: Group by prefix and set produto_pai ===
    // Group products by prefix
    const groups = new Map<string, string[]>()
    for (const r of registrosUnicos) {
      const prefix = getCodigoPrefixo(r.codigo_amigavel)
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix)!.push(r.codigo_amigavel)
    }

    for (const [_prefix, codigos] of groups) {
      codigos.sort() // alphabetical — first one becomes parent
      const paiCodigo = codigos[0]

      // Get pai id from DB
      const { data: paiRow } = await supabase
        .from('products_cache')
        .select('id')
        .eq('codigo_amigavel', paiCodigo)
        .single()

      if (!paiRow) continue

      const paiId = paiRow.id

      if (codigos.length === 1) {
        // Single product — self-reference
        await supabase
          .from('products_cache')
          .update({ produto_pai: paiId, is_variante: false })
          .eq('codigo_amigavel', paiCodigo)
      } else {
        // Parent
        await supabase
          .from('products_cache')
          .update({ produto_pai: paiId, is_variante: false })
          .eq('codigo_amigavel', paiCodigo)

        // Variants
        const variantCodigos = codigos.slice(1)
        for (let i = 0; i < variantCodigos.length; i += CHUNK_SIZE) {
          const chunk = variantCodigos.slice(i, i + CHUNK_SIZE)
          await supabase
            .from('products_cache')
            .update({ produto_pai: paiId, is_variante: true })
            .in('codigo_amigavel', chunk)
        }
      }
    }

    const limite = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString()
    await supabase
      .from('products_cache')
      .update({ ativo: false })
      .lt('ultima_sync', limite)

    await supabase.from('sync_log').insert({
      total_products: registrosUnicos.length,
      status: 'success',
    })

    return new Response(
      JSON.stringify({ success: true, total: registrosUnicos.length }),
      { headers: { ...corsHeaders,
          'Content-Type': 'application/json' } }
    )

  } catch (error) {
    await supabase.from('sync_log').insert({
      total_products: 0,
      status: 'error',
      erro: error.message,
    })
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders,
          'Content-Type': 'application/json' } }
    )
  }
})
