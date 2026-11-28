import {
  wasteExportQuerySchema,
  type WasteExportFormat,
} from "@/lib/waste/schemas";
import { buildWasteCsv, type WasteExportRow } from "@/lib/waste/export-csv";
import { reasonShares, roundRsd } from "@/lib/waste/math";
import { requireActionUser } from "@/lib/server/action";
import { requireWorkspaceMember } from "@/lib/workspace/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function featureForFormat(format: WasteExportFormat): string {
  if (format === "csv") return "waste_export_csv";
  return "waste_export_pdf_xlsx";
}

export async function GET(request: Request) {
  const auth = await requireActionUser();
  if ("error" in auth) {
    return Response.json(auth, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = wasteExportQuerySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    format: url.searchParams.get("format") ?? "csv",
    workspaceId: url.searchParams.get("workspaceId") ?? undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: first?.message ?? "Invalid query.",
        },
      },
      { status: 400 },
    );
  }

  const member = await requireWorkspaceMember(
    "cook",
    parsed.data.workspaceId,
    auth,
  );
  if ("error" in member) {
    return Response.json(member, {
      status: member.error.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { data: hasLog } = await member.supabase.rpc("workspace_has_feature", {
    p_workspace_id: member.workspaceId,
    p_feature: "waste_log",
  });
  if (!hasLog) {
    return Response.json(
      {
        error: {
          code: "UPGRADE_REQUIRED",
          message: "Evidencija otpada zahteva Starter ili Pro paket.",
        },
      },
      { status: 402 },
    );
  }

  const exportFeature = featureForFormat(parsed.data.format);
  const { data: hasExport } = await member.supabase.rpc("workspace_has_feature", {
    p_workspace_id: member.workspaceId,
    p_feature: exportFeature,
  });
  if (!hasExport) {
    return Response.json(
      {
        error: {
          code: "UPGRADE_REQUIRED",
          message:
            parsed.data.format === "csv"
              ? "CSV izvoz otpada zahteva Starter ili Pro paket."
              : "PDF i Excel izvoz otpada zahtevaju Pro paket.",
        },
      },
      { status: 402 },
    );
  }

  const { data: reportRows, error: reportError } = await member.supabase.rpc(
    "waste_report",
    {
      p_workspace_id: member.workspaceId,
      p_from: parsed.data.from,
      p_to: parsed.data.to,
    },
  );

  if (reportError) {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: reportError.message } },
      { status: 500 },
    );
  }

  const raw = (reportRows ?? []) as Array<Record<string, unknown>>;
  const rows: WasteExportRow[] = raw.map((row) => ({
    createdAt: String(row.created_at ?? ""),
    subjectName: String(row.subject_name ?? ""),
    quantity: Number(row.quantity) || 0,
    unit: String(row.unit ?? ""),
    reason: String(row.reason ?? ""),
    unitCostSnapshot: Number(row.unit_cost_snapshot) || 0,
    costRsd: Number(row.cost_rsd) || 0,
    isCorrection: Boolean(row.is_correction),
    note: row.note == null ? null : String(row.note),
  }));

  const totalNet =
    raw.length > 0
      ? Number(raw[0].total_net) || 0
      : roundRsd(rows.reduce((sum, row) => sum + row.costRsd, 0));

  const filenameBase = `otpad-${parsed.data.from}_${parsed.data.to}`;

  if (parsed.data.format === "csv") {
    const csv = buildWasteCsv(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        "Cache-Control": "no-store",
        "X-Waste-Total-Net": String(totalNet),
      },
    });
  }

  if (parsed.data.format === "pdf") {
    const { buildWastePdf } = await import("@/lib/waste/export-pdf");
    const bytes = await buildWastePdf({
      workspaceName: member.name,
      from: parsed.data.from,
      to: parsed.data.to,
      generatedAt: new Date(),
      rows,
      totalNet,
    });
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
        "Cache-Control": "no-store",
        "X-Waste-Total-Net": String(totalNet),
      },
    });
  }

  const byReason: Record<string, number> = {};
  for (const row of rows) {
    byReason[row.reason] = (byReason[row.reason] ?? 0) + row.costRsd;
  }
  const reasons = reasonShares(byReason).map((row) => ({
    reason: row.reason,
    amount: row.amount,
  }));

  const { buildWasteXlsx } = await import("@/lib/waste/export-xlsx");
  const bytes = await buildWasteXlsx({
    workspaceName: member.name,
    from: parsed.data.from,
    to: parsed.data.to,
    rows,
    totalNet,
    reasons,
  });

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      "Cache-Control": "no-store",
      "X-Waste-Total-Net": String(totalNet),
    },
  });
}
