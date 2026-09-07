"use client";

import { getCurrentWeekLabel } from "@/lib/week";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

const NAV_LINKS = [
  { label: "Content Atelier", href: "/atelier" },
  { label: "Saved Drafts", href: "/atelier/drafts" },
  { label: "Content Forge", href: "/content-forge" },
  { label: "AI Echo", href: "/atelier/ai-echo" },
  { label: "Authority", href: "/atelier/authority" },
  { label: "Structured Data", href: "/atelier/structured-data" },
  { label: "AI Usage", href: "/atelier/usage" },
];

interface HeaderProps {
  commandBarProps?: {
    onSelectTitle: (title: string) => void;
  };
}

export const Header = ({}: HeaderProps = {}) => {
  const weekLabel = getCurrentWeekLabel();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    const matches = NAV_LINKS.filter(
      (l) => pathname === l.href || pathname.startsWith(l.href + "/"),
    );
    if (matches.length === 0) return false;
    const longest = matches.reduce((a, b) =>
      b.href.length > a.href.length ? b : a,
    );
    return longest.href === href;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_1px_3px_rgba(0,0,0,0.18)]">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
        <Link
          href="/atelier"
          className="text-2xl font-bold tracking-tight text-white hover:opacity-90 shrink-0"
        >
          AI To Market
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={
                isActive(href)
                  ? "rounded-full border border-white/40 bg-white/15 px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white/85"
              }
            >
              {label}
            </Link>
          ))}

          {/* Version switcher */}
          <Link
            href="/atelier-v2"
            className="flex items-center gap-1.5 rounded-full border border-[#F88379]/40 bg-[#F88379]/10 px-3 py-2 text-sm font-semibold text-[#F88379] hover:bg-[#F88379]/20 hover:border-[#F88379]/60 transition-colors"
            title="Switch to V2 – GEO Content Desk"
          >
            <span>GEO Desk</span>
            <span className="rounded text-[9px] font-bold tracking-wider bg-[#F88379] text-[#163D26] px-1.5 py-0.5 leading-none">V2</span>
          </Link>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/30 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
