import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PETORA | Pets Beyond Borders",
  description:
    "PETORA — Pets Beyond Borders. Discover pets, explore categories and connect with companions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}