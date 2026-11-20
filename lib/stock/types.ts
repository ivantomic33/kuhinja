import type { IngredientUnit } from "@/lib/supabase/database.types";

export type StockMoveType = "dopuna" | "prodaja" | "otpis" | "korekcija";

export type StockStatus = "nestalo" | "nisko" | "ok" | "bez";

export type WriteOffReason =
  | "pokvareno"
  | "prosuto"
  | "hrana-osoblja"
  | "ostalo";

export type StockRow = {
  id: string;
  venueId: string;
  ingredientId: string;
  name: string;
  unit: IngredientUnit;
  qty: number;
  min: number;
  price: number;
  usedToday: number;
  usedOn: string;
  hasLevel: boolean;
};

export type StockMove = {
  id: string;
  venueId: string;
  ingredientId: string;
  type: StockMoveType;
  qtyDelta: number;
  unitCost: number | null;
  reason: string | null;
  note: string | null;
  saleId: string | null;
  userId: string | null;
  undone: boolean;
  createdAt: string;
  ingredientName?: string;
};

export type RecipeForSale = {
  id: string;
  name: string;
  portions: number;
  sellingPrice: number;
  items: Array<{
    ingredientId: string;
    name: string;
    unit: IngredientUnit;
    quantity: number;
    price: number;
    wastePercent: number;
  }>;
};

export type SaleDeductionLine = {
  ingredientId: string;
  name: string;
  unit: IngredientUnit;
  qty: number;
  before: number;
  after: number;
  unitCost: number;
};

export type BuyListItem = {
  ingredientId: string;
  name: string;
  unit: IngredientUnit;
  qty: number;
  min: number;
  need: number;
};
