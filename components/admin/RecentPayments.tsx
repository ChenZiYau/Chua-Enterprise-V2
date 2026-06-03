import Link from "next/link";

export type RecentPayment = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  when: string;
};

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Real recent payments, derived from revenue entries on the server.
 *  (Previously this animated randomly-generated fake names/amounts.) */
export function RecentPayments({ payments }: { payments: RecentPayment[] }) {
  return (
    <div className="ui-card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Recent Payments
        </h3>
        <Link href="/admin/revenue" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
          See all
        </Link>
      </div>

      {payments.length === 0 ? (
        <p className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
          No recorded payments yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 px-1 rounded-md">
              <div
                className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
                style={{ background: "linear-gradient(135deg,#dcd6c7,#b6ad99)", color: "#3a3a3a" }}
              >
                {p.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {p.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {p.unit} - {p.when}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: "var(--success)" }}>
                +{formatMYR(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
