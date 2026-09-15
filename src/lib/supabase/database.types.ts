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
      landlords: {
        Row: {
          assigned_ops_contact: string | null
          country_of_residence: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["landlord_status"]
          updated_at: string
        }
        Insert: {
          assigned_ops_contact?: string | null
          country_of_residence?: string | null
          created_at?: string
          id: string
          status?: Database["public"]["Enums"]["landlord_status"]
          updated_at?: string
        }
        Update: {
          assigned_ops_contact?: string | null
          country_of_residence?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["landlord_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landlords_assigned_ops_contact_fkey"
            columns: ["assigned_ops_contact"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landlords_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role_tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role_tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role_tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          bedrooms: number
          city: string
          created_at: string
          id: string
          landlord_id: string
          maintenance_threshold_ngn: number
          status: Database["public"]["Enums"]["property_status"]
          target_annual_rent: number
          updated_at: string
        }
        Insert: {
          address: string
          bedrooms: number
          city?: string
          created_at?: string
          id?: string
          landlord_id: string
          maintenance_threshold_ngn?: number
          status?: Database["public"]["Enums"]["property_status"]
          target_annual_rent: number
          updated_at?: string
        }
        Update: {
          address?: string
          bedrooms?: number
          city?: string
          created_at?: string
          id?: string
          landlord_id?: string
          maintenance_threshold_ngn?: number
          status?: Database["public"]["Enums"]["property_status"]
          target_annual_rent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role_tags: string[]
          status: Database["public"]["Enums"]["staff_invite_status"]
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_tags: string[]
          status?: Database["public"]["Enums"]["staff_invite_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_tags?: string[]
          status?: Database["public"]["Enums"]["staff_invite_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          conversion_status: Database["public"]["Enums"]["waitlist_conversion_status"]
          email: string
          email_confirmed: boolean
          id: string
          joined_at: string
          name: string
          whatsapp_confirmed: boolean
          whatsapp_number: string
        }
        Insert: {
          conversion_status?: Database["public"]["Enums"]["waitlist_conversion_status"]
          email: string
          email_confirmed?: boolean
          id?: string
          joined_at?: string
          name: string
          whatsapp_confirmed?: boolean
          whatsapp_number: string
        }
        Update: {
          conversion_status?: Database["public"]["Enums"]["waitlist_conversion_status"]
          email?: string
          email_confirmed?: boolean
          id?: string
          joined_at?: string
          name?: string
          whatsapp_confirmed?: boolean
          whatsapp_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_tags: { Args: never; Returns: string[] }
      has_role: { Args: { role_tag: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_privileged_writer: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      landlord_status:
        | "applied"
        | "kyc_pending"
        | "kyc_verified"
        | "kyc_rejected"
      property_status: "submitted" | "under_inspection" | "listed" | "rejected"
      staff_invite_status: "pending" | "accepted" | "revoked" | "expired"
      waitlist_conversion_status:
        | "waitlist"
        | "invited_to_convert"
        | "kyc_pending"
        | "active_queue"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      landlord_status: [
        "applied",
        "kyc_pending",
        "kyc_verified",
        "kyc_rejected",
      ],
      property_status: ["submitted", "under_inspection", "listed", "rejected"],
      staff_invite_status: ["pending", "accepted", "revoked", "expired"],
      waitlist_conversion_status: [
        "waitlist",
        "invited_to_convert",
        "kyc_pending",
        "active_queue",
      ],
    },
  },
} as const

