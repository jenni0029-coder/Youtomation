import "./globals.css";

const NAME = process.env.NEXT_PUBLIC_APP_NAME || "AutoTubeAI";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: `${NAME} — AI YouTube Automation Studio`, template: `%s · ${NAME}` },
  description: "Write viral scripts, titles, SEO packs, thumbnail concepts and content calendars, and analyze any YouTube video or competitor site — in seconds.",
  manifest: "/manifest.json",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: NAME },
  openGraph: {
    title: `${NAME} — AI YouTube Automation Studio`,
    description: "Scripts, titles, SEO, thumbnails, content plans and competitor research for YouTube creators.",
    images: ["/og.png"],
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080d1a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
