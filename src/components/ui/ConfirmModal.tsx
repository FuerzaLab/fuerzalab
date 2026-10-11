import Modal from "./Modal";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ marginBottom: 18 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          style={danger ? { background: "var(--bad)", borderColor: "var(--bad)" } : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
