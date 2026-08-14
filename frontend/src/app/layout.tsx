import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LedgerPro — Simple Ledger Management",
  description:
    "LedgerPro helps textile manufacturers track customer credit, debit and dues in one clean, mobile-friendly app.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4F46E5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans h-screen flex justify-center bg-gray-200 overflow-hidden antialiased text-text-primary`}
      >
        <div className="w-full max-w-[430px] h-screen bg-page flex flex-col overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}