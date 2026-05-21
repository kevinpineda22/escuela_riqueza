import { supabase } from "@/lib/supabase";

export type CommunityCategory = "pregunta" | "discusion" | "recurso" | "otro";
export type CommunitySort = "recent" | "popular";
export type LikeTarget = "post" | "comment";

export interface CommunityAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  plan: string | null;
}

export interface CommunityPost {
  id: string;
  author_id: string;
  title: string;
  body: string;
  image_url?: string | null;
  category: CommunityCategory;
  is_pinned: boolean;
  is_locked: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author: CommunityAuthor | null;
  liked_by_me?: boolean;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  author: CommunityAuthor | null;
  liked_by_me?: boolean;
}

const POST_SELECT = `
  id, author_id, title, body, image_url, category, is_pinned, is_locked,
  like_count, comment_count, created_at, updated_at,
  author:profiles!community_posts_author_id_fkey(id, full_name, avatar_url, role, plan)
`;

const COMMENT_SELECT = `
  id, post_id, author_id, parent_id, body, like_count, created_at, updated_at,
  author:profiles!community_comments_author_id_fkey(id, full_name, avatar_url, role, plan)
`;

async function getMyLikes(targetType: LikeTarget, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Set();

  const { data, error } = await supabase
    .from("community_likes")
    .select("target_id")
    .eq("user_id", userData.user.id)
    .eq("target_type", targetType)
    .in("target_id", ids);

  if (error || !data) return new Set();
  return new Set(data.map((row) => row.target_id as string));
}

export async function fetchPosts(
  sort: CommunitySort = "recent",
  category?: CommunityCategory
): Promise<CommunityPost[]> {
  let query = supabase.from("community_posts").select(POST_SELECT);
  if (category) query = query.eq("category", category);

  if (sort === "popular") {
    query = query.order("is_pinned", { ascending: false }).order("like_count", { ascending: false });
  } else {
    query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
  }
  query = query.limit(100);

  const { data, error } = await query;
  if (error) {
    console.error("fetchPosts error", error);
    return [];
  }
  const posts = (data ?? []) as unknown as CommunityPost[];
  const liked = await getMyLikes("post", posts.map((p) => p.id));
  return posts.map((p) => ({ ...p, liked_by_me: liked.has(p.id) }));
}

export async function fetchPost(id: string): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from("community_posts")
    .select(POST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const post = data as unknown as CommunityPost;
  const liked = await getMyLikes("post", [post.id]);
  return { ...post, liked_by_me: liked.has(post.id) };
}

export async function createPost(input: {
  title: string;
  body: string;
  category: CommunityCategory;
  image_url?: string;
  is_pinned?: boolean;
}): Promise<CommunityPost> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: user.user.id,
      title: input.title,
      body: input.body,
      category: input.category,
      image_url: input.image_url,
      is_pinned: input.is_pinned ?? false,
    })
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as CommunityPost;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function togglePinPost(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from("community_posts")
    .update({ is_pinned: pinned })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from("community_comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("fetchComments error", error);
    return [];
  }
  const comments = (data ?? []) as unknown as CommunityComment[];
  const liked = await getMyLikes("comment", comments.map((c) => c.id));
  return comments.map((c) => ({ ...c, liked_by_me: liked.has(c.id) }));
}

export async function createComment(input: {
  postId: string;
  body: string;
  parentId?: string | null;
}): Promise<CommunityComment> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: input.postId,
      author_id: userData.user.id,
      parent_id: input.parentId ?? null,
      body: input.body.trim(),
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as CommunityComment;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("community_comments").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleLike(targetType: LikeTarget, targetId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado");
  const userId = userData.user.id;

  const { data: existing } = await supabase
    .from("community_likes")
    .select("user_id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("community_likes")
      .delete()
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("community_likes")
    .insert({ user_id: userId, target_type: targetType, target_id: targetId });
  if (error) throw error;
  return true;
}
