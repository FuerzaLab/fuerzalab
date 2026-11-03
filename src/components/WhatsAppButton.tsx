import { whatsappLink } from "../lib/whatsapp";

/** Botón que abre WhatsApp con un mensaje ya escrito. */
export default function WhatsAppButton({
  phone,
  text,
  label = "WhatsApp",
  small,
  primary,
}: {
  phone?: string | null;
  text: string;
  label?: string;
  small?: boolean;
  primary?: boolean;
}) {
  return (
    <a
      className={`btn ${primary ? "" : "ghost"} wa-btn`}
      href={whatsappLink(phone, text)}
      target="_blank"
      rel="noreferrer"
      style={small ? { padding: "4px 10px", fontSize: 12.5 } : undefined}
      title={phone ? "Abre WhatsApp con el mensaje listo para enviar" : "Abre WhatsApp: elige el contacto y envía"}
    >
      <svg width={small ? 13 : 15} height={small ? 13 : 15} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/>
      </svg>
      {label}
    </a>
  );
}
