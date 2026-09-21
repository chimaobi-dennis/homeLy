"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { LandlordContent, TenantContent } from "./home-sections";
import { FEES } from "@/lib/fees";

export type Persona = "landlord" | "tenant";

const STORAGE_KEY = "homely:persona";

// The remembered persona lives in localStorage (falling back to memory when
// storage is unavailable) and is read through useSyncExternalStore, so the
// server render and the first client render agree (null) and the remembered
// value arrives right after hydration without a setState-in-effect.
let memoryPersona: Persona | null = null;
const listeners = new Set<() => void>();

function readStoredPersona(): Persona | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "landlord" || v === "tenant") return v;
  } catch {
    /* storage unavailable */
  }
  return memoryPersona;
}

function writeStoredPersona(next: Persona) {
  memoryPersona = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable: the choice still works for this visit */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function getServerSnapshot(): Persona | null {
  return null;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The persona choice IS the hero. Both sides are always shown; choosing one
 * narrows the content below. The last choice is remembered (localStorage) so a
 * returning visitor sees their content below without re-selecting — but the
 * split hero is always the entry state on load.
 */
export function HomeExperience() {
  const persona = useSyncExternalStore(subscribe, readStoredPersona, getServerSnapshot);
  const [chosenThisVisit, setChosenThisVisit] = useState(false);
  const remembered = persona !== null && !chosenThisVisit;
  const contentRef = useRef<HTMLDivElement>(null);

  function choose(next: Persona) {
    writeStoredPersona(next);
    setChosenThisVisit(true);
    // Let the new section mount, then bring it into view.
    window.setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }, 20);
  }

  return (
    <>
      <section className="home-hero" aria-label="Choose how you use HomeLy">
        {/* ---------- Landlord side ---------- */}
        <div className="home-hero__side home-hero__landlord">
          <h2 className="display text-[2.1rem] sm:text-[2.6rem] lg:text-[3rem]">
            Own a property in Enugu? Let people you can name manage it.
          </h2>
          <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-relaxed text-[var(--mute)]">
            HomeLy checks your ownership by hand, inspects the property in person, finds and screens the tenant,
            collects the rent and handles repairs — with a fee sheet you read before you fill in a single field.
          </p>
          <p className="mt-4 max-w-[34rem] text-sm text-[var(--ink)]">
            {FEES.agencyPct}% agency and {FEES.legalPct}% legal, once, when a tenant is placed. {FEES.managementPctMin}–
            {FEES.managementPctMax}% of rent a year for management. Nothing before that.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="home-btn home-btn--verify"
              aria-pressed={persona === "landlord"}
              aria-controls="persona-content"
              onClick={() => choose("landlord")}
            >
              I&apos;m a landlord
            </button>
            {persona === "landlord" ? (
              <span className="text-sm text-[var(--mute)]">Showing landlord information below.</span>
            ) : null}
          </div>
        </div>

        {/* ---------- Wordmark ---------- */}
        <div className="home-hero__mark">
          <span className="home-hero__rule" aria-hidden />
          <span className="home-seal" aria-hidden />
          <h1 className="display text-[3.4rem] leading-none sm:text-[4rem]">
            HomeLy
            <span className="sr-only"> — verified rental homes in Enugu</span>
          </h1>
          <p className="text-center text-xs tracking-wide text-[var(--mute)]">Verified homes · Enugu</p>
          <span className="home-hero__rule" aria-hidden />
        </div>

        {/* ---------- Tenant side ---------- */}
        <div className="home-hero__side home-hero__tenant">
          <h2 className="display display-italic text-[2.1rem] sm:text-[2.6rem] lg:text-[3rem]">
            Renting in Enugu? Be first to hear when verified homes open up.
          </h2>
          <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-relaxed text-[var(--mute)]">
            There are no live listings yet. HomeLy is verifying landlords and inspecting homes right now. Join the
            priority list — your place is by time on the list — and we notify you by email or WhatsApp when the
            official queue opens.
          </p>
          <p className="mt-4 max-w-[34rem] text-sm text-[var(--ink)]">No account. No fees. Three fields.</p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="home-btn home-btn--clay"
              aria-pressed={persona === "tenant"}
              aria-controls="persona-content"
              onClick={() => choose("tenant")}
            >
              I&apos;m a tenant
            </button>
            {persona === "tenant" ? (
              <span className="text-sm text-[var(--mute)]">Showing tenant information below.</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------- Below the hero ---------- */}
      <div id="persona-content" ref={contentRef} className="scroll-mt-4">
        <p className="sr-only" aria-live="polite">
          {persona === "landlord"
            ? "Now showing information for landlords."
            : persona === "tenant"
              ? "Now showing information for tenants."
              : "Choose landlord or tenant above to see more."}
        </p>

        {persona === null ? (
          <section className="mx-auto w-full max-w-[76rem] px-6 py-14" aria-label="One rule for both sides">
            <p className="display max-w-[40rem] text-[1.5rem] sm:text-[1.9rem]">
              One rule for both sides: nothing is listed until a person from our Enugu team has checked the landlord&apos;s
              documents and stood inside the property.
            </p>
            <p className="mt-4 max-w-[40rem] text-[var(--mute)]">
              Pick a side above to see what that means for you. HomeLy operates in Enugu only, for now.
            </p>
          </section>
        ) : null}

        {persona === "landlord" ? (
          <div key="landlord" className="home-enter">
            <PersonaSwitchNote remembered={remembered} persona="landlord" onSwitch={() => choose("tenant")} />
            <LandlordContent />
          </div>
        ) : null}

        {persona === "tenant" ? (
          <div key="tenant" className="home-enter">
            <PersonaSwitchNote remembered={remembered} persona="tenant" onSwitch={() => choose("landlord")} />
            <TenantContent />
          </div>
        ) : null}
      </div>
    </>
  );
}

function PersonaSwitchNote({
  remembered,
  persona,
  onSwitch,
}: {
  remembered: boolean;
  persona: Persona;
  onSwitch: () => void;
}) {
  const other = persona === "landlord" ? "tenant" : "landlord";
  return (
    <div className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center justify-between gap-2 px-6 pt-5 text-sm text-[var(--mute)]">
      <span>
        {remembered
          ? `Showing ${persona} information because that is what you chose last time.`
          : `Showing ${persona} information.`}
      </span>
      <button type="button" onClick={onSwitch} className="underline underline-offset-4 hover:text-[var(--ink)]">
        I&apos;m a {other} instead
      </button>
    </div>
  );
}
