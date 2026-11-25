import { z } from "zod";
import {
  updateIngredientVersionedAction,
  updateRecipeVersionedAction,
} from "@/lib/domain/versioned-update";
import { actionError } from "@/lib/server/action";

const requestSchema = z.object({
  resource: z.enum(["ingredients", "recipes"]),
  input: z.unknown(),
}).strict();

export async function PATCH(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(actionError("VALIDATION_ERROR", "Invalid input."), { status: 400 });
  }

  const { resource, input } = parsed.data;
  const result = resource === "ingredients"
    ? await updateIngredientVersionedAction(input)
    : await updateRecipeVersionedAction(input);

  if ("data" in result) return Response.json(result);
  const status = result.error.status ?? ({
    UNAUTHORIZED: 401,
    VALIDATION_ERROR: 400,
  } as Record<string, number>)[result.error.code] ?? 500;
  return Response.json(result, { status });
}
