import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Apply as a landlord · HomeLy" };

// TODO(session 2+): landlord onboarding form → creates auth user (landlord)
// and a `landlords` row (status 'applied'). KYC via Dojah plugs in after that.
export default function LandlordApplyPage() {
  return (
    <ComingSoon
      title="Landlord application"
      route="/landlord/apply"
      description="Property owners in Enugu will apply here to have HomeLy manage their homes."
    />
  );
}
