export default function ShareNotFound() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--background)", color: "var(--text-primary)" }}
    >
      <div className="text-center max-w-sm flex flex-col items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "var(--surface-subtle)", color: "var(--text-faint)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          This listing link is no longer available
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          The link may have expired or the listing has been removed. Please ask for an updated link.
        </p>
      </div>
    </main>
  );
}
