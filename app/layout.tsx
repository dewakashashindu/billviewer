import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mila Mirissa — Bill Viewer",
  description: "Mila Mirissa restaurant bill viewer and reports",
  icons: {
    icon: [
      { url: "/favicon-mila.png?v=2", type: "image/png", sizes: "64x64" },
      { url: "/favicon.ico?v=2" },
    ],
    shortcut: "/favicon-mila.png?v=2",
    apple: "/favicon-mila.png?v=2",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
