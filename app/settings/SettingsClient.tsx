"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { useT } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/Icon";
import { LanguageSelector, ThemeSelector } from "@/components/PreferenceControls";
import { PushSetting } from "@/components/PushPrompt";
import { useToast } from "@/components/Toast";
import { errorKey } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold tracking-wide text-muted uppercase">{title}</h2>
      <div className="card p-4">{children}</div>
    </section>
  );
}

function RowLink({ href, icon, children }: { href: string; icon: IconName; children: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-[48px] items-center gap-3 rounded-xl px-1 font-semibold active:bg-surface-2">
      <Icon name={icon} size={20} className="text-muted" />
      <span className="flex-1">{children}</span>
      <Icon name="back" size={18} className="rotate-180 text-muted" />
    </Link>
  );
}

/** Supprime les données locales de BingoBuzz (progression solo, pseudo…). */
function clearLocalData() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("bingobuzz:")) window.localStorage.removeItem(key);
    }
  } catch {
    // stockage indisponible : rien à effacer
  }
}

export function SettingsClient({
  email,
  name,
  hostedGames,
}: {
  email: string | null;
  name: string | null;
  /** parties en cours dont on est l'hôte : elles s'arrêtent avec le compte */
  hostedGames: { code: string; title: string; emoji: string }[];
}) {
  const t = useT();
  const toast = useToast();
  const confirmId = useId();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const word = t("settings.delete.word");

  async function exportData() {
    setExporting(true);
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("export_my_data");
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bingobuzz-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show(t("settings.data.done"), { tone: "success" });
    } catch (err) {
      toast.show(t(errorKey(err)), { tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirmText.trim().toUpperCase() !== word) return;
    setDeleting(true);
    const supabase = getSupabaseBrowserClient();
    // Les fichiers du stockage ne sont pas effacés par la base : on supprime
    // d'abord ses photos de preuve via l'API Storage.
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: photos } = await supabase
        .from("game_claims")
        .select("photo_path")
        .eq("claimed_by", auth.user.id)
        .not("photo_path", "is", null);
      const paths = (photos ?? []).map((p) => p.photo_path).filter((p): p is string => Boolean(p));
      if (paths.length > 0) await supabase.storage.from("proofs").remove(paths);
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      toast.show(t(errorKey(error)), { tone: "error" });
      setDeleting(false);
      return;
    }
    // le compte n'existe plus côté serveur : on nettoie la session locale
    await supabase.auth.signOut({ scope: "local" });
    clearLocalData();
    window.location.assign("/?deleted=1");
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/");
  }

  return (
    <div className="stagger space-y-7">
      <Section title={t("settings.account")}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-xl font-black text-accent-fg">
            {(name ?? email ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            {name && <p className="truncate font-bold">{name}</p>}
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost mt-4 w-full" onClick={signOut}>
          <Icon name="logout" size={20} />
          {t("login.signOut")}
        </button>
      </Section>

      <Section title={t("settings.preferences")}>
        <p className="label">{t("prefs.theme")}</p>
        <ThemeSelector />
        <p className="label mt-5">{t("prefs.language")}</p>
        <LanguageSelector />
      </Section>

      <Section title={t("push.title")}>
        <PushSetting />
      </Section>

      <Section title={t("settings.data")}>
        <p className="text-sm text-muted">{t("settings.data.body")}</p>
        <button type="button" className="btn btn-secondary mt-4 w-full" onClick={exportData} disabled={exporting}>
          <Icon name="download" size={20} />
          {exporting ? t("settings.data.exporting") : t("settings.data.export")}
        </button>
      </Section>

      <Section title={t("settings.legal")}>
        <RowLink href="/privacy" icon="shield">
          {t("legal.privacy")}
        </RowLink>
        <RowLink href="/terms" icon="file">
          {t("legal.terms")}
        </RowLink>
      </Section>

      <Section title={t("settings.danger")}>
        <p className="text-sm text-muted">{t("settings.delete.body")}</p>
        <button type="button" className="btn btn-danger mt-4 w-full" onClick={() => setDeleteOpen(true)}>
          <Icon name="trash" size={20} />
          {t("settings.delete")}
        </button>
      </Section>

      <BottomSheet
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmText("");
        }}
        title={t("settings.delete")}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void deleteAccount();
          }}
        >
          <p className="text-muted">{t("settings.delete.body")}</p>
          {hostedGames.length > 0 && (
            <div className="rounded-2xl bg-danger/10 p-3">
              <p className="text-sm font-bold">{t("settings.delete.games")}</p>
              <ul className="mt-1.5 space-y-1 text-sm">
                {hostedGames.map((game) => (
                  <li key={game.code} className="truncate">
                    <span aria-hidden>{game.emoji} </span>
                    {game.title} <span className="font-mono text-xs text-muted">· {game.code}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label htmlFor={confirmId} className="label">
              {t("settings.delete.confirmLabel", { word })}
            </label>
            <input
              id={confirmId}
              className="input font-bold tracking-widest uppercase"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            className="btn w-full bg-danger text-on-status"
            disabled={deleting || confirmText.trim().toUpperCase() !== word}
          >
            {deleting ? t("settings.delete.deleting") : t("settings.delete.submit")}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
