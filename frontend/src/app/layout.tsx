import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { PreferencesProvider, type Locale, type Theme } from "@/lib/i18n/preferences";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentShield",
  description: "AI Agent Security Gateway — Admin Dashboard",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const locale: Locale = store.get("locale")?.value === "en" ? "en" : "ar";
  const theme: Theme = store.get("theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${plexArabic.variable} ${jetbrains.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}
    >
      <body className="min-h-full bg-bg font-sans text-fg">
        <PreferencesProvider initialLocale={locale} initialTheme={theme}>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
