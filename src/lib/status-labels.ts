import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type LandlordStatus = Enums["landlord_status"];
export type PropertyStatus = Enums["property_status"];
export type AgreementStatus = Enums["landlord_agreement_status"];
export type DocumentType = Enums["landlord_document_type"];

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export type StatusLabel = {
  label: string;
  /** Plain-language sentence telling the landlord what is happening and what (if anything) they must do. */
  description: string;
  tone: Tone;
};

/** Landlord (KYC) status as the landlord should read it. Never silent. */
export const LANDLORD_STATUS: Record<LandlordStatus, StatusLabel> = {
  applied: {
    label: "Application received",
    description:
      "We have your application. Upload your ID and proof of ownership so our team can start the review.",
    tone: "info",
  },
  kyc_pending: {
    label: "Under review",
    description:
      "Our Enugu team is checking your documents by hand. This usually takes 1–3 working days. We will email you when it is done.",
    tone: "warning",
  },
  kyc_verified: {
    label: "Verified",
    description:
      "Your identity and ownership are confirmed. Next: sign the management agreement, then we schedule the inspection.",
    tone: "success",
  },
  kyc_rejected: {
    label: "Not approved",
    description:
      "We could not approve your application with the documents provided. See the reason below, upload corrected documents, and resubmit.",
    tone: "danger",
  },
};

export const PROPERTY_STATUS: Record<PropertyStatus, StatusLabel> = {
  submitted: {
    label: "Received",
    description:
      "We have the property details. Inspection is scheduled once your account is verified and the agreement is signed.",
    tone: "info",
  },
  under_inspection: {
    label: "Under inspection",
    description:
      "Our inspector is visiting or has visited. You will receive the report and our rent recommendation shortly.",
    tone: "warning",
  },
  listed: {
    label: "Listed",
    description: "This property is live. We are marketing it and screening tenants.",
    tone: "success",
  },
  rejected: {
    label: "Not approved",
    description:
      "We cannot list this property as submitted. See the reason below; you can correct the details and resubmit.",
    tone: "danger",
  },
};

export const AGREEMENT_STATUS: Record<AgreementStatus, StatusLabel> = {
  not_sent: {
    label: "Not sent yet",
    description: "We send the management agreement for e-signature once your account is verified.",
    tone: "neutral",
  },
  pending_signature: {
    label: "Awaiting your signature",
    description:
      "The management agreement has been sent to you for e-signature. Inspection is booked once it is signed.",
    tone: "warning",
  },
  signed: {
    label: "Signed",
    description: "The management agreement is signed. We will schedule the inspection.",
    tone: "success",
  },
};

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  id_document: "Government-issued ID",
  proof_of_ownership: "Proof of ownership",
};

export const DOCUMENT_TYPE_HELP: Record<DocumentType, string> = {
  id_document: "NIN slip, international passport, driver's licence or voter's card. Photo or PDF, up to 10 MB.",
  proof_of_ownership:
    "Certificate of Occupancy, deed of assignment, survey plan, or a receipt of purchase. Photo or PDF, up to 10 MB.",
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};
