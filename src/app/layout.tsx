import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/shell/Providers";
import { Toaster } from "@/components/ui/Toast";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/client/product";
import "./globals.css";

const sans = Inter_Tight({
  variable: "--nf-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});
const mono = JetBrains_Mono({ variable: "--nf-mono", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s / ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
};

export const viewport: Viewport = { themeColor: "#F3F1EC", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
