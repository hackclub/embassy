"use client";

import { usePathname } from "next/navigation";

// The admin panel has its own compact sticky header; showing the marketing
// header above it reads as two stacked headers. Hide it on /admin.
export default function SiteHeaderGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}
