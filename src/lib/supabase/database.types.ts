export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "admin" | "viewer";
export type ReportStatus = "pending" | "processing" | "partial" | "completed" | "failed";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; hashed_password: string; role: UserRole; created_at: string };
        Insert: { id?: string; email: string; hashed_password: string; role?: UserRole; created_at?: string };
        Update: { email?: string; hashed_password?: string; role?: UserRole };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string; name: string; brand_logo_url: string | null; shopify_store_url: string;
          shopify_access_token: string | null; klaviyo_api_key: string | null; meta_access_token: string | null;
          meta_ad_account_id: string | null; report_recipients: string[]; is_active: boolean; created_at: string;
          default_sections: string[];
        };
        Insert: {
          id?: string; name: string; brand_logo_url?: string | null; shopify_store_url: string;
          shopify_access_token?: string | null; klaviyo_api_key?: string | null; meta_access_token?: string | null;
          meta_ad_account_id?: string | null; report_recipients?: string[]; is_active?: boolean; created_at?: string;
          default_sections?: string[];
        };
        Update: Partial<{
          name: string; brand_logo_url: string | null; shopify_store_url: string; shopify_access_token: string | null;
          klaviyo_api_key: string | null; meta_access_token: string | null; meta_ad_account_id: string | null;
          report_recipients: string[]; is_active: boolean; default_sections: string[];
        }>; Relationships: [];
      };
      report_snapshots: {
        Row: {
          id: string; client_id: string; report_month: string; shopify_data: Json | null; klaviyo_data: Json | null;
          meta_data: Json | null; pdf_url: string | null; status: ReportStatus; error_log: string | null; created_at: string;
          included_sections: string[]; delivered_at: string | null;
        };
        Insert: {
          id?: string; client_id: string; report_month: string; shopify_data?: Json | null; klaviyo_data?: Json | null;
          meta_data?: Json | null; pdf_url?: string | null; status?: ReportStatus; error_log?: string | null; created_at?: string;
          included_sections?: string[]; delivered_at?: string | null;
        };
        Update: Partial<{
          shopify_data: Json | null; klaviyo_data: Json | null; meta_data: Json | null; pdf_url: string | null;
          status: ReportStatus; error_log: string | null; included_sections: string[]; delivered_at: string | null;
        }>;
        Relationships: [];
      };
      activity_logs: {
        Row: { id: string; user_id: string | null; client_id: string | null; action: string; metadata: Json; created_at: string };
        Insert: { id?: string; user_id?: string | null; client_id?: string | null; action: string; metadata?: Json; created_at?: string };
        Update: never; Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { user_role: UserRole; report_status: ReportStatus };
    CompositeTypes: Record<string, never>;
  };
};
