import { describe, it, expect } from 'vitest';
import { signR2RecordingUrl } from './recording-url';

// `signR2RecordingUrl` es la lógica de firma que usa recording-url.ts
// (rama autenticada, `live_id`) — se extrajo como función pura para poder
// testearla sin mockear `VercelRequest`/`VercelResponse`.
const creds = {
  accountId: 'acc123',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'secretkey',
  bucket: 'recordings-bucket',
};

describe('signR2RecordingUrl', () => {
  it('firma una URL apuntando al endpoint S3 de la cuenta y bucket correctos', async () => {
    const url = await signR2RecordingUrl(creds, 'lives/2026-09-12/vivo.mp4');
    expect(url.startsWith('https://acc123.r2.cloudflarestorage.com/recordings-bucket/lives/2026-09-12/vivo.mp4')).toBe(true);
  });

  it('URL-encodea cada segmento del key preservando las barras', async () => {
    const url = await signR2RecordingUrl(creds, 'lives/2026 09 12/vivo final.mp4');
    expect(url).toContain('lives/2026%2009%2012/vivo%20final.mp4');
  });

  it('usa el TTL default de 900s si no se pasa uno explícito', async () => {
    const url = await signR2RecordingUrl(creds, 'key.mp4');
    expect(url).toContain('X-Amz-Expires=900');
  });

  it('respeta un TTL explícito distinto del default', async () => {
    const url = await signR2RecordingUrl(creds, 'key.mp4', 60);
    expect(url).toContain('X-Amz-Expires=60');
  });

  it('produce una firma (query params de autenticación AWS SigV4)', async () => {
    const url = await signR2RecordingUrl(creds, 'key.mp4');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Credential=');
  });
});
