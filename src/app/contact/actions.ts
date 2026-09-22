"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";
import { isPhone } from "@/lib/validation";

export type ContactState = { ok: boolean; error: string | null };

/**
 * Homepage contact form. Writes through the rate-limited SECURITY DEFINER RPC
 * (the only write path into contact_messages) as the anonymous client — no
 * service role needed. Honeypot short-circuits to "ok" so bots learn nothing.
 * The client IP is hashed with a salt for the rate limiter and never stored raw.
 * No email is sent: notifyByEmail() remains a stub by design.
 */
export async function sendContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const honeypot = String(formData.get("company") ?? "");
  if (honeypot) return { ok: true, error: null };

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim().slice(0, 2000);
  if (!name) return { ok: false, error: "Please tell us your name." };
  if (!isPhone(whatsapp)) return { ok: false, error: "Enter a WhatsApp number we can reply to (digits, optional leading +)." };
  if (!message) return { ok: false, error: "Write a short message so we know how to help." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${process.env.CONTACT_RATE_SALT ?? "homely-contact"}:${ip}`).digest("hex");

  const supabase = createPublicClient();
  const { error } = await supabase.rpc("submit_contact_message", { p_name: name, p_whatsapp: whatsapp, p_message: message, p_ip_hash: ipHash });
  if (error) {
    // P0001 = our own rate-limit messages, safe to show verbatim; anything else stays generic.
    if (error.code === "P0001") return { ok: false, error: error.message };
    console.error("[contact] submit failed:", error);
    return { ok: false, error: "Something went wrong on our side. Please try WhatsApp instead." };
  }
  return { ok: true, error: null };
}
