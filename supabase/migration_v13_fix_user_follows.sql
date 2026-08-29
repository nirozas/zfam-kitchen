-- Drop existing foreign keys that point to auth.users
alter table public.user_follows
  drop constraint if exists user_follows_follower_id_fkey,
  drop constraint if exists user_follows_following_id_fkey;

-- Add new foreign keys that point to public.profiles so that Supabase PostgREST can join them
alter table public.user_follows
  add constraint user_follows_follower_id_fkey foreign key (follower_id) references public.profiles(id) on delete cascade,
  add constraint user_follows_following_id_fkey foreign key (following_id) references public.profiles(id) on delete cascade;
