export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      appelation: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          label_id: string | null
          name: string
          region_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          label_id?: string | null
          name: string
          region_id?: string | null
        }
        Update: {
          created_at?: string | null
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
          created_at: string | null
          flag: string | null
          id: string
          iso_code: string
          name: string
        }
        Insert: {
          created_at?: string | null
          flag?: string | null
          id?: string
          iso_code: string
          name: string
        }
        Update: {
          created_at?: string | null
          flag?: string | null
          id?: string
          iso_code?: string
          name?: string
        }
        Relationships: []
      }
      grape: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      label: {
        Row: {
          country_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
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
      region: {
        Row: {
          country_id: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
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
      tasting: {
        Row: {
          created_at: string | null
          date: string
          id: string
          location: string | null
          name: string | null
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
        }
        Update: {
          created_at?: string | null
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
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
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
          wine_id: string
          year: number
        }
        Insert: {
          abv?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          organic?: boolean | null
          price?: number | null
          wine_id: string
          year: number
        }
        Update: {
          abv?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          organic?: boolean | null
          price?: number | null
          wine_id?: string
          year?: number
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
          city: string | null
          country_id: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          region_id: string | null
          url: string | null
        }
        Insert: {
          city?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          region_id?: string | null
          url?: string | null
        }
        Update: {
          city?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          region_id?: string | null
          url?: string | null
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
