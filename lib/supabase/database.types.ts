/**
 * Supabase Database types.
 * Prefer regenerating with:
 *   supabase gen types typescript --local > lib/supabase/database.types.ts
 * when the local Supabase stack is available.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Plan = "free" | "starter" | "pro" | "premium" | "team" | "business";

export type BillingSubscription = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  paddle_price_id: string | null;
  paddle_event_at: string | null;
  paid_access_plan: "starter" | "pro" | null;
  paid_access_until: string | null;
  stripe_price_id: string | null;
  plan_key: "free" | "starter" | "pro";
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

type StripeEvent = {
  id: string;
  type: string;
  received_at: string;
  processed_at: string | null;
  payload: Json | null;
  attempts: number;
};

export type IngredientUnit = "g" | "kg" | "ml" | "l" | "kom" | "pak";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          plan: Plan;
          stripe_customer_id: string | null;
          paddle_customer_id: string | null;
          plan_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          plan?: Plan;
          stripe_customer_id?: string | null;
          paddle_customer_id?: string | null;
          plan_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          plan?: Plan;
          stripe_customer_id?: string | null;
          paddle_customer_id?: string | null;
          plan_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: BillingSubscription;
        Insert: Pick<BillingSubscription, "user_id" | "plan_key" | "status"> &
          Partial<BillingSubscription>;
        Update: Partial<BillingSubscription>;
        Relationships: [];
      };
      stripe_events: {
        Row: StripeEvent;
        Insert: Pick<StripeEvent, "id" | "type"> & Partial<StripeEvent>;
        Update: Partial<StripeEvent>;
        Relationships: [];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          type: string;
          processed_at: string;
        };
        Insert: {
          id: string;
          type: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string;
          kind: "ingredient_price_change" | "recipe_cost_change";
          title: string;
          message: string;
          data: Json;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id: string;
          kind: "ingredient_price_change" | "recipe_cost_change";
          title: string;
          message: string;
          data?: Json;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          workspace_id?: string;
          kind?: "ingredient_price_change" | "recipe_cost_change";
          title?: string;
          message?: string;
          data?: Json;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          owner_id: string;
          workspace_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          workspace_id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          workspace_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venues_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          id: string;
          venue_id: string;
          workspace_id: string;
          name: string;
          unit: IngredientUnit;
          price: number;
          waste_percent: number;
          notes: string | null;
          /** Optimistic lock token; bumped by trigger on UPDATE. */
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          workspace_id?: string;
          name: string;
          unit: IngredientUnit;
          price?: number;
          waste_percent?: number;
          notes?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          workspace_id?: string;
          name?: string;
          unit?: IngredientUnit;
          price?: number;
          waste_percent?: number;
          notes?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      allergens: {
        Row: {
          code: string;
          label: string;
          regulation_order: number;
        };
        Insert: {
          code: string;
          label: string;
          regulation_order: number;
        };
        Update: {
          code?: string;
          label?: string;
          regulation_order?: number;
        };
        Relationships: [];
      };
      ingredient_allergens: {
        Row: {
          ingredient_id: string;
          allergen_code: string;
          presence: "contains" | "trace";
        };
        Insert: {
          ingredient_id: string;
          allergen_code: string;
          presence?: "contains" | "trace";
        };
        Update: {
          ingredient_id?: string;
          allergen_code?: string;
          presence?: "contains" | "trace";
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_allergens_allergen_code_fkey";
            columns: ["allergen_code"];
            isOneToOne: false;
            referencedRelation: "allergens";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "ingredient_allergens_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_price_history: {
        Row: {
          id: string;
          ingredient_id: string;
          price: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          ingredient_id: string;
          price: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          ingredient_id?: string;
          price?: number;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_price_history_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          id: string;
          venue_id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          portions: number;
          selling_price: number;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          workspace_id?: string;
          name: string;
          description?: string | null;
          portions?: number;
          selling_price?: number;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          workspace_id?: string;
          name?: string;
          description?: string | null;
          portions?: number;
          selling_price?: number;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_items: {
        Row: {
          id: string;
          recipe_id: string;
          ingredient_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          ingredient_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          ingredient_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_items_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_templates: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          name?: string;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_templates_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_runs: {
        Row: {
          id: string;
          venue_id: string;
          template_id: string;
          user_id: string;
          status: "active" | "completed";
          checked_item_ids: Json;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          template_id: string;
          user_id: string;
          status?: "active" | "completed";
          checked_item_ids?: Json;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          template_id?: string;
          user_id?: string;
          status?: "active" | "completed";
          checked_item_ids?: Json;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_runs_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_runs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_runs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shift_checklist_items: {
        Row: {
          run_id: string;
          item_id: string;
          checked: boolean;
          checked_by: string | null;
          checked_at: string | null;
          updated_at: string;
        };
        Insert: {
          run_id: string;
          item_id: string;
          checked?: boolean;
          checked_by?: string | null;
          checked_at?: string | null;
          updated_at?: string;
        };
        Update: {
          run_id?: string;
          item_id?: string;
          checked?: boolean;
          checked_by?: string | null;
          checked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shift_checklist_items_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "checklist_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_checklist_items_checked_by_fkey";
            columns: ["checked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_levels: {
        Row: {
          id: string;
          venue_id: string;
          ingredient_id: string;
          qty: number;
          min_qty: number;
          used_today: number;
          used_on: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          ingredient_id: string;
          qty?: number;
          min_qty?: number;
          used_today?: number;
          used_on?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          ingredient_id?: string;
          qty?: number;
          min_qty?: number;
          used_today?: number;
          used_on?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_levels_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_moves: {
        Row: {
          id: string;
          venue_id: string;
          ingredient_id: string;
          type: "dopuna" | "prodaja" | "otpis" | "korekcija";
          qty_delta: number;
          unit_cost: number | null;
          reason: string | null;
          note: string | null;
          sale_id: string | null;
          user_id: string | null;
          undone: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          ingredient_id: string;
          type: "dopuna" | "prodaja" | "otpis" | "korekcija";
          qty_delta: number;
          unit_cost?: number | null;
          reason?: string | null;
          note?: string | null;
          sale_id?: string | null;
          user_id?: string | null;
          undone?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          ingredient_id?: string;
          type?: "dopuna" | "prodaja" | "otpis" | "korekcija";
          qty_delta?: number;
          unit_cost?: number | null;
          reason?: string | null;
          note?: string | null;
          sale_id?: string | null;
          user_id?: string | null;
          undone?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_moves_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_moves_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_moves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      recipe_allergens: {
        Row: {
          workspace_id: string;
          recipe_id: string;
          allergen_code: string;
          presence: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_billing_lock: { Args: { p_key: string; p_token: string }; Returns: boolean };
      release_billing_lock: { Args: { p_key: string; p_token: string }; Returns: undefined };
      record_stock_adjustment: {
        Args: { p_venue_id: string; p_type: string; p_lines: Json };
        Returns: undefined;
      };
      get_entitlements: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      is_venue_owner: {
        Args: { p_venue_id: string };
        Returns: boolean;
      };
      is_member: {
        Args: { p_workspace_id: string; p_min_role: string };
        Returns: boolean;
      };
      workspace_has_feature: {
        Args: { p_workspace_id: string; p_feature: string };
        Returns: boolean;
      };
      set_ingredient_allergens: {
        Args: { p_ingredient_id: string; p_items: Json };
        Returns: undefined;
      };
      restock_ingredient: {
        Args: { p_ingredient_id: string; p_new_price: number; p_note?: string | null };
        Returns: Database["public"]["Tables"]["ingredients"]["Row"];
      };
      upsert_shift_checklist_item: {
        Args: { p_run_id: string; p_item_id: string; p_checked: boolean };
        Returns: Database["public"]["Tables"]["shift_checklist_items"]["Row"];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Profile = Tables<"profiles">;
export type Venue = Tables<"venues">;
export type Ingredient = Tables<"ingredients">;
export type IngredientPriceHistory = Tables<"ingredient_price_history">;
export type Recipe = Tables<"recipes">;
export type RecipeItem = Tables<"recipe_items">;
export type ChecklistTemplate = Tables<"checklist_templates">;
export type ChecklistRun = Tables<"checklist_runs">;
export type ChecklistRunStatus = ChecklistRun["status"];
export type StockLevel = Tables<"stock_levels">;
export type StockMoveRow = Tables<"stock_moves">;
export type StockMoveTypeDb = StockMoveRow["type"];
