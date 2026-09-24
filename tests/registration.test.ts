import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageAt, automaticStatus, AUTHORIZATION_VERSION, guardianAuthorization, missingRequirements, playerAuthorization, statusOf, validRut, type Player } from '../src/lib/registration';
import { createScriptHarness } from './apps-script-harness';

const complete = (): Player => {
  const player: Player = { RUT: '12.345.678-5', Nombres: 'Jugador', Apellido_Paterno: 'De', Apellido_Materno: 'Prueba', Fecha_Nacimiento: '2000-01-01', Fecha_Inscripcion: '2026-09-23', Nacionalidad: 'CHILENA', Serie: '1ERA ADULTA', Tipo_Inscripcion: 'INSC ADULTO', Foto_Cedula_Frontal: 'yes', Foto_Cedula_Reverso: 'yes', Antecedentes_PDF: 'yes', Foto_Jugador: 'yes', Firma_Jugador: 'yes', Fecha_Firma: '2026-09-23T12:00:00Z', Autorizacion_Version: AUTHORIZATION_VERSION };
  player.Autorizacion_Texto = playerAuthorization(player); return player;
};
test('edad usa fechas de calendario, reconoce el cumpleaños y rechaza fechas imposibles', () => {
  assert.equal(ageAt('2008-09-23', '2026-09-22'), 17);
  assert.equal(ageAt('2008-09-23', '2026-09-23'), 18);
  assert.equal(ageAt('2024-02-30', '2026-09-23'), null);
  assert.equal(ageAt('2027-01-01', '2026-09-23'), null);
});
test('RUT verifica dígito y normaliza puntuación', () => { assert.ok(validRut('12.345.678-5')); assert.ok(validRut('123456785')); assert.equal(validRut('12.345.678-9'), false); });
test('documentos solos no completan la ficha; nunca federa automáticamente', () => {
  const p = complete(); assert.equal(automaticStatus(p), 'POR FEDERAR');
  delete p.Firma_Jugador; assert.equal(automaticStatus(p), 'PENDIENTE');
  p.Status_Validacion = 'FEDERADO'; assert.equal(automaticStatus(p), 'FEDERADO');
  p.Status_Validacion = 'Aprobado'; assert.equal(statusOf(p), 'FEDERADO');
});
test('cambiar identidad invalida la autorización anterior', () => { const p = complete(); p.Nombres = 'Otro'; assert.ok(missingRequirements(p).includes('Firma y autorización del jugador')); });
test('espacios accidentales no invalidan la firma cuando Sheets normaliza los campos', () => {
  const p = complete(); p.Nombres = ' Jugador '; p.RUT = ' 12.345.678-5 ';
  assert.equal(playerAuthorization(p), playerAuthorization(complete()));
});
test('menores requieren autorización firmada y documentos del apoderado', () => {
  const p: Player = { ...complete(), Fecha_Nacimiento: '2012-01-01', Tipo_Inscripcion: 'INSC INF/JUV' };
  delete p.Antecedentes_PDF;
  assert.equal(missingRequirements(p).length, 4);
  Object.assign(p, { Nombre_Apoderado: 'Apoderado de prueba', RUT_Apoderado: '12.345.678-5', Foto_Cedula_Padre_Frontal: 'yes', Foto_Cedula_Padre_Reverso: 'yes', Firma_Apoderado: 'yes', Fecha_Firma_Apoderado: '2026-09-23' });
  p.Autorizacion_Apoderado_Texto = guardianAuthorization(p);
  assert.deepEqual(missingRequirements(p), []);
  assert.equal(automaticStatus(p), 'POR FEDERAR');
  for (const field of ['Foto_Cedula_Frontal','Foto_Cedula_Reverso','Firma_Jugador','Foto_Cedula_Padre_Frontal','Foto_Cedula_Padre_Reverso','Firma_Apoderado']) {
    assert.ok(missingRequirements({ ...p, [field]: '' }).length > 0, field);
  }
  assert.ok(missingRequirements({ ...p, Fecha_Nacimiento: '2000-01-01' }).includes('Certificado de antecedentes'));
});
test('Apps Script añade columnas sin borrar filas y guarda nuevos campos por encabezado', () => {
  const harness = createScriptHarness([['Nombres', 'RUT', 'Columna_Personalizada'], ['Anterior', '9.876.543-3', 'NO CAMBIAR']]);
  const result = harness.post({ action: 'CREATE_REGISTRATION', player: { RUT: '12.345.678-5', Nombres: 'Prueba', Tipo_Inscripcion: 'INSC ADULTO', Firma_Jugador: 'https://drive.google.com/file/d/fake_signature_123/view' } });
  assert.equal(result.success, true); assert.equal(harness.rows[1][2], 'NO CAMBIAR'); assert.equal(harness.get().length, 2);
  assert.equal(harness.get()[1].Tipo_Inscripcion, 'INSC ADULTO'); assert.equal(harness.get()[1].Firma_Jugador, 'https://drive.google.com/file/d/fake_signature_123/view');
});
test('reintento idempotente no duplica jugador y actualización preserva otros campos', () => {
  const h = createScriptHarness(); const p = { RUT: '12.345.678-5', Nombres: 'Prueba', Observaciones: 'conservar' };
  assert.ok(h.post({ action: 'CREATE_REGISTRATION', player: p, requestId: 'same-request' }).success);
  assert.ok(h.post({ action: 'CREATE_REGISTRATION', player: p, requestId: 'same-request' }).success); assert.equal(h.get().length, 1);
  assert.equal(h.post({ action: 'CREATE_REGISTRATION', player: p }).success, false);
  const updated = h.post({ action: 'UPDATE_STATUS', RUT: '123456785', status: 'FEDERADO' });
  assert.equal(updated.player.Status_Validacion, 'FEDERADO'); assert.equal(updated.player.Observaciones, 'conservar');
  assert.ok(updated.player.Fecha_Validacion);
  assert.equal(h.post({ action: 'UPDATE_STATUS', RUT: p.RUT, status: 'PENDIENTE' }).player.Fecha_Validacion, '');
});
test('lectura de Drive solo permite documentos referenciados por el jugador', () => {
  const h = createScriptHarness(); assert.equal(h.post({ action: 'GET_FILE', RUT: '123456785', field: 'fileId' }).success, false);
});
