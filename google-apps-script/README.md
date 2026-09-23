# Activar las fichas de inscripción

El archivo `Code.gs` reemplaza el código completo compartido por el propietario. No se debe pegar al final del script anterior: quedarían funciones `doGet` y `doPost` duplicadas.

## Actualización de Google

1. Abre la planilla actual y elige **Extensiones → Apps Script**.
2. Guarda una copia del código anterior y de la planilla antes de actualizar.
3. Sustituye el contenido de `Código.gs` o `Code.gs` por este `Code.gs`.
4. Guarda. El script sigue usando la pestaña **Jugadores** y la carpeta **Documentos_ValleGrande**.
5. Selecciona **Implementar → Administrar implementaciones → Editar (lápiz) → Nueva versión → Implementar**. Conserva la URL `/exec` existente. Los permisos necesarios siguen siendo los de Sheets y Drive.
6. Comprueba `<URL_ACTUAL>/exec?capabilities=1`. Debe responder con `registrationVersion: 1`.
7. Publica la nueva versión de la aplicación en Vercel y revisa el registro con datos de prueba acordados antes de recibir inscripciones reales.

Las columnas nuevas se añaden al extremo derecho en la primera escritura. No se eliminan filas ni se reordenan las columnas actuales. Se actualizan únicamente los campos enviados; las columnas personalizadas y fórmulas ajenas se conservan. Si existen encabezados o RUT duplicados, el script devuelve un error para evitar actualizar a la persona equivocada.

## Variables de Vercel

- `GOOGLE_SCRIPT_URL`: URL de la implementación actual terminada en `/exec`. Como compatibilidad, se sigue leyendo `NEXT_PUBLIC_GOOGLE_SCRIPT_URL` si la nueva variable no existe.
- `GOOGLE_SCRIPT_TOKEN`: opcional, debe coincidir con la propiedad `API_TOKEN` configurada en Apps Script. Si se activa, debe hacerse junto con el cambio en Vercel; las peticiones directas a `doGet` sin token dejarán de listar jugadores. El chequeo de capacidades continúa público.

El token entre servidores no reemplaza la autenticación del dashboard. El proyecto conserva el acceso administrativo existente: sigue pendiente implementar inicio de sesión y roles antes de restringirlo a dirigentes. Los archivos nuevos no se hacen públicos individualmente mediante Drive, pero los endpoints del dashboard mantienen el modelo de acceso actual. No se modifican los permisos de documentos ya guardados.

## Comportamiento

- Nuevos datos: foto recortada, firma, fecha y texto de autorización, tipo de inscripción y datos/firma del apoderado.
- **Pendiente**: ficha incompleta. **Por federar**: requisitos completos. **Federado**: cambio manual del administrador; también puede revertirse.
- Generar el PDF nunca cambia el estado. Una persona federada puede tener una ficha digital incompleta; son conceptos separados y se muestran así.
- Los jugadores existentes no reciben firmas inventadas ni se marcan completos automáticamente. Sus documentos se pueden reutilizar para recortar la foto; las firmas las deben realizar sus titulares.
- La firma del club y el espacio de la liga quedan en blanco para su gestión posterior. No se reutilizan firmas del PDF de referencia.
- Se conservan todas las páginas del certificado de antecedentes (hasta 20). Un PDF ilegible o protegido produce un error, no un expediente parcial.
- Las cargas se limitan a 2,5 MB por documento preparado; las fotos se comprimen antes de subirlas. El expediente descargable tiene un máximo de 4 MB para respetar los límites de respuesta del alojamiento. Si se excede, la interfaz pide reducir los documentos en lugar de entregar un PDF incompleto.
- El texto de autorización es el del modelo facilitado; la autorización del apoderado debe ser revisada por el club para su uso con la liga.
- Una inscripción fallida conserva en la sesión los documentos subidos para reintentar sin repetir las cargas. Si se abandona el formulario después de subir archivos puede quedar un archivo sin asociar en Drive; no se eliminan automáticamente documentos.

## Compatibilidad y pruebas

`CREATE`, `UPDATE_DOCS` y `BULK_CREATE` se mantienen para compatibilidad. Las nuevas operaciones son `CREATE_REGISTRATION`, `UPDATE_REGISTRATION`, `UPDATE_STATUS`, `GET_FILE` y `LIST_PLAYERS`. `GET_FILE` solo lee campos de documentos asociados al RUT existente; no acepta URLs arbitrarias ni IDs de Drive del navegador.

`npm test` prueba el flujo mediante un simulador de Sheets/Drive que ejecuta este mismo `Code.gs`. No sustituye comprobar los permisos y la implementación real en la cuenta Google.
