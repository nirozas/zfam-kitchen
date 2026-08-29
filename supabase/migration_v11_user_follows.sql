-- 13. USER FOLLOWS (Subscriptions)
create table if not exists user_follows (
  id uuid default uuid_generate_v4() primary key,
  follower_id uuid references auth.users on delete cascade not null,
  following_id uuid references auth.users on delete cascade not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(follower_id, following_id)
);

alter table user_follows enable row level security;

create policy "Users can see their own follows." on user_follows for select using (auth.uid() = follower_id);
create policy "Users can see who follows them." on user_follows for select using (auth.uid() = following_id);
create policy "Users can insert their own follows." on user_follows for insert with check (auth.uid() = follower_id);
create policy "Users can update their own follows." on user_follows for update using (auth.uid() = follower_id);
create policy "Users can delete their own follows." on user_follows for delete using (auth.uid() = follower_id);

create index user_follows_follower_id_idx on user_follows(follower_id);
create index user_follows_following_id_idx on user_follows(following_id);
