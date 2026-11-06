import { redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth/session";
import { getAuthenticatedHost } from "@/lib/services/auth.service";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getHostSession();

  if (!session || !session.hostId) {
    redirect("/login");
  }

  let host;
  try {
    host = await getAuthenticatedHost(session.hostId);
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-900">
      <DashboardNav host={host} />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
