import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AccessGuard from "@/components/AccessGuard";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "SAVRDH Camera Control Studio",
  description: "Canon EOS R50 wireless control, live view, recording and multi-screen preview",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <Providers><AccessGuard />{children}</Providers>
      </body>
    </html>
  );
}
