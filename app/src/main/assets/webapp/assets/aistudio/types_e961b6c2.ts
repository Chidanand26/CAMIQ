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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
        }
        Relationships: []
      }
      cameras: {
        Row: {
          camera_type: string
          code: string
          created_at: string
          device_label: string | null
          direction: number
          fov: number
          fps: number | null
          id: string
          last_seen: string | null
          lat: number | null
          lng: number | null
          name: string
          neighbors: string[]
          range_m: number
          site_id: string | null
          status: string
        }
        Insert: {
          camera_type?: string
          code: string
          created_at?: string
          device_label?: string | null
          direction?: number
          fov?: number
          fps?: number | null
          id?: string
          last_seen?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          neighbors?: string[]
          range_m?: number
          site_id?: string | null
          status?: string
        }
        Update: {
          camera_type?: string
          code?: string
          created_at?: string
          device_label?: string | null
          direction?: number
          fov?: number
          fps?: number | null
          id?: string
          last_seen?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          neighbors?: string[]
          range_m?: number
          site_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cameras_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_events: {
        Row: {
          camera_code: string | null
          created_at: string
          direction: string | null
          gate: string | null
          id: string
          result: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          camera_code?: string | null
          created_at?: string
          direction?: string | null
          gate?: string | null
          id?: string
          result: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          camera_code?: string | null
          created_at?: string
          direction?: string | null
          gate?: string | null
          id?: string
          result?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      incident_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          incident_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          incident_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_notes_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          assigned_to: string | null
          camera_plan: Json | null
          category: string | null
          created_at: string
          description: string | null
          dest_lat: number | null
          dest_lng: number | null
          discreet: boolean
          female_pref: boolean
          id: string
          kind: string
          lat: number | null
          lng: number | null
          ref: string
          resolved_at: string | null
          site_id: string | null
          status: string
          student_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          camera_plan?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          dest_lat?: number | null
          dest_lng?: number | null
          discreet?: boolean
          female_pref?: boolean
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          ref?: string
          resolved_at?: string | null
          site_id?: string | null
          status?: string
          student_id: string
        }
        Update: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          camera_plan?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          dest_lat?: number | null
          dest_lng?: number | null
          discreet?: boolean
          female_pref?: boolean
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          ref?: string
          resolved_at?: string | null
          site_id?: string | null
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          auth_type: string | null
          base_url: string | null
          key: string
          last_error: string | null
          last_sync: string | null
          state: string
          sync_minutes: number | null
        }
        Insert: {
          auth_type?: string | null
          base_url?: string | null
          key: string
          last_error?: string | null
          last_sync?: string | null
          state?: string
          sync_minutes?: number | null
        }
        Update: {
          auth_type?: string | null
          base_url?: string | null
          key?: string
          last_error?: string | null
          last_sync?: string | null
          state?: string
          sync_minutes?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          campus_state: string
          created_at: string
          department: string | null
          full_name: string
          gender: string | null
          id: string
          on_duty: boolean
          phone: string | null
          student_id: string | null
          trusted_contacts: Json
        }
        Insert: {
          campus_state?: string
          created_at?: string
          department?: string | null
          full_name?: string
          gender?: string | null
          id: string
          on_duty?: boolean
          phone?: string | null
          student_id?: string | null
          trusted_contacts?: Json
        }
        Update: {
          campus_state?: string
          created_at?: string
          department?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          on_duty?: boolean
          phone?: string | null
          student_id?: string | null
          trusted_contacts?: Json
        }
        Relationships: []
      }
      qr_tokens: {
        Row: {
          expires_at: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          expires_at: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string
          id: string
          institution: string | null
          lat: number
          lng: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution?: string | null
          lat: number
          lng: number
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          institution?: string | null
          lat?: number
          lng?: number
          name?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          campus_state: string
          created_at: string
          created_by: string
          destination: string | null
          host: string | null
          id: string
          name: string
          organisation: string | null
          pass_token: string
          reason: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          campus_state?: string
          created_at?: string
          created_by: string
          destination?: string | null
          host?: string | null
          id?: string
          name: string
          organisation?: string | null
          pass_token?: string
          reason?: string | null
          valid_from?: string
          valid_until: string
        }
        Update: {
          campus_state?: string
          created_at?: string
          created_by?: string
          destination?: string | null
          host?: string | null
          id?: string
          name?: string
          organisation?: string | null
          pass_token?: string
          reason?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_gate_token: {
        Args: { _camera: string; _gate: string; _mode: string; _token: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      issue_pass_token: {
        Args: never
        Returns: {
          expires_at: string
          token: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "guard" | "student"
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
      app_role: ["admin", "guard", "student"],
    },
  },
} as const
