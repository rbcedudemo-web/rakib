import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { AdminNav } from "./AdminNav";

export const metadata = { robots: { index: false } };

/** Every admin page: admin only, with the admin menu on the left (top on phones). */
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  await requireRole("admin");
  return (
    <div className="page flex flex-col gap-6 py-6 lg:flex-row lg:gap-8">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
