"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";

const links = [
  { href: "/upload", labelKey: "nav.upload" },
  { href: "/months", labelKey: "nav.dashboard" },
  { href: "/summary", labelKey: "nav.summary" },
  { href: "/fire", labelKey: "nav.fire" },
  { href: "/settings", labelKey: "nav.rent_income" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();

  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {links.map(({ href, labelKey }) => {
            const active =
              pathname === href ||
              pathname.startsWith(href + "/") ||
              (href === "/months" && pathname.startsWith("/month/"));
            return (
              <Link
                key={href}
                href={href}
                className={`
                  rounded-xl px-4 py-2.5 text-sm font-semibold transition-all
                  ${active
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-purple-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
              >
                {t(labelKey)}
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  locale === "en" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
                aria-pressed={locale === "en"}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale("zh")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  locale === "zh" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
                aria-pressed={locale === "zh"}
              >
                中文
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
