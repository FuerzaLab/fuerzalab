import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: { port: 5173 },
    build: {
        rollupOptions: {
            output: {
                // Librerías grandes en archivos aparte: el navegador las guarda y no
                // las vuelve a bajar en cada publicación (solo cambia el código de la app).
                // Las pantallas ya se dividen solas (lazy en src/routes/index.tsx).
                // (Se usa indexOf y no includes: el chequeo de tipos de este archivo,
                // tsconfig.node.json, usa una versión de JavaScript que no trae includes.)
                manualChunks: function (id) {
                    var has = function (s) { return id.indexOf(s) !== -1; };
                    if (!has("node_modules"))
                        return;
                    if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
                        return "react";
                    if (has("@supabase"))
                        return "supabase";
                    if (has("recharts") || has("d3-") || has("victory"))
                        return "charts";
                },
            },
        },
    },
});
