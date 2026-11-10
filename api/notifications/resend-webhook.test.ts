import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SECRET_BYTES = Buffer.from('secreto-de-prueba-del-webhook-32b');

const mocks = vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from('secreto-de-prueba-del-webhook-32b').toString('base64')}`;
  return { rpc: vi.fn() };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc }) }));

import handler from './resend-webhook';

// Firma real, verificada por el SDK de Resend sin mocks: si cambia el esquema, esto falla.
function signedHeaders(payload: string, id = 'msg_1') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', SECRET_BYTES).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` };
}

function call(payload: string, headers: Record<string, string>) {
  const req = Object.assign(Readable.from([Buffer.from(payload)]), { method: 'POST', headers });
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
  };
  return handler(req as unknown as VercelRequest, res as unknown as VercelResponse).then(() => res);
}

const base = {
  email_id: 'email-1',
  to: ['Wilforati@gmail.com'],
  subject: 'Tu acceso a la Escuela de la Riqueza',
  created_at: '2026-11-06T19:08:00.000Z',
};

const event = (type: string, data: object = base) =>
  JSON.stringify({ type, created_at: '2026-11-06T19:08:30.000Z', data });

describe('POST /api/notifications/resend-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('guarda un rebote con su motivo y el diagnóstico del servidor', async () => {
    const payload = event('email.bounced', {
      ...base,
      bounce: {
        type: 'Permanent',
        subType: 'General',
        message: 'The recipient address does not exist',
        diagnosticCode: ['550 5.1.1 The email account that you tried to reach does not exist'],
      },
    });

    const res = await call(payload, signedHeaders(payload));

    expect(res.statusCode).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('record_email_event', {
      p_email_id: 'email-1',
      p_recipient: 'Wilforati@gmail.com',
      p_subject: 'Tu acceso a la Escuela de la Riqueza',
      p_status: 'bounced',
      p_sent_at: '2026-11-06T19:08:00.000Z',
      p_event_at: '2026-11-06T19:08:30.000Z',
      p_bounce_type: 'Permanent',
      p_bounce_subtype: 'General',
      p_detail:
        'The recipient address does not exist | 550 5.1.1 The email account that you tried to reach does not exist',
    });
  });

  it('rechaza una firma inválida sin tocar la base', async () => {
    const payload = event('email.delivered');
    const headers = signedHeaders(payload);

    const res = await call(payload.replace('email-1', 'email-falso'), headers);

    expect(res.statusCode).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('ignora los eventos que el panel no usa', async () => {
    const payload = event('email.opened');

    const res = await call(payload, signedHeaders(payload));

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, action: 'ignored' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('responde 500 si no pudo guardar, para que Resend reintente', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'down' } });
    const payload = event('email.delivered');

    const res = await call(payload, signedHeaders(payload));

    expect(res.statusCode).toBe(500);
  });
});
