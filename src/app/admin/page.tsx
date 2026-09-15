import { redirect } from "next/navigation";
import { requireStaffOrAdminPage } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

export default async function AdminIndexPage() {
  const viewer = await requireStaffOrAdminPage();
  redirect(isAdmin(viewer.roleTags) ? "/admin/landlords" : "/admin/waitlist");
}
