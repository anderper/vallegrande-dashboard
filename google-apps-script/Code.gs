/** Valle Grande FC - reemplazo completo del script vinculado a la hoja Jugadores.
 * Añade columnas por encabezado; conserva filas, columnas y fórmulas existentes.
 * Opcional: configurar API_TOKEN en Propiedades del script y GOOGLE_SCRIPT_TOKEN en Vercel.
 */
var VG_COLUMNS = ['ID_Jugador','RUT','Nombres','Apellido_Paterno','Apellido_Materno','Fecha_Nacimiento','Edad','Nacionalidad','Serie','WhatsApp','Direccion','Posicion','Foto_Cedula_Frontal','Foto_Cedula_Reverso','Antecedentes_PDF','Status_Validacion','Fecha_Validacion','Validado_Por','Observaciones','Fecha_Registro','Ultima_Modificacion','Modificado_Por','Tipo_Inscripcion','Fecha_Inscripcion','Foto_Jugador','Firma_Jugador','Fecha_Firma','Autorizacion_Texto','Autorizacion_Version','Nombre_Apoderado','RUT_Apoderado','Foto_Cedula_Padre_Frontal','Foto_Cedula_Padre_Reverso','Firma_Apoderado','Fecha_Firma_Apoderado','Autorizacion_Apoderado_Texto','ID_Envio'];
var VG_DOCUMENTS = ['Foto_Cedula_Frontal','Foto_Cedula_Reverso','Antecedentes_PDF','Foto_Jugador','Firma_Jugador','Foto_Cedula_Padre_Frontal','Foto_Cedula_Padre_Reverso','Firma_Apoderado'];
var VG_READONLY = ['ID_Jugador','Edad','Fecha_Registro','Ultima_Modificacion','Modificado_Por','Fecha_Validacion','Validado_Por','ID_Envio'];

function vgJson(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function vgError(error) { return vgJson({ success: false, error: error.message || String(error) }); }
function vgAuthorize(params) {
  var secret = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (secret && params.token !== secret) throw new Error('Acceso al servidor no autorizado.');
}
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.capabilities === '1') return vgJson({ success: true, registrationVersion: 1 });
    vgAuthorize({});
    return vgJson(vgRead().players);
  } catch (error) { return vgError(error); }
}
function doPost(e) {
  var lock;
  try {
    var params = JSON.parse(e.postData.contents);
    vgAuthorize(params);
    if (params.action === 'LIST_PLAYERS') return vgJson(vgRead().players);
    if (params.action === 'GET_FILE') return vgJson(vgGetFile(params));
    if (params.action === 'UPLOAD_FILE') return vgJson(vgUpload(params));
    lock = LockService.getScriptLock(); lock.waitLock(30000);
    var table = vgRead(true);
    if (params.action === 'CREATE_REGISTRATION' || params.action === 'CREATE') return vgJson(vgCreate(table, params.player || params, params.requestId));
    if (params.action === 'UPDATE_REGISTRATION') return vgJson(vgUpdate(table, params));
    if (params.action === 'UPDATE_STATUS') return vgJson(vgStatus(table, params.RUT, params.status));
    if (params.action === 'UPDATE_DOCS') {
      var original = vgFind(table, params.RUT);
      var patch = {};
      VG_DOCUMENTS.forEach(function(key) { if (params[key]) patch[key] = params[key]; });
      if (params.newStatus) patch.Status_Validacion = vgValidateStatus(params.newStatus);
      vgWrite(table, original.index, patch);
      return vgJson({ success: true, player: vgFind(vgRead(), params.RUT).player });
    }
    if (params.action === 'BULK_CREATE') {
      if (!Array.isArray(params.players) || !params.players.length || params.players.length > 500) throw new Error('Importa entre 1 y 500 jugadores.');
      var seen = {}; table.players.forEach(function(p) { seen[vgRut(p.RUT)] = true; });
      var pending = [], skipped = 0;
      params.players.forEach(function(p) {
        var clean = vgClean(p); if (!clean.RUT || !clean.Nombres) throw new Error('Cada fila debe tener RUT y Nombres.');
        var key = vgRut(clean.RUT); if (seen[key]) { skipped++; return; }
        seen[key] = true; clean.Status_Validacion = 'PENDIENTE'; pending.push(clean);
      });
      pending.forEach(function(p) { vgCreate(table, p); });
      return vgJson({ success: true, created: pending.length, skipped: skipped });
    }
    throw new Error('Acción no reconocida.');
  } catch (error) { return vgError(error); }
  finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
function vgRead(ensureColumns) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('El script debe estar vinculado a la planilla de jugadores.');
  var sheet = spreadsheet.getSheetByName('Jugadores');
  if (!sheet) throw new Error('No existe la pestaña Jugadores.');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(value) { return String(value).trim(); });
  if (headers.indexOf('RUT') < 0) throw new Error('Falta el encabezado RUT en la primera fila.');
  var nonempty = headers.filter(Boolean);
  if (nonempty.some(function(h, i) { return nonempty.indexOf(h) !== i; })) throw new Error('La planilla tiene encabezados duplicados.');
  if (ensureColumns) {
    var missing = VG_COLUMNS.filter(function(key) { return headers.indexOf(key) < 0; });
    if (missing.length) {
      var needed = headers.length + missing.length - sheet.getMaxColumns();
      if (needed > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed);
      sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
      headers = headers.concat(missing);
    }
  }
  var players = [], indexes = [];
  for (var i = 1; i < rows.length; i++) {
    var player = {};
    headers.forEach(function(key, index) {
      if (!key) return;
      var value = rows[i][index];
      if (value instanceof Date) value = key === 'Fecha_Nacimiento' || key === 'Fecha_Inscripcion' ? Utilities.formatDate(value, spreadsheet.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : value.toISOString();
      player[key] = value == null ? '' : String(value);
    });
    if (player.RUT) { players.push(player); indexes.push(i + 1); }
  }
  return { sheet: sheet, headers: headers, players: players, indexes: indexes };
}
function vgRut(value) { return String(value || '').replace(/[.\s-]/g, '').toUpperCase(); }
function vgFind(table, rut) {
  var indexes = [];
  table.players.forEach(function(p, i) { if (vgRut(p.RUT) === vgRut(rut)) indexes.push(i); });
  if (indexes.length !== 1) throw new Error(indexes.length ? 'Hay RUT duplicados. Revisa la planilla.' : 'Jugador no encontrado.');
  return { player: table.players[indexes[0]], index: table.indexes[indexes[0]] };
}
function vgClean(player) {
  var result = {};
  VG_COLUMNS.forEach(function(key) {
    if (VG_READONLY.indexOf(key) >= 0 || !Object.prototype.hasOwnProperty.call(player, key)) return;
    var value = player[key] == null ? '' : String(player[key]).trim();
    if (value.length > 2500) throw new Error('Campo demasiado largo: ' + key);
    if (VG_DOCUMENTS.indexOf(key) >= 0 && value && !vgDriveId(value)) throw new Error('Documento de Drive inválido: ' + key);
    result[key] = value;
  });
  return result;
}
function vgCell(value) {
  var text = String(value == null ? '' : value);
  return /^[=+@-]/.test(text) ? "'" + text : text;
}
function vgCreate(table, input, requestId) {
  var player = vgClean(input);
  if (!player.RUT || !player.Nombres) throw new Error('El RUT y el nombre son obligatorios.');
  var duplicate = table.players.filter(function(p) { return vgRut(p.RUT) === vgRut(player.RUT); });
  if (duplicate.length) {
    if (duplicate.length === 1 && requestId && duplicate[0].ID_Envio === requestId) return { success: true, player: duplicate[0], playerId: duplicate[0].ID_Jugador };
    throw new Error('Este RUT ya está inscrito. Solicita al club actualizar su ficha.');
  }
  player.ID_Jugador = Utilities.getUuid(); player.ID_Envio = requestId || Utilities.getUuid();
  player.Fecha_Registro = new Date().toISOString(); player.Ultima_Modificacion = player.Fecha_Registro;
  player.Fecha_Inscripcion = player.Fecha_Inscripcion || Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd');
  player.Status_Validacion = vgValidateStatus(player.Status_Validacion || 'PENDIENTE'); player.Modificado_Por = 'Sistema';
  table.sheet.appendRow(table.headers.map(function(key) { return vgCell(player[key]); }));
  table.players.push(player); table.indexes.push(table.sheet.getLastRow());
  return { success: true, player: player, playerId: player.ID_Jugador };
}
function vgWrite(table, row, patch) {
  patch.Ultima_Modificacion = new Date().toISOString(); patch.Modificado_Por = 'Dashboard';
  Object.keys(patch).forEach(function(key) {
    var col = table.headers.indexOf(key);
    if (col >= 0) table.sheet.getRange(row, col + 1).setValue(vgCell(patch[key]));
  });
}
function vgUpdate(table, params) {
  var current = vgFind(table, params.originalRut);
  var player = vgClean(params.player || {});
  if (vgRut(current.player.RUT) !== vgRut(player.RUT)) throw new Error('No se puede cambiar el RUT.');
  if (!player.Nombres) throw new Error('El nombre es obligatorio.');
  player.Status_Validacion = vgValidateStatus(player.Status_Validacion || current.player.Status_Validacion);
  vgWrite(table, current.index, player);
  return { success: true, player: vgFind(vgRead(), player.RUT).player };
}
function vgValidateStatus(value) {
  var status = String(value).toUpperCase();
  if (status === 'APROBADO') status = 'FEDERADO';
  if (['PENDIENTE','POR FEDERAR','FEDERADO'].indexOf(status) < 0) throw new Error('Estado inválido.');
  return status;
}
function vgStatus(table, rut, status) {
  var found = vgFind(table, rut), value = vgValidateStatus(status);
  vgWrite(table, found.index, { Status_Validacion: value, Fecha_Validacion: value === 'FEDERADO' ? new Date().toISOString() : '', Validado_Por: value === 'FEDERADO' ? 'Dashboard' : '' });
  return { success: true, player: vgFind(vgRead(), rut).player };
}
function vgDriveId(value) {
  var match = String(value || '').match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]{10,})(?:\/|$)/);
  if (match) return match[1];
  match = String(value || '').match(/^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]{10,})(?:&|$)/);
  return match ? match[1] : null;
}
function vgUpload(params) {
  if (['image/jpeg','image/png','application/pdf'].indexOf(params.mimeType) < 0) throw new Error('Formato no permitido.');
  if (typeof params.fileData !== 'string' || params.fileData.length > 3500000) throw new Error('Archivo demasiado grande.');
  var bytes = Utilities.base64Decode(params.fileData);
  if (bytes.length < 10 || bytes.length > 2621440) throw new Error('Archivo vacío o mayor a 2,5 MB.');
  var folders = DriveApp.getFoldersByName('Documentos_ValleGrande');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Documentos_ValleGrande');
  var name = String(params.fileName || 'documento').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 160);
  var file = folder.createFile(Utilities.newBlob(bytes, params.mimeType, name));
  // No publica nuevos documentos ni firmas. El dashboard los obtiene mediante GET_FILE.
  return { success: true, url: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
}
function vgGetFile(params) {
  if (VG_DOCUMENTS.indexOf(params.field) < 0) throw new Error('Campo de documento no permitido.');
  var player = vgFind(vgRead(), params.RUT).player;
  var id = vgDriveId(player[params.field]);
  if (!id) throw new Error('No se encontró el documento de Drive.');
  var file = DriveApp.getFileById(id);
  if (file.getSize() > 15 * 1024 * 1024) throw new Error('El documento supera 15 MB.');
  var blob = file.getBlob();
  if (['image/jpeg','image/png','application/pdf'].indexOf(blob.getContentType()) < 0) throw new Error('Formato del documento no admitido.');
  return { success: true, fileData: Utilities.base64Encode(blob.getBytes()), mimeType: blob.getContentType() };
}
