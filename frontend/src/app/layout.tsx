import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ServiceHub - Multi-Branch Service Center Management",
  description:
    "Comprehensive computer & laptop service center management system for India. Manage job cards, inventory, billing, and more.",
  keywords: [
    "service center",
    "laptop repair",
    "computer service",
    "job card",
    "GST billing",
    "inventory management",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
