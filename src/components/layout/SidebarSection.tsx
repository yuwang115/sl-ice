/**
 * Collapsible sidebar section with icon and rotating chevron.
 */

import { useState, type ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function SidebarSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 py-2 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        aria-expanded={open}
      >
        <span className="flex-shrink-0 opacity-60" style={{ width: 16, height: 16 }}>
          {icon}
        </span>
        <span className="font-data text-[10px] font-medium uppercase tracking-[0.2em] flex-1 text-left">
          {title}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 transition-transform"
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transitionDuration: '200ms',
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pt-1 pb-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
