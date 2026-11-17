/**
 * Casilla obligatoria al cargar alumnos: el entrenador confirma que es mayor
 * de edad o que va a pedir la autorización firmada de su tutor (part4p).
 */
export default function AgeConfirmCheckbox({ checked, onChange, plural }: { checked: boolean; onChange: (v: boolean) => void; plural?: boolean }) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13.5,
        lineHeight: 1.45,
        background: "var(--bg)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 14,
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 17, height: 17, marginTop: 1, flex: "none" }} />
      <span>
        {plural
          ? "Confirmo que estos alumnos son mayores de 18 años o, si alguno es menor, que voy a conseguir la autorización firmada de su madre, padre o tutor antes de cargarle datos."
          : "Confirmo que este alumno es mayor de 18 años o, si es menor, que voy a conseguir la autorización firmada de su madre, padre o tutor antes de cargarle datos."}
      </span>
    </label>
  );
}
