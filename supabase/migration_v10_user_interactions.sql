-- 1. Drop the existing check constraint on rating (which likely enforces rating >= 1)
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_rating_check;

-- 2. Add a new check constraint allowing rating >= 0
ALTER TABLE public.recipes ADD CONSTRAINT recipes_rating_check CHECK (rating >= 0 AND rating <= 5);

-- 3. Change default rating for recipes from 3 to 0
ALTER TABLE public.recipes ALTER COLUMN rating SET DEFAULT 0;

-- 4. Add cooked_before and tasted_before to reviews table
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS cooked_before BOOLEAN DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS tasted_before BOOLEAN DEFAULT false;

-- 5. Reset rating to 0 for untouched recipes that have rating = 3
UPDATE public.recipes r
SET rating = 0
WHERE rating = 3
  AND NOT EXISTS (
    SELECT 1 FROM public.meal_planner mp WHERE mp.recipe_id = r.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews rev WHERE rev.recipe_id = r.id
  );

-- 6. Mark recipes in the meal planner as Cooked and Tasted for asniroz@gmail.com
INSERT INTO public.reviews (user_id, recipe_id, cooked_before, tasted_before)
SELECT DISTINCT u.id, mp.recipe_id, true, true
FROM public.meal_planner mp
JOIN auth.users u ON u.id = mp.user_id
WHERE u.email = 'asniroz@gmail.com' 
  AND mp.recipe_id IS NOT NULL
ON CONFLICT (user_id, recipe_id) 
DO UPDATE SET 
  cooked_before = true,
  tasted_before = true;
