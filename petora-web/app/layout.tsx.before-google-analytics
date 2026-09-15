import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PETORA™ | Pets Beyond Borders",
  description:
    "Discover available pets, explore pet categories, check live listings, and connect with PETORA for enquiries and guidance.",
  keywords: [
    "PETORA",
    "Pets Beyond Borders",
    "pets in Patna",
    "pet listings",
    "dogs",
    "cats",
    "aquatics",
    "reptiles",
    "exotic pets",
  ],
  authors: [{ name: "PETORA" }],
  creator: "PETORA",
  publisher: "PETORA",
  metadataBase: new URL("https://petora-ashen.vercel.app"),

  openGraph: {
    title: "PETORA™ | Pets Beyond Borders",
    description:
      "Discover available pets, explore categories, and connect with PETORA.",
    url: "https://petora-ashen.vercel.app",
    siteName: "PETORA™",
    images: [
      {
        url: "/petora-logo.png",
        width: 1200,
        height: 630,
        alt: "PETORA™ — Pets Beyond Borders",
      },
    ],
    locale: "en_IN",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "PETORA™ | Pets Beyond Borders",
    description:
      "Discover available pets, explore categories, and connect with PETORA.",
    images: ["/petora-logo.png"],
  },

  icons: {
    icon: "/petora-logo.png",
    shortcut: "/petora-logo.png",
    apple: "/petora-logo.png",
  },

  robots: {
    index: true,
    follow: true,
  },
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