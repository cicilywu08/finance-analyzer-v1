"use client";

import { LanguageProvider } from "@/components/LanguageContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
