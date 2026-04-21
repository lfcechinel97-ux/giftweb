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
