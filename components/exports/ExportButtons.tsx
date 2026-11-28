"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { exportKitchenData } from "@/lib/exports/actions";
import type { ExportFormat, ExportScope } from "@/lib/exports/schemas";
import { sr } from "@/lib/i18n/sr";
import { useToast } from "@/components/ui/Toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "XLSX",
  pdf: "PDF",
};

export function ExportButtons({
  scope,
  workspaceId,
  formats,
  recipeId,
}: {
  scope: ExportScope;
  workspaceId: string | null;
  formats: ExportFormat[];
  recipeId?: string;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  if (!workspaceId) return null;

  async function onExport(format: ExportFormat) {
    if (exporting) return;
    setExporting(format);
    try {
      const result = await exportKitchenData({
        scope,
        format,
        workspaceId,
        ...(recipeId ? { recipeId } : {}),
      });
      if ("error" in result) {
        toast(result.error.message, "danger");
        return;
      }

      const binary = window.atob(result.data.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const blob = new Blob([bytes.buffer], {
        type: result.data.contentType,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      console.error("Export failed", error);
      toast(sr.exports.failed, "danger");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label={sr.exports.groupLabel}>
      {formats.map((format) => (
        <PrimaryButton
          key={format}
          type="button"
          size="sm"
          variant="secondary"
          loading={exporting === format}
          disabled={exporting !== null && exporting !== format}
          leftIcon={<Download aria-hidden="true" />}
          onClick={() => void onExport(format)}
        >
          {scope === "recipes" && format === "pdf"
            ? sr.exports.recipeCard
            : `${sr.exports.download} ${FORMAT_LABELS[format]}`}
        </PrimaryButton>
      ))}
    </div>
  );
}
