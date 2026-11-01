export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      appellation: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          label_id: string | null
          name: string
          region_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          label_id?: string | null
          name: string
          region_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          label_id?: string | null
          name?: string
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appellation_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "label"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appellation_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "region"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_message: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string | null
          message: string
          page: string | null
          phone: string | null
          reason: string
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name?: string | null
          message: string
          page?: string | null
          phone?: string | null
          reason: string
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
          message?: string
          page?: string | null
          phone?: string | null
          reason?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
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
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
      email_subscriber: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
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
      live_preorder: {
        Row: {
          email: string | null
          first_name: string | null
          guest_id: string
          items: Json
          last_name: string | null
          phone: string | null
          tasting_id: string
          updated_at: string
        }
        Insert: {
          email?: string | null
          first_name?: string | null
          guest_id: string
          items: Json
          last_name?: string | null
          phone?: string | null
          tasting_id: string
          updated_at?: string
        }
        Update: {
          email?: string | null
          first_name?: string | null
          guest_id?: string
          items?: Json
          last_name?: string | null
          phone?: string | null
          tasting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_preorder_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
            referencedColumns: ["id"]
          },
        ]
      }
      lot: {
        Row: {
          abv: number | null
          created_at: string
          discontinued_at: string | null
          id: string
          image_url: string | null
          organic: boolean | null
          price: number | null
          product_id: string
          production_year: number
          purchase_price: number
          volume_ml: number
          year: number | null
        }
        Insert: {
          abv?: number | null
          created_at?: string
          discontinued_at?: string | null
          id?: string
          image_url?: string | null
          organic?: boolean | null
          price?: number | null
          product_id: string
          production_year: number
          purchase_price?: number
          volume_ml?: number
          year?: number | null
        }
        Update: {
          abv?: number | null
          created_at?: string
          discontinued_at?: string | null
          id?: string
          image_url?: string | null
          organic?: boolean | null
          price?: number | null
          product_id?: string
          production_year?: number
          purchase_price?: number
          volume_ml?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lot_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_variety: {
        Row: {
          lot_id: string
          percentage: number | null
          variety_id: string
        }
        Insert: {
          lot_id: string
          percentage?: number | null
          variety_id: string
        }
        Update: {
          lot_id?: string
          percentage?: number | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_variety_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_variety_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "variety"
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
          lot_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lot_id: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lot_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot"
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
          status: string
          supplier_id: string
          total_price: number
          transport_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          status: string
          supplier_id: string
          total_price: number
          transport_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          status?: string
          supplier_id?: string
          total_price?: number
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
          lot_id: string
          note: string | null
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          note?: string | null
          order_id: string
          price: number
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          note?: string | null
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
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
      producer: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_id: string | null
          created_at: string
          description: string | null
          email: string | null
          hidden: boolean
          id: string
          instagram: string | null
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
          description?: string | null
          email?: string | null
          hidden?: boolean
          id?: string
          instagram?: string | null
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
          description?: string | null
          email?: string | null
          hidden?: boolean
          id?: string
          instagram?: string | null
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
            foreignKeyName: "producer_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producer_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "region"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          appellation_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string | null
          producer_id: string
          product_type_id: string
        }
        Insert: {
          appellation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string | null
          producer_id: string
          product_type_id: string
        }
        Update: {
          appellation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string | null
          producer_id?: string
          product_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_appellation_id_fkey"
            columns: ["appellation_id"]
            isOneToOne: false
            referencedRelation: "appellation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_type"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pairing: {
        Row: {
          pairing_id: string
          product_id: string
        }
        Insert: {
          pairing_id: string
          product_id: string
        }
        Update: {
          pairing_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pairing_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pairing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      product_type: {
        Row: {
          category: string | null
          created_at: string
          id: string
          kind: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          kind?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
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
          global_discount: number | null
          global_discount_type: string | null
          id: string
          invoice_number: string | null
          note: string | null
          payment_method: string | null
          status: string
          tasting_id: string | null
          total_price: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          date: string
          global_discount?: number | null
          global_discount_type?: string | null
          id?: string
          invoice_number?: string | null
          note?: string | null
          payment_method?: string | null
          status?: string
          tasting_id?: string | null
          total_price: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          date?: string
          global_discount?: number | null
          global_discount_type?: string | null
          id?: string
          invoice_number?: string | null
          note?: string | null
          payment_method?: string | null
          status?: string
          tasting_id?: string | null
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
          {
            foreignKeyName: "sale_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
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
          lot_id: string | null
          note: string | null
          price: number
          quantity: number
          sale_id: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          discount?: number | null
          discount_type?: string | null
          id?: string
          lot_id?: string | null
          note?: string | null
          price: number
          quantity: number
          sale_id: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          discount?: number | null
          discount_type?: string | null
          id?: string
          lot_id?: string | null
          note?: string | null
          price?: number
          quantity?: number
          sale_id?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_move: {
        Row: {
          created_at: string
          date: string
          id: string
          lot_id: string
          note: string | null
          quantity: number
          reason: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          lot_id: string
          note?: string | null
          quantity: number
          reason: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          lot_id?: string
          note?: string | null
          quantity?: number
          reason?: string
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
          capacity: number | null
          created_at: string
          date: string
          description: string | null
          id: string
          is_private: boolean
          live_position: number | null
          location: string | null
          name: string | null
          notes: string | null
          price: number | null
          start_time: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          is_private?: boolean
          live_position?: number | null
          location?: string | null
          name?: string | null
          notes?: string | null
          price?: number | null
          start_time?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_private?: boolean
          live_position?: number | null
          location?: string | null
          name?: string | null
          notes?: string | null
          price?: number | null
          start_time?: string | null
        }
        Relationships: []
      }
      tasting_customer: {
        Row: {
          created_at: string
          customer_id: string
          seats: number
          tasting_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          seats?: number
          tasting_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          seats?: number
          tasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasting_customer_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_customer_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting_feedback: {
        Row: {
          comment: string | null
          created_at: string
          guest_email: string | null
          guest_id: string
          guest_name: string | null
          id: string
          lot_id: string
          rating: number | null
          tasting_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          guest_email?: string | null
          guest_id: string
          guest_name?: string | null
          id?: string
          lot_id: string
          rating?: number | null
          tasting_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          guest_email?: string | null
          guest_id?: string
          guest_name?: string | null
          id?: string
          lot_id?: string
          rating?: number | null
          tasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasting_feedback_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_feedback_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting_lot: {
        Row: {
          lot_id: string
          order: number
          tasting_id: string
        }
        Insert: {
          lot_id: string
          order: number
          tasting_id: string
        }
        Update: {
          lot_id?: string
          order?: number
          tasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasting_lot_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_lot_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting_registration: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          first_name: string
          id: string
          last_name: string | null
          phone: string | null
          seats: number
          status: string
          tasting_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          first_name: string
          id?: string
          last_name?: string | null
          phone?: string | null
          seats?: number
          status?: string
          tasting_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          seats?: number
          status?: string
          tasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasting_registration_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_registration_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
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
      variety: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      wish_request: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          guest_id: string | null
          id: string
          items: Json
          last_name: string | null
          message: string | null
          phone: string | null
          sale_id: string | null
          source: string
          status: string
          tasting_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          guest_id?: string | null
          id?: string
          items: Json
          last_name?: string | null
          message?: string | null
          phone?: string | null
          sale_id?: string | null
          source?: string
          status?: string
          tasting_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          guest_id?: string | null
          id?: string
          items?: Json
          last_name?: string | null
          message?: string | null
          phone?: string | null
          sale_id?: string | null
          source?: string
          status?: string
          tasting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wish_request_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wish_request_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tasting"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory: {
        Row: {
          lot_id: string | null
          quantity_on_hand: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_to_supplier_order: {
        Args: {
          p_lot_id: string
          p_price: number
          p_quantity: number
          p_supplier_id: string
        }
        Returns: {
          created: boolean
          order_id: string
        }[]
      }
      admin_find_or_create_customer: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_phone: string
        }
        Returns: string
      }
      assert_admin: { Args: never; Returns: undefined }
      assign_invoice_number: { Args: { p_sale_id: string }; Returns: string }
      attach_orders_to_transport: {
        Args: { p_order_ids: string[]; p_transport_id: string }
        Returns: undefined
      }
      brussels_today: { Args: never; Returns: string }
      confirm_tasting_registration: {
        Args: { p_registration_id: string }
        Returns: string
      }
      create_lot: {
        Args: {
          p_copy_notes?: boolean
          p_copy_varieties?: boolean
          p_lot: Json
          p_source_id?: string
        }
        Returns: string
      }
      find_or_create_customer: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_match_phone?: boolean
          p_phone: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      link_registration_to_customer: {
        Args: { p_registration_id: string }
        Returns: string
      }
      merge_customers: {
        Args: { p_from: string; p_into: string; p_keep_from_email?: boolean }
        Returns: undefined
      }
      my_notebook: { Args: never; Returns: Json }
      participant_seats: {
        Args: { p_customer_id: string; p_tasting_id: string }
        Returns: number
      }
      product_kind_vat_rate: { Args: { p_kind: unknown }; Returns: number }
      public_lot_availability: {
        Args: never
        Returns: {
          in_stock: boolean
          lot_id: string
          low_stock: boolean
        }[]
      }
      register_for_tasting: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_seats: number
          p_tasting_id: string
        }
        Returns: string
      }
      registration_customer_match: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_tasting_id: string
        }
        Returns: string
      }
      save_live_preorder: {
        Args: {
          p_confirm?: boolean
          p_email?: string
          p_first_name?: string
          p_guest_id: string
          p_items: Json
          p_last_name?: string
          p_phone?: string
          p_tasting_id: string
        }
        Returns: string
      }
      save_order: {
        Args: { p_items: Json; p_order: Json; p_order_id: string }
        Returns: string
      }
      save_sale: {
        Args: {
          p_items: Json
          p_sale: Json
          p_sale_id: string
          p_wish_id?: string
        }
        Returns: string
      }
      save_tasting: {
        Args: {
          p_added_customer_ids: string[]
          p_lot_ids: string[]
          p_removed_customer_ids: string[]
          p_tasting: Json
          p_tasting_id: string
        }
        Returns: string
      }
      set_sale_status: {
        Args: { p_payment_method?: string; p_sale_id: string; p_status: string }
        Returns: string
      }
      set_transport_status: {
        Args: { p_status: string; p_transport_id: string }
        Returns: undefined
      }
      tasting_availability: {
        Args: { p_tasting_id: string }
        Returns: {
          capacity: number
          seats_left: number
          seats_taken: number
        }[]
      }
      tasting_seats_taken: { Args: { p_tasting_id: string }; Returns: number }
      unsubscribe_email: { Args: { p_id: string }; Returns: boolean }
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

