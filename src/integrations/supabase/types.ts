export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      homepage_featured_showcase: {
        Row: {
          badge_text: string | null
          created_at: string | null
          id: number
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          position: number
          price_text: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          badge_text?: string | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          position?: number
          price_text?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          badge_text?: string | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          position?: number
          price_text?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string | null
          email: string
          empresa: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          empresa?: string | null
          id?: string
          nome?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          empresa?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      product_collection_items: {
        Row: {
          codigo_prefixo: string
          collection_id: string
          created_at: string
          id: string
          ordem: number
        }
        Insert: {
          codigo_prefixo: string
          collection_id: string
          created_at?: string
          id?: string
          ordem?: number
        }
        Update: {
          codigo_prefixo?: string
          collection_id?: string
          created_at?: string
          id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "product_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          ativo: boolean
          cor_destaque: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          slug: string
          titulo_destaque: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor_destaque?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          slug: string
          titulo_destaque?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor_destaque?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          titulo_destaque?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_spotlight_categories: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          position: number | null
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          position?: number | null
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          position?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_spotlight_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "spotlight_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_spotlight_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      products_cache: {
        Row: {
          altura: number | null
          ativo: boolean | null
          busca: string | null
          categoria: string | null
          categoria_manual: string | null
          codigo_amigavel: string
          codigo_prefixo: string | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          estoque: number | null
          estoque_total: number | null
          featured_position: number | null
          has_image: boolean | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_featured: boolean | null
          is_hidden: boolean | null
          is_variante: boolean | null
          largura: number | null
          marca: string | null
          nome: string
          peso: number | null
          preco_custo: number | null
          preco_custo_manual: boolean
          produto_pai: string | null
          profundidade: number | null
          site_link: string | null
          slug: string | null
          sort_estoque: number | null
          tabela_precos: Json | null
          ultima_sync: string | null
          updated_at: string | null
          variantes: Json | null
          variantes_count: number | null
        }
        Insert: {
          altura?: number | null
          ativo?: boolean | null
          busca?: string | null
          categoria?: string | null
          categoria_manual?: string | null
          codigo_amigavel: string
          codigo_prefixo?: string | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque?: number | null
          estoque_total?: number | null
          featured_position?: number | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          is_variante?: boolean | null
          largura?: number | null
          marca?: string | null
          nome: string
          peso?: number | null
          preco_custo?: number | null
          preco_custo_manual?: boolean
          produto_pai?: string | null
          profundidade?: number | null
          site_link?: string | null
          slug?: string | null
          sort_estoque?: number | null
          tabela_precos?: Json | null
          ultima_sync?: string | null
          updated_at?: string | null
          variantes?: Json | null
          variantes_count?: number | null
        }
        Update: {
          altura?: number | null
          ativo?: boolean | null
          busca?: string | null
          categoria?: string | null
          categoria_manual?: string | null
          codigo_amigavel?: string
          codigo_prefixo?: string | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque?: number | null
          estoque_total?: number | null
          featured_position?: number | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          is_variante?: boolean | null
          largura?: number | null
          marca?: string | null
          nome?: string
          peso?: number | null
          preco_custo?: number | null
          preco_custo_manual?: boolean
          produto_pai?: string | null
          profundidade?: number | null
          site_link?: string | null
          slug?: string | null
          sort_estoque?: number | null
          tabela_precos?: Json | null
          ultima_sync?: string | null
          updated_at?: string | null
          variantes?: Json | null
          variantes_count?: number | null
        }
        Relationships: []
      }
      sistema_ajustes_estoque: {
        Row: {
          codigo_composto: string | null
          created_at: string
          created_by: string | null
          id: string
          motivo: string | null
          orcamento_id: string | null
          pedido_id: string | null
          produto_id: string | null
          quantidade: number
          tipo: string
          variante_slug: string | null
        }
        Insert: {
          codigo_composto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          produto_id?: string | null
          quantidade: number
          tipo: string
          variante_slug?: string | null
        }
        Update: {
          codigo_composto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          produto_id?: string | null
          quantidade?: number
          tipo?: string
          variante_slug?: string | null
        }
        Relationships: []
      }
      sistema_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          entidade: string
          entidade_id: string | null
          entidade_numero: string | null
          id: string
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          entidade: string
          entidade_id?: string | null
          entidade_numero?: string | null
          id?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          entidade?: string
          entidade_id?: string | null
          entidade_numero?: string | null
          id?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      sistema_clientes: {
        Row: {
          contatos: Json
          created_at: string
          documento: string
          enderecos: Json
          id: string
          ie: string | null
          nome: string
          observacoes: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          contatos?: Json
          created_at?: string
          documento: string
          enderecos?: Json
          id?: string
          ie?: string | null
          nome: string
          observacoes?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          contatos?: Json
          created_at?: string
          documento?: string
          enderecos?: Json
          id?: string
          ie?: string | null
          nome?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      sistema_config: {
        Row: {
          chave: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      sistema_cotacoes_frete: {
        Row: {
          cotado_em: string
          cotado_por: string | null
          escolhida: boolean
          id: string
          link_cotacao: string | null
          observacoes: string | null
          orcamento_id: string | null
          pedido_id: string | null
          prazo_dias: number | null
          print_url: string | null
          transportadora_id: string | null
          transportadora_nome: string | null
          valido_ate: string | null
          valor: number
        }
        Insert: {
          cotado_em?: string
          cotado_por?: string | null
          escolhida?: boolean
          id?: string
          link_cotacao?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          prazo_dias?: number | null
          print_url?: string | null
          transportadora_id?: string | null
          transportadora_nome?: string | null
          valido_ate?: string | null
          valor: number
        }
        Update: {
          cotado_em?: string
          cotado_por?: string | null
          escolhida?: boolean
          id?: string
          link_cotacao?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          prazo_dias?: number | null
          print_url?: string | null
          transportadora_id?: string | null
          transportadora_nome?: string | null
          valido_ate?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sistema_cotacoes_frete_cotado_por_fkey"
            columns: ["cotado_por"]
            isOneToOne: false
            referencedRelation: "sistema_vendedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_cotacoes_frete_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "sistema_orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_cotacoes_frete_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "sistema_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_cotacoes_frete_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pcp"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "sistema_cotacoes_frete_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "sistema_transportadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_fornecedores: {
        Row: {
          ativo: boolean
          cidade: string | null
          contato: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          prazo_padrao_dias: number | null
          telefone: string | null
          tipo: string
          uf: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          prazo_padrao_dias?: number | null
          telefone?: string | null
          tipo?: string
          uf?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          prazo_padrao_dias?: number | null
          telefone?: string | null
          tipo?: string
          uf?: string | null
        }
        Relationships: []
      }
      sistema_item_historico: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          pedido_item_id: string
          status_anterior:
            | Database["public"]["Enums"]["status_item_producao"]
            | null
          status_novo: Database["public"]["Enums"]["status_item_producao"]
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          pedido_item_id: string
          status_anterior?:
            | Database["public"]["Enums"]["status_item_producao"]
            | null
          status_novo: Database["public"]["Enums"]["status_item_producao"]
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          pedido_item_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["status_item_producao"]
            | null
          status_novo?: Database["public"]["Enums"]["status_item_producao"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sistema_item_historico_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "sistema_pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_item_historico_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "vw_fora_de_casa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_item_historico_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "vw_pendentes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_meios_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          meta: Json | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      sistema_orcamentos: {
        Row: {
          anexo_url: string | null
          aprovado_em: string | null
          cliente_id: string | null
          cliente_snapshot: Json | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          data_despachar_ate: string | null
          data_produzir_ate: string | null
          frete_tipo: string | null
          frete_valor: number
          id: string
          itens: Json
          numero: string
          observacoes: string | null
          origem_id: string | null
          pagamento_id: string | null
          prazo_entrega: number | null
          prazo_producao_dias: number
          status: string
          subtotal: number
          transportadora_id: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          anexo_url?: string | null
          aprovado_em?: string | null
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          data_despachar_ate?: string | null
          data_produzir_ate?: string | null
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero: string
          observacoes?: string | null
          origem_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
          prazo_producao_dias?: number
          status?: string
          subtotal?: number
          transportadora_id?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          anexo_url?: string | null
          aprovado_em?: string | null
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          data_despachar_ate?: string | null
          data_produzir_ate?: string | null
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero?: string
          observacoes?: string | null
          origem_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
          prazo_producao_dias?: number
          status?: string
          subtotal?: number
          transportadora_id?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: []
      }
      sistema_origens: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          meta: Json | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      sistema_pedido_itens: {
        Row: {
          arte_aprovada_em: string | null
          codigo_composto: string | null
          compra_confirmada_em: string | null
          created_at: string
          data_entrega_item: string | null
          descricao_personalizacao: string | null
          enviado_terceiro_em: string | null
          fornecedor_compra_id: string | null
          id: string
          imagem_catalogo_url: string | null
          local_producao: Database["public"]["Enums"]["local_producao_tipo"]
          mockup_url: string | null
          nome: string
          nota_fiscal_compra: string | null
          observacoes: string | null
          ordem: number
          origem_estoque: string
          pedido_id: string
          previsao_retorno: string | null
          produto_cache_id: string | null
          produto_custom_id: string | null
          qtd_enviada: number | null
          qtd_retornada: number | null
          quantidade: number
          retornado_terceiro_em: string | null
          status: Database["public"]["Enums"]["status_item_producao"]
          tecnica_id: string | null
          terceirizada_id: string | null
          updated_at: string
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          arte_aprovada_em?: string | null
          codigo_composto?: string | null
          compra_confirmada_em?: string | null
          created_at?: string
          data_entrega_item?: string | null
          descricao_personalizacao?: string | null
          enviado_terceiro_em?: string | null
          fornecedor_compra_id?: string | null
          id?: string
          imagem_catalogo_url?: string | null
          local_producao?: Database["public"]["Enums"]["local_producao_tipo"]
          mockup_url?: string | null
          nome: string
          nota_fiscal_compra?: string | null
          observacoes?: string | null
          ordem?: number
          origem_estoque?: string
          pedido_id: string
          previsao_retorno?: string | null
          produto_cache_id?: string | null
          produto_custom_id?: string | null
          qtd_enviada?: number | null
          qtd_retornada?: number | null
          quantidade: number
          retornado_terceiro_em?: string | null
          status?: Database["public"]["Enums"]["status_item_producao"]
          tecnica_id?: string | null
          terceirizada_id?: string | null
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          arte_aprovada_em?: string | null
          codigo_composto?: string | null
          compra_confirmada_em?: string | null
          created_at?: string
          data_entrega_item?: string | null
          descricao_personalizacao?: string | null
          enviado_terceiro_em?: string | null
          fornecedor_compra_id?: string | null
          id?: string
          imagem_catalogo_url?: string | null
          local_producao?: Database["public"]["Enums"]["local_producao_tipo"]
          mockup_url?: string | null
          nome?: string
          nota_fiscal_compra?: string | null
          observacoes?: string | null
          ordem?: number
          origem_estoque?: string
          pedido_id?: string
          previsao_retorno?: string | null
          produto_cache_id?: string | null
          produto_custom_id?: string | null
          qtd_enviada?: number | null
          qtd_retornada?: number | null
          quantidade?: number
          retornado_terceiro_em?: string | null
          status?: Database["public"]["Enums"]["status_item_producao"]
          tecnica_id?: string | null
          terceirizada_id?: string | null
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "sistema_pedido_itens_fornecedor_compra_id_fkey"
            columns: ["fornecedor_compra_id"]
            isOneToOne: false
            referencedRelation: "sistema_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "sistema_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pcp"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "sistema_pedido_itens_produto_cache_id_fkey"
            columns: ["produto_cache_id"]
            isOneToOne: false
            referencedRelation: "products_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_pedido_itens_produto_custom_id_fkey"
            columns: ["produto_custom_id"]
            isOneToOne: false
            referencedRelation: "sistema_produtos_custom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_pedido_itens_tecnica_id_fkey"
            columns: ["tecnica_id"]
            isOneToOne: false
            referencedRelation: "sistema_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_pedido_itens_terceirizada_id_fkey"
            columns: ["terceirizada_id"]
            isOneToOne: false
            referencedRelation: "sistema_fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_pedidos: {
        Row: {
          cliente_id: string | null
          cliente_snapshot: Json | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          data_despachar_ate: string | null
          data_produzir_ate: string | null
          frete_tipo: string | null
          frete_valor: number
          id: string
          itens: Json
          numero: string
          observacoes: string | null
          orcamento_id: string | null
          pagamento_id: string | null
          prazo_entrega: number | null
          prazo_producao_dias: number
          status: string
          subtotal: number
          total: number
          transportadora_id: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          data_despachar_ate?: string | null
          data_produzir_ate?: string | null
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero: string
          observacoes?: string | null
          orcamento_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
          prazo_producao_dias?: number
          status?: string
          subtotal?: number
          total?: number
          transportadora_id?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          data_despachar_ate?: string | null
          data_produzir_ate?: string | null
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero?: string
          observacoes?: string | null
          orcamento_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
          prazo_producao_dias?: number
          status?: string
          subtotal?: number
          total?: number
          transportadora_id?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: []
      }
      sistema_producao_comentarios: {
        Row: {
          autor_email: string | null
          autor_id: string | null
          created_at: string
          id: string
          mensagem: string
          pedido_id: string | null
          producao_item_id: string
        }
        Insert: {
          autor_email?: string | null
          autor_id?: string | null
          created_at?: string
          id?: string
          mensagem: string
          pedido_id?: string | null
          producao_item_id: string
        }
        Update: {
          autor_email?: string | null
          autor_id?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          pedido_id?: string | null
          producao_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sistema_producao_comentarios_producao_item_id_fkey"
            columns: ["producao_item_id"]
            isOneToOne: false
            referencedRelation: "sistema_producao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_producao_comentarios_producao_item_id_fkey"
            columns: ["producao_item_id"]
            isOneToOne: false
            referencedRelation: "vw_pcp"
            referencedColumns: ["producao_id"]
          },
        ]
      }
      sistema_producao_historico: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          producao_item_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          producao_item_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          producao_item_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sistema_producao_historico_producao_item_id_fkey"
            columns: ["producao_item_id"]
            isOneToOne: false
            referencedRelation: "sistema_producao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_producao_historico_producao_item_id_fkey"
            columns: ["producao_item_id"]
            isOneToOne: false
            referencedRelation: "vw_pcp"
            referencedColumns: ["producao_id"]
          },
        ]
      }
      sistema_producao_itens: {
        Row: {
          arte_aprovada_em: string | null
          coleta_solicitada_em: string | null
          compra_confirmada_em: string | null
          created_at: string
          data_entrega_item: string | null
          descricao_personalizacao: string | null
          enviado_terceiro_em: string | null
          etiqueta_ok: boolean
          fornecedor_compra_id: string | null
          id: string
          item_id: string
          local_producao: string
          medidas_ok: boolean
          nota_fiscal_compra: string | null
          observacoes: string | null
          origem_estoque: string
          pagamento_cartao_conferido_em: string | null
          pagamento_ok: boolean
          pedido_id: string
          pix_recebido_integral_em: string | null
          previsao_retorno: string | null
          qtd_enviada: number | null
          qtd_retornada: number | null
          retornado_terceiro_em: string | null
          status: string
          tags: string[]
          tecnica_id: string | null
          terceirizada_id: string | null
          updated_at: string
        }
        Insert: {
          arte_aprovada_em?: string | null
          coleta_solicitada_em?: string | null
          compra_confirmada_em?: string | null
          created_at?: string
          data_entrega_item?: string | null
          descricao_personalizacao?: string | null
          enviado_terceiro_em?: string | null
          etiqueta_ok?: boolean
          fornecedor_compra_id?: string | null
          id?: string
          item_id: string
          local_producao?: string
          medidas_ok?: boolean
          nota_fiscal_compra?: string | null
          observacoes?: string | null
          origem_estoque?: string
          pagamento_cartao_conferido_em?: string | null
          pagamento_ok?: boolean
          pedido_id: string
          pix_recebido_integral_em?: string | null
          previsao_retorno?: string | null
          qtd_enviada?: number | null
          qtd_retornada?: number | null
          retornado_terceiro_em?: string | null
          status?: string
          tags?: string[]
          tecnica_id?: string | null
          terceirizada_id?: string | null
          updated_at?: string
        }
        Update: {
          arte_aprovada_em?: string | null
          coleta_solicitada_em?: string | null
          compra_confirmada_em?: string | null
          created_at?: string
          data_entrega_item?: string | null
          descricao_personalizacao?: string | null
          enviado_terceiro_em?: string | null
          etiqueta_ok?: boolean
          fornecedor_compra_id?: string | null
          id?: string
          item_id?: string
          local_producao?: string
          medidas_ok?: boolean
          nota_fiscal_compra?: string | null
          observacoes?: string | null
          origem_estoque?: string
          pagamento_cartao_conferido_em?: string | null
          pagamento_ok?: boolean
          pedido_id?: string
          pix_recebido_integral_em?: string | null
          previsao_retorno?: string | null
          qtd_enviada?: number | null
          qtd_retornada?: number | null
          retornado_terceiro_em?: string | null
          status?: string
          tags?: string[]
          tecnica_id?: string | null
          terceirizada_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sistema_producao_itens_fornecedor_compra_id_fkey"
            columns: ["fornecedor_compra_id"]
            isOneToOne: false
            referencedRelation: "sistema_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_producao_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "sistema_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_producao_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pcp"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "sistema_producao_itens_tecnica_id_fkey"
            columns: ["tecnica_id"]
            isOneToOne: false
            referencedRelation: "sistema_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_producao_itens_terceirizada_id_fkey"
            columns: ["terceirizada_id"]
            isOneToOne: false
            referencedRelation: "sistema_fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_produtos_custom: {
        Row: {
          categoria: string | null
          codigo: string
          cor: string | null
          created_at: string
          created_by: string | null
          estoque: number
          id: string
          image_url: string | null
          nome: string
          observacoes: string | null
          parent_id: string | null
          preco_custo: number
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
          estoque?: number
          id?: string
          image_url?: string | null
          nome: string
          observacoes?: string | null
          parent_id?: string | null
          preco_custo?: number
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo?: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
          estoque?: number
          id?: string
          image_url?: string | null
          nome?: string
          observacoes?: string | null
          parent_id?: string | null
          preco_custo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sistema_produtos_custom_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sistema_produtos_custom"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_tecnicas: {
        Row: {
          ativo: boolean
          id: string
          local_padrao: string
          nome: string
          prazo_padrao_dias: number
        }
        Insert: {
          ativo?: boolean
          id?: string
          local_padrao?: string
          nome: string
          prazo_padrao_dias?: number
        }
        Update: {
          ativo?: boolean
          id?: string
          local_padrao?: string
          nome?: string
          prazo_padrao_dias?: number
        }
        Relationships: []
      }
      sistema_transportadoras: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          meta: Json | null
          nome: string
          prazo_entrega: number | null
          tipo_frete: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome: string
          prazo_entrega?: number | null
          tipo_frete?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome?: string
          prazo_entrega?: number | null
          tipo_frete?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sistema_vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          meta: Json | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta?: Json | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          height_desk: number | null
          height_mob: number | null
          id: string
          label: string | null
          section: string | null
          type: string
          updated_at: string | null
          value: string | null
          width_desk: number | null
          width_mob: number | null
        }
        Insert: {
          height_desk?: number | null
          height_mob?: number | null
          id: string
          label?: string | null
          section?: string | null
          type?: string
          updated_at?: string | null
          value?: string | null
          width_desk?: number | null
          width_mob?: number | null
        }
        Update: {
          height_desk?: number | null
          height_mob?: number | null
          id?: string
          label?: string | null
          section?: string | null
          type?: string
          updated_at?: string | null
          value?: string | null
          width_desk?: number | null
          width_mob?: number | null
        }
        Relationships: []
      }
      spotlight_categories: {
        Row: {
          active: boolean
          category_type: string
          created_at: string | null
          description: string | null
          id: string
          label: string
          position: number
          slug: string
          tabela_multiplicadores: Json | null
        }
        Insert: {
          active?: boolean
          category_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          position?: number
          slug: string
          tabela_multiplicadores?: Json | null
        }
        Update: {
          active?: boolean
          category_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          position?: number
          slug?: string
          tabela_multiplicadores?: Json | null
        }
        Relationships: []
      }
      spotlight_products: {
        Row: {
          category_slug: string
          created_at: string | null
          id: number
          position: number | null
          product_id: string
        }
        Insert: {
          category_slug: string
          created_at?: string | null
          id?: number
          position?: number | null
          product_id: string
        }
        Update: {
          category_slug?: string
          created_at?: string | null
          id?: number
          position?: number | null
          product_id?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          erro: string | null
          id: string
          status: string | null
          synced_at: string | null
          total_products: number | null
        }
        Insert: {
          erro?: string | null
          id?: string
          status?: string | null
          synced_at?: string | null
          total_products?: number | null
        }
        Update: {
          erro?: string | null
          id?: string
          status?: string | null
          synced_at?: string | null
          total_products?: number | null
        }
        Relationships: []
      }
      top10_xbz_ajustes: {
        Row: {
          ativo: boolean
          codigo_prefixo: string
          ordem_override: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_prefixo: string
          ordem_override?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_prefixo?: string
          ordem_override?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      topprodutos_categorias_meta: {
        Row: {
          created_at: string
          eyebrow: string | null
          imagem_capa: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eyebrow?: string | null
          imagem_capa?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eyebrow?: string | null
          imagem_capa?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      topprodutos_curadoria: {
        Row: {
          ativo: boolean
          categoria: string
          cores: Json
          created_at: string
          descricao_curta: string | null
          descricao_longa: string | null
          destaque: string
          galeria: Json
          id: string
          imagem_editorial: string | null
          imagem_hover: string | null
          imagem_principal: string | null
          mais_vendido: boolean
          moq: number
          nome: string
          ordem: number
          preco_exibicao: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          cores?: Json
          created_at?: string
          descricao_curta?: string | null
          descricao_longa?: string | null
          destaque?: string
          galeria?: Json
          id?: string
          imagem_editorial?: string | null
          imagem_hover?: string | null
          imagem_principal?: string | null
          mais_vendido?: boolean
          moq?: number
          nome: string
          ordem?: number
          preco_exibicao?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          cores?: Json
          created_at?: string
          descricao_curta?: string | null
          descricao_longa?: string | null
          destaque?: string
          galeria?: Json
          id?: string
          imagem_editorial?: string | null
          imagem_hover?: string | null
          imagem_principal?: string | null
          mais_vendido?: boolean
          moq?: number
          nome?: string
          ordem?: number
          preco_exibicao?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_fora_de_casa: {
        Row: {
          alerta: string | null
          cliente: string | null
          data_entrega_item: string | null
          dias_fora: number | null
          enviado_em: string | null
          id: string | null
          imagem_catalogo_url: string | null
          mockup_url: string | null
          pedido: string | null
          previsao_retorno: string | null
          produto: string | null
          qtd_enviada: number | null
          quantidade: number | null
          tecnica: string | null
          terceirizada: string | null
          terceirizada_telefone: string | null
        }
        Relationships: []
      }
      vw_pcp: {
        Row: {
          cliente: string | null
          coleta_solicitada_em: string | null
          compra_confirmada_em: string | null
          data_entrega_item: string | null
          enviado_terceiro_em: string | null
          etapa_desde: string | null
          etiqueta_ok: boolean | null
          fornecedor_compra_id: string | null
          horas_na_etapa: number | null
          imagem_catalogo_url: string | null
          item_observacao: string | null
          itens_enviados_pedido: number | null
          local_producao: string | null
          medidas_ok: boolean | null
          mockup_url: string | null
          origem_estoque: string | null
          pagamento_cartao_conferido_em: string | null
          pagamento_nome: string | null
          pagamento_ok: boolean | null
          pedido_cor: string | null
          pedido_id: string | null
          pedido_numero: string | null
          pedido_observacoes: string | null
          pedido_total: number | null
          pix_recebido_integral_em: string | null
          previsao_retorno: string | null
          producao_id: string | null
          produto_nome: string | null
          qtd_enviada: number | null
          qtd_retornada: number | null
          quantidade: number | null
          status: string | null
          tags: string[] | null
          tecnica_id: string | null
          tecnica_nome: string | null
          terceirizada_id: string | null
          terceirizada_nome: string | null
          terceirizada_telefone: string | null
          total_itens_pedido: number | null
          valor_unitario: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sistema_producao_itens_fornecedor_compra_id_fkey"
            columns: ["fornecedor_compra_id"]
            isOneToOne: false
            referencedRelation: "sistema_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_producao_itens_tecnica_id_fkey"
            columns: ["tecnica_id"]
            isOneToOne: false
            referencedRelation: "sistema_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_producao_itens_terceirizada_id_fkey"
            columns: ["terceirizada_id"]
            isOneToOne: false
            referencedRelation: "sistema_fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_pendentes_compra: {
        Row: {
          cliente: string | null
          created_at: string | null
          data_entrega_item: string | null
          fornecedor: string | null
          id: string | null
          pedido: string | null
          produto: string | null
          quantidade: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_search_products: {
        Args: {
          p_category_slug?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_set_product_visibility: {
        Args: { p_hidden: boolean; p_product_id: string }
        Returns: undefined
      }
      calc_display_price: { Args: { p_preco_custo: number }; Returns: number }
      get_catalog_filter_colors: { Args: never; Returns: string[] }
      get_catalog_story_categories: {
        Args: never
        Returns: {
          category_position: number
          image_url: string
          label: string
          slug: string
        }[]
      }
      get_category_colors: {
        Args: { p_category_slug: string }
        Returns: string[]
      }
      get_category_cost_distribution: {
        Args: { p_category_id: string }
        Returns: {
          bucket: string
          max_val: number
          min_val: number
          total: number
        }[]
      }
      get_category_product_counts: {
        Args: never
        Returns: {
          category_id: string
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: never; Returns: boolean }
      recalc_estoque_total: { Args: { p_id: string }; Returns: undefined }
      search_products_by_category:
        | {
            Args: {
              p_apenas_estoque?: boolean
              p_category_slug: string
              p_cor?: string[]
              p_page?: number
              p_page_size?: number
              p_search?: string
              p_sort?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_apenas_estoque?: boolean
              p_category_slug: string
              p_cor?: string[]
              p_page?: number
              p_page_size?: number
              p_preco_max?: number
              p_preco_min?: number
              p_search?: string
              p_sort?: string
            }
            Returns: Json
          }
      search_products_by_collection: {
        Args: {
          p_apenas_estoque?: boolean
          p_collection_slug: string
          p_cor?: string[]
          p_page?: number
          p_page_size?: number
          p_preco_max?: number
          p_preco_min?: number
          p_search?: string
          p_sort?: string
        }
        Returns: Json
      }
      search_products_global:
        | {
            Args: {
              p_apenas_estoque?: boolean
              p_cor?: string[]
              p_page?: number
              p_page_size?: number
              p_search?: string
              p_sort?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_apenas_estoque?: boolean
              p_cor?: string[]
              p_page?: number
              p_page_size?: number
              p_preco_max?: number
              p_preco_min?: number
              p_search?: string
              p_sort?: string
            }
            Returns: Json
          }
      set_variantes_por_prefixo: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sistema_cor_pedido: { Args: { p_numero: string }; Returns: string }
      sistema_get_bootstrap: { Args: never; Returns: Json }
      sistema_get_custom_product_variants: {
        Args: { p_parent_id: string }
        Returns: Json
      }
      sistema_get_orcamento: { Args: { p_id: string }; Returns: Json }
      sistema_get_product_group: { Args: { p_codigo: string }; Returns: Json }
      sistema_list_custom_products: { Args: never; Returns: Json }
      sistema_list_orcamentos: {
        Args: {
          p_cliente?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_limit?: number
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
          p_vendedor_id?: string
        }
        Returns: Json
      }
      sistema_next_orcamento_numero: { Args: never; Returns: string }
      sistema_next_pedido_numero: { Args: never; Returns: string }
      sistema_search_products: {
        Args: { p_page?: number; p_page_size?: number; p_search?: string }
        Returns: Json
      }
      sistema_verificar_senha_exclusao: {
        Args: { p_senha: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "producao"
      local_producao_tipo:
        | "interna"
        | "terceirizada"
        | "fornecedor_para_terceirizada"
      status_item_producao:
        | "aguardando_arte"
        | "aguardando_compra"
        | "fila_producao"
        | "em_producao"
        | "enviado_terceiro"
        | "retornou_terceiro"
        | "conferencia"
        | "pronto"
        | "expedido"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor", "producao"],
      local_producao_tipo: [
        "interna",
        "terceirizada",
        "fornecedor_para_terceirizada",
      ],
      status_item_producao: [
        "aguardando_arte",
        "aguardando_compra",
        "fila_producao",
        "em_producao",
        "enviado_terceiro",
        "retornou_terceiro",
        "conferencia",
        "pronto",
        "expedido",
      ],
    },
  },
} as const
