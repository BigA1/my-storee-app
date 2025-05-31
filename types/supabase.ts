export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      memories: {
        Row: {
          id: string
          created_at: string
          title: string
          content: string
          user_id: string
          date: string
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          content: string
          user_id: string
          date: string
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          content?: string
          user_id?: string
          date?: string
        }
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
  }
} 