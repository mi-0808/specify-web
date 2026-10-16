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
      genres: {
        Row: { id: string; name: string; keyword: string; created_by: string; created_at: string };
        Insert: { id?: string; name: string; keyword: string; created_by: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["genres"]["Insert"]>;
        Relationships: [];
      };
      room_genres: {
        Row: { room_id: string; genre_id: string; excluded: boolean; added_by: string; created_at: string };
        Insert: { room_id: string; genre_id: string; excluded?: boolean; added_by: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["room_genres"]["Insert"]>;
        Relationships: [];
      };
      saved_rooms: {
        Row: { user_id: string; room_id: string; created_at: string };
        Insert: { user_id: string; room_id: string; created_at?: string };
        Update: { user_id?: string; room_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "saved_rooms_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          id: string;
          title: string;
          channel_id: string;
          channel_title: string;
          thumbnail_url: string;
          published_at: string;
          tags: string[];
          description_hash: string;
          refreshed_at: string;
        };
        Insert: {
          id: string;
          title: string;
          channel_id: string;
          channel_title: string;
          thumbnail_url: string;
          published_at: string;
          tags?: string[];
          description_hash: string;
          refreshed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
        Relationships: [];
      };
      room_items: {
        Row: {
          room_id: string;
          position: number;
          label: string;
          url: string;
          shop_host: string;
          product_title: string | null;
          image_url: string | null;
        };
        Insert: {
          room_id: string;
          position: number;
          label: string;
          url: string;
          shop_host: string;
          product_title?: string | null;
          image_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["room_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "room_items_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
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
    Functions: {
      rooms_in_genre: {
        Args: { gid: string };
        Returns: Database["public"]["Tables"]["rooms"]["Row"][];
        SetofOptions: { from: "*"; to: "rooms"; isOneToOne: false; isSetofReturn: true };
      };
      genres_for_room: {
        Args: { rid: string };
        Returns: Database["public"]["Tables"]["genres"]["Row"][];
        SetofOptions: { from: "*"; to: "genres"; isOneToOne: false; isSetofReturn: true };
      };
      genres_with_counts: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; name: string; room_count: number }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
