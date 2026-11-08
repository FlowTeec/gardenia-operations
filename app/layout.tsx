import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const APPLICATION_NAME = "Gardenia Smart Operations";
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
  title: {
    default: APPLICATION_NAME,
    template: `%s · ${APPLICATION_NAME}`,
  },
  description:
    "Gardenia Smart Operations – Centralized inventory and sales management system.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-svh flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
