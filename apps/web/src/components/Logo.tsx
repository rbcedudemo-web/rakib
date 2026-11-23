import Link from "next/link";

export function Logo({ name, org }: { name: string; org: string }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={name}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <rect width="36" height="36" rx="10" fill="#006a4e" />
        <circle cx="18" cy="14" r="6.5" fill="#c8202b" />
        {/* open book */}
        <path d="M7 24.5c3.6-1.6 7.3-1.6 11 0 3.7-1.6 7.4-1.6 11 0V29c-3.6-1.4-7.3-1.4-11 0-3.7-1.4-7.4-1.4-11 0z" fill="#fff" />
        <path d="M18 24.5V29" stroke="#006a4e" strokeWidth="1.2" />
      </svg>
      <span className="hidden leading-tight sm:block">
        <span className="block text-sm font-bold text-primary-700">{org}</span>
        <span className="block text-xs text-neutral-500">{name}</span>
      </span>
    </Link>
  );
}
