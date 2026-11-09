"use client";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Landing is full-bleed; every other page sits in a centered container. */
export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path === "/") return <>{children}</>;
  return <main className="mx-auto max-w-5xl px-4 pb-16 pt-24">{children}</main>;
}
