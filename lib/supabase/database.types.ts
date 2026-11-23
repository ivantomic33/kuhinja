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
          plan_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          plan?: Plan;
          stripe_customer_id?: string | null;
          plan_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          plan?: Plan;
          stripe_customer_id?: string | null;
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
      venues: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
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
          name: string;
          unit: IngredientUnit;
          price: number;
          waste_percent: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          unit: IngredientUnit;
          price?: number;
          waste_percent?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          name?: string;
          unit?: IngredientUnit;
          price?: number;
          waste_percent?: number;
          notes?: string | null;
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
          name: string;
          description: string | null;
          portions: number;
          selling_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          description?: string | null;
          portions?: number;
          selling_price?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          name?: string;
          description?: string | null;
          portions?: number;
          selling_price?: number;
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
      [_ in never]: never;
    };
    Functions: {
      is_venue_owner: {
        Args: { p_venue_id: string };
        Returns: boolean;
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
