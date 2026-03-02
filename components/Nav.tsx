"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const links = [
  { href: "/upload", label: "Upload" },
  { href: "/months", label: "Dashboard" },
  { href: "/summary", label: "Summary" },
  { href: "/fire", label: "FIRE Calculator" },
  { href: "/settings", label: "Rent & income" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {links.map(({ href, label }) => {
            const active =
              pathname === href ||
              pathname.startsWith(href + "/") ||
              (href === "/months" && pathname.startsWith("/month/"));
            return (
              <Link
                key={href}
                href={href}
                className={`
                  rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200
                  ${active
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-purple-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
              >
                {label}
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            {status === "loading" ? (
              <span className="text-sm text-gray-400">…</span>
            ) : session?.user ? (
              <>
                <span className="text-sm text-gray-600 truncate max-w-[140px]" title={session.user.email ?? undefined}>
                  {session.user.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-md hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
