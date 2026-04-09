import type { NavIcon } from "./nav-config";

const common = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function SidebarNavIcon({ name }: { name: NavIcon }) {
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 4 2 5-6" />
        </svg>
      );
    case "news":
      return (
        <svg {...common}>
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 9h-6" />
          <path d="M15 13h-3" />
          <path d="M15 17h-3" />
        </svg>
      );
    case "flask":
      return (
        <svg {...common}>
          <path d="M9 3h6" />
          <path d="M10 9v8l-4 5h12l-4-5V9" />
          <path d="M7.5 18h9" />
        </svg>
      );
    case "premium":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.25" />
          <rect x="14" y="3" width="7" height="5" rx="1.25" />
          <rect x="14" y="11" width="7" height="10" rx="1.25" />
          <rect x="3" y="15" width="7" height="6" rx="1.25" />
        </svg>
      );
    case "portfolio":
      return (
        <svg {...common}>
          <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
          <rect x="4" y="7" width="16" height="14" rx="2" />
          <path d="M4 11h16" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
