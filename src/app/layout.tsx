import type { Metadata } from "next";
import { Rajdhani, Inter } from "next/font/google";
import "./globals.css";
import { getSiteSettings } from "@/lib/site-settings";
import { getActiveTheme } from "@/lib/theme/get-active-theme";
import { buildCssVars } from "@/lib/theme/build-css-vars";
import { buildGoogleFontsUrl } from "@/lib/theme/google-fonts";
import { mangaPreset } from "@/lib/theme/presets/manga";

const rajdhani = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: {
      default: settings.site_title,
      template: `%s | ${settings.site_title}`,
    },
    description: settings.site_description,
    icons: settings.favicon_url
      ? { icon: settings.favicon_url }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [activeTheme, settings] = await Promise.all([
    getActiveTheme(),
    getSiteSettings(),
  ]);
  const cssVars = buildCssVars(activeTheme.preset, activeTheme.customOverrides);

  const isDefaultPreset = activeTheme.preset.id === mangaPreset.id;
  const googleFontsUrl = isDefaultPreset
    ? null
    : buildGoogleFontsUrl(activeTheme.preset);

  return (
    <html lang="en" style={cssVars}>
      <head>
        {settings.favicon_url && (
          <link rel="icon" href={settings.favicon_url} />
        )}
        {googleFontsUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={googleFontsUrl} />
          </>
        )}
      </head>
      <body className={`${rajdhani.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
