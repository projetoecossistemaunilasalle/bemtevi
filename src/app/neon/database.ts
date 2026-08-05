export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          user_id: string;
        };
        Insert: {
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [];
      };
      page_view_counts: {
        Row: {
          view_date: string;
          route: string;
          view_count: number;
        };
        Insert: {
          view_date: string;
          route: string;
          view_count?: number;
        };
        Update: {
          view_date?: string;
          route?: string;
          view_count?: number;
        };
        Relationships: [];
      };
      published_content: {
        Row: {
          id: string;
          schema_version: string;
          revision: number;
          payload: unknown;
          published_at: string;
          published_by: string;
        };
        Insert: {
          id: string;
          schema_version: string;
          revision: number;
          payload: unknown;
          published_at: string;
          published_by: string;
        };
        Update: {
          id?: string;
          schema_version?: string;
          revision?: number;
          payload?: unknown;
          published_at?: string;
          published_by?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      get_page_view_counts: {
        Args: { p_start_date: string };
        Returns: Array<{
          view_date: string;
          route: string;
          view_count: number;
        }>;
      };
      record_page_view: {
        Args: { p_route: string };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
