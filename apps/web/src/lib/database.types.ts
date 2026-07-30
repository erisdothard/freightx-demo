export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      accessorial_charges: {
        Row: {
          amount_usd: number;
          approved_at: string | null;
          approved_by: string | null;
          booking_id: string | null;
          created_at: string | null;
          created_by: string;
          id: string;
          load_id: string;
          notes: string | null;
          status: string;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          amount_usd?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          booking_id?: string | null;
          created_at?: string | null;
          created_by: string;
          id?: string;
          load_id: string;
          notes?: string | null;
          status?: string;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          amount_usd?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          booking_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          id?: string;
          load_id?: string;
          notes?: string | null;
          status?: string;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'accessorial_charges_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accessorial_charges_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bids';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accessorial_charges_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accessorial_charges_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          created_at: string | null;
          diff: Json | null;
          entity_id: string;
          entity_type: string;
          id: string;
          ip_address: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          diff?: Json | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          diff?: Json | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      broker_reviews: {
        Row: {
          id: string;
          carrier_company_id: string;
          broker_company_id: string;
          load_id: string;
          reviewer_id: string;
          overall: number;
          payment_speed: number | null;
          payment_reliability: number | null;
          communication: number | null;
          rate_fairness: number | null;
          comment: string | null;
          would_work_again: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          carrier_company_id: string;
          broker_company_id: string;
          load_id: string;
          reviewer_id: string;
          overall: number;
          payment_speed?: number | null;
          payment_reliability?: number | null;
          communication?: number | null;
          rate_fairness?: number | null;
          comment?: string | null;
          would_work_again?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          carrier_company_id?: string;
          broker_company_id?: string;
          load_id?: string;
          reviewer_id?: string;
          overall?: number;
          payment_speed?: number | null;
          payment_reliability?: number | null;
          communication?: number | null;
          rate_fairness?: number | null;
          comment?: string | null;
          would_work_again?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
      broker_relationships: {
        Row: {
          id: string;
          carrier_company_id: string;
          broker_company_id: string;
          status: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          carrier_company_id: string;
          broker_company_id: string;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          carrier_company_id?: string;
          broker_company_id?: string;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bids: {
        Row: {
          amount_usd: number;
          carrier_id: string;
          company_id: string | null;
          company_name: string;
          created_at: string;
          deleted_at: string | null;
          expires_at: string;
          id: string;
          load_id: string;
          notes: string | null;
          parent_bid_id: string | null;
          round: number;
          signatory_name: string | null;
          signature_url: string | null;
          signed_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_usd: number;
          carrier_id: string;
          company_id?: string | null;
          company_name?: string;
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string;
          id?: string;
          load_id: string;
          notes?: string | null;
          parent_bid_id?: string | null;
          round?: number;
          signatory_name?: string | null;
          signature_url?: string | null;
          signed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_usd?: number;
          carrier_id?: string;
          company_id?: string | null;
          company_name?: string;
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string;
          id?: string;
          load_id?: string;
          notes?: string | null;
          parent_bid_id?: string | null;
          round?: number;
          signatory_name?: string | null;
          signature_url?: string | null;
          signed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bids_carrier_id_fkey';
            columns: ['carrier_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bids_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bids_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bids_parent_bid_id_fkey';
            columns: ['parent_bid_id'];
            isOneToOne: false;
            referencedRelation: 'bids';
            referencedColumns: ['id'];
          },
        ];
      };
      broker_payment_metrics: {
        Row: {
          avg_days_to_pay: number | null;
          company_id: string;
          on_time_pct: number | null;
          payment_count: number;
          total_paid_usd: number | null;
          updated_at: string | null;
        };
        Insert: {
          avg_days_to_pay?: number | null;
          company_id: string;
          on_time_pct?: number | null;
          payment_count?: number;
          total_paid_usd?: number | null;
          updated_at?: string | null;
        };
        Update: {
          avg_days_to_pay?: number | null;
          company_id?: string;
          on_time_pct?: number | null;
          payment_count?: number;
          total_paid_usd?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'broker_payment_metrics_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: true;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      carrier_preferences: {
        Row: {
          created_at: string | null;
          home_city: string | null;
          home_state: string | null;
          min_rate_per_mile: number | null;
          preferred_dest_states: string[] | null;
          preferred_equipment: string[] | null;
          preferred_origin_states: string[] | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          home_city?: string | null;
          home_state?: string | null;
          min_rate_per_mile?: number | null;
          preferred_dest_states?: string[] | null;
          preferred_equipment?: string[] | null;
          preferred_origin_states?: string[] | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          home_city?: string | null;
          home_state?: string | null;
          min_rate_per_mile?: number | null;
          preferred_dest_states?: string[] | null;
          preferred_equipment?: string[] | null;
          preferred_origin_states?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'carrier_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      carrier_relationships: {
        Row: {
          carrier_id: string;
          company_id: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          notes: string | null;
          status: string;
        };
        Insert: {
          carrier_id: string;
          company_id: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
        };
        Update: {
          carrier_id?: string;
          company_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'carrier_relationships_carrier_id_fkey';
            columns: ['carrier_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'carrier_relationships_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'carrier_relationships_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      carrier_lane_preferences: {
        Row: {
          id: string;
          carrier_company_id: string;
          origin_state: string;
          dest_state: string;
          equipment: string | null;
          min_rate_per_mile: number | null;
          max_deadhead_miles: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          carrier_company_id: string;
          origin_state: string;
          dest_state: string;
          equipment?: string | null;
          min_rate_per_mile?: number | null;
          max_deadhead_miles?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          carrier_company_id?: string;
          origin_state?: string;
          dest_state?: string;
          equipment?: string | null;
          min_rate_per_mile?: number | null;
          max_deadhead_miles?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      carrier_verifications: {
        Row: {
          company_id: string;
          created_at: string;
          csa_score: number | null;
          dot_number: string | null;
          fmcsa_status: string | null;
          fmcsa_verified_at: string | null;
          id: string;
          insurance_amount_usd: number | null;
          insurance_carrier: string | null;
          insurance_cert_url: string | null;
          insurance_expires_at: string | null;
          insurance_expiry_date: string | null;
          insurance_policy: string | null;
          last_verified_at: string | null;
          mc_number: string | null;
          next_verify_at: string | null;
          notes: string | null;
          risk_factors: Json | null;
          risk_score: number | null;
          safety_rating: string | null;
          status: Database['public']['Enums']['verification_status'];
          updated_at: string;
          verified_at: string | null;
          hazmat_certified: boolean;
          hazmat_permit_expires: string | null;
          hazmat_permit_number: string | null;
          w9_uploaded_at: string | null;
          w9_url: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          csa_score?: number | null;
          dot_number?: string | null;
          fmcsa_status?: string | null;
          fmcsa_verified_at?: string | null;
          hazmat_certified?: boolean;
          hazmat_permit_expires?: string | null;
          hazmat_permit_number?: string | null;
          id?: string;
          insurance_amount_usd?: number | null;
          insurance_carrier?: string | null;
          insurance_cert_url?: string | null;
          insurance_expires_at?: string | null;
          insurance_expiry_date?: string | null;
          insurance_policy?: string | null;
          last_verified_at?: string | null;
          mc_number?: string | null;
          next_verify_at?: string | null;
          notes?: string | null;
          risk_factors?: Json | null;
          risk_score?: number | null;
          safety_rating?: string | null;
          status?: Database['public']['Enums']['verification_status'];
          updated_at?: string;
          verified_at?: string | null;
          w9_uploaded_at?: string | null;
          w9_url?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          csa_score?: number | null;
          dot_number?: string | null;
          fmcsa_status?: string | null;
          fmcsa_verified_at?: string | null;
          hazmat_certified?: boolean;
          hazmat_permit_expires?: string | null;
          hazmat_permit_number?: string | null;
          id?: string;
          insurance_amount_usd?: number | null;
          insurance_carrier?: string | null;
          insurance_cert_url?: string | null;
          insurance_expires_at?: string | null;
          insurance_expiry_date?: string | null;
          insurance_policy?: string | null;
          last_verified_at?: string | null;
          mc_number?: string | null;
          next_verify_at?: string | null;
          notes?: string | null;
          risk_factors?: Json | null;
          risk_score?: number | null;
          safety_rating?: string | null;
          status?: Database['public']['Enums']['verification_status'];
          updated_at?: string;
          verified_at?: string | null;
          w9_uploaded_at?: string | null;
          w9_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'carrier_verifications_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      companies: {
        Row: {
          address: string | null;
          broker_authority: string | null;
          broker_bond_amount: number | null;
          broker_bond_expires_at: string | null;
          broker_bond_verified: boolean;
          city: string | null;
          created_at: string;
          dot_number: string | null;
          email: string | null;
          id: string;
          logo_url: string | null;
          mc_number: string | null;
          name: string;
          on_time_percent: number | null;
          owner_id: string;
          phone: string | null;
          rating: number | null;
          state: string | null;
          total_loads: number;
          type: string;
          updated_at: string;
          verified: boolean;
          website: string | null;
          zip: string | null;
        };
        Insert: {
          address?: string | null;
          broker_authority?: string | null;
          broker_bond_amount?: number | null;
          broker_bond_expires_at?: string | null;
          broker_bond_verified?: boolean;
          city?: string | null;
          created_at?: string;
          dot_number?: string | null;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          mc_number?: string | null;
          name: string;
          on_time_percent?: number | null;
          owner_id: string;
          phone?: string | null;
          rating?: number | null;
          state?: string | null;
          total_loads?: number;
          type: string;
          updated_at?: string;
          verified?: boolean;
          website?: string | null;
          zip?: string | null;
        };
        Update: {
          address?: string | null;
          broker_authority?: string | null;
          broker_bond_amount?: number | null;
          broker_bond_expires_at?: string | null;
          broker_bond_verified?: boolean;
          city?: string | null;
          created_at?: string;
          dot_number?: string | null;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          mc_number?: string | null;
          name?: string;
          on_time_percent?: number | null;
          owner_id?: string;
          phone?: string | null;
          rating?: number | null;
          state?: string | null;
          total_loads?: number;
          type?: string;
          updated_at?: string;
          verified?: boolean;
          website?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'companies_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      company_invites: {
        Row: {
          accepted_at: string | null;
          company_id: string;
          created_at: string | null;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          company_id: string;
          created_at?: string | null;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          company_id?: string;
          created_at?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'company_invites_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'company_invites_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string | null;
          id: string;
          invited_by: string | null;
          joined_at: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          role?: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'company_members_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'company_members_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'company_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          last_message: string | null;
          last_message_at: string;
          load_number: string | null;
          other_party: string;
          other_party_role: string;
          participant_a: string | null;
          participant_b: string | null;
          unread_count: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message?: string | null;
          last_message_at?: string;
          load_number?: string | null;
          other_party: string;
          other_party_role: string;
          participant_a?: string | null;
          participant_b?: string | null;
          unread_count?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message?: string | null;
          last_message_at?: string;
          load_number?: string | null;
          other_party?: string;
          other_party_role?: string;
          participant_a?: string | null;
          participant_b?: string | null;
          unread_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_participant_a_fkey';
            columns: ['participant_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_participant_b_fkey';
            columns: ['participant_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          bol_number: string | null;
          company_id: string | null;
          created_at: string;
          deleted_at: string | null;
          file_name: string;
          file_size: number | null;
          file_url: string;
          id: string;
          load_id: string | null;
          mime_type: string | null;
          signatory_name: string | null;
          signature_url: string | null;
          signed_at: string | null;
          type: string;
          uploaded_by: string | null;
        };
        Insert: {
          bol_number?: string | null;
          company_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          file_name: string;
          file_size?: number | null;
          file_url: string;
          id?: string;
          load_id?: string | null;
          mime_type?: string | null;
          signatory_name?: string | null;
          signature_url?: string | null;
          signed_at?: string | null;
          type: string;
          uploaded_by?: string | null;
        };
        Update: {
          bol_number?: string | null;
          company_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          file_name?: string;
          file_size?: number | null;
          file_url?: string;
          id?: string;
          load_id?: string | null;
          mime_type?: string | null;
          signatory_name?: string | null;
          signature_url?: string | null;
          signed_at?: string | null;
          type?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      driver_incidents: {
        Row: {
          created_at: string | null;
          description: string | null;
          driver_id: string;
          id: string;
          incident_date: string;
          incident_type: string;
          lat: number | null;
          lng: number | null;
          load_number: string | null;
          location_text: string | null;
          photos: string[] | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          severity: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          driver_id: string;
          id?: string;
          incident_date?: string;
          incident_type: string;
          lat?: number | null;
          lng?: number | null;
          load_number?: string | null;
          location_text?: string | null;
          photos?: string[] | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          severity?: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          driver_id?: string;
          id?: string;
          incident_date?: string;
          incident_type?: string;
          lat?: number | null;
          lng?: number | null;
          load_number?: string | null;
          location_text?: string | null;
          photos?: string[] | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          severity?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_incidents_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      factoring_requests: {
        Row: {
          approved_at: string | null;
          carrier_id: string;
          company_id: string | null;
          created_at: string | null;
          factor_partner: string | null;
          fee_percent: number;
          funded_at: string | null;
          id: string;
          invoice_amount: number;
          load_id: string | null;
          load_number: string | null;
          net_payout: number | null;
          notes: string | null;
          requested_at: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          approved_at?: string | null;
          carrier_id: string;
          company_id?: string | null;
          created_at?: string | null;
          factor_partner?: string | null;
          fee_percent?: number;
          funded_at?: string | null;
          id?: string;
          invoice_amount: number;
          load_id?: string | null;
          load_number?: string | null;
          net_payout?: number | null;
          notes?: string | null;
          requested_at?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          approved_at?: string | null;
          carrier_id?: string;
          company_id?: string | null;
          created_at?: string | null;
          factor_partner?: string | null;
          fee_percent?: number;
          funded_at?: string | null;
          id?: string;
          invoice_amount?: number;
          load_id?: string | null;
          load_number?: string | null;
          net_payout?: number | null;
          notes?: string | null;
          requested_at?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'factoring_requests_carrier_id_fkey';
            columns: ['carrier_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'factoring_requests_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'factoring_requests_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
        ];
      };
      gdpr_deletion_log: {
        Row: {
          date_range_end: string | null;
          date_range_start: string | null;
          deleted_at: string;
          deleted_by: string | null;
          deletion_type: string;
          id: string;
          metadata: Json | null;
          user_id: string;
        };
        Insert: {
          date_range_end?: string | null;
          date_range_start?: string | null;
          deleted_at?: string;
          deleted_by?: string | null;
          deletion_type: string;
          id?: string;
          metadata?: Json | null;
          user_id: string;
        };
        Update: {
          date_range_end?: string | null;
          date_range_start?: string | null;
          deleted_at?: string;
          deleted_by?: string | null;
          deletion_type?: string;
          id?: string;
          metadata?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gdpr_deletion_log_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gdpr_deletion_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lane_benchmarks: {
        Row: {
          avg_rate_per_mile: number | null;
          created_at: string | null;
          dest_state: string;
          equipment: string;
          id: string;
          max_rate_per_mile: number | null;
          min_rate_per_mile: number | null;
          origin_state: string;
          sample_count: number;
          week_start: string;
        };
        Insert: {
          avg_rate_per_mile?: number | null;
          created_at?: string | null;
          dest_state: string;
          equipment: string;
          id?: string;
          max_rate_per_mile?: number | null;
          min_rate_per_mile?: number | null;
          origin_state: string;
          sample_count?: number;
          week_start: string;
        };
        Update: {
          avg_rate_per_mile?: number | null;
          created_at?: string | null;
          dest_state?: string;
          equipment?: string;
          id?: string;
          max_rate_per_mile?: number | null;
          min_rate_per_mile?: number | null;
          origin_state?: string;
          sample_count?: number;
          week_start?: string;
        };
        Relationships: [];
      };
      load_templates: {
        Row: {
          company_id: string | null;
          created_at: string | null;
          id: string;
          name: string;
          template_data: Json;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string | null;
          id?: string;
          name: string;
          template_data?: Json;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string;
          template_data?: Json;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'load_templates_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'load_templates_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      load_exception_alerts: {
        Row: {
          id: string;
          load_id: string;
          alert_type: string;
          severity: string;
          message: string;
          acknowledged: boolean;
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          load_id: string;
          alert_type: string;
          severity?: string;
          message: string;
          acknowledged?: boolean;
          acknowledged_by?: string | null;
          acknowledged_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          load_id?: string;
          alert_type?: string;
          severity?: string;
          message?: string;
          acknowledged?: boolean;
          acknowledged_by?: string | null;
          acknowledged_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'load_exception_alerts_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
        ];
      };
      load_invitations: {
        Row: {
          id: string;
          load_id: string;
          carrier_company_id: string;
          invited_by: string;
          status: string;
          message: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          load_id: string;
          carrier_company_id: string;
          invited_by: string;
          status?: string;
          message?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          load_id?: string;
          carrier_company_id?: string;
          invited_by?: string;
          status?: string;
          message?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'load_invitations_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
        ];
      };
      loads: {
        Row: {
          assigned_driver_id: string | null;
          assignee_id: string | null;
          bid_count: number;
          broker_credit_score: number | null;
          commodity: string;
          company_id: string | null;
          company_name: string;
          created_at: string;
          deleted_at: string | null;
          delivery_appt_end: string | null;
          delivery_appt_start: string | null;
          delivery_date: string;
          delivery_notes: string | null;
          dest_address: string | null;
          dest_address_normalized: string | null;
          dest_address_raw: string | null;
          dest_city: string;
          dest_geocode_confidence: string | null;
          dest_place_id: string | null;
          dest_state: string;
          dest_zip: string | null;
          equipment: string;
          freight_class: string | null;
          full_partial: string | null;
          hazmat: boolean;
          height_in: number | null;
          id: string;
          length_in: number | null;
          load_number: string;
          loading_notes: string | null;
          origin_address: string | null;
          origin_address_normalized: string | null;
          origin_address_raw: string | null;
          origin_city: string;
          origin_geocode_confidence: string | null;
          origin_place_id: string | null;
          origin_state: string;
          origin_zip: string | null;
          packaging_type: string | null;
          pallets_count: number | null;
          pickup_appt_end: string | null;
          pickup_appt_start: string | null;
          pickup_date: string;
          pieces_count: number | null;
          po_number: string | null;
          posted_at: string;
          posted_by: string | null;
          preferred_carriers_only: boolean;
          rate_per_mile: number | null;
          rate_usd: number;
          receiver_contact_email: string | null;
          receiver_contact_name: string | null;
          receiver_contact_phone: string | null;
          receiver_name: string | null;
          search_vector: unknown;
          second_driver_id: string | null;
          shipper_contact_email: string | null;
          shipper_contact_name: string | null;
          shipper_contact_phone: string | null;
          shipper_name: string | null;
          shipper_reference: string | null;
          special_instructions: string | null;
          stackable: boolean | null;
          status: string;
          temp_controlled: boolean;
          total_miles: number | null;
          visibility: string;
          hazmat_proper_shipping_name: string | null;
          hazmat_class: string | null;
          hazmat_un_number: string | null;
          hazmat_packing_group: string | null;
          hazmat_quantity: string | null;
          hazmat_emergency_phone: string | null;
          hazmat_placard_required: boolean;
          hazmat_reportable_quantity: boolean;
          weight_lbs: number;
          width_in: number | null;
        };
        Insert: {
          assigned_driver_id?: string | null;
          assignee_id?: string | null;
          bid_count?: number;
          broker_credit_score?: number | null;
          commodity: string;
          company_id?: string | null;
          company_name: string;
          created_at?: string;
          deleted_at?: string | null;
          delivery_appt_end?: string | null;
          delivery_appt_start?: string | null;
          delivery_date: string;
          delivery_notes?: string | null;
          dest_address?: string | null;
          dest_address_normalized?: string | null;
          dest_address_raw?: string | null;
          dest_city: string;
          dest_geocode_confidence?: string | null;
          dest_place_id?: string | null;
          dest_state: string;
          dest_zip?: string | null;
          equipment: string;
          freight_class?: string | null;
          full_partial?: string | null;
          hazmat?: boolean;
          height_in?: number | null;
          id?: string;
          length_in?: number | null;
          load_number: string;
          loading_notes?: string | null;
          origin_address?: string | null;
          origin_address_normalized?: string | null;
          origin_address_raw?: string | null;
          origin_city: string;
          origin_geocode_confidence?: string | null;
          origin_place_id?: string | null;
          origin_state: string;
          origin_zip?: string | null;
          packaging_type?: string | null;
          pallets_count?: number | null;
          pickup_appt_end?: string | null;
          pickup_appt_start?: string | null;
          pickup_date: string;
          pieces_count?: number | null;
          po_number?: string | null;
          posted_at?: string;
          posted_by?: string | null;
          preferred_carriers_only?: boolean;
          rate_per_mile?: number | null;
          rate_usd: number;
          receiver_contact_email?: string | null;
          receiver_contact_name?: string | null;
          receiver_contact_phone?: string | null;
          receiver_name?: string | null;
          search_vector?: unknown;
          second_driver_id?: string | null;
          shipper_contact_email?: string | null;
          shipper_contact_name?: string | null;
          shipper_contact_phone?: string | null;
          shipper_name?: string | null;
          shipper_reference?: string | null;
          special_instructions?: string | null;
          stackable?: boolean | null;
          status?: string;
          temp_controlled?: boolean;
          total_miles?: number | null;
          visibility?: string;
          hazmat_proper_shipping_name?: string | null;
          hazmat_class?: string | null;
          hazmat_un_number?: string | null;
          hazmat_packing_group?: string | null;
          hazmat_quantity?: string | null;
          hazmat_emergency_phone?: string | null;
          hazmat_placard_required?: boolean;
          hazmat_reportable_quantity?: boolean;
          weight_lbs: number;
          width_in?: number | null;
        };
        Update: {
          assigned_driver_id?: string | null;
          assignee_id?: string | null;
          bid_count?: number;
          broker_credit_score?: number | null;
          commodity?: string;
          company_id?: string | null;
          company_name?: string;
          created_at?: string;
          deleted_at?: string | null;
          delivery_appt_end?: string | null;
          delivery_appt_start?: string | null;
          delivery_date?: string;
          delivery_notes?: string | null;
          dest_address?: string | null;
          dest_address_normalized?: string | null;
          dest_address_raw?: string | null;
          dest_city?: string;
          dest_geocode_confidence?: string | null;
          dest_place_id?: string | null;
          dest_state?: string;
          dest_zip?: string | null;
          equipment?: string;
          freight_class?: string | null;
          full_partial?: string | null;
          hazmat?: boolean;
          height_in?: number | null;
          id?: string;
          length_in?: number | null;
          load_number?: string;
          loading_notes?: string | null;
          origin_address?: string | null;
          origin_address_normalized?: string | null;
          origin_address_raw?: string | null;
          origin_city?: string;
          origin_geocode_confidence?: string | null;
          origin_place_id?: string | null;
          origin_state?: string;
          origin_zip?: string | null;
          packaging_type?: string | null;
          pallets_count?: number | null;
          pickup_appt_end?: string | null;
          pickup_appt_start?: string | null;
          pickup_date?: string;
          pieces_count?: number | null;
          po_number?: string | null;
          posted_at?: string;
          posted_by?: string | null;
          preferred_carriers_only?: boolean;
          rate_per_mile?: number | null;
          rate_usd?: number;
          receiver_contact_email?: string | null;
          receiver_contact_name?: string | null;
          receiver_contact_phone?: string | null;
          receiver_name?: string | null;
          search_vector?: unknown;
          second_driver_id?: string | null;
          shipper_contact_email?: string | null;
          shipper_contact_name?: string | null;
          shipper_contact_phone?: string | null;
          shipper_name?: string | null;
          shipper_reference?: string | null;
          special_instructions?: string | null;
          stackable?: boolean | null;
          status?: string;
          temp_controlled?: boolean;
          total_miles?: number | null;
          visibility?: string;
          hazmat_proper_shipping_name?: string | null;
          hazmat_class?: string | null;
          hazmat_un_number?: string | null;
          hazmat_packing_group?: string | null;
          hazmat_quantity?: string | null;
          hazmat_emergency_phone?: string | null;
          hazmat_placard_required?: boolean;
          hazmat_reportable_quantity?: boolean;
          weight_lbs?: number;
          width_in?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'loads_assigned_driver_id_fkey';
            columns: ['assigned_driver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loads_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loads_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loads_posted_by_fkey';
            columns: ['posted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loads_second_driver_id_fkey';
            columns: ['second_driver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      location_access_audit: {
        Row: {
          access_timestamp: string;
          access_type: string;
          accessed_driver_id: string | null;
          accessed_load_number: string | null;
          accessor_id: string | null;
          accessor_role: string | null;
          id: string;
          ip_address: unknown;
          metadata: Json | null;
          user_agent: string | null;
        };
        Insert: {
          access_timestamp?: string;
          access_type: string;
          accessed_driver_id?: string | null;
          accessed_load_number?: string | null;
          accessor_id?: string | null;
          accessor_role?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: Json | null;
          user_agent?: string | null;
        };
        Update: {
          access_timestamp?: string;
          access_type?: string;
          accessed_driver_id?: string | null;
          accessed_load_number?: string | null;
          accessor_id?: string | null;
          accessor_role?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: Json | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'location_access_audit_accessed_driver_id_fkey';
            columns: ['accessed_driver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_access_audit_accessor_id_fkey';
            columns: ['accessor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      location_pings: {
        Row: {
          accuracy_m: number | null;
          driver_id: string | null;
          heading_deg: number | null;
          id: string;
          latitude: number;
          load_number: string;
          longitude: number;
          recorded_at: string;
          speed_ms: number | null;
        };
        Insert: {
          accuracy_m?: number | null;
          driver_id?: string | null;
          heading_deg?: number | null;
          id?: string;
          latitude: number;
          load_number: string;
          longitude: number;
          recorded_at?: string;
          speed_ms?: number | null;
        };
        Update: {
          accuracy_m?: number | null;
          driver_id?: string | null;
          heading_deg?: number | null;
          id?: string;
          latitude?: number;
          load_number?: string;
          longitude?: number;
          recorded_at?: string;
          speed_ms?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'location_pings_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          conversation_id: string;
          created_at: string;
          from_me: boolean;
          id: string;
          read: boolean;
          sender_id: string | null;
          text: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          from_me?: boolean;
          id?: string;
          read?: boolean;
          sender_id?: string | null;
          text: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          from_me?: boolean;
          id?: string;
          read?: boolean;
          sender_id?: string | null;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_preferences: {
        Row: {
          phone_number: string | null;
          settings: Json;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          phone_number?: string | null;
          settings?: Json;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          phone_number?: string | null;
          settings?: Json;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_queue: {
        Row: {
          attempts: number;
          created_at: string | null;
          error_message: string | null;
          id: string;
          max_attempts: number;
          next_retry_at: string | null;
          payload: Json;
          recipient: string;
          sent_at: string | null;
          status: string;
          subject: string | null;
          type: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          max_attempts?: number;
          next_retry_at?: string | null;
          payload?: Json;
          recipient: string;
          sent_at?: string | null;
          status?: string;
          subject?: string | null;
          type: string;
        };
        Update: {
          attempts?: number;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          max_attempts?: number;
          next_retry_at?: string | null;
          payload?: Json;
          recipient?: string;
          sent_at?: string | null;
          status?: string;
          subject?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          load_id: string | null;
          read: boolean;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          load_id?: string | null;
          read?: boolean;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          load_id?: string | null;
          read?: boolean;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          current_duty_status: Database['public']['Enums']['duty_status'] | null;
          duty_status_updated_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          last_known_location: unknown;
          last_location_update: string | null;
          onboarding_complete: boolean;
          phone: string | null;
          phone_verified_at: string | null;
          phone_carrier_type: string | null;
          last_synced_at: string | null;
          carrier_id: string | null;
          status: string;
          role: string;
          theme: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          current_duty_status?: Database['public']['Enums']['duty_status'] | null;
          duty_status_updated_at?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          last_known_location?: unknown;
          last_location_update?: string | null;
          onboarding_complete?: boolean;
          phone?: string | null;
          phone_verified_at?: string | null;
          phone_carrier_type?: string | null;
          last_synced_at?: string | null;
          carrier_id?: string | null;
          status?: string;
          role?: string;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          current_duty_status?: Database['public']['Enums']['duty_status'] | null;
          duty_status_updated_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          last_known_location?: unknown;
          last_location_update?: string | null;
          onboarding_complete?: boolean;
          phone?: string | null;
          phone_verified_at?: string | null;
          phone_carrier_type?: string | null;
          last_synced_at?: string | null;
          carrier_id?: string | null;
          status?: string;
          role?: string;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string | null;
          endpoint: string;
          id: string;
          last_used_at: string | null;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string | null;
          endpoint: string;
          id?: string;
          last_used_at?: string | null;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string | null;
          endpoint?: string;
          id?: string;
          last_used_at?: string | null;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_history: {
        Row: {
          dest_state: string;
          equipment: string;
          id: string;
          lane_hash: string;
          load_id: string | null;
          origin_state: string;
          rate_per_mile: number | null;
          rate_usd: number;
          recorded_at: string | null;
          total_miles: number | null;
        };
        Insert: {
          dest_state: string;
          equipment: string;
          id?: string;
          lane_hash: string;
          load_id?: string | null;
          origin_state: string;
          rate_per_mile?: number | null;
          rate_usd: number;
          recorded_at?: string | null;
          total_miles?: number | null;
        };
        Update: {
          dest_state?: string;
          equipment?: string;
          id?: string;
          lane_hash?: string;
          load_id?: string | null;
          origin_state?: string;
          rate_per_mile?: number | null;
          rate_usd?: number;
          recorded_at?: string | null;
          total_miles?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rate_history_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
        ];
      };
      ratings: {
        Row: {
          comment: string | null;
          communication: number | null;
          created_at: string;
          id: string;
          load_id: string;
          overall: number;
          professionalism: number | null;
          rated_company_id: string;
          rater_id: string;
          reliability: number | null;
        };
        Insert: {
          comment?: string | null;
          communication?: number | null;
          created_at?: string;
          id?: string;
          load_id: string;
          overall: number;
          professionalism?: number | null;
          rated_company_id: string;
          rater_id: string;
          reliability?: number | null;
        };
        Update: {
          comment?: string | null;
          communication?: number | null;
          created_at?: string;
          id?: string;
          load_id?: string;
          overall?: number;
          professionalism?: number | null;
          rated_company_id?: string;
          rater_id?: string;
          reliability?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ratings_load_id_fkey';
            columns: ['load_id'];
            isOneToOne: false;
            referencedRelation: 'loads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_rated_company_id_fkey';
            columns: ['rated_company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_rater_id_fkey';
            columns: ['rater_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_searches: {
        Row: {
          alert_enabled: boolean;
          created_at: string | null;
          filters: Json;
          id: string;
          last_alerted_at: string | null;
          name: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          alert_enabled?: boolean;
          created_at?: string | null;
          filters?: Json;
          id?: string;
          last_alerted_at?: string | null;
          name: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          alert_enabled?: boolean;
          created_at?: string | null;
          filters?: Json;
          id?: string;
          last_alerted_at?: string | null;
          name?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_searches_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      spatial_ref_sys: {
        Row: {
          auth_name: string | null;
          auth_srid: number | null;
          proj4text: string | null;
          srid: number;
          srtext: string | null;
        };
        Insert: {
          auth_name?: string | null;
          auth_srid?: number | null;
          proj4text?: string | null;
          srid: number;
          srtext?: string | null;
        };
        Update: {
          auth_name?: string | null;
          auth_srid?: number | null;
          proj4text?: string | null;
          srid?: number;
          srtext?: string | null;
        };
        Relationships: [];
      };
      tier_feature_limits: {
        Row: {
          tier: string;
          max_active_loads: number | null;
          max_saved_searches: number | null;
          load_alerts: boolean;
          rate_analytics: boolean;
          api_access: boolean;
          priority_support: boolean;
          white_label: boolean;
          factoring_rate: number | null;
        };
        Insert: {
          tier: string;
          max_active_loads?: number | null;
          max_saved_searches?: number | null;
          load_alerts?: boolean;
          rate_analytics?: boolean;
          api_access?: boolean;
          priority_support?: boolean;
          white_label?: boolean;
          factoring_rate?: number | null;
        };
        Update: {
          tier?: string;
          max_active_loads?: number | null;
          max_saved_searches?: number | null;
          load_alerts?: boolean;
          rate_analytics?: boolean;
          api_access?: boolean;
          priority_support?: boolean;
          white_label?: boolean;
          factoring_rate?: number | null;
        };
        Relationships: [];
      };
      tracking_milestones: {
        Row: {
          completed: boolean;
          created_at: string;
          current: boolean;
          id: string;
          label: string;
          load_number: string;
          location: string;
          milestone_timestamp: string | null;
          sort_order: number;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          current?: boolean;
          id?: string;
          label: string;
          load_number: string;
          location: string;
          milestone_timestamp?: string | null;
          sort_order?: number;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          current?: boolean;
          id?: string;
          label?: string;
          load_number?: string;
          location?: string;
          milestone_timestamp?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      trucks: {
        Row: {
          available_date: string;
          company_id: string | null;
          company_name: string;
          created_at: string;
          dest_city: string | null;
          dest_state: string | null;
          driver_id: string | null;
          driver_name: string | null;
          driver_phone: string | null;
          equipment: string;
          id: string;
          length_ft: number | null;
          origin_city: string;
          origin_state: string;
          posted_by: string | null;
          status: string;
          weight_capacity_lbs: number | null;
        };
        Insert: {
          available_date: string;
          company_id?: string | null;
          company_name: string;
          created_at?: string;
          dest_city?: string | null;
          dest_state?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          equipment: string;
          id?: string;
          length_ft?: number | null;
          origin_city: string;
          origin_state: string;
          posted_by?: string | null;
          status?: string;
          weight_capacity_lbs?: number | null;
        };
        Update: {
          available_date?: string;
          company_id?: string | null;
          company_name?: string;
          created_at?: string;
          dest_city?: string | null;
          dest_state?: string | null;
          driver_id?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          equipment?: string;
          id?: string;
          length_ft?: number | null;
          origin_city?: string;
          origin_state?: string;
          posted_by?: string | null;
          status?: string;
          weight_capacity_lbs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trucks_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trucks_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trucks_posted_by_fkey';
            columns: ['posted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      verification_schedule: {
        Row: {
          carrier_id: string;
          company_id: string;
          completed_at: string | null;
          created_at: string | null;
          id: string;
          result: Json | null;
          scheduled_at: string;
          trigger_reason: string | null;
        };
        Insert: {
          carrier_id: string;
          company_id: string;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          result?: Json | null;
          scheduled_at: string;
          trigger_reason?: string | null;
        };
        Update: {
          carrier_id?: string;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          result?: Json | null;
          scheduled_at?: string;
          trigger_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'verification_schedule_carrier_id_fkey';
            columns: ['carrier_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'verification_schedule_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      // ── Phase 3 tables ──────────────────────────────────────────────────
      // ── Phase 4 tables ──────────────────────────────────────────────────
      mobile_devices: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          platform: string;
          app_version: string | null;
          os_version: string | null;
          device_model: string | null;
          push_token: string | null;
          push_enabled: boolean;
          locale: string;
          timezone: string;
          last_active_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          platform: string;
          app_version?: string | null;
          os_version?: string | null;
          device_model?: string | null;
          push_token?: string | null;
          push_enabled?: boolean;
          locale?: string;
          timezone?: string;
          last_active_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_id?: string;
          platform?: string;
          app_version?: string | null;
          os_version?: string | null;
          device_model?: string | null;
          push_token?: string | null;
          push_enabled?: boolean;
          locale?: string;
          timezone?: string;
          last_active_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fuel_cards: {
        Row: {
          id: string;
          company_id: string;
          card_number_masked: string;
          provider: string;
          assigned_driver: string | null;
          assigned_truck: string | null;
          spending_limit_usd: number | null;
          daily_limit_usd: number | null;
          discount_cents_per_gallon: number;
          status: string;
          activated_at: string;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          card_number_masked: string;
          provider: string;
          assigned_driver?: string | null;
          assigned_truck?: string | null;
          spending_limit_usd?: number | null;
          daily_limit_usd?: number | null;
          discount_cents_per_gallon?: number;
          status?: string;
          activated_at?: string;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          card_number_masked?: string;
          provider?: string;
          assigned_driver?: string | null;
          assigned_truck?: string | null;
          spending_limit_usd?: number | null;
          daily_limit_usd?: number | null;
          discount_cents_per_gallon?: number;
          status?: string;
          activated_at?: string;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      fuel_transactions: {
        Row: {
          id: string;
          fuel_card_id: string;
          company_id: string;
          driver_id: string | null;
          load_id: string | null;
          truck_id: string | null;
          transaction_date: string;
          gallons: number;
          price_per_gallon: number;
          discount_applied: number;
          total_usd: number | null;
          retail_price: number | null;
          savings_usd: number | null;
          fuel_type: string;
          location_name: string | null;
          location_city: string | null;
          location_state: string | null;
          odometer_miles: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fuel_card_id: string;
          company_id: string;
          driver_id?: string | null;
          load_id?: string | null;
          truck_id?: string | null;
          transaction_date?: string;
          gallons: number;
          price_per_gallon: number;
          discount_applied?: number;
          retail_price?: number | null;
          fuel_type?: string;
          location_name?: string | null;
          location_city?: string | null;
          location_state?: string | null;
          odometer_miles?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          fuel_card_id?: string;
          company_id?: string;
          driver_id?: string | null;
          load_id?: string | null;
          truck_id?: string | null;
          transaction_date?: string;
          gallons?: number;
          price_per_gallon?: number;
          discount_applied?: number;
          retail_price?: number | null;
          fuel_type?: string;
          location_name?: string | null;
          location_city?: string | null;
          location_state?: string | null;
          odometer_miles?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      factoring_risk_assessments: {
        Row: {
          id: string;
          factoring_request_id: string;
          carrier_company_id: string;
          broker_company_id: string | null;
          load_id: string;
          carrier_history_score: number;
          broker_credit_score: number;
          load_risk_score: number;
          verification_score: number;
          relationship_score: number;
          overall_risk_score: number;
          risk_level: string;
          decision: string;
          decision_reasons: Json;
          base_fee_pct: number;
          adjusted_fee_pct: number;
          assessed_at: string;
          assessed_by: string;
        };
        Insert: {
          id?: string;
          factoring_request_id: string;
          carrier_company_id: string;
          broker_company_id?: string | null;
          load_id: string;
          carrier_history_score?: number;
          broker_credit_score?: number;
          load_risk_score?: number;
          verification_score?: number;
          relationship_score?: number;
          overall_risk_score?: number;
          risk_level?: string;
          decision?: string;
          decision_reasons?: Json;
          base_fee_pct?: number;
          adjusted_fee_pct?: number;
          assessed_at?: string;
          assessed_by?: string;
        };
        Update: {
          id?: string;
          factoring_request_id?: string;
          carrier_company_id?: string;
          broker_company_id?: string | null;
          load_id?: string;
          carrier_history_score?: number;
          broker_credit_score?: number;
          load_risk_score?: number;
          verification_score?: number;
          relationship_score?: number;
          overall_risk_score?: number;
          risk_level?: string;
          decision?: string;
          decision_reasons?: Json;
          base_fee_pct?: number;
          adjusted_fee_pct?: number;
          assessed_at?: string;
          assessed_by?: string;
        };
        Relationships: [];
      };
      factoring_exposure_limits: {
        Row: {
          id: string;
          company_id: string;
          max_outstanding_usd: number;
          max_single_invoice_usd: number;
          min_risk_score: number;
          auto_approve_above: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          max_outstanding_usd?: number;
          max_single_invoice_usd?: number;
          min_risk_score?: number;
          auto_approve_above?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          max_outstanding_usd?: number;
          max_single_invoice_usd?: number;
          min_risk_score?: number;
          auto_approve_above?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      identity_verifications: {
        Row: {
          id: string;
          user_id: string;
          company_id: string | null;
          check_type: string;
          status: string;
          confidence: number | null;
          provider: string | null;
          provider_ref: string | null;
          failure_reason: string | null;
          metadata: Json;
          expires_at: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id?: string | null;
          check_type: string;
          status?: string;
          confidence?: number | null;
          provider?: string | null;
          provider_ref?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          expires_at?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_id?: string | null;
          check_type?: string;
          status?: string;
          confidence?: number | null;
          provider?: string | null;
          provider_ref?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          expires_at?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      phone_verifications: {
        Row: {
          id: string;
          user_id: string;
          phone_number: string;
          country_code: string;
          carrier_name: string | null;
          carrier_type: string | null;
          is_voip: boolean | null;
          is_prepaid: boolean | null;
          is_ported: boolean | null;
          risk_score: number | null;
          risk_flags: Json;
          provider: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phone_number: string;
          country_code?: string;
          carrier_name?: string | null;
          carrier_type?: string | null;
          is_voip?: boolean | null;
          is_prepaid?: boolean | null;
          is_ported?: boolean | null;
          risk_score?: number | null;
          risk_flags?: Json;
          provider?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phone_number?: string;
          country_code?: string;
          carrier_name?: string | null;
          carrier_type?: string | null;
          is_voip?: boolean | null;
          is_prepaid?: boolean | null;
          is_ported?: boolean | null;
          risk_score?: number | null;
          risk_flags?: Json;
          provider?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sync_queue: {
        Row: {
          id: string;
          user_id: string;
          device_id: string | null;
          entity_type: string;
          operation: string;
          entity_id: string | null;
          payload: Json;
          client_timestamp: string;
          status: string;
          error_message: string | null;
          attempt_count: number;
          max_attempts: number;
          processed_at: string | null;
          server_entity_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id?: string | null;
          entity_type: string;
          operation: string;
          entity_id?: string | null;
          payload: Json;
          client_timestamp: string;
          status?: string;
          error_message?: string | null;
          attempt_count?: number;
          max_attempts?: number;
          processed_at?: string | null;
          server_entity_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_id?: string | null;
          entity_type?: string;
          operation?: string;
          entity_id?: string | null;
          payload?: Json;
          client_timestamp?: string;
          status?: string;
          error_message?: string | null;
          attempt_count?: number;
          max_attempts?: number;
          processed_at?: string | null;
          server_entity_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sync_conflicts: {
        Row: {
          id: string;
          sync_queue_id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          local_version: Json;
          server_version: Json;
          conflict_fields: string[];
          resolution: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sync_queue_id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          local_version: Json;
          server_version: Json;
          conflict_fields: string[];
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sync_queue_id?: string;
          user_id?: string;
          entity_type?: string;
          entity_id?: string;
          local_version?: Json;
          server_version?: Json;
          conflict_fields?: string[];
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      spot_rate_snapshots: {
        Row: {
          id: string;
          snapshot_date: string;
          origin_state: string;
          dest_state: string;
          equipment: string;
          avg_rate_per_mile: number;
          median_rate_per_mile: number | null;
          p25_rate: number | null;
          p75_rate: number | null;
          min_rate: number | null;
          max_rate: number | null;
          stddev_rate: number | null;
          sample_count: number;
          load_count: number;
          fill_rate_pct: number | null;
          day_over_day_pct: number | null;
          week_over_week_pct: number | null;
          trend_direction: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_date: string;
          origin_state: string;
          dest_state: string;
          equipment: string;
          avg_rate_per_mile: number;
          median_rate_per_mile?: number | null;
          p25_rate?: number | null;
          p75_rate?: number | null;
          min_rate?: number | null;
          max_rate?: number | null;
          stddev_rate?: number | null;
          sample_count: number;
          load_count?: number;
          fill_rate_pct?: number | null;
          day_over_day_pct?: number | null;
          week_over_week_pct?: number | null;
          trend_direction?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_date?: string;
          origin_state?: string;
          dest_state?: string;
          equipment?: string;
          avg_rate_per_mile?: number;
          median_rate_per_mile?: number | null;
          p25_rate?: number | null;
          p75_rate?: number | null;
          min_rate?: number | null;
          max_rate?: number | null;
          stddev_rate?: number | null;
          sample_count?: number;
          load_count?: number;
          fill_rate_pct?: number | null;
          day_over_day_pct?: number | null;
          week_over_week_pct?: number | null;
          trend_direction?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          scopes: string[];
          rate_limit_rpm: number | null;
          ip_whitelist: string[] | null;
          expires_at: string | null;
          last_used_at: string | null;
          revoked_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          scopes?: string[];
          rate_limit_rpm?: number | null;
          ip_whitelist?: string[] | null;
          expires_at?: string | null;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          key_hash?: string;
          key_prefix?: string;
          scopes?: string[];
          rate_limit_rpm?: number | null;
          ip_whitelist?: string[] | null;
          expires_at?: string | null;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      api_key_usage: {
        Row: {
          id: string;
          api_key_id: string;
          endpoint: string;
          method: string;
          response_status: number | null;
          response_time_ms: number | null;
          ip_address: string | null;
          user_agent: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          api_key_id: string;
          endpoint: string;
          method: string;
          response_status?: number | null;
          response_time_ms?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          api_key_id?: string;
          endpoint?: string;
          method?: string;
          response_status?: number | null;
          response_time_ms?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      dock_appointments: {
        Row: {
          id: string;
          facility_id: string;
          dock_slot_id: string;
          load_id: string | null;
          appointment_type: string;
          scheduled_start: string;
          scheduled_end: string;
          carrier_company_id: string | null;
          driver_name: string | null;
          truck_number: string | null;
          trailer_number: string | null;
          status: string;
          checked_in_at: string | null;
          loading_started_at: string | null;
          checked_out_at: string | null;
          dwell_minutes: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          dock_slot_id: string;
          load_id?: string | null;
          appointment_type: string;
          scheduled_start: string;
          scheduled_end: string;
          carrier_company_id?: string | null;
          driver_name?: string | null;
          truck_number?: string | null;
          trailer_number?: string | null;
          status?: string;
          checked_in_at?: string | null;
          loading_started_at?: string | null;
          checked_out_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          facility_id?: string;
          dock_slot_id?: string;
          load_id?: string | null;
          appointment_type?: string;
          scheduled_start?: string;
          scheduled_end?: string;
          carrier_company_id?: string | null;
          driver_name?: string | null;
          truck_number?: string | null;
          trailer_number?: string | null;
          status?: string;
          checked_in_at?: string | null;
          loading_started_at?: string | null;
          checked_out_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      dock_slots: {
        Row: {
          id: string;
          facility_id: string;
          slot_name: string;
          slot_type: string;
          equipment_types: string[] | null;
          slot_duration_minutes: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          slot_name: string;
          slot_type?: string;
          equipment_types?: string[] | null;
          slot_duration_minutes?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          facility_id?: string;
          slot_name?: string;
          slot_type?: string;
          equipment_types?: string[] | null;
          slot_duration_minutes?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      eld_devices: {
        Row: {
          id: string;
          company_id: string;
          device_serial: string;
          provider: string;
          vehicle_id: string | null;
          driver_id: string | null;
          status: string;
          last_sync_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          device_serial: string;
          provider: string;
          vehicle_id?: string | null;
          driver_id?: string | null;
          status?: string;
          last_sync_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          device_serial?: string;
          provider?: string;
          vehicle_id?: string | null;
          driver_id?: string | null;
          status?: string;
          last_sync_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      facilities: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          address: string | null;
          city: string;
          state: string;
          zip: string | null;
          lat: number | null;
          lng: number | null;
          contact_name: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          operating_hours: Json;
          timezone: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          address?: string | null;
          city: string;
          state: string;
          zip?: string | null;
          lat?: number | null;
          lng?: number | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          operating_hours?: Json;
          timezone?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          address?: string | null;
          city?: string;
          state?: string;
          zip?: string | null;
          lat?: number | null;
          lng?: number | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          operating_hours?: Json;
          timezone?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      hos_daily_summary: {
        Row: {
          id: string;
          driver_id: string;
          log_date: string;
          driving_minutes: number;
          on_duty_minutes: number;
          sleeper_minutes: number;
          off_duty_minutes: number;
          total_miles: number | null;
          violations_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          log_date: string;
          driving_minutes?: number;
          on_duty_minutes?: number;
          sleeper_minutes?: number;
          off_duty_minutes?: number;
          total_miles?: number | null;
          violations_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          log_date?: string;
          driving_minutes?: number;
          on_duty_minutes?: number;
          sleeper_minutes?: number;
          off_duty_minutes?: number;
          total_miles?: number | null;
          violations_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      hos_duty_log: {
        Row: {
          id: string;
          driver_id: string;
          status: Database['public']['Enums']['hos_duty_status'];
          started_at: string;
          ended_at: string | null;
          duration_minutes: number | null;
          location_lat: number | null;
          location_lng: number | null;
          location_description: string | null;
          odometer_miles: number | null;
          vehicle_id: string | null;
          source: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          status: Database['public']['Enums']['hos_duty_status'];
          started_at?: string;
          ended_at?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_description?: string | null;
          odometer_miles?: number | null;
          vehicle_id?: string | null;
          source?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          status?: Database['public']['Enums']['hos_duty_status'];
          started_at?: string;
          ended_at?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_description?: string | null;
          odometer_miles?: number | null;
          vehicle_id?: string | null;
          source?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      hos_violations: {
        Row: {
          id: string;
          driver_id: string;
          violation_type: string;
          violation_date: string;
          description: string | null;
          duty_log_id: string | null;
          severity: string;
          resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          violation_type: string;
          violation_date: string;
          description?: string | null;
          duty_log_id?: string | null;
          severity?: string;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          violation_type?: string;
          violation_date?: string;
          description?: string | null;
          duty_log_id?: string | null;
          severity?: string;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rfps: {
        Row: {
          id: string;
          company_id: string;
          created_by: string;
          title: string;
          description: string | null;
          contract_start: string;
          contract_end: string;
          volume_estimate: string | null;
          equipment: string | null;
          requirements: Json;
          status: string;
          published_at: string | null;
          closes_at: string | null;
          visibility: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          contract_start: string;
          contract_end: string;
          volume_estimate?: string | null;
          equipment?: string | null;
          requirements?: Json;
          status?: string;
          published_at?: string | null;
          closes_at?: string | null;
          visibility?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          contract_start?: string;
          contract_end?: string;
          volume_estimate?: string | null;
          equipment?: string | null;
          requirements?: Json;
          status?: string;
          published_at?: string | null;
          closes_at?: string | null;
          visibility?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rfp_lanes: {
        Row: {
          id: string;
          rfp_id: string;
          origin_city: string | null;
          origin_state: string;
          dest_city: string | null;
          dest_state: string;
          equipment: string | null;
          loads_per_week: number | null;
          target_rate_usd: number | null;
          special_requirements: string | null;
          status: string;
          awarded_to: string | null;
          awarded_rate: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rfp_id: string;
          origin_city?: string | null;
          origin_state: string;
          dest_city?: string | null;
          dest_state: string;
          equipment?: string | null;
          loads_per_week?: number | null;
          target_rate_usd?: number | null;
          special_requirements?: string | null;
          status?: string;
          awarded_to?: string | null;
          awarded_rate?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rfp_id?: string;
          origin_city?: string | null;
          origin_state?: string;
          dest_city?: string | null;
          dest_state?: string;
          equipment?: string | null;
          loads_per_week?: number | null;
          target_rate_usd?: number | null;
          special_requirements?: string | null;
          status?: string;
          awarded_to?: string | null;
          awarded_rate?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rfp_proposals: {
        Row: {
          id: string;
          rfp_id: string;
          rfp_lane_id: string;
          carrier_company_id: string;
          submitted_by: string;
          proposed_rate_usd: number;
          capacity_per_week: number | null;
          transit_days: number | null;
          equipment_offered: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rfp_id: string;
          rfp_lane_id: string;
          carrier_company_id: string;
          submitted_by: string;
          proposed_rate_usd: number;
          capacity_per_week?: number | null;
          transit_days?: number | null;
          equipment_offered?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rfp_id?: string;
          rfp_lane_id?: string;
          carrier_company_id?: string;
          submitted_by?: string;
          proposed_rate_usd?: number;
          capacity_per_week?: number | null;
          transit_days?: number | null;
          equipment_offered?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipper_reviews: {
        Row: {
          id: string;
          carrier_company_id: string;
          shipper_company_id: string;
          load_id: string;
          reviewer_id: string;
          overall: number;
          loading_efficiency: number | null;
          dock_wait_time: number | null;
          communication: number | null;
          facility_quality: number | null;
          accuracy: number | null;
          comment: string | null;
          detention_occurred: boolean | null;
          detention_minutes: number | null;
          would_work_again: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          carrier_company_id: string;
          shipper_company_id: string;
          load_id: string;
          reviewer_id: string;
          overall: number;
          loading_efficiency?: number | null;
          dock_wait_time?: number | null;
          communication?: number | null;
          facility_quality?: number | null;
          accuracy?: number | null;
          comment?: string | null;
          detention_occurred?: boolean | null;
          detention_minutes?: number | null;
          would_work_again?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          carrier_company_id?: string;
          shipper_company_id?: string;
          load_id?: string;
          reviewer_id?: string;
          overall?: number;
          loading_efficiency?: number | null;
          dock_wait_time?: number | null;
          communication?: number | null;
          facility_quality?: number | null;
          accuracy?: number | null;
          comment?: string | null;
          detention_occurred?: boolean | null;
          detention_minutes?: number | null;
          would_work_again?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null;
          f_geography_column: unknown;
          f_table_catalog: unknown;
          f_table_name: unknown;
          f_table_schema: unknown;
          srid: number | null;
          type: string | null;
        };
        Relationships: [];
      };
      geometry_columns: {
        Row: {
          coord_dimension: number | null;
          f_geometry_column: unknown;
          f_table_catalog: string | null;
          f_table_name: unknown;
          f_table_schema: unknown;
          srid: number | null;
          type: string | null;
        };
        Insert: {
          coord_dimension?: number | null;
          f_geometry_column?: unknown;
          f_table_catalog?: string | null;
          f_table_name?: unknown;
          f_table_schema?: unknown;
          srid?: number | null;
          type?: string | null;
        };
        Update: {
          coord_dimension?: number | null;
          f_geometry_column?: unknown;
          f_table_catalog?: string | null;
          f_table_name?: unknown;
          f_table_schema?: unknown;
          srid?: number | null;
          type?: string | null;
        };
        Relationships: [];
      };
      popular_lanes: {
        Row: {
          avg_rate_per_mile: number | null;
          dest_state: string | null;
          equipment: string | null;
          last_seen_at: string | null;
          load_count: number | null;
          max_rate_per_mile: number | null;
          min_rate_per_mile: number | null;
          origin_state: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string };
        Returns: undefined;
      };
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown };
        Returns: unknown;
      };
      _postgis_pgsql_version: { Args: never; Returns: string };
      _postgis_scripts_pgsql_version: { Args: never; Returns: string };
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown };
        Returns: number;
      };
      _postgis_stats: {
        Args: { ''?: string; att_name: string; tbl: unknown };
        Returns: string;
      };
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_dwithin: {
        Args: {
          geog1: unknown;
          geog2: unknown;
          tolerance: number;
          use_spheroid?: boolean;
        };
        Returns: boolean;
      };
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown };
        Returns: number;
      };
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_sortablehash: { Args: { geom: unknown }; Returns: number };
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_voronoi: {
        Args: {
          clip?: unknown;
          g1: unknown;
          return_polygons?: boolean;
          tolerance?: number;
        };
        Returns: unknown;
      };
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      accept_bid: { Args: { bid_id: string }; Returns: undefined };
      accept_company_invite: { Args: { p_token: string }; Returns: undefined };
      addauth: { Args: { '': string }; Returns: boolean };
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string;
              column_name: string;
              new_dim: number;
              new_srid_in: number;
              new_type: string;
              schema_name: string;
              table_name: string;
              use_typmod?: boolean;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: string;
              new_dim: number;
              new_srid: number;
              new_type: string;
              schema_name: string;
              table_name: string;
              use_typmod?: boolean;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: string;
              new_dim: number;
              new_srid: number;
              new_type: string;
              table_name: string;
              use_typmod?: boolean;
            };
            Returns: string;
          };
      anonymize_driver_location_data: {
        Args: {
          p_date_range_end?: string;
          p_date_range_start?: string;
          p_driver_id: string;
        };
        Returns: {
          rows_deleted: number;
          table_name: string;
        }[];
      };
      benchmark_location_query: {
        Args: { p_load_number: string };
        Returns: {
          execution_time_ms: number;
          query_type: string;
        }[];
      };
      book_now: { Args: { p_load_id: string }; Returns: undefined };
      cleanup_old_audit_logs: { Args: never; Returns: undefined };
      cleanup_old_breadcrumb_snapshots: {
        Args: never;
        Returns: {
          deleted_count: number;
        }[];
      };
      cleanup_old_dwell_records: {
        Args: never;
        Returns: {
          deleted_count: number;
        }[];
      };
      cleanup_old_geofence_events: {
        Args: never;
        Returns: {
          deleted_count: number;
        }[];
      };
      cleanup_old_location_pings: {
        Args: never;
        Returns: {
          deleted_count: number;
        }[];
      };
      disablelongtransactions: { Args: never; Returns: string };
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string;
              column_name: string;
              schema_name: string;
              table_name: string;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: string;
              schema_name: string;
              table_name: string;
            };
            Returns: string;
          }
        | { Args: { column_name: string; table_name: string }; Returns: string };
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string;
              schema_name: string;
              table_name: string;
            };
            Returns: string;
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string };
      enablelongtransactions: { Args: never; Returns: string };
      enqueue_notification: {
        Args: {
          p_payload: Json;
          p_recipient: string;
          p_subject: string;
          p_type: string;
        };
        Returns: string;
      };
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      find_loads_needing_regeocoding: {
        Args: { p_min_confidence?: string };
        Returns: {
          dest_address: string;
          dest_confidence: string;
          load_number: string;
          origin_address: string;
          origin_confidence: string;
        }[];
      };
      find_nearest_available_drivers: {
        Args: {
          p_limit?: number;
          p_max_distance_miles?: number;
          p_pickup_lat: number;
          p_pickup_lng: number;
        };
        Returns: {
          coords_lat: number;
          coords_lng: number;
          distance_miles: number;
          driver_id: string;
          driver_name: string;
          duty_status: Database['public']['Enums']['duty_status'];
          last_update: string;
        }[];
      };
      geometry: { Args: { '': string }; Returns: unknown };
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geomfromewkt: { Args: { '': string }; Returns: unknown };
      get_fleet_availability_summary: {
        Args: { p_company_id: string };
        Returns: {
          avg_time_in_status: string;
          driver_count: number;
          duty_status: Database['public']['Enums']['duty_status'];
        }[];
      };
      get_geocoding_quality_report: {
        Args: never;
        Returns: {
          confidence_level: string;
          dest_count: number;
          origin_count: number;
          total_count: number;
        }[];
      };
      get_lane_stats: {
        Args: {
          p_days?: number;
          p_dest_state: string;
          p_equipment: string;
          p_origin_state: string;
        };
        Returns: {
          avg_rate_per_mile: number;
          last_recorded_at: string;
          max_rate_per_mile: number;
          min_rate_per_mile: number;
          sample_count: number;
        }[];
      };
      get_lane_trend: {
        Args: {
          p_dest_state: string;
          p_equipment: string;
          p_origin_state: string;
        };
        Returns: {
          avg_rate_per_mile: number;
          day: string;
        }[];
      };
      get_latest_driver_ping: {
        Args: { p_driver_id: string };
        Returns: {
          accuracy_m: number;
          heading_deg: number;
          latitude: number;
          longitude: number;
          recorded_at: string;
          speed_ms: number;
        }[];
      };
      get_load_access_history: {
        Args: { p_limit?: number; p_load_number: string };
        Returns: {
          access_timestamp: string;
          access_type: string;
          accessed_driver_name: string;
          accessor_name: string;
          accessor_role: string;
        }[];
      };
      get_location_data_retention_status: {
        Args: never;
        Returns: {
          newest_record: string;
          oldest_record: string;
          rows_eligible_for_deletion: number;
          table_name: string;
          total_rows: number;
        }[];
      };
      get_my_company_ids: { Args: never; Returns: string[] };
      get_my_location_access_history: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: {
          access_timestamp: string;
          access_type: string;
          accessor_name: string;
          accessor_role: string;
          ip_address: unknown;
          load_number: string;
        }[];
      };
      get_onduty_drivers_for_carrier: {
        Args: { p_carrier_id: string };
        Returns: {
          coords_lat: number;
          coords_lng: number;
          current_load_number: string;
          driver_id: string;
          driver_name: string;
          duty_status: Database['public']['Enums']['duty_status'];
          last_update: string;
        }[];
      };
      gettransactionid: { Args: never; Returns: unknown };
      increment_bid_count: { Args: { load_id: string }; Returns: undefined };
      log_location_access: {
        Args: {
          p_access_type: string;
          p_accessed_driver_id: string;
          p_accessed_load_number: string;
          p_metadata?: Json;
        };
        Returns: boolean;
      };
      log_location_access_batch: {
        Args: {
          p_access_type: string;
          p_accessed_driver_ids: string[];
          p_accessed_load_number: string;
        };
        Returns: boolean;
      };
      longtransactionsenabled: { Args: never; Returns: boolean };
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string };
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: number;
      };
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: number;
      };
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: string;
      };
      postgis_extensions_upgrade: { Args: never; Returns: string };
      postgis_full_version: { Args: never; Returns: string };
      postgis_geos_version: { Args: never; Returns: string };
      postgis_lib_build_date: { Args: never; Returns: string };
      postgis_lib_revision: { Args: never; Returns: string };
      postgis_lib_version: { Args: never; Returns: string };
      postgis_libjson_version: { Args: never; Returns: string };
      postgis_liblwgeom_version: { Args: never; Returns: string };
      postgis_libprotobuf_version: { Args: never; Returns: string };
      postgis_libxml_version: { Args: never; Returns: string };
      postgis_proj_version: { Args: never; Returns: string };
      postgis_scripts_build_date: { Args: never; Returns: string };
      postgis_scripts_installed: { Args: never; Returns: string };
      postgis_scripts_released: { Args: never; Returns: string };
      postgis_svn_version: { Args: never; Returns: string };
      postgis_type_name: {
        Args: {
          coord_dimension: number;
          geomname: string;
          use_new_name?: boolean;
        };
        Returns: string;
      };
      postgis_version: { Args: never; Returns: string };
      postgis_wagyu_version: { Args: never; Returns: string };
      record_broker_payment: {
        Args: {
          p_amount_usd: number;
          p_company_id: string;
          p_days_to_pay: number;
          p_on_time: boolean;
        };
        Returns: undefined;
      };
      run_location_data_retention_policy: {
        Args: never;
        Returns: {
          deleted_count: number;
          executed_at: string;
          table_name: string;
        }[];
      };
      search_loads: {
        Args: {
          p_dest_state?: string;
          p_equipment?: string;
          p_origin_state?: string;
          p_page?: number;
          p_page_size?: number;
          p_query: string;
          p_status?: string;
        };
        Returns: {
          bid_count: number;
          commodity: string;
          company_name: string;
          dest_city: string;
          dest_state: string;
          equipment: string;
          id: string;
          load_number: string;
          origin_city: string;
          origin_state: string;
          pickup_date: string;
          posted_at: string;
          rank: number;
          rate_per_mile: number;
          rate_usd: number;
          status: string;
          total_miles: number;
        }[];
      };
      set_driver_duty_status: {
        Args: {
          p_driver_id: string;
          p_duty_status: Database['public']['Enums']['duty_status'];
        };
        Returns: undefined;
      };
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown };
            Returns: number;
          };
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { '': string }; Returns: number };
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number };
        Returns: string;
      };
      st_asewkt: { Args: { '': string }; Returns: string };
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number };
            Returns: string;
          }
        | {
            Args: {
              geom_column?: string;
              maxdecimaldigits?: number;
              pretty_bool?: boolean;
              r: Record<string, unknown>;
            };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string };
      st_asgml:
        | {
            Args: {
              geog: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
            };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string }
        | {
            Args: {
              geog: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
              version: number;
            };
            Returns: string;
          }
        | {
            Args: {
              geom: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
              version: number;
            };
            Returns: string;
          };
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string };
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string };
        Returns: string;
      };
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string };
      st_asmvtgeom: {
        Args: {
          bounds: unknown;
          buffer?: number;
          clip_geom?: boolean;
          extent?: number;
          geom: unknown;
        };
        Returns: unknown;
      };
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string };
      st_astext: { Args: { '': string }; Returns: string };
      st_astwkb:
        | {
            Args: {
              geom: unknown;
              prec?: number;
              prec_m?: number;
              prec_z?: number;
              with_boxes?: boolean;
              with_sizes?: boolean;
            };
            Returns: string;
          }
        | {
            Args: {
              geom: unknown[];
              ids: number[];
              prec?: number;
              prec_m?: number;
              prec_z?: number;
              with_boxes?: boolean;
              with_sizes?: boolean;
            };
            Returns: string;
          };
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number };
        Returns: string;
      };
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number };
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown };
        Returns: unknown;
      };
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number };
            Returns: unknown;
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number };
            Returns: unknown;
          };
      st_centroid: { Args: { '': string }; Returns: unknown };
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown };
        Returns: unknown;
      };
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown };
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean;
          param_geom: unknown;
          param_pctconvex: number;
        };
        Returns: unknown;
      };
      st_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_coorddim: { Args: { geometry: unknown }; Returns: number };
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number };
        Returns: unknown;
      };
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean };
            Returns: number;
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number };
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number };
            Returns: number;
          };
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_dwithin: {
        Args: {
          geog1: unknown;
          geog2: unknown;
          tolerance: number;
          use_spheroid?: boolean;
        };
        Returns: boolean;
      };
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number };
            Returns: unknown;
          }
        | {
            Args: {
              dm?: number;
              dx: number;
              dy: number;
              dz?: number;
              geom: unknown;
            };
            Returns: unknown;
          };
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown };
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number };
        Returns: unknown;
      };
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number };
        Returns: unknown;
      };
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number };
        Returns: unknown;
      };
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number };
            Returns: unknown;
          };
      st_geogfromtext: { Args: { '': string }; Returns: unknown };
      st_geographyfromtext: { Args: { '': string }; Returns: unknown };
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string };
      st_geomcollfromtext: { Args: { '': string }; Returns: unknown };
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean;
          g: unknown;
          max_iter?: number;
          tolerance?: number;
        };
        Returns: unknown;
      };
      st_geometryfromtext: { Args: { '': string }; Returns: unknown };
      st_geomfromewkt: { Args: { '': string }; Returns: unknown };
      st_geomfromgeojson:
        | { Args: { '': Json }; Returns: unknown }
        | { Args: { '': Json }; Returns: unknown }
        | { Args: { '': string }; Returns: unknown };
      st_geomfromgml: { Args: { '': string }; Returns: unknown };
      st_geomfromkml: { Args: { '': string }; Returns: unknown };
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown };
      st_geomfromtext: { Args: { '': string }; Returns: unknown };
      st_gmltosql: { Args: { '': string }; Returns: unknown };
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean };
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number };
        Returns: unknown;
      };
      st_hexagongrid: {
        Args: { bounds: unknown; size: number };
        Returns: Record<string, unknown>[];
      };
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown };
        Returns: number;
      };
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown };
        Returns: Database['public']['CompositeTypes']['valid_detail'];
        SetofOptions: {
          from: '*';
          to: 'valid_detail';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { '': string }; Returns: number };
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown };
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown };
        Returns: number;
      };
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string };
        Returns: unknown;
      };
      st_linefromtext: { Args: { '': string }; Returns: unknown };
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown };
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number };
        Returns: unknown;
      };
      st_locatebetween: {
        Args: {
          frommeasure: number;
          geometry: unknown;
          leftrightoffset?: number;
          tomeasure: number;
        };
        Returns: unknown;
      };
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number };
        Returns: unknown;
      };
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makevalid: {
        Args: { geom: unknown; params: string };
        Returns: unknown;
      };
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number };
        Returns: unknown;
      };
      st_mlinefromtext: { Args: { '': string }; Returns: unknown };
      st_mpointfromtext: { Args: { '': string }; Returns: unknown };
      st_mpolyfromtext: { Args: { '': string }; Returns: unknown };
      st_multilinestringfromtext: { Args: { '': string }; Returns: unknown };
      st_multipointfromtext: { Args: { '': string }; Returns: unknown };
      st_multipolygonfromtext: { Args: { '': string }; Returns: unknown };
      st_node: { Args: { g: unknown }; Returns: unknown };
      st_normalize: { Args: { geom: unknown }; Returns: unknown };
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string };
        Returns: unknown;
      };
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean };
        Returns: number;
      };
      st_pointfromtext: { Args: { '': string }; Returns: unknown };
      st_pointm: {
        Args: {
          mcoordinate: number;
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
        };
        Returns: unknown;
      };
      st_pointz: {
        Args: {
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
          zcoordinate: number;
        };
        Returns: unknown;
      };
      st_pointzm: {
        Args: {
          mcoordinate: number;
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
          zcoordinate: number;
        };
        Returns: unknown;
      };
      st_polyfromtext: { Args: { '': string }; Returns: unknown };
      st_polygonfromtext: { Args: { '': string }; Returns: unknown };
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown };
        Returns: unknown;
      };
      st_quantizecoordinates: {
        Args: {
          g: unknown;
          prec_m?: number;
          prec_x: number;
          prec_y?: number;
          prec_z?: number;
        };
        Returns: unknown;
      };
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number };
        Returns: unknown;
      };
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string };
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number };
        Returns: unknown;
      };
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown };
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number };
        Returns: unknown;
      };
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown };
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number };
        Returns: unknown;
      };
      st_squaregrid: {
        Args: { bounds: unknown; size: number };
        Returns: Record<string, unknown>[];
      };
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number };
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number };
        Returns: unknown[];
      };
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown };
        Returns: unknown;
      };
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_tileenvelope: {
        Args: {
          bounds?: unknown;
          margin?: number;
          x: number;
          y: number;
          zoom: number;
        };
        Returns: unknown;
      };
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string };
            Returns: unknown;
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number };
            Returns: unknown;
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown };
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown };
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number };
            Returns: unknown;
          };
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown };
      st_wkttosql: { Args: { '': string }; Returns: unknown };
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number };
        Returns: unknown;
      };
      unlockrows: { Args: { '': string }; Returns: number };
      update_driver_location: {
        Args: { p_driver_id: string; p_latitude: number; p_longitude: number };
        Returns: undefined;
      };
      updategeometrysrid: {
        Args: {
          catalogn_name: string;
          column_name: string;
          new_srid_in: number;
          schema_name: string;
          table_name: string;
        };
        Returns: string;
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_diff?: Json;
          p_entity_id: string;
          p_entity_type: string;
          p_ip?: string;
        };
        Returns: string;
      };
      check_broker_verified: {
        Args: {
          p_company_id: string;
        };
        Returns: boolean;
      };
      get_broker_payment_summary: {
        Args: {
          p_company_id: string;
        };
        Returns: Json;
      };
      check_late_pickups: {
        Args: Record<string, never>;
        Returns: number;
      };
      check_delivery_delays: {
        Args: Record<string, never>;
        Returns: number;
      };
      acknowledge_alert: {
        Args: {
          p_alert_id: string;
        };
        Returns: undefined;
      };
      get_carrier_scorecards: {
        Args: {
          p_shipper_company_id: string;
          p_lane?: string | null;
        };
        Returns: {
          carrier_company_id: string;
          carrier_name: string;
          lane: string;
          total_loads: number;
          completed_loads: number;
          on_time_pct: number;
          avg_transit_days: number;
          avg_rate_per_mile: number;
          last_shipment_at: string;
          reliability_grade: string;
        }[];
      };
      refresh_carrier_scorecards: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      check_feature_access: {
        Args: {
          p_company_id: string;
          p_feature: string;
        };
        Returns: Json;
      };
      get_company_tier: {
        Args: {
          p_company_id: string;
        };
        Returns: Json;
      };
      grant_gps_consent: {
        Args: {
          p_consent_text: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: string;
      };
      revoke_gps_consent: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      has_gps_consent: {
        Args: {
          p_user_id?: string | null;
        };
        Returns: boolean;
      };
      validate_bol_requirements: {
        Args: {
          p_load_id: string;
        };
        Returns: Json;
      };
      check_hazmat_eligible: {
        Args: {
          p_company_id: string;
        };
        Returns: boolean;
      };
      check_insurance_adequate: {
        Args: {
          p_company_id: string;
          p_hazmat?: boolean;
        };
        Returns: boolean;
      };
      soft_delete_load: {
        Args: {
          p_load_id: string;
        };
        Returns: undefined;
      };
      send_notification: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_title: string;
          p_body?: string | null;
          p_load_id?: string | null;
        };
        Returns: string;
      };
      notify_carriers_new_load: {
        Args: {
          p_load_id: string;
        };
        Returns: undefined;
      };
      submit_broker_review: {
        Args: {
          p_load_id: string;
          p_overall: number;
          p_payment_speed?: number | null;
          p_payment_reliability?: number | null;
          p_communication?: number | null;
          p_rate_fairness?: number | null;
          p_comment?: string | null;
          p_would_work_again?: boolean | null;
        };
        Returns: string;
      };
      get_broker_trust_profile: {
        Args: {
          p_broker_company_id: string;
        };
        Returns: Json;
      };
      invite_carriers_to_load: {
        Args: {
          p_load_id: string;
          p_carrier_company_ids: string[];
          p_message?: string | null;
          p_expires_in_hours?: number | null;
        };
        Returns: number;
      };
      get_my_load_invitations: {
        Args: {
          p_status?: string | null;
        };
        Returns: {
          invitation_id: string;
          load_id: string;
          load_number: string;
          origin: string;
          destination: string;
          equipment: string;
          rate_usd: number;
          message: string | null;
          expires_at: string | null;
          invited_at: string;
          broker_name: string;
        }[];
      };
      expire_load_invitations: {
        Args: Record<string, never>;
        Returns: number;
      };
      match_lane_alerts: {
        Args: {
          p_load_id: string;
        };
        Returns: number;
      };
      forecast_lane_rate: {
        Args: {
          p_origin_state: string;
          p_dest_state: string;
          p_equipment: string;
          p_lookback_days?: number | null;
        };
        Returns: Json;
      };
      get_rate_heatmap: {
        Args: {
          p_equipment: string;
          p_origin_state?: string | null;
          p_days?: number | null;
          p_limit?: number | null;
        };
        Returns: {
          origin_state: string;
          dest_state: string;
          avg_rate_per_mile: number;
          load_count: number;
          trend_direction: string;
          last_seen: string;
        }[];
      };
      refresh_lane_benchmarks: {
        Args: Record<string, never>;
        Returns: number;
      };
      validate_hazmat_shipping_paper: {
        Args: {
          p_load_id: string;
        };
        Returns: Json;
      };
      request_factoring: {
        Args: {
          p_load_id: string;
          p_payment_method?: string | null;
        };
        Returns: Json;
      };
      approve_factoring: {
        Args: {
          p_request_id: string;
          p_payment_reference?: string | null;
        };
        Returns: Json;
      };
      fund_factoring: {
        Args: {
          p_request_id: string;
          p_payment_reference: string;
        };
        Returns: Json;
      };
      get_factoring_stats: {
        Args: {
          p_company_id?: string | null;
        };
        Returns: Json;
      };
      get_lane_suggestions: {
        Args: {
          p_carrier_company_id: string;
          p_limit?: number | null;
        };
        Returns: Json;
      };
      get_backhaul_opportunities: {
        Args: {
          p_current_state: string;
          p_equipment: string;
          p_limit?: number | null;
        };
        Returns: {
          load_id: string;
          load_number: string;
          origin: string;
          destination: string;
          rate_usd: number;
          rate_per_mile: number;
          total_miles: number;
          pickup_date: string;
          delivery_date: string;
          posted_at: string;
        }[];
      };
      set_theme_preference: {
        Args: {
          p_theme: string;
        };
        Returns: undefined;
      };
      // ── Phase 3 RPCs ──────────────────────────────────────────────────
      // ── Phase 4 RPCs ──────────────────────────────────────────────────
      register_mobile_device: {
        Args: {
          p_device_id: string;
          p_platform: string;
          p_push_token?: string | null;
          p_app_version?: string | null;
          p_os_version?: string | null;
          p_device_model?: string | null;
          p_locale?: string;
          p_timezone?: string;
        };
        Returns: string;
      };
      deregister_mobile_device: {
        Args: {
          p_device_id: string;
        };
        Returns: undefined;
      };
      get_my_devices: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          device_id: string;
          platform: string;
          app_version: string | null;
          device_model: string | null;
          push_enabled: boolean;
          last_active_at: string;
        }[];
      };
      issue_fuel_card: {
        Args: {
          p_company_id: string;
          p_card_number_last4: string;
          p_provider: string;
          p_assigned_driver?: string | null;
          p_assigned_truck?: string | null;
          p_spending_limit?: number | null;
          p_daily_limit?: number | null;
          p_discount_cpg?: number;
        };
        Returns: string;
      };
      record_fuel_transaction: {
        Args: {
          p_fuel_card_id: string;
          p_gallons: number;
          p_price_per_gallon: number;
          p_fuel_type?: string;
          p_load_id?: string | null;
          p_truck_id?: string | null;
          p_location_name?: string | null;
          p_location_city?: string | null;
          p_location_state?: string | null;
          p_odometer_miles?: number | null;
        };
        Returns: string;
      };
      get_fuel_summary: {
        Args: {
          p_company_id: string;
          p_days?: number;
        };
        Returns: Json;
      };
      assess_factoring_risk: {
        Args: {
          p_factoring_request_id: string;
        };
        Returns: Json;
      };
      get_factoring_exposure: {
        Args: {
          p_company_id: string;
        };
        Returns: Json;
      };
      set_factoring_exposure_limit: {
        Args: {
          p_company_id: string;
          p_max_outstanding?: number;
          p_max_single_invoice?: number;
          p_min_risk_score?: number;
          p_auto_approve_above?: number;
        };
        Returns: undefined;
      };
      submit_identity_verification: {
        Args: {
          p_user_id: string;
          p_check_type: string;
          p_status: string;
          p_confidence?: number | null;
          p_provider?: string | null;
          p_provider_ref?: string | null;
          p_failure_reason?: string | null;
          p_metadata?: Json;
          p_expires_in_days?: number;
        };
        Returns: string;
      };
      submit_phone_verification: {
        Args: {
          p_user_id: string;
          p_phone_number: string;
          p_carrier_name?: string | null;
          p_carrier_type?: string;
          p_is_voip?: boolean | null;
          p_is_prepaid?: boolean | null;
          p_is_ported?: boolean | null;
          p_risk_score?: number | null;
          p_risk_flags?: Json;
          p_provider?: string | null;
        };
        Returns: Json;
      };
      get_identity_risk_profile: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
      process_sync_queue: {
        Args: {
          p_batch_size?: number;
        };
        Returns: Json;
      };
      resolve_sync_conflict: {
        Args: {
          p_conflict_id: string;
          p_resolution: string;
        };
        Returns: Json;
      };
      get_sync_status: {
        Args: Record<string, never>;
        Returns: Json;
      };
      compute_spot_rate_index: {
        Args: {
          p_snapshot_date?: string;
        };
        Returns: Json;
      };
      get_spot_rate_index: {
        Args: {
          p_origin_state: string;
          p_dest_state: string;
          p_equipment?: string;
          p_days?: number;
        };
        Returns: Json;
      };
      get_shipper_rate_recommendation: {
        Args: {
          p_origin_state: string;
          p_dest_state: string;
          p_equipment?: string;
          p_urgency?: string;
        };
        Returns: Json;
      };
      score_carrier_for_load: {
        Args: {
          p_load_id: string;
          p_carrier_company_id: string;
        };
        Returns: Json;
      };
      rank_carriers_for_load: {
        Args: {
          p_load_id: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      get_driver_hos_status: {
        Args: {
          p_driver_id: string;
        };
        Returns: Json;
      };
      log_duty_transition: {
        Args: {
          p_new_status: string;
          p_location_lat?: number | null;
          p_location_lng?: number | null;
          p_location_description?: string | null;
          p_odometer_miles?: number | null;
          p_vehicle_id?: string | null;
          p_source?: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      aggregate_hos_daily: {
        Args: {
          p_driver_id: string;
          p_log_date: string;
        };
        Returns: undefined;
      };
      submit_shipper_review: {
        Args: {
          p_load_id: string;
          p_overall: number;
          p_loading_efficiency?: number | null;
          p_dock_wait_time?: number | null;
          p_communication?: number | null;
          p_facility_quality?: number | null;
          p_accuracy?: number | null;
          p_comment?: string | null;
          p_detention_occurred?: boolean | null;
          p_detention_minutes?: number | null;
          p_would_work_again?: boolean | null;
        };
        Returns: string;
      };
      get_shipper_trust_profile: {
        Args: {
          p_shipper_company_id: string;
        };
        Returns: Json;
      };
      get_marketplace_trust_summary: {
        Args: {
          p_company_id: string;
        };
        Returns: Json;
      };
      generate_api_key: {
        Args: {
          p_company_id: string;
          p_name: string;
          p_scopes?: string[];
          p_rate_limit?: number | null;
          p_ip_whitelist?: string[] | null;
          p_expires_in_days?: number | null;
        };
        Returns: Json;
      };
      validate_api_key: {
        Args: {
          p_key_raw: string;
          p_scope?: string | null;
          p_ip_address?: string | null;
        };
        Returns: Json;
      };
      revoke_api_key: {
        Args: {
          p_key_id: string;
        };
        Returns: undefined;
      };
      get_api_usage_stats: {
        Args: {
          p_company_id: string;
          p_days?: number;
        };
        Returns: Json;
      };
      get_available_dock_slots: {
        Args: {
          p_facility_id: string;
          p_date: string;
          p_appointment_type?: string;
          p_equipment?: string | null;
        };
        Returns: {
          slot_id: string;
          slot_name: string;
          slot_type: string;
          time_start: string;
          time_end: string;
          available: boolean;
        }[];
      };
      book_dock_appointment: {
        Args: {
          p_dock_slot_id: string;
          p_load_id: string;
          p_scheduled_start: string;
          p_scheduled_end: string;
          p_appointment_type: string;
          p_driver_name?: string | null;
          p_truck_number?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      dock_check_in: {
        Args: {
          p_appointment_id: string;
        };
        Returns: undefined;
      };
      dock_check_out: {
        Args: {
          p_appointment_id: string;
        };
        Returns: Json;
      };
      submit_rfp_proposal: {
        Args: {
          p_rfp_lane_id: string;
          p_proposed_rate_usd: number;
          p_capacity_per_week?: number | null;
          p_transit_days?: number | null;
          p_equipment_offered?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      award_rfp_lane: {
        Args: {
          p_rfp_lane_id: string;
          p_carrier_company_id: string;
          p_awarded_rate: number;
        };
        Returns: Json;
      };
      get_rfp_summary: {
        Args: {
          p_rfp_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      duty_status: 'on_duty' | 'off_duty' | 'sleeper' | 'driving';
      hos_duty_status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';
      load_visibility: 'public' | 'preferred_only' | 'invited_only';
      verification_status: 'pending' | 'verified' | 'failed' | 'expired';
    };
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null;
        geom: unknown;
      };
      valid_detail: {
        valid: boolean | null;
        reason: string | null;
        location: unknown;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      duty_status: ['on_duty', 'off_duty', 'sleeper', 'driving'],
      hos_duty_status: ['off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving'],
      load_visibility: ['public', 'preferred_only', 'invited_only'],
      verification_status: ['pending', 'verified', 'failed', 'expired'],
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Type Exports
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Table Row Types
// ─────────────────────────────────────────────────────────────────────────────

export type LoadRow = Database['public']['Tables']['loads']['Row'];
export type TruckRow = Database['public']['Tables']['trucks']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type CompanyRow = Database['public']['Tables']['companies']['Row'];
export type BidRow = Database['public']['Tables']['bids']['Row'];
export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type TrackingMilestoneRow = Database['public']['Tables']['tracking_milestones']['Row'];
export type RatingRow = Database['public']['Tables']['ratings']['Row'];
export type ConversationRow = Database['public']['Tables']['conversations']['Row'];
export type MessageRow = Database['public']['Tables']['messages']['Row'];
export type CarrierVerificationRow = Database['public']['Tables']['carrier_verifications']['Row'];

// ─────────────────────────────────────────────────────────────────────────────
// Enum & Status Types
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentType = Database['public']['Tables']['documents']['Row']['type'];
export type VerificationStatus = Database['public']['Enums']['verification_status'];

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder Types (for features not yet implemented)
// ─────────────────────────────────────────────────────────────────────────────

export type InvoiceRow = {
  id: string;
  status: InvoiceStatus;
  created_at: string;
  due_date: string;
  amount_usd: number;
  payment_method?: string;
  quick_pay_fee_usd?: number;
  [key: string]: unknown;
};
export type SubscriptionRow = { id: string; tier: string; [key: string]: unknown };
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled' | 'invoiced' | 'approved';
export type SubscriptionTier =
  | 'free'
  | 'basic'
  | 'pro'
  | 'enterprise'
  | 'carrier_pro'
  | 'broker_starter'
  | 'broker_growth'
  | 'shipper';

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports from @freightx/shared (for backwards compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export type { UserRole, EquipmentType, LoadStatus, TruckStatus } from '@freightx/shared';
