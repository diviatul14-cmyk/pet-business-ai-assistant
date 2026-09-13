import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "PETORA™ | Pets Beyond Borders | Pet Listings in Patna",
  description: "Discover available pets, pet listings, dogs, cats, aquatics and more with PETORA™ — Pets Beyond Borders. Explore listings and connect with PETORA in Patna.",
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
  alternates: {
    canonical: "/",
  },

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
      <body>
        {children}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://petora-ashen.vercel.app/#organization",
                "name": "PETORA™",
                "url": "https://petora-ashen.vercel.app",
                "logo": "https://petora-ashen.vercel.app/petora-logo.png",
                "description": "PETORA™ — Pets Beyond Borders. Discover pet listings, explore pet categories, and connect with PETORA."
              },
              {
                "@type": "WebSite",
                "@id": "https://petora-ashen.vercel.app/#website",
                "url": "https://petora-ashen.vercel.app",
                "name": "PETORA™ | Pets Beyond Borders",
                "publisher": {
                  "@id": "https://petora-ashen.vercel.app/#organization"
                }
              }
            ]
          })
        }}
      />

        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-2B07YW3NWJ"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-2B07YW3NWJ');
          `}
        </Script>
      </body>
    </html>
  );
}