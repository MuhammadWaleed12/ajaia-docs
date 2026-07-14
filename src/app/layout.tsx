import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ajaia Docs",
  description: "A tiny collaborative documents app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
