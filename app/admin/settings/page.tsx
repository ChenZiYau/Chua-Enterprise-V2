"use client";

import { useRouter } from "next/navigation";
import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";
import { signOut } from "@/lib/auth";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  preview: { bg: string; surface: string; text: string; accent: string };
}[] = [
  {
    value: "light",
    label: "Light",
    hint: "Warm paper background",
    preview: { bg: "#f4f1ea", surface: "#ffffff", text: "#15171c", accent: "#5d5fef" },
  },
  {
    value: "dark",
    label: "Dark",
    hint: "Low-glare for night work",
    preview: { bg: "#0e1014", surface: "#161920", text: "#e8eaef", accent: "#7c7ef5" },
  },
  {
    value: "system",
    label: "System",
    hint: "Match your OS setting",
    preview: { bg: "linear-gradient(90deg,#f4f1ea 50%,#0e1014 50%)", surface: "transparent", text: "#888", accent: "#7c7ef5" },
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { preference, resolved, setPreference } = useTheme();

  function handleSignOut() {
    signOut();
    router.replace("/login");
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-8 max-w-4xl">
      <div>
        <p
          className="text-[11px] uppercase tracking-[0.16em]"
          style={{ color: "var(--text-faint)" }}
        >
          Workspace
        </p>
        <h2
          className="text-2xl font-semibold mt-1 tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Settings
        </h2>
        <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
          Personal preferences for this device.
        </p>
      </div>

      {/* Appearance */}
      <section className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-x-8 gap-y-4">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            Appearance
          </p>
          <h3
            className="text-sm font-semibold mt-1"
            style={{ color: "var(--text-primary)" }}
          >
            Theme
          </h3>
          <p
            className="text-xs mt-2 leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Currently showing the{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {resolved}
            </span>{" "}
            theme.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OPTIONS.map((opt) => {
            const active = preference === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreference(opt.value)}
                className="text-left p-4 rounded-xl transition flex flex-col gap-3"
                style={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: active ? "var(--accent)" : "var(--border-soft)",
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                  boxShadow: active ? "0 0 0 3px var(--accent-ring)" : "none",
                }}
              >
                {/* Mini preview */}
                <div
                  className="h-16 w-full rounded-lg relative overflow-hidden"
                  style={{
                    background: opt.preview.bg,
                    border: "1px solid var(--border-soft)",
                  }}
                >
                  {opt.value !== "system" ? (
                    <>
                      <span
                        className="absolute left-2 top-2 right-2 h-2 rounded-sm"
                        style={{ background: opt.preview.surface }}
                      />
                      <span
                        className="absolute left-2 bottom-2 w-8 h-2 rounded-sm"
                        style={{ background: opt.preview.accent }}
                      />
                      <span
                        className="absolute left-12 bottom-2 right-2 h-2 rounded-sm opacity-60"
                        style={{ background: opt.preview.text }}
                      />
                    </>
                  ) : null}
                </div>

                <div className="flex items-center justify-between">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {opt.label}
                  </p>
                  {active ? (
                    <span
                      className="text-[10px] uppercase tracking-[0.14em] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      Active
                    </span>
                  ) : null}
                </div>
                <p
                  className="text-[11px] -mt-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {opt.hint}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Profile */}
      <section className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-x-8 gap-y-4">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            Profile
          </p>
          <h3
            className="text-sm font-semibold mt-1"
            style={{ color: "var(--text-primary)" }}
          >
            Account
          </h3>
          <p
            className="text-xs mt-2 leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Signed in to this workspace.
          </p>
        </div>

        <div className="ui-card p-5 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full shrink-0"
            style={{
              background: "linear-gradient(135deg, #4a4f5b 0%, #2a2d34 100%)",
              border: "2px solid var(--border-soft)",
            }}
          />
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Admin User
            </p>
            <p
              className="text-xs leading-tight mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              admin@chua.co
            </p>
          </div>
          <button type="button" className="ui-btn" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
