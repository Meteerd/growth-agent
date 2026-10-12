import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { PitchControls } from "@/components/shell/PitchControls";
import { PresentMode } from "@/components/shell/PresentMode";
import { Providers } from "@/components/shell/Providers";
import { RouteProgress } from "@/components/shell/RouteProgress";
import { Toaster } from "@/components/ui/Toast";
import { PRODUCT_NAME, PRODUCT_TAGLINE, SITE_URL } from "@/lib/client/product";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${PRODUCT_NAME}: the ads that win, rebuilt for your brand`, template: `%s / ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: PRODUCT_NAME, url: "/", description: PRODUCT_TAGLINE },
  twitter: { card: "summary_large_image", description: PRODUCT_TAGLINE },
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
        <RouteProgress />
        <Providers>
          {children}
          <PitchControls />
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
