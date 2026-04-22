/**
 * T063 / US4 — Aurelia storefront root layout.
 *
 * Embeds the AI to Widget bundle via `<link>` + `<script>` with the data-*
 * attributes the runtime expects (contracts/widget-config.md §1). The
 * widget boots on `afterInteractive` and renders the launcher in the
 * bottom-right corner of every page.
 *
 * This file replaces the Next.js starter's `app/layout.tsx` at image
 * build time (see storefront/Dockerfile stage).
 */
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurelia — Specialty Coffee",
  description:
    "Aurelia's specialty coffee catalog — the Ai to Widget hackathon demo host.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backendUrl = process.env.NEXT_PUBLIC_ATW_BACKEND_URL ?? "http://localhost:3100";
  const apiBaseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
  return (
    <html lang="es-ES">
      <body>
        {children}

        {/* Aurelia theming overrides — host-level; the widget picks these up
            via CSS custom property inheritance. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --atw-primary-color: #8B4513;
                --atw-primary-text-color: #ffffff;
                --atw-radius: 4px;
                --atw-font-family: "Inter", system-ui, -apple-system, sans-serif;
              }
            `,
          }}
        />

        <link rel="stylesheet" href="/widget.css" />
        <Script
          src="/widget.js"
          strategy="afterInteractive"
          data-backend-url={backendUrl}
          data-api-base-url={apiBaseUrl}
          data-auth-mode="cookie"
          data-launcher-position="bottom-right"
          data-locale="es-ES"
          data-intro="¡Hola! Soy el asistente de Aurelia. Pregúntame sobre nuestros cafés."
          data-login-url="/account"
        />
      </body>
    </html>
  );
}
