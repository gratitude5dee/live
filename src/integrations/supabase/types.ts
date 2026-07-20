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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      presets: {
        Row: {
          created_at: string
          emoji: string
          expand: boolean
          id: number
          input_hint: string | null
          kind: string
          name: string
          prompt: string
          ref_image_url: string | null
          requires_ref: boolean
          sort_order: number
          template_key: string | null
          thumbnail_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          emoji: string
          expand?: boolean
          id?: never
          input_hint?: string | null
          kind?: string
          name: string
          prompt: string
          ref_image_url?: string | null
          requires_ref?: boolean
          sort_order?: number
          template_key?: string | null
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          emoji?: string
          expand?: boolean
          id?: never
          input_hint?: string | null
          kind?: string
          name?: string
          prompt?: string
          ref_image_url?: string | null
          requires_ref?: boolean
          sort_order?: number
          template_key?: string | null
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      prompt_events: {
        Row: {
          at_ms: number
          created_at: string
          id: number
          kind: string
          prompt: string | null
          ref_image_path: string | null
          session_id: string
          source: string
          user_id: string
        }
        Insert: {
          at_ms: number
          created_at?: string
          id?: never
          kind: string
          prompt?: string | null
          ref_image_path?: string | null
          session_id: string
          source: string
          user_id: string
        }
        Update: {
          at_ms?: number
          created_at?: string
          id?: never
          kind?: string
          prompt?: string | null
          ref_image_path?: string | null
          session_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          ended_at: string | null
          id: string
          started_at: string
          stats: Json
          transport: string | null
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          transport?: string | null
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          transport?: string | null
          user_id?: string
        }
        Relationships: []
      }
      takes: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: number
          kind: string
          session_id: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: never
          kind: string
          session_id: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: never
          kind?: string
          session_id?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      token_mints: {
        Row: {
          id: number
          minted_at: string
          user_id: string
        }
        Insert: {
          id?: never
          minted_at?: string
          user_id: string
        }
        Update: {
          id?: never
          minted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vision_events: {
        Row: {
          action: string | null
          at_ms: number
          created_at: string
          id: number
          kind: string
          label: string
          score: number
          session_id: string
          user_id: string
        }
        Insert: {
          action?: string | null
          at_ms: number
          created_at?: string
          id?: never
          kind: string
          label: string
          score: number
          session_id: string
          user_id: string
        }
        Update: {
          action?: string | null
          at_ms?: number
          created_at?: string
          id?: never
          kind?: string
          label?: string
          score?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_events: {
        Row: {
          ack_word: string | null
          at_ms: number
          created_at: string
          edit_type: string | null
          id: number
          latency_ms: number | null
          lucy_prompt: string | null
          session_id: string
          transcript: string | null
          user_id: string
          wake_detected: boolean
        }
        Insert: {
          ack_word?: string | null
          at_ms: number
          created_at?: string
          edit_type?: string | null
          id?: never
          latency_ms?: number | null
          lucy_prompt?: string | null
          session_id: string
          transcript?: string | null
          user_id: string
          wake_detected?: boolean
        }
        Update: {
          ack_word?: string | null
          at_ms?: number
          created_at?: string
          edit_type?: string | null
          id?: never
          latency_ms?: number | null
          lucy_prompt?: string | null
          session_id?: string
          transcript?: string | null
          user_id?: string
          wake_detected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "voice_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
