import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { PresentMode } from "@/components/shell/PresentMode";
import { Providers } from "@/components/shell/Providers";
import { Toaster } from "@/components/ui/Toast";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/client/product";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s / ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
};

export const viewport: Viewport = { themeColor: "#F3F1EC", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  // fonts are self-hosted in public/fonts so the demo works with the venue Wi-Fi down
  for (const f of ["inter-tight-latin", "jetbrains-mono-latin"])
    preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body>
        <PresentMode />
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
