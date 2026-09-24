import vm from 'node:vm';
import { readFileSync } from 'node:fs';

export function createScriptHarness(initial?: string[][], apiToken?: string) {
  const rows: string[][] = initial || [['ID_Jugador', 'RUT', 'Nombres', 'Observaciones']];
  const files = new Map<string, { bytes: number[]; type: string }>();
  let sequence = 0;
  const range = (r: number, c: number, height = 1, width = 1) => ({
    getValues: () => Array.from({ length: height }, (_, ri) => Array.from({ length: width }, (_, ci) => rows[r - 1 + ri]?.[c - 1 + ci] || '')),
    setValue: (value: string) => { rows[r - 1] ||= []; rows[r - 1][c - 1] = value.startsWith("'") ? value.slice(1) : value; },
    setValues: (values: string[][]) => values.forEach((row, ri) => row.forEach((value, ci) => { rows[r - 1 + ri] ||= []; rows[r - 1 + ri][c - 1 + ci] = value; })),
  });
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map(r => [...r]) }),
    getRange: range, getMaxColumns: () => 60, insertColumnsAfter: () => {},
    appendRow: (row: string[]) => rows.push(row.map(value => value.startsWith("'") ? value.slice(1) : value)),
    getLastRow: () => rows.length,
  };
  const blob = (bytes: number[], type: string) => ({ getBytes: () => bytes, getContentType: () => type });
  const folder = { createFile: (file: ReturnType<typeof blob>) => { const id = `fake_document_${++sequence}`; files.set(id, { bytes: file.getBytes(), type: file.getContentType() }); return { getId: () => id }; } };
  const context = vm.createContext({
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (content: string) => ({ setMimeType: () => content }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (name: string) => name === 'Jugadores' ? sheet : null, getSpreadsheetTimeZone: () => 'America/Santiago' }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, hasLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => apiToken || null }) },
    Utilities: { getUuid: () => `test-id-${++sequence}`, formatDate: (date: Date) => date.toISOString().slice(0, 10), base64Decode: (value: string) => [...Buffer.from(value, 'base64')], base64Encode: (value: number[]) => Buffer.from(value).toString('base64'), newBlob: blob },
    DriveApp: { getFoldersByName: () => ({ hasNext: () => true, next: () => folder }), createFolder: () => folder, getFileById: (id: string) => { const file = files.get(id); if (!file) throw new Error('Archivo no encontrado.'); return { getSize: () => file.bytes.length, getBlob: () => blob(file.bytes, file.type) }; } },
  });
  vm.runInContext(readFileSync('google-apps-script/Code.gs', 'utf8'), context);
  return {
    rows, files,
    post: (body: Record<string, unknown>) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } })),
    get: (capabilities = false) => JSON.parse(context.doGet({ parameter: capabilities ? { capabilities: '1' } : {} })),
  };
}
