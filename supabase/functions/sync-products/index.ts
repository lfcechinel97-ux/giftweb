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
  if (codigo.includes('-')) return codigo
  const match = codigo.match(/^(.+?)([A-Z])$/)
  if (match && match[2].length === 1) {
    return match[1]
  }
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
    // === STAGE 1: Fetch from XBZ API ===
    console.log('[SYNC] Stage 1: Fetching from XBZ API...')
    const apiUrl = Deno.env.get('XBZ_API_URL')
    if (!apiUrl) throw new Error('XBZ_API_URL nao configurada')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    let response: Response
    try {
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeout)
    } catch (fetchErr) {
      clearTimeout(timeout)
      console.error('[SYNC] Stage 1 FAILED - fetch error:', fetchErr)
      throw new Error('Falha ao chamar API XBZ: ' + (fetchErr as Error).message)
    }

    if (!response.ok) {
      const body = await response.text()
      console.error('[SYNC] Stage 1 FAILED - status:', response.status, 'body:', body.slice(0, 500))
      throw new Error('API retornou status ' + response.status)
    }

    let data: any
    try {
      data = await response.json()
    } catch (jsonErr) {
      console.error('[SYNC] Stage 1 FAILED - JSON parse error:', jsonErr)
      throw new Error('Resposta da API nao e JSON valido')
    }

    const produtos = Array.isArray(data)
      ? data
      : data.produtos ?? data.data ?? []

    console.log('[SYNC] Stage 1 OK - produtos recebidos:', produtos.length)
    if (!produtos.length) throw new Error('API retornou lista vazia')

    // === STAGE 2: Map records ===
    console.log('[SYNC] Stage 2: Mapping records...')
    const agora = new Date().toISOString()

    let registros: any[]
    try {
      registros = produtos
        .map((p: any) => {
          const codigo = p.CodigoAmigavel ?? p.codigoAmigavel ?? ''
          const nome = p.Nome ?? p.nome ?? codigo
          const imageLink = p.ImageLink ?? p.imageLink ?? ''
          const imageUrls = getImageUrls(p)
          return {
            codigo_amigavel: codigo,
            slug: getSlug(nome, codigo),
            nome,
            descricao: p.Descricao ?? p.descricao ?? '',
            image_url: imageLink,
            image_urls: imageUrls,
            has_image: !!(imageLink && imageLink.trim() !== ''),
            site_link: p.SiteLink ?? p.siteLink ?? '',
            cor: p.CorWebPrincipal ?? p.corWebPrincipal ?? '',
            categoria: getCategoria(nome),
            marca: 'XBZ',
            preco_custo: parseFloat(p.PrecoVenda ?? p.precoVenda ?? 0),
            estoque: parseInt(p.QuantidadeDisponivel ?? p.quantidadeDisponivel ?? 0),
            peso: parseFloat(p.Peso ?? p.peso ?? 0) || null,
            altura: parseFloat(p.Altura ?? p.altura ?? 0) || null,
            largura: parseFloat(p.Largura ?? p.largura ?? 0) || null,
            profundidade: parseFloat(p.Profundidade ?? p.profundidade ?? 0) || null,
            ativo: true,
            busca: getBusca(p),
            updated_at: agora,
            ultima_sync: agora,
            is_variante: false,
            produto_pai: null,
          }
        })
        .filter((p: any) => p.codigo_amigavel !== '')
    } catch (mapErr) {
      console.error('[SYNC] Stage 2 FAILED - mapping error:', mapErr)
      throw new Error('Erro ao mapear registros: ' + (mapErr as Error).message)
    }

    const deduped = new Map<string, any>()
    for (const r of registros) {
      deduped.set(r.codigo_amigavel, r)
    }
    const registrosUnicos = Array.from(deduped.values())
    console.log('[SYNC] Stage 2 OK - registros unicos:', registrosUnicos.length)

    // === STAGE 3: Pass 1 - Upsert all products ===
    console.log('[SYNC] Stage 3: Pass 1 - Upserting', registrosUnicos.length, 'products...')
    try {
      for (let i = 0; i < registrosUnicos.length; i += CHUNK_SIZE) {
        const chunk = registrosUnicos.slice(i, i + CHUNK_SIZE)
        console.log('[SYNC] Stage 3: Upserting chunk', Math.floor(i / CHUNK_SIZE) + 1, 'size:', chunk.length)
        const { error } = await supabase
          .from('products_cache')
          .upsert(chunk, { onConflict: 'codigo_amigavel' })
        if (error) {
          console.error('[SYNC] Stage 3 FAILED - upsert error on chunk', Math.floor(i / CHUNK_SIZE) + 1, ':', JSON.stringify(error))
          throw error
        }
      }
    } catch (upsertErr) {
      console.error('[SYNC] Stage 3 FAILED:', upsertErr)
      throw new Error('Erro no upsert (Pass 1): ' + (upsertErr as Error).message)
    }
    console.log('[SYNC] Stage 3 OK - all products upserted')

    // === STAGE 4: Pass 2 - Group by prefix and set produto_pai ===
    console.log('[SYNC] Stage 4: Pass 2 - Grouping variants...')
    try {
      const groups = new Map<string, string[]>()
      for (const r of registrosUnicos) {
        const prefix = getCodigoPrefixo(r.codigo_amigavel)
        if (!groups.has(prefix)) groups.set(prefix, [])
        groups.get(prefix)!.push(r.codigo_amigavel)
      }

      const multiGroups = Array.from(groups.entries()).filter(([_, c]) => c.length > 1)
      const singleGroups = Array.from(groups.entries()).filter(([_, c]) => c.length === 1)
      console.log('[SYNC] Stage 4: groups total:', groups.size, 'multi:', multiGroups.length, 'single:', singleGroups.length)

      // Handle single products in bulk batches
      const singleCodigos = singleGroups.map(([_, c]) => c[0])
      for (let i = 0; i < singleCodigos.length; i += CHUNK_SIZE) {
        const chunk = singleCodigos.slice(i, i + CHUNK_SIZE)
        // For singles, set produto_pai = id (self-reference) via raw update
        // We need to fetch ids first
        const { data: rows, error: fetchErr } = await supabase
          .from('products_cache')
          .select('id, codigo_amigavel')
          .in('codigo_amigavel', chunk)
        if (fetchErr) {
          console.error('[SYNC] Stage 4 FAILED - fetch singles:', JSON.stringify(fetchErr))
          throw fetchErr
        }
        if (rows) {
          for (const row of rows) {
            await supabase
              .from('products_cache')
              .update({ produto_pai: row.id, is_variante: false })
              .eq('id', row.id)
          }
        }
      }
      console.log('[SYNC] Stage 4: singles done, processing', multiGroups.length, 'multi-groups...')

      // Handle multi-variant groups
      for (const [prefix, codigos] of multiGroups) {
        codigos.sort()
        const paiCodigo = codigos[0]

        const { data: paiRow, error: paiErr } = await supabase
          .from('products_cache')
          .select('id')
          .eq('codigo_amigavel', paiCodigo)
          .single()

        if (paiErr || !paiRow) {
          console.warn('[SYNC] Stage 4: could not find pai for prefix', prefix, 'codigo', paiCodigo)
          continue
        }

        const paiId = paiRow.id

        // Update parent
        await supabase
          .from('products_cache')
          .update({ produto_pai: paiId, is_variante: false })
          .eq('codigo_amigavel', paiCodigo)

        // Update variants
        const variantCodigos = codigos.slice(1)
        for (let i = 0; i < variantCodigos.length; i += CHUNK_SIZE) {
          const chunk = variantCodigos.slice(i, i + CHUNK_SIZE)
          await supabase
            .from('products_cache')
            .update({ produto_pai: paiId, is_variante: true })
            .in('codigo_amigavel', chunk)
        }
      }
    } catch (groupErr) {
      console.error('[SYNC] Stage 4 FAILED:', groupErr)
      throw new Error('Erro no agrupamento (Pass 2): ' + (groupErr as Error).message)
    }
    console.log('[SYNC] Stage 4 OK - all variants grouped')

    // === STAGE 5: Deactivate stale products ===
    console.log('[SYNC] Stage 5: Deactivating stale products...')
    const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('products_cache')
      .update({ ativo: false })
      .lt('ultima_sync', limite)

    // === STAGE 6: Log success ===
    await supabase.from('sync_log').insert({
      total_products: registrosUnicos.length,
      status: 'success',
    })

    console.log('[SYNC] DONE - success, total:', registrosUnicos.length)

    return new Response(
      JSON.stringify({ success: true, total: registrosUnicos.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SYNC] FATAL ERROR:', error)
    try {
      await supabase.from('sync_log').insert({
        total_products: 0,
        status: 'error',
        erro: (error as Error).message,
      })
    } catch (logErr) {
      console.error('[SYNC] Failed to log error to sync_log:', logErr)
    }
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
