import type { ReactNode } from "react";

export default function Chip({
  tone = "",
  children,
}: {
  tone?: "" | "ok" | "warn" | "bad" | "pri";
  children: ReactNode;
}) {
  return <span className={`chip ${tone}`}>{children}</span>;
}
