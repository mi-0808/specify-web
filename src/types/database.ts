export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      saved_recipes: {
        Row: { user_id: string; recipe_id: string; created_at: string };
        Insert: { user_id: string; recipe_id: string; created_at?: string };
        Update: { user_id?: string; recipe_id?: string; created_at?: string };
        Relationships: [];
      };
      purchases: {
        Row: {
          user_id: string;
          recipe_id: string;
          item_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          recipe_id: string;
          item_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          recipe_id?: string;
          item_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          width_cm: number | null;
          height_cm: number | null;
          depth_cm: number | null;
          volume_cm3: number | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          width_cm?: number | null;
          height_cm?: number | null;
          depth_cm?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          width_cm?: number | null;
          height_cm?: number | null;
          depth_cm?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          name: string;
          width_cm: number | null;
          height_cm: number | null;
          depth_cm: number | null;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          name: string;
          width_cm?: number | null;
          height_cm?: number | null;
          depth_cm?: number | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          name?: string;
          width_cm?: number | null;
          height_cm?: number | null;
          depth_cm?: number | null;
          category?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suggestions: {
        Row: {
          id: string;
          space_id: string;
          score: number | null;
          reasoning: string | null;
          storage_options: Json | null;
          image_tag: string | null;
          raw_json: Json | null;
          room_image_url: string | null;
          storage_image_url: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          score?: number | null;
          reasoning?: string | null;
          storage_options?: Json | null;
          image_tag?: string | null;
          raw_json?: Json | null;
          room_image_url?: string | null;
          storage_image_url?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          score?: number | null;
          reasoning?: string | null;
          storage_options?: Json | null;
          image_tag?: string | null;
          raw_json?: Json | null;
          room_image_url?: string | null;
          storage_image_url?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      suggestion_markers: {
        Row: {
          id: string;
          suggestion_id: string;
          image_type: string;
          x: number;
          y: number;
          comment: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          suggestion_id: string;
          image_type: string;
          x: number;
          y: number;
          comment: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          suggestion_id?: string;
          image_type?: string;
          x?: number;
          y?: number;
          comment?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      b_scans: {
        Row: {
          id: string;
          user_id: string;
          area_name: string;
          image_url: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          area_name: string;
          image_url?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          area_name?: string;
          image_url?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      b_markers: {
        Row: {
          id: string;
          scan_id: string;
          x: number;
          y: number;
          category: string;
          comment: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          scan_id: string;
          x: number;
          y: number;
          category: string;
          comment: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          scan_id?: string;
          x?: number;
          y?: number;
          category?: string;
          comment?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
