"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If already signed in, skip straight to the admin.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/admin");
    });
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Incorrect email or password.");
      setPassword("");
      setSubmitting(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2"
      style={{ background: "var(--background)" }}
    >
      {/* Left - property image */}
      <aside className="relative hidden lg:block overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/login-property.jpg"
          alt="Modern house exterior"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Overlay gradient for readable text */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,17,22,0.10) 0%, rgba(15,17,22,0.55) 60%, rgba(15,17,22,0.85) 100%)",
          }}
        />

        {/* Brand mark - top left */}
        <div className="relative z-10 p-8 flex items-center gap-2.5 text-white">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11 12 4l9 7" />
              <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
            </svg>
          </div>
          <span className="font-semibold tracking-tight">Chua Enterprise</span>
        </div>

        {/* Caption - bottom */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-10 text-white">
          <p
            className="text-[11px] uppercase tracking-[0.18em] mb-3"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Property Management
          </p>
          <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight leading-tight max-w-md">
            Manage every room, every payment, every property.
          </h2>
          <p
            className="text-sm mt-3 max-w-md leading-relaxed"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            A calmer admin for room-rental and whole-unit portfolios.
          </p>

          <p
            className="text-[10px] mt-8"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Photo by Max Vakhtbovych - Pexels
          </p>
        </div>
      </aside>

      {/* Right - form */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm flex flex-col gap-7">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11 12 4l9 7" />
                <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Chua Enterprise
            </span>
          </div>

          <div>
            <p
              className="text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "var(--text-faint)" }}
            >
              Welcome back
            </p>
            <h1
              className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1"
              style={{ color: "var(--text-primary)" }}
            >
              Sign in
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
              Use your admin email and password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span
                className="text-[11px] font-medium uppercase tracking-[0.12em]"
                style={{ color: "var(--text-muted)" }}
              >
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition"
                style={{
                  borderColor: "var(--border-soft)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Password
                </span>
                <a
                  href="#"
                  className="text-[11px] font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg border outline-none transition"
                  style={{
                    borderColor: "var(--border-soft)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17.9 17.9 0 0 1-3.2 4.2" />
                      <path d="M6.7 6.7A17.7 17.7 0 0 0 2 12s4 7 10 7a10 10 0 0 0 5.3-1.5" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Keep me signed in on this device
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="text-xs -mt-2"
                style={{ color: "var(--danger, #dc2626)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="ui-btn ui-btn-primary w-full !py-2.5 disabled:opacity-70"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p
            className="text-[11px] text-center mt-2"
            style={{ color: "var(--text-faint)" }}
          >
            By signing in you agree to the workspace terms.
          </p>
        </div>
      </main>
    </div>
  );
}
