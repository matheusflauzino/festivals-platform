import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function createIcon(children: ReactNode) {
  return function IconComponent({ className = 'h-5 w-5', ...props }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const MenuIcon = createIcon(
  <>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </>,
);
export const CloseIcon = createIcon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>,
);
export const ChevronDownIcon = createIcon(<polyline points="6 9 12 15 18 9" />);
export const ChevronLeftIcon = createIcon(<polyline points="15 18 9 12 15 6" />);
export const ChevronRightIcon = createIcon(<polyline points="9 18 15 12 9 6" />);
export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>,
);
export const MoonIcon = createIcon(<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />);
export const SunIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </>,
);
export const BellIcon = createIcon(
  <>
    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9z" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </>,
);
export const PlusIcon = createIcon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);
export const PencilIcon = createIcon(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </>,
);
export const LogOutIcon = createIcon(
  <>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>,
);
export const GridIcon = createIcon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);
export const CalendarIcon = createIcon(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" />
    <line x1="16" y1="2.5" x2="16" y2="6.5" />
  </>,
);
export const AwardIcon = createIcon(
  <>
    <circle cx="12" cy="8" r="5" />
    <polyline points="8.5 12.5 7 21 12 18 17 21 15.5 12.5" />
  </>,
);
export const StarIcon = createIcon(
  <polygon points="12 2.5 15 9.5 22 10.2 16.8 15 18.2 22 12 18.3 5.8 22 7.2 15 2 10.2 9 9.5" />,
);
export const MusicIcon = createIcon(
  <>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </>,
);
export const ClipboardIcon = createIcon(
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <rect x="8.5" y="2" width="7" height="4" rx="1" />
  </>,
);
export const TrendingUpIcon = createIcon(
  <>
    <polyline points="3 17 9 11 13 15 21 6" />
    <polyline points="15 6 21 6 21 12" />
  </>,
);
export const FileTextIcon = createIcon(
  <>
    <path d="M6 3h9l4 4v14H6z" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </>,
);
export const MailIcon = createIcon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3 7 12 13 21 7" />
  </>,
);
export const UsersIcon = createIcon(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0111 0" />
    <circle cx="17.5" cy="9.5" r="2.6" />
    <path d="M15.7 13.2a4.5 4.5 0 015.3 4.4" />
  </>,
);
export const DatabaseIcon = createIcon(
  <>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5V18c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.5" />
    <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </>,
);
