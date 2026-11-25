// Yengil inline SVG ikonkalar (tashqi kutubxonasiz)
type P = { size?: number };
const S = ({ children, size }: { children: React.ReactNode } & P) => (
  <svg
    width={size || 24}
    height={size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const I = {
  today: (p: P) => (
    <S {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </S>
  ),
  tasks: (p: P) => (
    <S {...p}>
      <rect x="3" y="4" width="18" height="17" rx="4" />
      <path d="m8 12 3 3 5-6" />
    </S>
  ),
  habit: (p: P) => (
    <S {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </S>
  ),
  money: (p: P) => (
    <S {...p}>
      <rect x="2" y="6" width="20" height="13" rx="3" />
      <path d="M2 10h20M6 15h4" />
    </S>
  ),
  notes: (p: P) => (
    <S {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </S>
  ),
  books: (p: P) => (
    <S {...p}>
      <path d="M4 18V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14v-4" />
      <path d="M9 7h7" />
    </S>
  ),
  mosque: (p: P) => (
    <S {...p}>
      <path d="M12 3c-3 2.5-5 4.3-5 7h10c0-2.7-2-4.5-5-7z" />
      <path d="M5 21V12h14v9M3 21h18M10 21v-4a2 2 0 0 1 4 0v4" />
      <path d="M12 3V1.5" />
    </S>
  ),
  ru: (p: P) => (
    <S {...p}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
        Я
      </text>
    </S>
  ),
  gear: (p: P) => (
    <S {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </S>
  ),
  plus: (p: P) => (
    <S {...p}>
      <path d="M12 5v14M5 12h14" />
    </S>
  ),
  check: (p: P) => (
    <S {...p}>
      <path d="m5 12 5 5 9-10" />
    </S>
  ),
  dots: (p: P) => (
    <S {...p}>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </S>
  ),
  left: (p: P) => (
    <S {...p}>
      <path d="m15 6-6 6 6 6" />
    </S>
  ),
  right: (p: P) => (
    <S {...p}>
      <path d="m9 6 6 6-6 6" />
    </S>
  ),
  up: (p: P) => (
    <S {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </S>
  ),
  down: (p: P) => (
    <S {...p}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </S>
  ),
  edit: (p: P) => (
    <S {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </S>
  ),
  trash: (p: P) => (
    <S {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </S>
  ),
  pin: (p: P) => (
    <S {...p}>
      <path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z" />
    </S>
  ),
  logout: (p: P) => (
    <S {...p}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
    </S>
  ),
  archive: (p: P) => (
    <S {...p}>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
    </S>
  ),
};
