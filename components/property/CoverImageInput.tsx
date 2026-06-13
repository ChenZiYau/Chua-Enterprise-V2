"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

/**
 * Cover-image control: accept a file upload (drag-drop or picker) OR a pasted
 * URL, then crop at a user-chosen aspect ratio.
 *
 *  - Pasted URL kept as-is  -> reported via `onUrlChange`, `onFileChange(null)`.
 *  - Uploaded/cropped image -> reported via `onFileChange(file)` as a Blob ready
 *    for storage, and `onUrlChange("")` so the URL field is cleared.
 *
 * Cropping a *remote* URL needs the host to allow CORS (canvas read). If it
 * doesn't, we don't crash: we fall back to storing the URL as-is and show a
 * small "preview only" note. Cropping uploaded files always works.
 */

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "Free", value: undefined },
];

type Props = {
  /** Current cover URL (e.g. existing image on edit) for the initial preview. */
  value?: string | null;
  /** Called with a pasted/kept URL string (or "" when a binary replaces it). */
  onUrlChange?: (url: string) => void;
  /** Called with the cropped/uploaded image Blob, or null when none. */
  onFileChange?: (file: File | null) => void;
  /** Adder mode (gallery): when set, each chosen/cropped image is committed and
   *  the control resets for the next one, instead of holding a single value. */
  onCommit?: (result: { url: string } | { file: File; previewUrl: string }) => void;
  /** Force-enable/disable upload+crop. Defaults to "enabled when a Blob consumer
   *  exists". Pass false to offer paste-a-URL only. */
  allowUpload?: boolean;
};

const boxStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
};

export function CoverImageInput({ value, onUrlChange, onFileChange, onCommit, allowUpload }: Props) {
  // Adder mode (gallery) commits each image and resets; single-value mode (cover)
  // holds one value.
  const adder = typeof onCommit === "function";
  // Uploading/cropping produces a Blob that needs a consumer. Without one (e.g.
  // the edit drawer, which only persists URLs) we degrade to paste-a-URL only,
  // so an uploaded file can never be silently dropped on save.
  const canUpload =
    allowUpload !== undefined ? allowUpload : adder || typeof onFileChange === "function";
  const [tab, setTab] = useState<"upload" | "link">(canUpload ? "upload" : "link");
  const [urlDraft, setUrlDraft] = useState("");
  const [preview, setPreview] = useState<string | null>(value || null);

  // Crop session state.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropRemote, setCropRemote] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(4 / 3);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Object URLs we create and must revoke to avoid leaks.
  const objectUrls = useRef<string[]>([]);
  const trackUrl = (u: string) => {
    objectUrls.current.push(u);
    return u;
  };
  useEffect(
    () => () => {
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    []
  );

  const onCropComplete = useCallback((_: Area, areaPx: Area) => setAreaPixels(areaPx), []);

  function beginCropFromFile(file: File) {
    setError(null);
    setNote(null);
    setCropRemote(false);
    setCropSrc(trackUrl(URL.createObjectURL(file)));
  }

  function beginCropFromUrl(url: string) {
    setError(null);
    setNote(null);
    setCropRemote(true);
    setCropSrc(url);
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Image is larger than 20MB.");
      return;
    }
    beginCropFromFile(file);
  }

  /** Reset the picker to empty (adder mode, ready for the next image). */
  function resetAdder() {
    setCropSrc(null);
    setUrlDraft("");
    setNote(null);
    setError(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }

  /** Keep a URL without cropping. */
  function keepUrlAsIs(url: string) {
    if (adder) {
      onCommit?.({ url });
      resetAdder();
      return;
    }
    onUrlChange?.(url);
    onFileChange?.(null);
    setPreview(url);
    setCropSrc(null);
  }

  async function applyCrop() {
    if (!cropSrc || !areaPixels) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getCroppedBlob(cropSrc, areaPixels, cropRemote);
      const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
      if (adder) {
        // Caller owns this object URL's lifecycle (revoked on item removal).
        onCommit?.({ file, previewUrl: URL.createObjectURL(blob) });
        resetAdder();
        return;
      }
      onFileChange?.(file);
      onUrlChange?.("");
      setPreview(trackUrl(URL.createObjectURL(blob)));
      setNote(null);
      setCropSrc(null);
    } catch {
      // CORS-tainted remote image (or unreadable): fall back to URL-as-is.
      if (cropRemote) {
        keepUrlAsIs(cropSrc);
        setNote("Preview only — couldn't crop this remote image, so it's saved as-is.");
      } else {
        setError("Could not crop this image. Try a different file.");
      }
    } finally {
      setBusy(false);
    }
  }

  function clearCover() {
    onUrlChange?.("");
    onFileChange?.(null);
    setPreview(null);
    setUrlDraft("");
    setCropSrc(null);
    setNote(null);
    setError(null);
  }

  // ---- Crop overlay ----
  if (cropSrc) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border p-3" style={boxStyle}>
        <div className="relative w-full overflow-hidden rounded-lg" style={{ height: 240, background: "var(--surface-subtle)" }}>
          <Cropper
            image={cropSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect ?? areaAspectFallback(areaPixels)}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            Ratio
          </span>
          {ASPECTS.map((a) => {
            const active = aspect === a.value;
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => setAspect(a.value)}
                className="text-xs px-2.5 py-1 rounded-lg border transition"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border-soft)",
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.12em] shrink-0" style={{ color: "var(--text-muted)" }}>
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="accent-[var(--accent)]"
            style={{ width: 190 }}
          />
          <span
            className="text-xs tabular-nums shrink-0"
            style={{ color: "var(--text-muted)", minWidth: 42 }}
          >
            {Math.round(zoom * 100)}%
          </span>
        </label>

        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="ui-btn" onClick={() => setCropSrc(null)} disabled={busy}>
            Cancel
          </button>
          {cropRemote && (
            <button type="button" className="ui-btn" onClick={() => keepUrlAsIs(cropSrc)} disabled={busy}>
              Use without cropping
            </button>
          )}
          <button type="button" className="ui-btn ui-btn-primary" onClick={applyCrop} disabled={busy}>
            {busy ? "Cropping…" : "Apply crop"}
          </button>
        </div>
      </div>
    );
  }

  // ---- Chosen-cover preview ----
  if (preview) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="relative w-full overflow-hidden rounded-xl border"
          style={{
            ...boxStyle,
            // Match the dashboard cover ratio (PublicGallery hero is 4:3) but cap
            // the height so a wide form column can't blow the preview up. The crop
            // data is unaffected — this is display-only.
            aspectRatio: "4 / 3",
            maxWidth: 460,
            maxHeight: 345,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Cover preview" className="w-full h-full object-cover" />
        </div>
        {note && <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{note}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ui-btn"
            onClick={() => (canUpload ? fileInputRef.current?.click() : clearCover())}
          >
            Replace
          </button>
          <button type="button" className="ui-btn" onClick={clearCover}>
            Remove
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    );
  }

  // ---- Empty: choose upload or link ----
  return (
    <div className="flex flex-col gap-3">
      {canUpload && (
      <div className="flex gap-1.5">
        {(["upload", "link"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="text-xs px-3 py-1.5 rounded-lg border transition"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border-soft)",
                background: active ? "var(--accent-soft)" : "var(--surface)",
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {t === "upload" ? "Upload" : "Paste link"}
            </button>
          );
        })}
      </div>
      )}

      {canUpload && tab === "upload" ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-8 text-center transition"
          style={{ ...boxStyle, borderColor: "var(--border-strong)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Drag &amp; drop an image, or click to choose
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            PNG or JPG, up to 20MB — you can crop it next
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition focus:ring-2"
            style={{ ...boxStyle, color: "var(--text-primary)" }}
            placeholder="https://… (shown as the hero photo)"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {canUpload && (
              <button
                type="button"
                className="ui-btn"
                disabled={!urlDraft.trim()}
                onClick={() => beginCropFromUrl(urlDraft.trim())}
              >
                Crop…
              </button>
            )}
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              disabled={!urlDraft.trim()}
              onClick={() => keepUrlAsIs(urlDraft.trim())}
            >
              Use this URL
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

/** A sane aspect for "Free" mode so the cropper has finite bounds. */
function areaAspectFallback(area: Area | null): number {
  if (area && area.height > 0) return area.width / area.height;
  return 4 / 3;
}

/** Draw the cropped region to a canvas and export a JPEG Blob. Throws if the
 *  source is a CORS-tainted remote image (caller falls back to URL-as-is). */
async function getCroppedBlob(src: string, area: Area, remote: boolean): Promise<Blob> {
  const img = await loadImage(src, remote);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height
  );
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.9
    );
  });
}

function loadImage(src: string, remote: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Request CORS for remote images so the canvas stays readable when allowed.
    if (remote) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
