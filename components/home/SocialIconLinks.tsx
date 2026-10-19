import { SOCIAL_LINKS } from "@/lib/social-links";

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.4 3.6 12 3.6 12 3.6s-7.4 0-9.38.48A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12C4.6 20.4 12 20.4 12 20.4s7.4 0 9.38-.48A3 3 0 0 0 23.5 17.8 31.9 31.9 0 0 0 24 12a31.9 31.9 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.15" cy="6.85" r="1.15" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.7 3c.4 2.45 1.9 4.2 4.5 4.5v3.1c-1.54 0-2.97-.5-4.3-1.28v6.7A6.42 6.42 0 0 1 8.5 22.5 6.48 6.48 0 0 1 2 16.08 6.48 6.48 0 0 1 8.42 9.5c.4 0 .8.04 1.18.12v3.28a3.22 3.22 0 0 0-1.18-.22 3.18 3.18 0 1 0 3.18 3.18V3h3.1z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.24 3h3.08l-6.74 7.7L22.5 21h-6.2l-4.86-6.35L5.9 21H2.8l7.22-8.25L1.5 3h6.36l4.4 5.82L18.24 3zm-1.08 16.2h1.7L6.92 4.7H5.08l12.08 14.5z"
      />
    </svg>
  );
}

const ICONS = {
  YouTube: YouTubeIcon,
  Instagram: InstagramIcon,
  TikTok: TikTokIcon,
  X: XIcon,
} as const;

export default function SocialIconLinks() {
  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      {SOCIAL_LINKS.map((s) => {
        const Icon = ICONS[s.label];
        return (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-white text-black transition hover:border-[#d32f2f] hover:text-[#d32f2f]"
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
