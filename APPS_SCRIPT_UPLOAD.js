// =====================================================================
// AGREGA ESTA FUNCIÓN Y MODIFICA tu doPost() en Google Apps Script
// =====================================================================
//
// INSTRUCCIONES:
// 1. Abre tu Google Apps Script (script.google.com)
// 2. Copia el bloque "UPLOAD_FILE" y añádelo al INICIO de tu doPost()
// 3. Copia la función saveFileToDrive() al final del archivo
// 4. Haz clic en "Implementar" → "Administrar implementaciones" → "Editar" → "Nueva versión"
//
// =====================================================================

// -----------------------------------------------
// PASO 1: AÑADE ESTO AL INICIO de tu doPost(e)
// (dentro del try, antes de tu lógica actual)
// -----------------------------------------------

/*
  var params = JSON.parse(e.postData.contents);
  
  if (params.action === "UPLOAD_FILE") {
    return saveFileToDrive(params.fileData, params.fileName, params.mimeType);
  }
*/

// -----------------------------------------------
// PASO 2: AGREGA ESTA FUNCIÓN al final del archivo
// -----------------------------------------------

function saveFileToDrive(base64Data, fileName, mimeType) {
  try {
    // Decodifica el archivo base64
    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);

    // Guarda en una carpeta llamada "ValleGrande Documentos"
    // (se crea automáticamente si no existe)
    var folders = DriveApp.getFoldersByName("ValleGrande Documentos");
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("ValleGrande Documentos");
    }

    // Crea el archivo en Drive
    var file = folder.createFile(blob);
    
    // Hace el archivo público (cualquiera con el link puede verlo)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Devuelve el link de visualización directo
    var fileId = file.getId();
    var url = "https://drive.google.com/file/d/" + fileId + "/view?usp=sharing";

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, url: url }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================================================
// ASÍ DEBERÍA QUEDAR TU doPost() COMPLETA (ejemplo de estructura):
// =====================================================================

/*
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);

    // ---- NUEVO: Manejo de subida de archivos ----
    if (params.action === "UPLOAD_FILE") {
      return saveFileToDrive(params.fileData, params.fileName, params.mimeType);
    }

    // ---- TU CÓDIGO EXISTENTE SIGUE AQUÍ ----
    // (todo lo relacionado con CREATE, UPDATE_DOCS, etc.)
    
    ...tu código actual...

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
*/
