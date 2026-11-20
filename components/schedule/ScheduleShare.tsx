"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ImageDown, Link2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { createSchedulePng, downloadScheduleFile } from "@/lib/schedule/exports-browser";
import { getSchedulePreview } from "@/lib/schedule/exports-preview";
import { weekNumber } from "@/lib/schedule/math";
import type { PublicSchedule } from "@/lib/schedule/types";
import { SchedulePreview } from "./SchedulePreview";

type ScheduleShareProps = {
  open: boolean;
  onClose: () => void;
  schedule: PublicSchedule;
  url: string;
};

export function ScheduleShare({ open, onClose, schedule, url }: ScheduleShareProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => getSchedulePreview(schedule), [schedule]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link kopiran", "success");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      toast("Kopirajte označeni link.");
    }
  }

  async function saveImage() {
    setSaving(true);
    try {
      const png = await createSchedulePng(schedule);
      downloadScheduleFile(png, `raspored-n${weekNumber(schedule.monday)}-${schedule.monday}.png`);
    } catch {
      toast("Slika rasporeda nije sačuvana.", "danger");
    } finally {
      setSaving(false);
    }
  }

  function shareWith(app: "whatsapp" | "viber") {
    const encoded = encodeURIComponent(new URL(url, window.location.origin).href);
    if (app === "whatsapp") window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    else window.location.assign(`viber://forward?text=${encoded}`);
  }

  return (
    <BottomSheet
      id="rShareModal"
      open={open}
      onClose={onClose}
      title="Podeli raspored"
      description={`${preview.week} · ${schedule.venueName}`}
      className="r-share-modal"
      footer={<div className="r-export-actions"><PrimaryButton onClick={onClose}>Gotovo</PrimaryButton></div>}
    >
      <p className="rp-label">Slika rasporeda · pregled</p>
      <SchedulePreview preview={preview} titleId={`${inputId}-preview`} />
      <div className="r-share-btns">
        <PrimaryButton variant="secondary" disabled={!url} onClick={() => shareWith("whatsapp")} leftIcon={<span className="r-share-dot whatsapp" aria-hidden="true" />}>
          WhatsApp
        </PrimaryButton>
        <PrimaryButton variant="secondary" disabled={!url} onClick={() => shareWith("viber")} leftIcon={<span className="r-share-dot viber" aria-hidden="true" />}>
          Viber
        </PrimaryButton>
        <PrimaryButton variant="secondary" loading={saving} onClick={saveImage} leftIcon={<ImageDown aria-hidden="true" />}>
          Sačuvaj sliku
        </PrimaryButton>
      </div>
      <label className="rp-label" htmlFor={inputId}>Link za zaposlene · samo pregled, bez naloga</label>
      <div className="r-share-link">
        <div className="field-input">
          <Link2 size={17} aria-hidden="true" />
          <input ref={inputRef} id={inputId} value={url} readOnly />
        </div>
        <PrimaryButton variant="secondary" disabled={!url} onClick={copy}>Kopiraj link</PrimaryButton>
      </div>
    </BottomSheet>
  );
}
