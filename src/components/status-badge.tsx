import { TONE_CLASSES, type Tone } from "@/lib/status-labels";

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
