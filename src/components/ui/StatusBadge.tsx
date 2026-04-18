const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-bni-green/10 text-bni-green",
  INACTIVE: "bg-gray-100 text-gray-500",
  ARCHIVED: "bg-bni-red/10 text-bni-red",
  QUEUED: "bg-bni-blue/10 text-bni-blue",
  SENT: "bg-bni-blue/10 text-bni-blue",
  COMPLETED: "bg-bni-green/10 text-bni-green",
  EXPIRED: "bg-bni-amber/10 text-bni-amber",
  EXCLUDED: "bg-gray-100 text-gray-500",
};

interface Props {
  status:
    | "ACTIVE"
    | "INACTIVE"
    | "ARCHIVED"
    | "QUEUED"
    | "SENT"
    | "COMPLETED"
    | "EXPIRED"
    | "EXCLUDED";
}

export default function StatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {status}
    </span>
  );
}
