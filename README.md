# Valle Grande FC

Aplicación para inscripciones y expedientes de jugadores de la Liga Comunal Lampa.

## Funciones

- Inscripción pública en `/registro`: datos, documentos, recorte de foto desde la cédula y firma dibujada en pantalla.
- Autorización del jugador y, para menores, datos, documentos y firma del apoderado.
- Dashboard: faltantes por jugador, edición de ficha, tipo de trámite y estado manual Pendiente / Por federar / Federado.
- PDF con ficha, foto, firma, autorización, ambas caras de la cédula y certificado de antecedentes completo.
- Importación y exportación CSV existentes.

## Desarrollo

Requiere Node.js 20.9 o superior y las dependencias instaladas con `npm ci`.

Configura `.env.local` con `GOOGLE_SCRIPT_URL` apuntando a tu implementación de Apps Script. `NEXT_PUBLIC_GOOGLE_SCRIPT_URL` sigue aceptándose para compatibilidad. No se deben incluir credenciales en el repositorio.

```sh
npm run dev
npm test
npm run lint
npm run build
```

Si Turbopack falla al resolver Tailwind en Windows, usa `npm run dev -- --webpack` para la vista previa. La compilación de producción usa Turbopack. La fuente Inter se descarga durante la compilación y requiere acceso de red.

## Conexión con Google

El reemplazo completo del backend está en [google-apps-script/Code.gs](google-apps-script/Code.gs). Sigue [las instrucciones de actualización](google-apps-script/README.md). El script añade columnas a la hoja `Jugadores` sin borrar los registros existentes.

La nueva interfaz comprueba la versión del backend antes de permitir cargas, para evitar que una implementación antigua descarte firmas o fotos silenciosamente. El script debe actualizarse junto con el despliegue de Vercel.

## Pruebas sin datos reales

En una terminal ejecuta `node --import tsx tests/demo-server.ts`. En otra terminal, configura `GOOGLE_SCRIPT_URL=http://127.0.0.1:9876/exec` solo para ese proceso y ejecuta `npm run dev -- --webpack --hostname 127.0.0.1 --port 3001`.

La vista previa tendrá registros ficticios en memoria; no escribe en Sheets ni en Drive. El servidor de demostración solo escucha en localhost y no se permite en producción.

Las pruebas ejercitan el mismo `Code.gs` con un simulador de Sheets/Drive, verifican el API y generan PDFs de adultos/menores, incluidos anexos multipágina. El flujo real requiere comprobar permisos y actualización de la implementación en Google.

## Límites actuales

El proyecto mantiene el modelo de acceso administrativo anterior, sin inicio de sesión. El token opcional entre Next.js y Apps Script no autentica a los usuarios del dashboard. Implementar acceso de dirigentes es una tarea pendiente antes de restringir el acceso a información personal.

La firma del club y el espacio de la liga permanecen en blanco para su gestión posterior. Los documentos históricos con enlaces públicos conservan sus permisos; los nuevos archivos no se publican individualmente mediante Drive.
