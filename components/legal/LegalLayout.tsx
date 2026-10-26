import Link from "next/link";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

/** Mise en page commune aux pages légales (lisible sur mobile, liens soulignés). */
export function LegalLayout({
  title,
  updated,
  backLabel,
  other,
  children,
}: {
  title: string;
  updated: string;
  backLabel: string;
  other: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <>
      <AppHeader back="/" backLabel={backLabel} title={title} />
      <main className="page pb-safe pt-6 pb-16">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-1 text-sm text-muted">{updated}</p>
        <article
          className={[
            "mt-6 space-y-4 leading-relaxed",
            "[&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold",
            "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
            "[&_a]:font-semibold [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
            "[&_strong]:font-bold",
          ].join(" ")}
        >
          {children}
        </article>
        <p className="mt-10 border-t border-border pt-6">
          <Link href={other.href} className="font-semibold text-accent underline underline-offset-2">
            {other.label}
          </Link>
        </p>
      </main>
    </>
  );
}
