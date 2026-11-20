"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { updateProfileAction } from "@/lib/auth/profile-actions";
import { cn } from "@/lib/utils/cn";

export type SettingsAccountFormProps = {
  initialName: string;
  email: string;
  currencyLabel?: string;
};

export function SettingsAccountForm({
  initialName,
  email,
  currencyLabel = "RSD (din)",
}: SettingsAccountFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);

    try {
      const result = await updateProfileAction({ full_name: name.trim() });

      if ("error" in result) {
        setError(
          result.error.code === "UNAUTHORIZED"
            ? "Morate biti prijavljeni."
            : result.error.code === "VALIDATION_ERROR"
              ? result.error.message
              : "Čuvanje nije uspelo. Pokušajte ponovo."
        );
        return;
      }

      setName(result.data.full_name);
      toast("Izmene su sačuvane", "success");
      router.refresh();
    } catch {
      setError("Čuvanje nije uspelo. Pokušajte ponovo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid max-w-[720px] gap-5 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)]"
      noValidate
    >
      <div>
        <label className="field-label" htmlFor="settings-name">
          Ime
        </label>
        <div className="field-input">
          <input
            id="settings-name"
            name="fullName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Vaše ime"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="settings-email">
          Email
        </label>
        <div className={cn("field-input opacity-90")}>
          <input
            id="settings-email"
            name="email"
            type="email"
            value={email}
            readOnly
            aria-readonly="true"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="settings-currency">
          Valuta
        </label>
        <div className="field-input opacity-90">
          <input
            id="settings-currency"
            name="currency"
            value={currencyLabel}
            readOnly
            aria-readonly="true"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[length:var(--fs-sm)] text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <PrimaryButton type="submit" loading={loading}>
          Sačuvaj izmene
        </PrimaryButton>
      </div>
    </form>
  );
}
