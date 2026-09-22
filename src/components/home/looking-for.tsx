import Link from "next/link";
import { LOOKING_FOR } from "@/lib/content/homepage";
import { Icon } from "./icons";

/** "What are you looking for?" tiles under the hero copy (reference: `.looking-icons`). */
export function LookingFor() {
  return (
    <div className="home-looking">
      <h5 className="home-looking__title">{LOOKING_FOR.heading}</h5>
      <ul className="home-looking__list">
        {LOOKING_FOR.items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="home-looking__tile">
              <Icon name={item.icon} size={50} strokeWidth={1.2} />
              <h6>{item.label}</h6>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
