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
  title: "ATM Field Master",
  description: "Engineer Access Portal for NCR, Diebold, and GRG ATMs",
  manifest: "/manifest.json",
  themeColor: "#020617",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ATM Master",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          body { background-color: #020617 !important; color: #e2e8f0 !important; font-family: -apple-system, system-ui, sans-serif !important; }
          .bg-slate-900 { background-color: #020617 !important; }
          .bg-slate-800 { background-color: #1e293b !important; }
          .bg-slate-950 { background-color: #020617 !important; }
          .text-slate-100 { color: #f1f5f9 !important; }
          .text-slate-200 { color: #e2e8f0 !important; }
          .text-slate-400 { color: #94a3b8 !important; }
          .text-white { color: #ffffff !important; }
          .min-h-screen { min-height: 100vh !important; }
          .flex { display: -webkit-box !important; display: -webkit-flex !important; display: flex !important; }
          .flex-col { -webkit-box-orient: vertical !important; -webkit-box-direction: normal !important; -webkit-flex-direction: column !important; flex-direction: column !important; }
          .items-center { -webkit-box-align: center !important; -webkit-align-items: center !important; align-items: center !important; }
          .justify-center { -webkit-box-pack: center !important; -webkit-justify-content: center !important; justify-content: center !important; }
          .rounded-lg { border-radius: 0.5rem !important; }
          .rounded-xl { border-radius: 0.75rem !important; }
          .p-8 { padding: 2rem !important; }
          .max-w-md { max-width: 28rem !important; }
          .w-full { width: 100% !important; }
          .border { border: 1px solid #334155 !important; }
          input { background-color: #020617 !important; color: #ffffff !important; border: 1px solid #334155 !important; border-radius: 0.375rem !important; padding: 0.625rem 1rem !important; }
          button { background-color: #2563eb !important; color: #ffffff !important; border-radius: 0.375rem !important; padding: 0.75rem 1.25rem !important; cursor: pointer !important; }
        ` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
