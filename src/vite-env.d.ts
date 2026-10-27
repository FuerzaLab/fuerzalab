/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Cuenta del entrenador demo (opcional). Si están las dos, el inicio de sesión muestra "Probar la demo". */
  readonly VITE_DEMO_EMAIL?: string;
  readonly VITE_DEMO_PASSWORD?: string;
  /** Contacto en la página de presentación (opcionales). WhatsApp: código de país + número, sin "+". */
  readonly VITE_CONTACT_WHATSAPP?: string;
  readonly VITE_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
