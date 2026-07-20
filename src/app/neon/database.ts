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
        Args: { user_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
