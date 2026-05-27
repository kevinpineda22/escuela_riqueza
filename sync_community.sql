-- ============================================================================
-- COMUNIDAD VIP - Foro tipo Reddit (posts + comentarios + likes)
-- Acceso: VIP y admin
-- ============================================================================

-- ============================================================================
-- 1. Tablas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  category text NOT NULL DEFAULT 'pregunta'
    CHECK (category IN ('pregunta','discusion','recurso','otro')),
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  -- Contadores desnormalizados para perf (mantenidos por triggers)
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_likes ON public.community_posts(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.community_posts(is_pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE, -- null = comentario raíz
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.community_comments(parent_id);

CREATE TABLE IF NOT EXISTS public.community_likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post','comment')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_target ON public.community_likes(target_type, target_id);

-- ============================================================================
-- 2. Triggers: mantener like_count y comment_count desnormalizados
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_community_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_updated ON public.community_posts;
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_community_updated_at();

DROP TRIGGER IF EXISTS trg_comments_updated ON public.community_comments;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_community_updated_at();

-- Trigger de contadores de likes
CREATE OR REPLACE FUNCTION public.handle_community_like_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.target_type = 'post' THEN
      UPDATE public.community_posts SET like_count = like_count + 1 WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'comment' THEN
      UPDATE public.community_comments SET like_count = like_count + 1 WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.target_type = 'post' THEN
      UPDATE public.community_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    ELSIF OLD.target_type = 'comment' THEN
      UPDATE public.community_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_likes_count ON public.community_likes;
CREATE TRIGGER trg_likes_count
  AFTER INSERT OR DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_community_like_change();

-- Trigger de contador de comentarios
CREATE OR REPLACE FUNCTION public.handle_community_comment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_comments_count ON public.community_comments;
CREATE TRIGGER trg_comments_count
  AFTER INSERT OR DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_community_comment_change();

-- ============================================================================
-- 3. Helper: ¿es VIP o admin?
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_vip_or_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND (role = 'admin' OR plan IN ('vip', 'individual'))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_vip_or_admin(uuid) TO authenticated;

-- ============================================================================
-- 4. RLS - sólo VIP + admin
-- ============================================================================

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

-- ---- POSTS ----
DROP POLICY IF EXISTS "VIP can view posts" ON public.community_posts;
CREATE POLICY "VIP can view posts" ON public.community_posts
  FOR SELECT USING (public.is_vip_or_admin(auth.uid()));

DROP POLICY IF EXISTS "VIP can create posts" ON public.community_posts;
CREATE POLICY "VIP can create posts" ON public.community_posts
  FOR INSERT WITH CHECK (
    public.is_vip_or_admin(auth.uid()) AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authors and admins can update posts" ON public.community_posts;
CREATE POLICY "Authors and admins can update posts" ON public.community_posts
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Authors and admins can delete posts" ON public.community_posts;
CREATE POLICY "Authors and admins can delete posts" ON public.community_posts
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- COMMENTS ----
DROP POLICY IF EXISTS "VIP can view comments" ON public.community_comments;
CREATE POLICY "VIP can view comments" ON public.community_comments
  FOR SELECT USING (public.is_vip_or_admin(auth.uid()));

DROP POLICY IF EXISTS "VIP can create comments" ON public.community_comments;
CREATE POLICY "VIP can create comments" ON public.community_comments
  FOR INSERT WITH CHECK (
    public.is_vip_or_admin(auth.uid()) AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authors and admins can delete comments" ON public.community_comments;
CREATE POLICY "Authors and admins can delete comments" ON public.community_comments
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Authors and admins can update comments" ON public.community_comments;
CREATE POLICY "Authors and admins can update comments" ON public.community_comments
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- LIKES ----
DROP POLICY IF EXISTS "VIP can view likes" ON public.community_likes;
CREATE POLICY "VIP can view likes" ON public.community_likes
  FOR SELECT USING (public.is_vip_or_admin(auth.uid()));

DROP POLICY IF EXISTS "VIP can like" ON public.community_likes;
CREATE POLICY "VIP can like" ON public.community_likes
  FOR INSERT WITH CHECK (
    public.is_vip_or_admin(auth.uid()) AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can unlike own" ON public.community_likes;
CREATE POLICY "Users can unlike own" ON public.community_likes
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 5. Realtime: habilitar broadcast en publicaciones y comentarios
-- (corre esto en Supabase Dashboard → Database → Replication si no se aplica)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;
  END IF;
END
$$;
