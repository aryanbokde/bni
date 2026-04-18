"use client";

import { ReactNode, useState } from "react";

interface TooltipProps {
  children: ReactNode;
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}

const SIDES = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
};

const ARROWS = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-navy-800",
  right: "right-full top-1/2 -translate-y-1/2 border-r-navy-800",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-navy-800",
  left: "left-full top-1/2 -translate-y-1/2 border-l-navy-800",
};

export default function Tooltip({
  children,
  content,
  side = "right",
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  function show() {
    const t = setTimeout(() => setVisible(true), delay);
    setTimer(t);
  }

  function hide() {
    if (timer) clearTimeout(timer);
    setVisible(false);
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`
            absolute z-50 whitespace-nowrap
            bg-navy-800 text-white text-xs font-medium
            px-2.5 py-1.5 rounded-md shadow-strong
            pointer-events-none
            animate-fade-in
            ${SIDES[side]}
          `}
        >
          {content}
          <span
            className={`
              absolute w-0 h-0 border-4 border-transparent
              ${ARROWS[side]}
            `}
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}
