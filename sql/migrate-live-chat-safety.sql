-- Chat del vivo seguro (Fase 4 de la revisión de la sala en vivo, 2026-10-27).
--
-- Hasta acá la única regla de escritura era `auth.uid() = user_id`: un script
-- podía mandar decenas de mensajes por segundo o un texto de megas, escribir
-- con la clase finalizada o seguir escribiendo con la cuenta suspendida. Todo
-- eso se controlaba (a medias) en el navegador, que es lo primero que se salta.
--
-- Qué agrega:
--   1. Largo: 1 a 300 caracteres (sin contar espacios en los bordes).
--   2. Trigger BEFORE INSERT en live_messages: cuenta suspendida, clase
--      finalizada, silenciado por un moderador y un mensaje por segundo.
--      El equipo (role = 'admin') no tiene límites.
--   3. live_chat_mutes: silenciar a alguien en una clase (por un rato o toda
--      la clase). Solo admins escriben; cada uno puede leer su propio silencio.
--   4. Reacciones: como mucho 8 en 2 segundos por persona.
--
-- La LECTURA del chat no cambia: es para todos los usuarios con sesión
-- (decisión de producto, 2026-10-27).
--
-- Orden de deploy: correr este archivo ANTES del front. El front viejo sigue
-- funcionando (solo ve errores nuevos si alguien supera un límite).
--
-- Mensajes de error: van en español y tal cual al alumno. El front los
-- reconoce por el HINT ('chat_…') y muestra el mensaje en el cuadro de envío.

-- 1. Largo ----------------------------------------------------------------
-- NOT VALID: no revisa los mensajes viejos (podría haber alguno más largo);
-- sí rige para todo lo nuevo.
ALTER TABLE public.live_messages DROP CONSTRAINT IF EXISTS live_messages_content_length;
ALTER TABLE public.live_messages
  ADD CONSTRAINT live_messages_content_length
  CHECK (char_length(btrim(content)) BETWEEN 1 AND 300) NOT VALID;

-- Para el control de ritmo (último mensaje de esta persona en esta clase).
CREATE INDEX IF NOT EXISTS live_messages_user_live_created_idx
  ON public.live_messages (user_id, live_id, created_at DESC);

-- 3. Silenciados (antes que el trigger, que la consulta) -----------------
CREATE TABLE IF NOT EXISTS public.live_chat_mutes (
  live_id uuid NOT NULL REFERENCES public.lives (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- null = silenciado toda la clase.
  muted_until timestamptz,
  muted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (live_id, user_id)
);

ALTER TABLE public.live_chat_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage live_chat_mutes" ON public.live_chat_mutes;
CREATE POLICY "Admins manage live_chat_mutes" ON public.live_chat_mutes
  FOR ALL TO authenticated
  USING (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  WITH CHECK (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

DROP POLICY IF EXISTS "Users read own live_chat_mute" ON public.live_chat_mutes;
CREATE POLICY "Users read own live_chat_mute" ON public.live_chat_mutes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Trigger de escritura -------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_messages_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_suspended boolean;
  v_status text;
  v_muted_until timestamptz;
  v_is_muted boolean := false;
BEGIN
  -- Reintento del mismo mensaje (el front reusa el id si se perdió la
  -- respuesta): que choque con la clave primaria (23505 = "ya se envió") en
  -- vez de caer en el límite de ritmo y mostrarse como error.
  IF EXISTS (SELECT 1 FROM live_messages WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT role, coalesce(is_suspended, false) INTO v_role, v_suspended
  FROM profiles WHERE id = NEW.user_id;

  -- El equipo de la escuela no tiene límites.
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF v_suspended THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida: no puedes escribir en el chat.'
      USING ERRCODE = 'P0001', HINT = 'chat_suspended';
  END IF;

  SELECT status INTO v_status FROM lives WHERE id = NEW.live_id;
  IF v_status IS NULL OR v_status = 'ended' THEN
    RAISE EXCEPTION 'La clase terminó: el chat está cerrado.'
      USING ERRCODE = 'P0001', HINT = 'chat_closed';
  END IF;

  SELECT muted_until, true INTO v_muted_until, v_is_muted
  FROM live_chat_mutes WHERE live_id = NEW.live_id AND user_id = NEW.user_id;
  IF v_is_muted AND (v_muted_until IS NULL OR v_muted_until > now()) THEN
    RAISE EXCEPTION 'Un moderador te silenció en este chat por un rato.'
      USING ERRCODE = 'P0001', HINT = 'chat_muted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM live_messages
    WHERE user_id = NEW.user_id
      AND live_id = NEW.live_id
      AND created_at > now() - interval '1 second'
  ) THEN
    RAISE EXCEPTION 'Vas muy rápido: espera un segundo antes de enviar otro mensaje.'
      USING ERRCODE = 'P0001', HINT = 'chat_rate';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_messages_guard ON public.live_messages;
CREATE TRIGGER live_messages_guard
  BEFORE INSERT ON public.live_messages
  FOR EACH ROW EXECUTE FUNCTION public.live_messages_guard();

-- 4. Reacciones -----------------------------------------------------------
-- Cada toque se transmite a todos los espectadores: 8 en 2 s ya es más de lo
-- que una persona hace a mano.
CREATE INDEX IF NOT EXISTS live_message_reactions_user_created_idx
  ON public.live_message_reactions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.live_message_reactions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM live_message_reactions
    WHERE user_id = NEW.user_id AND created_at > now() - interval '2 seconds'
  ) >= 8 THEN
    RAISE EXCEPTION 'Vas muy rápido con las reacciones.'
      USING ERRCODE = 'P0001', HINT = 'chat_rate';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_message_reactions_guard ON public.live_message_reactions;
CREATE TRIGGER live_message_reactions_guard
  BEFORE INSERT ON public.live_message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.live_message_reactions_guard();
