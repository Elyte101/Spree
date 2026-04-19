import type { Metadata } from "next";
import "./globals.css";
import { StoreAppBar } from "@/components/navigation/storeAppBar";
import { AuthProvider } from "@/components/providers/authProvider";
import { CartProvider } from "@/components/providers/cartProvider";
import { FavoritesProvider } from "@/components/providers/favoritesProvider";
import { QueryProvider } from "@/components/providers/queryProvider";
import ThemeRegistry from "@/components/providers/themeRegistry";
import { getCart } from "@/lib/serverApi";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeRegistry>
            <QueryProvider>
              <FavoritesProvider>
                <CartProvider initialCart={initialCart}>
                  <StoreAppBar />
                  <main style={{ flex: 1 }}>{children}</main>
                </CartProvider>
              </FavoritesProvider>
            </QueryProvider>
          </ThemeRegistry>
        </AuthProvider>
      </body>
    </html>
  );
}
