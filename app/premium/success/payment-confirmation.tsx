"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const maxAttempts = 15;

export function PaymentConfirmation({ confirmed }: { confirmed: boolean }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (confirmed || attempts >= maxAttempts) return;
    const timer = window.setTimeout(() => {
      setAttempts(attempts + 1);
      router.refresh();
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [attempts, confirmed, router]);

  return (
    <main className="page-gutter mx-auto flex min-h-[65dvh] max-w-xl flex-col items-center justify-center gap-5 text-center">
      <h1 className="text-2xl font-semibold">
        {confirmed ? "Pretplata je aktivna" : "Potvrda plaćanja"}
      </h1>
      {confirmed ? (
        <Link href="/dashboard" className="font-semibold text-accent underline">Otvori kontrolnu tablu</Link>
      ) : (
        <p role="status" className="text-text-2">
          {attempts < maxAttempts
            ? "Potvrđujemo plaćanje…"
            : "Potvrda još nije stigla. Ovu stranicu možete osvežiti kasnije."}
        </p>
      )}
    </main>
  );
}
