import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });
// Christmas Mallow Demo (via 1001fonts) — free for personal use only. Buy a licence before commercial use.
// Papernotes — text inside cards & glass panels.
const george = localFont({
  src: [
    { path: "../fonts/Papernotes.woff2", weight: "400" },
    { path: "../fonts/Papernotes-Bold.woff2", weight: "700" },
  ],
  variable: "--font-george",
  display: "swap",
});
const gasdrifo = localFont({ src: "../fonts/ChristmasMallow-Demo.ttf",
  variable: "--font-gasdrifo",
  display: "swap",
  // The face draws very large for its em-box; scale it down to sit like a normal display font.
  declarations: [{ prop: "size-adjust", value: "42%" }],
});

export const metadata: Metadata = {
  title: {
    default: "AeroFusion — Explainable PM2.5 forecasting for India",
    template: "%s · AeroFusion",
  },
  description:
    "MW-AeroFusion-Net: multi-resolution wavelet, adaptive diffusion graph, ConvLSTM and Transformer network for explainable PM2.5 forecasting across Indian cities.",
  applicationName: "AeroFusion",
  authors: [{ name: "AeroFusion" }],
  keywords: ["PM2.5", "air quality", "India", "forecasting", "explainable AI", "graph neural network", "ConvLSTM"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#07080d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} ${gasdrifo.variable} ${george.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <div className="app-backdrop" aria-hidden />
          {children}
        </Providers>
      </body>
    </html>
  );
}
