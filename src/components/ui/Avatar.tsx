interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  src?: string | null;
  className?: string;
}

const SIZES = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-xl",
};

// Generate consistent color from name (hashed)
const COLORS = [
  "bg-gradient-to-br from-bni-blue-500 to-bni-blue-700",
  "bg-gradient-to-br from-navy-500 to-navy-700",
  "bg-gradient-to-br from-bni-green-500 to-emerald-700",
  "bg-gradient-to-br from-bni-amber-500 to-orange-700",
  "bg-gradient-to-br from-purple-500 to-purple-700",
  "bg-gradient-to-br from-cyan-500 to-cyan-700",
  "bg-gradient-to-br from-pink-500 to-pink-700",
  "bg-gradient-to-br from-indigo-500 to-indigo-700",
];

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % COLORS.length;
}

export default function Avatar({ name, size = "md", src, className = "" }: AvatarProps) {
  const initials = getInitials(name);
  const colorClass = COLORS[getColorIndex(name)];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${SIZES[size]} rounded-full object-cover ring-2 ring-white ${className}`}
      />
    );
  }

  return (
    <div
      className={`
        ${SIZES[size]}
        ${colorClass}
        rounded-full flex items-center justify-center
        font-bold text-white shadow-soft
        ring-2 ring-white
        ${className}
      `}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
