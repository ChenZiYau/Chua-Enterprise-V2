import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chua Enterprise V2 — Admin Dashboard",
  description: "Property management admin dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
