# Activar el acceso privado

El dashboard y las API de consulta, documentos, PDF, edición y estados requieren una sesión. `/registro`, la comprobación de conexión y el envío de una inscripción completa siguen públicos. El cliente nunca decide si es administrador ni puede enviar una inscripción pública incompleta usando `complete: false`.

## Configuración inicial

1. Ejecutar `node scripts/prepare-admin-access.mjs` una sola vez. Genera `.env.admin-setup.local`, excluido de Git. Abrir ese archivo local y guardar sus valores en un gestor de contraseñas; no subirlo al repositorio ni enviarlo por chat.
2. En Vercel, proyecto **vallegrande-dashboard → Settings → Environment Variables**, añadir `ADMIN_PASSWORD` y `GOOGLE_SCRIPT_TOKEN` con los valores del archivo para **Production** (y Preview si se usará). La primera es la clave que usarán los dirigentes.
3. Publicar esta versión desde GitHub. Las variables se aplican al nuevo despliegue. Sin `ADMIN_PASSWORD` válida (mínimo 16 caracteres), el acceso queda cerrado, nunca abierto por defecto.
4. En el proyecto de Apps Script vinculado a `Jugadores`, abrir **Configuración del proyecto → Propiedades del script**. Añadir `API_TOKEN` con exactamente el valor de `GOOGLE_SCRIPT_TOKEN`. El script actual ya soporta esta propiedad; no requiere copiar código ni crear otra implementación.
5. Verificar que el enlace directo de Apps Script rechaza consultas sin token; que `/` pide clave; que las API privadas devuelven 401 sin sesión; y que `/registro` sigue disponible. No considerar la protección completa hasta cerrar también Apps Script.

Para desarrollo local, copiar `ADMIN_PASSWORD` a `.env.local`. Solo añadir `GOOGLE_SCRIPT_TOKEN` si el servidor de Apps Script usado tiene el mismo token. El simulador local de pruebas no necesita ese token.

## Uso y mantenimiento

- Sesión de 8 horas; cookie HttpOnly, SameSite=Strict y Secure en producción. Botón **Cerrar sesión** en el dashboard.
- Cambiar `ADMIN_PASSWORD` en Vercel y volver a desplegar invalida las sesiones anteriores. Usar una clave aleatoria larga y compartirla únicamente con dirigentes autorizados.
- Los POST requieren el mismo origen. Diez intentos de clave por 15 minutos activan un límite por instancia. Para un límite global, configurar una regla de Vercel Firewall sobre `/api/auth/login`; el contador local no sustituye esa regla.
- Las respuestas públicas de inscripción no devuelven fichas ni documentos, incluidos reintentos.
- Las cargas siguen públicas porque las necesitan los jugadores. La protección no revoca enlaces de Drive históricos que ya se compartieron públicamente; revisar esos permisos por separado cuando corresponda.
