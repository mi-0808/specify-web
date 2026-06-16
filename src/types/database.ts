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
      };
      suggestions: {
        Row: {
          id: string;
          space_id: string;
          score: number | null;
          reasoning: string | null;
          storage_options: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          score?: number | null;
          reasoning?: string | null;
          storage_options?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          score?: number | null;
          reasoning?: string | null;
          storage_options?: Json | null;
          created_at?: string;
        };
      };
    };
  };
}
