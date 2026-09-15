import Link from "next/link";

type ComingSoonProps = {
  title: string;
  route: string;
  description: string;
};

/** Placeholder used by route stubs until the real forms are built. */
export function ComingSoon({ title, route, description }: ComingSoonProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        HomeLy
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">{description}</p>
      <p className="rounded-full border border-zinc-200 px-4 py-1 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Coming soon · route <code className="font-mono">{route}</code> resolves
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to home
      </Link>
    </main>
  );
}
