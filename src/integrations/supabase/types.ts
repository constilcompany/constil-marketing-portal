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
      ai_estimate_results: {
        Row: {
          ai_estimate_id: string
          created_at: string
          estimate_id: string | null
          extracted_page_pdf_url: string | null
          id: string
          output_json: Json | null
          output_markdown: string | null
          output_pdf_url: string | null
          page_number: number
          status: number
        }
        Insert: {
          ai_estimate_id: string
          created_at?: string
          estimate_id?: string | null
          extracted_page_pdf_url?: string | null
          id?: string
          output_json?: Json | null
          output_markdown?: string | null
          output_pdf_url?: string | null
          page_number: number
          status?: number
        }
        Update: {
          ai_estimate_id?: string
          created_at?: string
          estimate_id?: string | null
          extracted_page_pdf_url?: string | null
          id?: string
          output_json?: Json | null
          output_markdown?: string | null
          output_pdf_url?: string | null
          page_number?: number
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_estimate_results_ai_estimate_id_fkey"
            columns: ["ai_estimate_id"]
            isOneToOne: false
            referencedRelation: "ai_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_estimate_results_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_estimates: {
        Row: {
          address: string | null
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          input_pdf_url: string | null
          name: string
          status: string
          user_id: string
        }
        Insert: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          input_pdf_url?: string | null
          name: string
          status?: string
          user_id: string
        }
        Update: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          input_pdf_url?: string | null
          name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_invoices: {
        Row: {
          address: string | null
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          input_pdf_url: string | null
          name: string
          output_json: Json | null
          output_markdown: string | null
          output_pdf_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          input_pdf_url?: string | null
          name: string
          output_json?: Json | null
          output_markdown?: string | null
          output_pdf_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          input_pdf_url?: string | null
          name?: string
          output_json?: Json | null
          output_markdown?: string | null
          output_pdf_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          created_at: string
          id: string
          influencer_amount: number
          influencer_id: string | null
          manager_amount: number
          manager_id: string | null
          sale_id: string
          status: string
          unlock_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          influencer_amount?: number
          influencer_id?: string | null
          manager_amount?: number
          manager_id?: string | null
          sale_id: string
          status?: string
          unlock_date: string
        }
        Update: {
          created_at?: string
          id?: string
          influencer_amount?: number
          influencer_id?: string | null
          manager_amount?: number
          manager_id?: string | null
          sale_id?: string
          status?: string
          unlock_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commissions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commissions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commissions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      company_legal_info: {
        Row: {
          business_type: number
          company_profile_id: string
          created_at: string
          id: string
          legal_address: string | null
          legal_business_name: string
          tax_id_number: string | null
          updated_at: string
        }
        Insert: {
          business_type?: number
          company_profile_id: string
          created_at?: string
          id?: string
          legal_address?: string | null
          legal_business_name: string
          tax_id_number?: string | null
          updated_at?: string
        }
        Update: {
          business_type?: number
          company_profile_id?: string
          created_at?: string
          id?: string
          legal_address?: string | null
          legal_business_name?: string
          tax_id_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_legal_info_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: true
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          address: string | null
          company_email: string
          company_legal_name: string
          company_phone: string | null
          created_at: string
          id: string
          industry: string | null
          logo_url: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          company_email: string
          company_legal_name: string
          company_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          company_email?: string
          company_legal_name?: string
          company_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          auto_generated: boolean
          code: string
          created_at: string
          discount_percent: number
          expiry_date: string | null
          id: string
          influencer_id: string | null
          is_active: boolean
          manager_id: string | null
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          auto_generated?: boolean
          code: string
          created_at?: string
          discount_percent?: number
          expiry_date?: string | null
          id?: string
          influencer_id?: string | null
          is_active?: boolean
          manager_id?: string | null
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          auto_generated?: boolean
          code?: string
          created_at?: string
          discount_percent?: number
          expiry_date?: string | null
          id?: string
          influencer_id?: string | null
          is_active?: boolean
          manager_id?: string | null
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coupons_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coupons_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coupons_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      credit_action_config: {
        Row: {
          action_type: string
          credit_cost: number
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          action_type: string
          credit_cost?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          action_type?: string
          credit_cost?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          ai_estimate_credits: number
          ai_estimate_unlimited: boolean
          billing_interval: string | null
          billing_type: string
          created_at: string
          credit_amount: number
          duration_days: number
          estimate_credits: number
          estimate_unlimited: boolean
          id: string
          invoice_credits: number
          invoice_unlimited: boolean
          is_active: boolean
          name: string
          price: number
          template_tier: string
          trial_ai_estimate_credits: number
          trial_days: number | null
          trial_enabled: boolean
          trial_estimate_credits: number
          trial_invoice_credits: number
          updated_at: string
        }
        Insert: {
          ai_estimate_credits?: number
          ai_estimate_unlimited?: boolean
          billing_interval?: string | null
          billing_type?: string
          created_at?: string
          credit_amount: number
          duration_days?: number
          estimate_credits?: number
          estimate_unlimited?: boolean
          id?: string
          invoice_credits?: number
          invoice_unlimited?: boolean
          is_active?: boolean
          name: string
          price: number
          template_tier?: string
          trial_ai_estimate_credits?: number
          trial_days?: number | null
          trial_enabled?: boolean
          trial_estimate_credits?: number
          trial_invoice_credits?: number
          updated_at?: string
        }
        Update: {
          ai_estimate_credits?: number
          ai_estimate_unlimited?: boolean
          billing_interval?: string | null
          billing_type?: string
          created_at?: string
          credit_amount?: number
          duration_days?: number
          estimate_credits?: number
          estimate_unlimited?: boolean
          id?: string
          invoice_credits?: number
          invoice_unlimited?: boolean
          is_active?: boolean
          name?: string
          price?: number
          template_tier?: string
          trial_ai_estimate_credits?: number
          trial_days?: number | null
          trial_enabled?: boolean
          trial_estimate_credits?: number
          trial_invoice_credits?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount_paid: number | null
          coupon_id: string | null
          created_at: string
          credits_change: number
          discount_applied: number | null
          id: string
          package_id: string | null
          reference_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          coupon_id?: string | null
          created_at?: string
          credits_change: number
          discount_applied?: number | null
          id?: string
          package_id?: string | null
          reference_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          coupon_id?: string | null
          created_at?: string
          credits_change?: number
          discount_applied?: number | null
          id?: string
          package_id?: string | null
          reference_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          created_at: string
          id: string
          name: string
          rate: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rate?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rate?: number
          user_id?: string
        }
        Relationships: []
      }
      estimate_item_discounts: {
        Row: {
          created_at: string
          discount_id: string
          estimate_item_id: string
          id: string
        }
        Insert: {
          created_at?: string
          discount_id: string
          estimate_item_id: string
          id?: string
        }
        Update: {
          created_at?: string
          discount_id?: string
          estimate_item_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_item_discounts_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_item_discounts_estimate_item_id_fkey"
            columns: ["estimate_item_id"]
            isOneToOne: false
            referencedRelation: "estimate_items"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_item_taxes: {
        Row: {
          created_at: string
          estimate_item_id: string
          id: string
          tax_id: string
        }
        Insert: {
          created_at?: string
          estimate_item_id: string
          id?: string
          tax_id: string
        }
        Update: {
          created_at?: string
          estimate_item_id?: string
          id?: string
          tax_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_item_taxes_estimate_item_id_fkey"
            columns: ["estimate_item_id"]
            isOneToOne: false
            referencedRelation: "estimate_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_item_taxes_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_items: {
        Row: {
          client_id: string | null
          created_at: string
          description: string
          discount: Json | null
          discount_key: boolean
          estimate_id: string
          id: string
          price: number | null
          product_id: string | null
          quantity: number
          tax: Json | null
          tax_key: boolean
          total: number
          unit_price: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string
          discount?: Json | null
          discount_key?: boolean
          estimate_id: string
          id?: string
          price?: number | null
          product_id?: string | null
          quantity?: number
          tax?: Json | null
          tax_key?: boolean
          total?: number
          unit_price?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string
          discount?: Json | null
          discount_key?: boolean
          estimate_id?: string
          id?: string
          price?: number | null
          product_id?: string | null
          quantity?: number
          tax?: Json | null
          tax_key?: boolean
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_mails: {
        Row: {
          client_ids: string[]
          created_at: string
          estimate_id: string | null
          file_url: string | null
          id: string
          recipient_emails: string[]
          send_copy: boolean
          status: string
          user_id: string
        }
        Insert: {
          client_ids?: string[]
          created_at?: string
          estimate_id?: string | null
          file_url?: string | null
          id?: string
          recipient_emails?: string[]
          send_copy?: boolean
          status?: string
          user_id: string
        }
        Update: {
          client_ids?: string[]
          created_at?: string
          estimate_id?: string | null
          file_url?: string | null
          id?: string
          recipient_emails?: string[]
          send_copy?: boolean
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_mails_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_pdfs: {
        Row: {
          estimate_id: string
          generated_at: string
          id: string
          pdf_url: string
        }
        Insert: {
          estimate_id: string
          generated_at?: string
          id?: string
          pdf_url: string
        }
        Update: {
          estimate_id?: string
          generated_at?: string
          id?: string
          pdf_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_pdfs_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_template_locks: {
        Row: {
          estimate_id: string
          id: string
          locked_at: string
          template_number: number
          user_id: string
        }
        Insert: {
          estimate_id: string
          id?: string
          locked_at?: string
          template_number: number
          user_id: string
        }
        Update: {
          estimate_id?: string
          id?: string
          locked_at?: string
          template_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_template_locks_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: true
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          client_id: string | null
          created_at: string
          document_url: string | null
          estimate_date: string | null
          estimate_number: string
          estimate_type: string
          id: string
          logo: string | null
          logo_url: string | null
          notes: string | null
          payment_terms: number | null
          project_id: string | null
          sent_at: string | null
          signature: string | null
          signature_url: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_percent: number
          template_number: number | null
          total: number
          total_amount: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          document_url?: string | null
          estimate_date?: string | null
          estimate_number?: string
          estimate_type?: string
          id?: string
          logo?: string | null
          logo_url?: string | null
          notes?: string | null
          payment_terms?: number | null
          project_id?: string | null
          sent_at?: string | null
          signature?: string | null
          signature_url?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          template_number?: number | null
          total?: number
          total_amount?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          document_url?: string | null
          estimate_date?: string | null
          estimate_number?: string
          estimate_type?: string
          id?: string
          logo?: string | null
          logo_url?: string | null
          notes?: string | null
          payment_terms?: number | null
          project_id?: string | null
          sent_at?: string | null
          signature?: string | null
          signature_url?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          template_number?: number | null
          total?: number
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          id: string
          influencer_commission_percent: number
          lock_period_days: number
          manager_commission_percent: number
          minimum_payout_threshold: number
          payment_mode: string
          updated_at: string
        }
        Insert: {
          id?: string
          influencer_commission_percent?: number
          lock_period_days?: number
          manager_commission_percent?: number
          minimum_payout_threshold?: number
          payment_mode?: string
          updated_at?: string
        }
        Update: {
          id?: string
          influencer_commission_percent?: number
          lock_period_days?: number
          manager_commission_percent?: number
          minimum_payout_threshold?: number
          payment_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_item_discounts: {
        Row: {
          created_at: string
          discount_id: string
          id: string
          invoice_item_id: string
        }
        Insert: {
          created_at?: string
          discount_id: string
          id?: string
          invoice_item_id: string
        }
        Update: {
          created_at?: string
          discount_id?: string
          id?: string
          invoice_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_item_discounts_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_item_discounts_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_item_taxes: {
        Row: {
          created_at: string
          id: string
          invoice_item_id: string
          tax_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_item_id: string
          tax_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_item_id?: string
          tax_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_item_taxes_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_item_taxes_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          client_id: string | null
          created_at: string
          description: string
          discount: Json | null
          discount_key: boolean
          id: string
          invoice_id: string
          price: number | null
          product_id: string | null
          quantity: number
          tax: Json | null
          tax_key: boolean
          total: number
          unit_price: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string
          discount?: Json | null
          discount_key?: boolean
          id?: string
          invoice_id: string
          price?: number | null
          product_id?: string | null
          quantity?: number
          tax?: Json | null
          tax_key?: boolean
          total?: number
          unit_price?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string
          discount?: Json | null
          discount_key?: boolean
          id?: string
          invoice_id?: string
          price?: number | null
          product_id?: string | null
          quantity?: number
          tax?: Json | null
          tax_key?: boolean
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_mails: {
        Row: {
          client_ids: string[]
          created_at: string
          file_url: string | null
          id: string
          invoice_id: string | null
          recipient_emails: string[]
          send_copy: boolean
          status: string
          user_id: string
        }
        Insert: {
          client_ids?: string[]
          created_at?: string
          file_url?: string | null
          id?: string
          invoice_id?: string | null
          recipient_emails?: string[]
          send_copy?: boolean
          status?: string
          user_id: string
        }
        Update: {
          client_ids?: string[]
          created_at?: string
          file_url?: string | null
          id?: string
          invoice_id?: string | null
          recipient_emails?: string[]
          send_copy?: boolean
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_mails_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_pdfs: {
        Row: {
          generated_at: string
          id: string
          invoice_id: string
          pdf_url: string
        }
        Insert: {
          generated_at?: string
          id?: string
          invoice_id: string
          pdf_url: string
        }
        Update: {
          generated_at?: string
          id?: string
          invoice_id?: string
          pdf_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_pdfs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_template_locks: {
        Row: {
          id: string
          invoice_id: string
          locked_at: string
          template_number: number
          user_id: string
        }
        Insert: {
          id?: string
          invoice_id: string
          locked_at?: string
          template_number: number
          user_id: string
        }
        Update: {
          id?: string
          invoice_id?: string
          locked_at?: string
          template_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_template_locks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          document_url: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          logo: string | null
          logo_url: string | null
          notes: string | null
          payment_terms: number | null
          project_id: string | null
          sent_at: string | null
          signature: string | null
          signature_url: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_percent: number
          template_number: number | null
          total: number
          total_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          logo?: string | null
          logo_url?: string | null
          notes?: string | null
          payment_terms?: number | null
          project_id?: string | null
          sent_at?: string | null
          signature?: string | null
          signature_url?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          template_number?: number | null
          total?: number
          total_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          logo?: string | null
          logo_url?: string | null
          notes?: string | null
          payment_terms?: number | null
          project_id?: string | null
          sent_at?: string | null
          signature?: string | null
          signature_url?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          template_number?: number | null
          total?: number
          total_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_passwords: {
        Row: {
          created_at: string
          django_hash: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          django_hash: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          django_hash?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      legacy_user_map: {
        Row: {
          email: string
          id: string
          legacy_id: string
          migrated_at: string
          new_user_id: string
        }
        Insert: {
          email: string
          id?: string
          legacy_id: string
          migrated_at?: string
          new_user_id: string
        }
        Update: {
          email?: string
          id?: string
          legacy_id?: string
          migrated_at?: string
          new_user_id?: string
        }
        Relationships: []
      }
      manager_influencers: {
        Row: {
          created_at: string
          id: string
          influencer_id: string
          manager_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          influencer_id: string
          manager_id: string
        }
        Update: {
          created_at?: string
          id?: string
          influencer_id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_influencers_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manager_influencers_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: true
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manager_influencers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manager_influencers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mock_stripe_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          payment_intent_id: string | null
          processed: boolean
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          payment_intent_id?: string | null
          processed?: boolean
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_intent_id?: string | null
          processed?: boolean
        }
        Relationships: []
      }
      password_reset_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_code: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          used?: boolean
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          billing_type: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          discount_amount: number | null
          id: string
          influencer_id: string | null
          manager_id: string | null
          metadata: Json | null
          original_price: number | null
          package_id: string | null
          payment_mode: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          billing_type?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number | null
          id?: string
          influencer_id?: string | null
          manager_id?: string | null
          metadata?: Json | null
          original_price?: number | null
          package_id?: string | null
          payment_mode?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_type?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number | null
          id?: string
          influencer_id?: string | null
          manager_id?: string | null
          metadata?: Json | null
          original_price?: number | null
          package_id?: string | null
          payment_mode?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_jobs: {
        Row: {
          created_at: string
          detail: Json | null
          id: string
          message: string | null
          pdf_key: string
          status: Database["public"]["Enums"]["pdf_job_status"]
          userid: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          id?: string
          message?: string | null
          pdf_key: string
          status?: Database["public"]["Enums"]["pdf_job_status"]
          userid: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          id?: string
          message?: string | null
          pdf_key?: string
          status?: Database["public"]["Enums"]["pdf_job_status"]
          userid?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          extra_info: string | null
          id: string
          name: string
          ref: string | null
          unit: string | null
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_info?: string | null
          id?: string
          name?: string
          ref?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_info?: string | null
          id?: string
          name?: string
          ref?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_name: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          payment_method: string | null
          phone: string | null
          signup_method: string | null
          state: string | null
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          payment_method?: string | null
          phone?: string | null
          signup_method?: string | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          payment_method?: string | null
          phone?: string | null
          signup_method?: string | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          address: string | null
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          coupon_id: string | null
          created_at: string
          customer_user_id: string | null
          discount_amount: number
          final_amount: number
          id: string
          total_amount: number
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          customer_user_id?: string | null
          discount_amount?: number
          final_amount?: number
          id?: string
          total_amount?: number
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          customer_user_id?: string | null
          discount_amount?: number
          final_amount?: number
          id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_active_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_type: string
          created_at: string
          expiry_date: string
          id: string
          is_active: boolean
          is_trial: boolean
          package_id: string
          start_date: string
          status: string
          stripe_subscription_id: string | null
          template_tier: string
          trial_end_at: string | null
          trial_start_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_type?: string
          created_at?: string
          expiry_date: string
          id?: string
          is_active?: boolean
          is_trial?: boolean
          package_id: string
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          template_tier?: string
          trial_end_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_type?: string
          created_at?: string
          expiry_date?: string
          id?: string
          is_active?: boolean
          is_trial?: boolean
          package_id?: string
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          template_tier?: string
          trial_end_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_queries: {
        Row: {
          company_name: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          message: string
          status: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          message: string
          status?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string
          status?: string
        }
        Relationships: []
      }
      taxes: {
        Row: {
          created_at: string
          id: string
          name: string
          rate: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rate?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rate?: number
          user_id?: string
        }
        Relationships: []
      }
      user_attributions: {
        Row: {
          coupon_id: string | null
          created_at: string
          id: string
          influencer_id: string
          user_id: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          id?: string
          influencer_id: string
          user_id: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          id?: string
          influencer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_attributions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credit_wallets: {
        Row: {
          ai_estimate_remaining: number
          ai_estimate_unlimited: boolean
          created_at: string
          estimate_remaining: number
          estimate_unlimited: boolean
          id: string
          invoice_remaining: number
          invoice_unlimited: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_estimate_remaining?: number
          ai_estimate_unlimited?: boolean
          created_at?: string
          estimate_remaining?: number
          estimate_unlimited?: boolean
          id?: string
          invoice_remaining?: number
          invoice_unlimited?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_estimate_remaining?: number
          ai_estimate_unlimited?: boolean
          created_at?: string
          estimate_remaining?: number
          estimate_unlimited?: boolean
          id?: string
          invoice_remaining?: number
          invoice_unlimited?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_with_stats: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_name: string | null
          blue_print_count: number | null
          city: string | null
          country: string | null
          estimate_count: number | null
          estimates_in_this_month: number | null
          full_name: string | null
          id: string | null
          invoice_count: number | null
          invoice_in_this_month: number | null
          payment_method: string | null
          phone: string | null
          register: Json | null
          state: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          blue_print_count?: never
          city?: string | null
          country?: string | null
          estimate_count?: never
          estimates_in_this_month?: never
          full_name?: string | null
          id?: string | null
          invoice_count?: never
          invoice_in_this_month?: never
          payment_method?: string | null
          phone?: string | null
          register?: never
          state?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          blue_print_count?: never
          city?: string | null
          country?: string | null
          estimate_count?: never
          estimates_in_this_month?: never
          full_name?: string | null
          id?: string | null
          invoice_count?: never
          invoice_in_this_month?: never
          payment_method?: string | null
          phone?: string | null
          register?: never
          state?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invalidate_user_sessions: {
        Args: { _user_id: string }
        Returns: undefined
      }
      validate_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "influencer" | "user"
      pdf_job_status: "pending" | "processing" | "done" | "fail"
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
      app_role: ["admin", "manager", "influencer", "user"],
      pdf_job_status: ["pending", "processing", "done", "fail"],
    },
  },
} as const
