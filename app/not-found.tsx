import type { Metadata } from "next";
import Link from "next/link";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.notFound.title,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-text">
        {sr.notFound.title}
      </h1>
      <p className="text-sm leading-relaxed text-muted">{sr.notFound.body}</p>
      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent"
      >
        {sr.notFound.home}
      </Link>
    </main>
  );
}
