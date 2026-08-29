-- Allow users to create their own profile if the auto-trigger fails
create policy "Users can insert their own profile." on profiles 
for insert with check (auth.uid() = id);

-- Helper function to ensure profile exists
create or replace function public.ensure_profile_exists()
returns trigger as $$
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, username, is_approved, role)
    values (
      new.id, 
      coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User_' || substr(new.id::text, 1, 6)), 
      false, 
      'user'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Recreate trigger with the more robust function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.ensure_profile_exists();
