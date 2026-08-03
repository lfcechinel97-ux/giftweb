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
          frete_tipo: string | null
          frete_valor: number
          id: string
          itens: Json
          numero: string
          observacoes: string | null
          origem_id: string | null
          pagamento_id: string | null
          prazo_entrega: number | null
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
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero: string
          observacoes?: string | null
          origem_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
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
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero?: string
          observacoes?: string | null
          origem_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
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
      sistema_pedidos: {
        Row: {
          cliente_id: string | null
          cliente_snapshot: Json | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          frete_tipo: string | null
          frete_valor: number
          id: string
          itens: Json
          numero: string
          observacoes: string | null
          orcamento_id: string | null
          pagamento_id: string | null
          prazo_entrega: number | null
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
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero: string
          observacoes?: string | null
          orcamento_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
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
          frete_tipo?: string | null
          frete_valor?: number
          id?: string
          itens?: Json
          numero?: string
          observacoes?: string | null
          orcamento_id?: string | null
          pagamento_id?: string | null
          prazo_entrega?: number | null
          status?: string
          subtotal?: number
          total?: number
          transportadora_id?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
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
          p_limit?: number
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
