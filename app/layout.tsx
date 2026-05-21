import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

import { StoreAppBar } from "@/components/navigation/storeAppBar";
import { AuthProvider } from "@/components/providers/authProvider";
import { CartProvider } from "@/components/providers/cartProvider";
import { FavoritesProvider } from "@/components/providers/favoritesProvider";
import { QueryProvider } from "@/components/providers/queryProvider";
import ThemeRegistry from "@/components/providers/themeRegistry";

import { getCart } from "@/lib/serverApi";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Spree",
  description: "Spree storefront UI",
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
      className={`${inter.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeRegistry>
            <QueryProvider>
              <FavoritesProvider>
                <CartProvider initialCart={initialCart}>
                  <StoreAppBar />

                  <main style={{ flex: 1 }}>
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