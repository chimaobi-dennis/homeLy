import { SiteHeader } from "@/components/site-header";

export default function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
