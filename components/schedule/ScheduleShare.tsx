"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ImageDown, Link2, Link2Off } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { getSchedulePreview } from "@/lib/schedule/exports-preview";
import { weekNumber } from "@/lib/schedule/math";
import type { PublicSchedule } from "@/lib/schedule/types";
import { SchedulePreview } from "./SchedulePreview";

type ScheduleShareProps = {
  open: boolean;
  onClose: () => void;
  schedule: PublicSchedule;
  url: string;
  /** Owner revoke: invalidates the token so /r/ returns 404. */
  onRevoke?: () => Promise<void>;
};

export function ScheduleShare({
  open,
  onClose,
  schedule,
  url,
  onRevoke,
}: ScheduleShareProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const preview = useMemo(() => getSchedulePreview(schedule), [schedule]);
  const activeUrl = revoked ? "" : url;

  async function copy() {
    try {
      await navigator.clipboard.writeText(activeUrl);
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
      // Canvas PNG export is heavy — load only on user action.
      const { createSchedulePng, downloadScheduleFile } = await import(
        "@/lib/schedule/exports-browser"
      );
      const png = await createSchedulePng(schedule);
      downloadScheduleFile(
        png,
        `raspored-n${weekNumber(schedule.monday)}-${schedule.monday}.png`,
      );
    } catch {
      toast("Slika rasporeda nije sačuvana.", "danger");
    } finally {
      setSaving(false);
    }
  }

  function shareWith(app: "whatsapp" | "viber") {
    const encoded = encodeURIComponent(
      new URL(activeUrl, window.location.origin).href,
    );
    if (app === "whatsapp") {
      window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(`viber://forward?text=${encoded}`);
    }
  }

  async function revoke() {
    if (!onRevoke || revoking || revoked) return;
    setRevoking(true);
    try {
      await onRevoke();
      setRevoked(true);
      toast("Link je opozvan. Stari URL više ne radi.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Link nije opozvan.",
        "danger",
      );
    } finally {
      setRevoking(false);
    }
  }

  return (
    <BottomSheet
      id="rShareModal"
      open={open}
      onClose={onClose}
      title="Podeli raspored"
      description={`${preview.week} · ${schedule.venueName}`}
      className="r-share-modal"
      footer={
        <div className="r-export-actions">
          <PrimaryButton onClick={onClose}>Gotovo</PrimaryButton>
        </div>
      }
    >
      <p className="rp-label">Slika rasporeda · pregled</p>
      <SchedulePreview preview={preview} titleId={`${inputId}-preview`} />
      <div className="r-share-btns">
        <PrimaryButton
          variant="secondary"
          disabled={!activeUrl}
          onClick={() => shareWith("whatsapp")}
          leftIcon={<span className="r-share-dot whatsapp" aria-hidden="true" />}
        >
          WhatsApp
        </PrimaryButton>
        <PrimaryButton
          variant="secondary"
          disabled={!activeUrl}
          onClick={() => shareWith("viber")}
          leftIcon={<span className="r-share-dot viber" aria-hidden="true" />}
        >
          Viber
        </PrimaryButton>
        <PrimaryButton
          variant="secondary"
          loading={saving}
          onClick={saveImage}
          leftIcon={<ImageDown aria-hidden="true" />}
        >
          Sačuvaj sliku
        </PrimaryButton>
      </div>
      <label className="rp-label" htmlFor={inputId}>
        Link za zaposlene · samo pregled, bez naloga
      </label>
      <div className="r-share-link">
        <div className="field-input">
          <Link2 size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            id={inputId}
            value={revoked ? "Link opozvan" : activeUrl}
            readOnly
          />
        </div>
        <PrimaryButton variant="secondary" disabled={!activeUrl} onClick={copy}>
          Kopiraj link
        </PrimaryButton>
      </div>
      {onRevoke ? (
        <div className="r-share-link mt-3">
          <PrimaryButton
            variant="secondary"
            loading={revoking}
            disabled={revoked}
            onClick={() => void revoke()}
            leftIcon={<Link2Off aria-hidden="true" />}
          >
            {revoked ? "Link opozvan" : "Opozovi link"}
          </PrimaryButton>
        </div>
      ) : null}
    </BottomSheet>
  );
}
