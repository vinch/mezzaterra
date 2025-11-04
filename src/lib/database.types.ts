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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      administrator: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      appelation: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label_id: string | null
          name: string
          region_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label_id?: string | null
          name: string
          region_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label_id?: string | null
          name?: string
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appelations_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "label"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appelations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "region"
            referencedColumns: ["id"]
          },
        ]
      }
      country: {
        Row: {
          created_at: string
          flag: string
          id: string
          iso_code: string
          name: string
        }
        Insert: {
          created_at?: string
          flag: string
          id?: string
          iso_code: string
          name: string
        }
        Update: {
          created_at?: string
          flag?: string
          id?: string
          iso_code?: string
          name?: string
        }
        Relationships: []
      }
      customer: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_name: string | null
          country_id: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone_number: string | null
          vat: string | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_name?: string | null
          country_id?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone_number?: string | null
          vat?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_name?: string | null
          country_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone_number?: string | null
          vat?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
        ]
      }
      grape: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      label: {
        Row: {
          country_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
        ]
      }
      member: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      note: {
        Row: {
          content: string
          created_at: string
          id: string
          type: string
          wine_vintage_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          type: string
          wine_vintage_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          type?: string
          wine_vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wine_tasting_notes_wine_vintage_id_fkey"
            columns: ["wine_vintage_id"]
            isOneToOne: false
            referencedRelation: "wine_vintage"
            referencedColumns: ["id"]
          },
        ]
      }
      order: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          supplier_id: string
          transport_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          supplier_id: string
          transport_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          supplier_id?: string
          transport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transport_id_fkey"
            columns: ["transport_id"]
            isOneToOne: false
            referencedRelation: "transport"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          quantity: number
          wine_vintage_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          quantity: number
          wine_vintage_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          quantity?: number
          wine_vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_wine_vintage_id_fkey"
            columns: ["wine_vintage_id"]
            isOneToOne: false
            referencedRelation: "wine_vintage"
            referencedColumns: ["id"]
          },
        ]
      }
      pairing: {
        Row: {
          description: string
          id: string
        }
        Insert: {
          description: string
          id?: string
        }
        Update: {
          description?: string
          id?: string
        }
        Relationships: []
      }
      payment: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          method: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          id?: string
          method: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          method?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
        ]
      }
      region: {
        Row: {
          country_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
        ]
      }
      sale: {
        Row: {
          created_at: string
          customer_id: string
          date: string
          id: string
          invoice_number: string | null
          note: string | null
          status: string
          total_price: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          date: string
          id?: string
          invoice_number?: string | null
          note?: string | null
          status?: string
          total_price: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          date?: string
          id?: string
          invoice_number?: string | null
          note?: string | null
          status?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_item: {
        Row: {
          created_at: string
          discount: number | null
          discount_type: string | null
          id: string
          note: string | null
          price: number
          quantity: number
          sale_id: string
          wine_vintage_id: string
        }
        Insert: {
          created_at?: string
          discount?: number | null
          discount_type?: string | null
          id?: string
          note?: string | null
          price: number
          quantity: number
          sale_id: string
          wine_vintage_id: string
        }
        Update: {
          created_at?: string
          discount?: number | null
          discount_type?: string | null
          id?: string
          note?: string | null
          price?: number
          quantity?: number
          sale_id?: string
          wine_vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_wine_vintage_id_fkey"
            columns: ["wine_vintage_id"]
            isOneToOne: false
            referencedRelation: "wine_vintage"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_move: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          quantity: number
          reason: string
          wine_vintage_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          quantity: number
          reason: string
          wine_vintage_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          quantity?: number
          reason?: string
          wine_vintage_id?: string
        }
        Relationships: []
      }
      supplier: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone_number: string | null
          vat: string | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone_number?: string | null
          vat?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone_number?: string | null
          vat?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting: {
        Row: {
          created_at: string
          date: string
          id: string
          location: string | null
          name: string | null
          notes: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      tasting_wine_vintage: {
        Row: {
          order: number
          tasting_id: string
          wine_vintage_id: string
        }
        Insert: {
          order: number
          tasting_id: string
          wine_vintage_id: string
        }
        Update: {
          order?: number
          tasting_id?: string
          wine_vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tastings_wines_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tastings_wines_wine_vintage_id_fkey"
            columns: ["wine_vintage_id"]
            isOneToOne: false
            referencedRelation: "wine_vintage"
            referencedColumns: ["id"]
          },
        ]
      }
      transport: {
        Row: {
          arrival_date: string | null
          created_at: string
          departure_date: string | null
          id: string
          note: string | null
          pallets_number: number | null
          price: number | null
          status: string | null
          transporter_id: string
        }
        Insert: {
          arrival_date?: string | null
          created_at?: string
          departure_date?: string | null
          id?: string
          note?: string | null
          pallets_number?: number | null
          price?: number | null
          status?: string | null
          transporter_id: string
        }
        Update: {
          arrival_date?: string | null
          created_at?: string
          departure_date?: string | null
          id?: string
          note?: string | null
          pallets_number?: number | null
          price?: number | null
          status?: string | null
          transporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporter"
            referencedColumns: ["id"]
          },
        ]
      }
      transporter: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone_number: string | null
          vat: string | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone_number?: string | null
          vat?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone_number?: string | null
          vat?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transporter_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
        ]
      }
      wine: {
        Row: {
          appelation_id: string
          created_at: string
          description: string | null
          id: string
          name: string | null
          wine_type_id: string
          winery_id: string
        }
        Insert: {
          appelation_id: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          wine_type_id: string
          winery_id: string
        }
        Update: {
          appelation_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          wine_type_id?: string
          winery_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wines_appelation_id_fkey"
            columns: ["appelation_id"]
            isOneToOne: false
            referencedRelation: "appelation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wines_wine_type_id_fkey"
            columns: ["wine_type_id"]
            isOneToOne: false
            referencedRelation: "wine_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wines_winery_id_fkey"
            columns: ["winery_id"]
            isOneToOne: false
            referencedRelation: "winery"
            referencedColumns: ["id"]
          },
        ]
      }
      wine_pairing: {
        Row: {
          pairing_id: string
          wine_id: string
        }
        Insert: {
          pairing_id: string
          wine_id: string
        }
        Update: {
          pairing_id?: string
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wines_pairings_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wines_pairings_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wine"
            referencedColumns: ["id"]
          },
        ]
      }
      wine_type: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      wine_vintage: {
        Row: {
          abv: number | null
          created_at: string
          id: string
          image_url: string | null
          organic: boolean | null
          price: number | null
          production_year: number
          purchase_price: number
          wine_id: string
          year: number | null
        }
        Insert: {
          abv?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          organic?: boolean | null
          price?: number | null
          production_year: number
          purchase_price?: number
          wine_id: string
          year?: number | null
        }
        Update: {
          abv?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          organic?: boolean | null
          price?: number | null
          production_year?: number
          purchase_price?: number
          wine_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wine_vintages_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wine"
            referencedColumns: ["id"]
          },
        ]
      }
      wine_vintage_grape: {
        Row: {
          grape_id: string
          percentage: number | null
          wine_vintage_id: string
        }
        Insert: {
          grape_id: string
          percentage?: number | null
          wine_vintage_id: string
        }
        Update: {
          grape_id?: string
          percentage?: number | null
          wine_vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wines_grapes_grape_id_fkey"
            columns: ["grape_id"]
            isOneToOne: false
            referencedRelation: "grape"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wines_grapes_wine_vintage_id_fkey"
            columns: ["wine_vintage_id"]
            isOneToOne: false
            referencedRelation: "wine_vintage"
            referencedColumns: ["id"]
          },
        ]
      }
      winery: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_id: string | null
          created_at: string
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone_number: string | null
          region_id: string | null
          url: string | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone_number?: string | null
          region_id?: string | null
          url?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone_number?: string | null
          region_id?: string | null
          url?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wineries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wineries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "region"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory: {
        Row: {
          quantity_on_hand: number | null
          wine_vintage_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
