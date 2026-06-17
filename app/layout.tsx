import type { Metadata } from "next";
import { Rubik, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"

import "./globals.css";

import { StoreAppBar } from "@/components/navigation/storeAppBar";
import { AuthProvider } from "@/components/providers/authProvider";
import { CartProvider } from "@/components/providers/cartProvider";
import { FavoritesProvider } from "@/components/providers/favoritesProvider";
import { QueryProvider } from "@/components/providers/queryProvider";
import ThemeRegistry from "@/components/providers/themeRegistry";

import { getCart } from "@/lib/serverApi";

const rubik = Rubik({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rubik",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Spree — Shop Safe. Pay Smart. Delivered.",
  description: "Ghana's trusted marketplace with escrow protection, verified sellers, and Mobile Money payments.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/spree-logo.png", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialCart = await getCart();

  return (
    <html
      lang="en"
      className={`${rubik.variable} ${nunitoSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Blocking script: runs before React hydrates so the page background
          matches the stored theme even during the JS loading window. */}
      <head>
        {/* eslint-disable react/no-danger, @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('spree-theme-mode'),d=s==='dark'||(s===null&&window.matchMedia('(prefers-color-scheme: dark)').matches),e=document.documentElement;if(d){e.style.background='#0C0B14';e.style.color='#F0EEFF';e.style.colorScheme='dark';}else{e.style.background='#F5F4FF';e.style.color='#0F0E1A';e.style.colorScheme='light';}}catch(e){}}())`,
          }}
        />
        {/* eslint-enable react/no-danger, @next/next/no-sync-scripts */}
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeRegistry>
            <QueryProvider>
              <FavoritesProvider>
                <CartProvider initialCart={initialCart}>
                  <StoreAppBar />
                  <Analytics />
                  <main style={{ flex: 1, minHeight: "calc(100vh - 72px)", paddingTop: "72px" }}>
                    {children}
                  </main>
                </CartProvider>
              </FavoritesProvider>
            </QueryProvider>
          </ThemeRegistry>
        </AuthProvider>
      </body>
    </html>
  );
}
