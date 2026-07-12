"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Send, ShieldCheck, UserRound } from "lucide-react";
import { WalletLogin } from "./WalletLogin";

const navItems = [
  { href: "/account", label: "Account", icon: UserRound },
  { href: "/deposit", label: "Deposit", icon: Banknote },
  { href: "/withdraw", label: "Withdraw", icon: Send }
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/account">
          <ShieldCheck size={22} />
          <span>PactPay Aleo</span>
        </Link>
        <nav className="mainNav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link className={active ? "active" : ""} href={item.href} key={item.href}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <WalletLogin />

      {children}
    </main>
  );
}
