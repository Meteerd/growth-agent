import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Backdrop, Grain } from "@/components/shell/Backdrop";
import { Providers } from "@/components/shell/Providers";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { Toaster } from "@/components/ui/Toast";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/client/product";
import "./globals.css";

const serif = Instrument_Serif({
  variable: "--nf-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const sans = Inter_Tight({ variable: "--nf-sans", subsets: ["latin", "latin-ext"] });
const mono = JetBrains_Mono({ variable: "--nf-mono", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s / ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
};

export const viewport: Viewport = { themeColor: "#06070A", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Backdrop />
        <SmoothScroll />
        <Providers>{children}</Providers>
        <Toaster />
        <Grain />
      </body>
    </html>
  );
}
