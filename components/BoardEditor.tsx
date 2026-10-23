"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ensureSession } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { cleanPhrase, isDuplicate, MAX_PHRASES, parsePhrases } from "@/lib/phrases";
import { hasFreeCenter, requiredPhraseCount } from "@/lib/random";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { THEME_COLOR_NAMES, THEME_COLORS, THEME_EMOJIS, themeStyle } from "@/lib/themes";
import type { BoardWithPhrases, GridSize, ThemeColor } from "@/types/bingo";
import { BottomSheet } from "./BottomSheet";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

const SIZES: GridSize[] = [3, 4, 5];

export function BoardEditor({ initial }: { initial?: BoardWithPhrases }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const ids = { title: useId(), add: useId(), paste: useId(), free: useId() };

  const [title, setTitle] = useState(initial?.title ?? "");
  const [emoji, setEmoji] = useState(initial?.theme.emoji ?? THEME_EMOJIS[0]);
  const [color, setColor] = useState<ThemeColor>(initial?.theme.color ?? "violet");
  const [gridSize, setGridSize] = useState<GridSize>(initial?.grid_size ?? 5);
  const [freeCenter, setFreeCenter] = useState(initial?.free_center ?? true);
  const [phrases, setPhrases] = useState<string[]>(initial?.phrases.map((p) => p.text) ?? []);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const addInput = useRef<HTMLInputElement>(null);

  const free = hasFreeCenter(gridSize, freeCenter);
  const required = requiredPhraseCount(gridSize, freeCenter);
  const missing = Math.max(0, required - phrases.length);
  const progress = Math.min(1, phrases.length / required);
  // les plus récentes en haut, juste sous le champ de saisie
  const displayed = useMemo(() => phrases.map((text, i) => ({ text, i })).reverse(), [phrases]);

  function addDraft(e?: FormEvent) {
    e?.preventDefault();
    const phrase = cleanPhrase(draft);
    if (!phrase) return;
    if (isDuplicate(phrase, phrases)) {
      setDraftError(t("editor.phrases.duplicate"));
      return;
    }
    if (phrases.length >= MAX_PHRASES) return;
    setPhrases((list) => [...list, phrase]);
    setDraft("");
    setDraftError(null);
    addInput.current?.focus();
  }

  function addPasted() {
    const added = parsePhrases(pasteText, phrases).slice(0, MAX_PHRASES - phrases.length);
    setPhrases((list) => [...list, ...added]);
    setPasteText("");
    setPasteOpen(false);
    toast.show(t("editor.phrases.paste.added", { count: added.length }), { tone: "success" });
  }

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError(t("editor.errors.title"));
      return;
    }
    if (missing > 0) {
      setError(t("editor.errors.phrases", { required, size: gridSize }));
      return;
    }

    setSaving(true);
    try {
      await ensureSession();
      const supabase = getSupabaseBrowserClient();
      const { data: id, error: rpcError } = await supabase.rpc("save_board", {
        p_id: initial?.id ?? null,
        p_title: title.trim().slice(0, 80),
        p_theme: { emoji, color },
        p_grid_size: gridSize,
        p_free_center: free,
        p_phrases: phrases,
      });
      if (rpcError || !id) throw rpcError ?? new Error("save_board");

      toast.show(t("editor.saved"), { tone: "success" });
      router.push(`/boards/${id}`);
      router.refresh();
    } catch (err) {
      setError(t(errorKey(err)));
      setSaving(false);
    }
  }

  return (
    <div className="themed" style={themeStyle({ emoji, color })}>
      <div className="page space-y-7 pt-4 pb-36">
        {/* Titre */}
        <section>
          <label htmlFor={ids.title} className="label">
            {t("editor.title.label")}
          </label>
          <div className="flex gap-2">
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl"
            >
              {emoji}
            </span>
            <input
              id={ids.title}
              className="input"
              value={title}
              maxLength={80}
              placeholder={t("editor.title.placeholder")}
              onChange={(e) => setTitle(e.target.value)}
              enterKeyHint="next"
              autoComplete="off"
            />
          </div>
        </section>

        {/* Thème */}
        <section>
          <h2 className="label">{t("editor.theme")}</h2>
          <div
            className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2"
            role="radiogroup"
            aria-label={t("editor.emoji")}
          >
            {THEME_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                onClick={() => setEmoji(e)}
                className={`grid h-12 w-12 shrink-0 snap-start place-items-center rounded-2xl text-2xl transition ${
                  emoji === e ? "bg-accent-soft ring-2 ring-accent" : "bg-surface"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label={t("editor.color")}>
            {THEME_COLOR_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={color === name}
                aria-label={t(`editor.color.${name}`)}
                onClick={() => setColor(name)}
                className={`grid h-11 w-11 place-items-center rounded-full transition ${
                  color === name ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""
                }`}
                style={{ background: THEME_COLORS[name].light }}
              >
                {color === name && <Icon name="check" size={20} className="text-white" />}
              </button>
            ))}
          </div>
        </section>

        {/* Grille */}
        <section>
          <h2 className="label">{t("editor.gridSize")}</h2>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label={t("editor.gridSize")}>
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={gridSize === size}
                onClick={() => setGridSize(size)}
                className={`min-h-[44px] rounded-xl font-bold transition ${
                  gridSize === size ? "bg-surface shadow-sm" : "text-muted"
                }`}
              >
                {size}×{size}
              </button>
            ))}
          </div>

          <label
            htmlFor={ids.free}
            className={`mt-3 flex min-h-[56px] items-center gap-3 rounded-2xl bg-surface px-4 py-2 ${
              gridSize % 2 === 0 ? "opacity-50" : ""
            }`}
          >
            <span className="flex-1">
              <span className="block font-semibold">{t("editor.freeCenter")}</span>
              <span className="block text-sm text-muted">
                {gridSize % 2 === 0 ? t("editor.freeCenter.even") : t("editor.freeCenter.hint")}
              </span>
            </span>
            <input
              id={ids.free}
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={free}
              disabled={gridSize % 2 === 0}
              onChange={(e) => setFreeCenter(e.target.checked)}
            />
            <span
              aria-hidden
              className="relative h-7 w-12 shrink-0 rounded-full bg-border transition peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-accent after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
            />
          </label>
        </section>

        {/* Phrases */}
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-[0.95rem] font-bold">{t("editor.phrases")}</h2>
            <span className="text-sm font-bold tabular-nums">
              {phrases.length} / {required}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={required}
            aria-valuenow={Math.min(phrases.length, required)}
          >
            <div
              className={`h-full rounded-full transition-all ${missing > 0 ? "bg-accent" : "bg-success"}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className={`mt-2 text-sm ${missing > 0 ? "text-muted" : "font-semibold text-success"}`} aria-live="polite">
            {missing > 0
              ? t("editor.phrases.missing", { count: missing, size: gridSize })
              : phrases.length === required
                ? t("editor.phrases.exact", { count: phrases.length })
                : t("editor.phrases.ok", { count: phrases.length, size: gridSize })}
          </p>
          <p className="mt-1 text-sm text-muted">{t("editor.phrases.hint")}</p>

          <form onSubmit={addDraft} className="mt-4">
            <label htmlFor={ids.add} className="sr-only">
              {t("editor.phrases.add.label")}
            </label>
            <div className="flex gap-2">
              <input
                ref={addInput}
                id={ids.add}
                className="input"
                value={draft}
                maxLength={120}
                placeholder={t("editor.phrases.add.placeholder")}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftError(null);
                }}
                enterKeyHint="done"
                autoComplete="off"
                aria-invalid={draftError ? true : undefined}
                aria-describedby={draftError ? `${ids.add}-err` : undefined}
              />
              <button type="submit" className="btn btn-primary shrink-0 px-4" disabled={!draft.trim()} aria-label={t("editor.phrases.add")}>
                <Icon name="plus" />
              </button>
            </div>
            {draftError && (
              <p id={`${ids.add}-err`} className="mt-1 text-sm text-danger">
                {draftError}
              </p>
            )}
          </form>

          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => setPasteOpen(true)}>
              <Icon name="copy" size={20} />
              {t("editor.phrases.paste")}
            </button>
            {phrases.length > 0 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (window.confirm(t("editor.phrases.clear.confirm"))) setPhrases([]);
                }}
              >
                {t("editor.phrases.clear")}
              </button>
            )}
          </div>

          {phrases.length === 0 ? (
            <p className="mt-6 text-center text-muted">{t("editor.phrases.empty")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {displayed.map(({ text, i }) => (
                <li key={text} className="flex items-center gap-2 py-1 pr-1 pl-4">
                  <span className="w-6 shrink-0 text-xs font-bold text-muted tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 py-2 break-words">{text}</span>
                  <button
                    type="button"
                    className="icon-btn text-muted"
                    aria-label={t("editor.phrases.remove", { text })}
                    onClick={() => setPhrases((list) => list.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Barre d'enregistrement collée en bas, au-dessus de l'indicateur d'accueil iOS */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/90 pt-3 backdrop-blur-md">
        <div className="page">
          {error && (
            <p role="alert" className="mb-2 text-center text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-primary w-full" onClick={save} disabled={saving}>
            {saving ? t("editor.saving") : t("editor.save")}
          </button>
        </div>
      </div>

      <BottomSheet open={pasteOpen} onClose={() => setPasteOpen(false)} title={t("editor.phrases.paste")}>
        <label htmlFor={ids.paste} className="label">
          {t("editor.phrases.paste.label")}
        </label>
        <textarea
          id={ids.paste}
          className="input min-h-[40dvh] resize-y leading-relaxed"
          value={pasteText}
          placeholder={t("editor.phrases.paste.placeholder")}
          onChange={(e) => setPasteText(e.target.value)}
          autoFocus
        />
        <button
          type="button"
          className="btn btn-primary mt-3 w-full"
          onClick={addPasted}
          disabled={!pasteText.trim()}
        >
          {t("editor.phrases.paste.submit")}
        </button>
      </BottomSheet>
    </div>
  );
}
