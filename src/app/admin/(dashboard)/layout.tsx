import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";
import { getSiteSettings } from "@/lib/site-settings";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/admin/login");
  }

  const settings = await getSiteSettings();

  return (
    <AdminLayoutClient shopName={settings.shop_name}>
      {children}
    </AdminLayoutClient>
  );
}
