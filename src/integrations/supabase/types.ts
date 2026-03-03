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
      admin_activity_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: string | null
          id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "hierarchy_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
        }
        Relationships: []
      }
      colleges: {
        Row: {
          college_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          college_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          college_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          college_id: string
          created_at: string | null
          created_by: string | null
          department_name: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          college_id: string
          created_at?: string | null
          created_by?: string | null
          department_name: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          college_id?: string
          created_at?: string | null
          created_by?: string | null
          department_name?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "hierarchy_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      hall_assignments: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          hall_number: string
          id: string
          roll_number: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          hall_number: string
          id?: string
          roll_number: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          hall_number?: string
          id?: string
          roll_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "hall_assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "assignment_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      hierarchy_admins: {
        Row: {
          college_id: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          failed_login_attempts: number | null
          full_name: string
          id: string
          is_active: boolean | null
          last_login: string | null
          locked_until: string | null
          role: string
          user_id: string
          username: string
        }
        Insert: {
          college_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          failed_login_attempts?: number | null
          full_name: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          locked_until?: string | null
          role: string
          user_id: string
          username: string
        }
        Update: {
          college_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          failed_login_attempts?: number | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          locked_until?: string | null
          role?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "hierarchy_admins_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_admins_created_by_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "hierarchy_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_admins_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hierarchy_students: {
        Row: {
          college_id: string
          created_at: string | null
          created_by: string | null
          department_id: string
          hall_number: string | null
          id: string
          is_assigned: boolean | null
          roll_number: string
          seat_number: string | null
        }
        Insert: {
          college_id: string
          created_at?: string | null
          created_by?: string | null
          department_id: string
          hall_number?: string | null
          id?: string
          is_assigned?: boolean | null
          roll_number: string
          seat_number?: string | null
        }
        Update: {
          college_id?: string
          created_at?: string | null
          created_by?: string | null
          department_id?: string
          hall_number?: string | null
          id?: string
          is_assigned?: boolean | null
          roll_number?: string
          seat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hierarchy_students_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "hierarchy_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      seating: {
        Row: {
          block: string
          created_at: string
          exam_id: string
          floor: string
          id: string
          roll_number: string
          room: string
        }
        Insert: {
          block: string
          created_at?: string
          exam_id: string
          floor: string
          id?: string
          roll_number: string
          room: string
        }
        Update: {
          block?: string
          created_at?: string
          exam_id?: string
          floor?: string
          id?: string
          roll_number?: string
          room?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_count_tracker: {
        Row: {
          current_staff_count: number | null
          department_id: string
          id: string
          max_staff_count: number | null
        }
        Insert: {
          current_staff_count?: number | null
          department_id: string
          id?: string
          max_staff_count?: number | null
        }
        Update: {
          current_staff_count?: number | null
          department_id?: string
          id?: string
          max_staff_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_count_tracker_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Functions: {
      get_admin_role: { Args: { _user_id: string }; Returns: string }
      get_my_admin_id: { Args: { _user_id: string }; Returns: string }
      get_my_college_id: { Args: { _user_id: string }; Returns: string }
      get_my_department_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
