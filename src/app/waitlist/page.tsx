import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Tenant waitlist · HomeLy" };

// TODO(session 2+): anonymous waitlist form → INSERT name / whatsapp_number /
// email into `waitlist_entries`. No login, no tenant auth account — deliberate.
// Confirmation via Resend (email) and Termii (WhatsApp/SMS) plug in later.
export default function WaitlistPage() {
  return (
    <ComingSoon
      title="Tenant waitlist"
      route="/waitlist"
      description="Renters looking for a home in Enugu will join the waitlist here — no account needed."
    />
  );
}
