import Link from "next/link";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteNav } from "@/components/home/site-nav";
import "../../home.css";

export default function HomeNotFound() {
  return (
    <div className="home flex flex-1 flex-col">
      <SiteNav variant="solid" />
      <main className="wrap home-single__top">
        <div className="home-single__card home-zero">
          <h3>This home is no longer listed.</h3>
          <p className="font-roboto">It may have been let, or the link is out of date.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/search" className="btn btn--gradient btn--pill">
              See available homes
            </Link>
            <Link href="/waitlist" className="btn btn--dashed">
              Join the priority list
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
