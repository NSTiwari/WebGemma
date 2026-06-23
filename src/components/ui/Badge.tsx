interface BadgeProps {
  label: string;
  color?: "blue" | "teal" | "amber" | "pink" | "indigo" | "green";
}

const colorMap: Record<string, string> = {
  blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  teal: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  pink: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  green: "bg-green-500/20 text-green-300 border-green-500/30",
};

export function Badge({ label, color = "blue" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorMap[color]}`}
    >
      {label}
    </span>
  );
}
