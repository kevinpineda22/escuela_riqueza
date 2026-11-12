/**
 * Nombre de archivo para la descarga de una grabación: "Clase-AAAA-MM-DD-<slug>.mp4".
 * ASCII puro (sin acentos ni comillas) para que viaje seguro dentro del header
 * `Content-Disposition` sin necesitar RFC 5987.
 */

const MAX_SLUG_LENGTH = 60;

export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

// La fecha se toma en hora de Colombia: una clase de las 8 p. m. no debe caer
// en el día siguiente por estar en UTC.
function formatDate(startsAt: string | null | undefined): string {
  const date = startsAt ? new Date(startsAt) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function buildRecordingDownloadFilename(
  title: string | null | undefined,
  startsAt: string | null | undefined,
): string {
  const parts = ['Clase', formatDate(startsAt), slugifyTitle(title ?? '')].filter(Boolean);
  return `${parts.join('-')}.mp4`;
}
