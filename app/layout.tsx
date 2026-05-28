import type { Metadata } from "next";
import { Rubik, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

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
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeRegistry>
            <QueryProvider>
              <FavoritesProvider>
                <CartProvider initialCart={initialCart}>
                  <StoreAppBar />
                  <Analytics />
                  <main style={{ flex: 1, paddingTop: "72px" }}>
                    {children}
                  </main>
                </CartProvider>
              </FavoritesProvider>
            </QueryProvider>
          </ThemeRegistry>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
