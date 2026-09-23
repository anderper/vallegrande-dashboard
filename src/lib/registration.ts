export type Player = Record<string, string>;

export const REGISTRATION_TYPES = [
  'INSC ADULTO', 'INSC INF/JUV', 'PASE INTERNO', 'EXTRANJERO INT',
  'PASE ADULTO CONCEDIDO', 'PASE INTERNO INF CONCEDIDO',
] as const;
export const STATUSES = ['PENDIENTE', 'POR FEDERAR', 'FEDERADO'] as const;
export type RegistrationStatus = typeof STATUSES[number];
export const DOCUMENT_FIELDS = [
  'Foto_Cedula_Frontal', 'Foto_Cedula_Reverso', 'Antecedentes_PDF',
  'Foto_Jugador', 'Firma_Jugador', 'Foto_Cedula_Padre_Frontal',
  'Foto_Cedula_Padre_Reverso', 'Firma_Apoderado',
] as const;
export type DocumentField = typeof DOCUMENT_FIELDS[number];
export const AUTHORIZATION_VERSION = 'lampa-2026-v1';

export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function ageAt(birth: string, today = localDate()): number | null {
  const value = birth?.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value > today) return null;
  const age = Number(today.slice(0, 4)) - Number(value.slice(0, 4)) - (today.slice(5) < value.slice(5) ? 1 : 0);
  return age > 120 ? null : age;
}

export const isMinor = (player: Player) => {
  const age = ageAt(player.Fecha_Nacimiento, player.Fecha_Inscripcion?.slice(0, 10) || localDate());
  return age !== null && age < 18;
};
export const fullName = (p: Player) => [p.Nombres || p.Nombre, p.Apellido_Paterno || p.Apellidos, p.Apellido_Materno].map(value => value?.trim()).filter(Boolean).join(' ');
export const normalizeRut = (rut: string) => (rut || '').replace(/[.\s-]/g, '').toUpperCase();
export function validRut(rut: string) {
  const value = normalizeRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(value)) return false;
  let sum = 0, factor = 2;
  for (const digit of value.slice(0, -1).split('').reverse()) { sum += Number(digit) * factor; factor = factor === 7 ? 2 : factor + 1; }
  const digit = 11 - (sum % 11);
  return value.at(-1) === (digit === 11 ? '0' : digit === 10 ? 'K' : String(digit));
}
export function statusOf(p: Player): RegistrationStatus {
  const status = p.Status_Validacion?.trim().toUpperCase();
  return status === 'FEDERADO' || status === 'APROBADO' ? 'FEDERADO' : status === 'POR FEDERAR' ? 'POR FEDERAR' : 'PENDIENTE';
}
export const playerAuthorization = (p: Player) => `Yo, ${fullName(p)}, con RUT ${p.RUT?.trim() || ''}, autorizo al CLUB DEPORTIVO VALLE GRANDE FC a inscribirme como jugador en la LIGA COMUNAL LAMPA.`;
export const guardianAuthorization = (p: Player) => `Yo, ${p.Nombre_Apoderado?.trim() || ''}, con RUT ${p.RUT_Apoderado?.trim() || ''}, como apoderado de ${fullName(p)}, RUT ${p.RUT?.trim() || ''}, autorizo al CLUB DEPORTIVO VALLE GRANDE FC a inscribirlo como jugador en la LIGA COMUNAL LAMPA.`;

export function requirements(p: Player) {
  const checks: { key: string; label: string; complete: boolean }[] = [
    { key: 'datos', label: 'Datos personales válidos', complete: !!(p.Nombres?.trim() && p.Apellido_Paterno?.trim() && p.Apellido_Materno?.trim() && p.Nacionalidad?.trim() && p.Serie?.trim() && validRut(p.RUT) && ageAt(p.Fecha_Nacimiento) !== null) },
    { key: 'Tipo_Inscripcion', label: 'Tipo de inscripción', complete: REGISTRATION_TYPES.includes(p.Tipo_Inscripcion as typeof REGISTRATION_TYPES[number]) },
    { key: 'Foto_Cedula_Frontal', label: 'Cédula frontal', complete: !!p.Foto_Cedula_Frontal },
    { key: 'Foto_Cedula_Reverso', label: 'Cédula reverso', complete: !!p.Foto_Cedula_Reverso },
    { key: 'Antecedentes_PDF', label: 'Certificado de antecedentes', complete: !!p.Antecedentes_PDF },
    { key: 'Foto_Jugador', label: 'Foto recortada de la cédula', complete: !!p.Foto_Jugador },
    { key: 'Firma_Jugador', label: 'Firma y autorización del jugador', complete: !!p.Firma_Jugador && !!p.Fecha_Firma && p.Autorizacion_Texto === playerAuthorization(p) && p.Autorizacion_Version === AUTHORIZATION_VERSION },
  ];
  if (isMinor(p)) checks.push(
    { key: 'apoderado', label: 'Datos del apoderado', complete: !!p.Nombre_Apoderado?.trim() && validRut(p.RUT_Apoderado) },
    { key: 'Foto_Cedula_Padre_Frontal', label: 'Cédula frontal del apoderado', complete: !!p.Foto_Cedula_Padre_Frontal },
    { key: 'Foto_Cedula_Padre_Reverso', label: 'Cédula reverso del apoderado', complete: !!p.Foto_Cedula_Padre_Reverso },
    { key: 'Firma_Apoderado', label: 'Firma y autorización del apoderado', complete: !!p.Firma_Apoderado && !!p.Fecha_Firma_Apoderado && p.Autorizacion_Apoderado_Texto === guardianAuthorization(p) },
  );
  return checks;
}
export const missingRequirements = (p: Player) => requirements(p).filter(check => !check.complete).map(check => check.label);
export function automaticStatus(p: Player): RegistrationStatus {
  return statusOf(p) === 'FEDERADO' ? 'FEDERADO' : missingRequirements(p).length ? 'PENDIENTE' : 'POR FEDERAR';
}
export function normalizePlayer(raw: Record<string, unknown>): Player {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value == null ? '' : String(value)]));
}
