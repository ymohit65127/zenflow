import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
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
    default: "ZenFlow — Everything Flows.",
    template: "%s | ZenFlow",
  },
  description:
    "ZenFlow is the all-in-one SaaS platform for modern businesses. CRM, Projects, HR, Helpdesk, Accounting, and more — everything flows seamlessly.",
  keywords: ["saas", "crm", "project management", "hr", "helpdesk", "accounting", "zenflow"],
  authors: [{ name: "Mohit Yadav", url: "https://mobilise.co.in" }],
  creator: "Mobilise App Lab Private Limited",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "ZenFlow — Everything Flows.",
    description: "The all-in-one SaaS platform for modern businesses.",
    siteName: "ZenFlow",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZenFlow — Everything Flows.",
    description: "The all-in-one SaaS platform for modern businesses.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)", color: "#4338ca" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              duration: 4000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
