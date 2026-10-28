import type { ReactNode } from "react";

/**
 * Lo que se ve cuando una sección todavía no tiene nada: qué es, para qué
 * sirve y un botón para empezar — en vez de una tabla en blanco.
 */
export default function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty-state">
      <b className="empty-title">{title}</b>
      <p>{children}</p>
      {action && (
        <button className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
