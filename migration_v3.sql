-- Add note column to recipe_ingredients
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS note TEXT;
