-- Add is_image_recipe to recipes table
ALTER TABLE recipes
ADD COLUMN is_image_recipe BOOLEAN DEFAULT FALSE;

-- Update existing recipes if needed (optional, they will default to FALSE)
-- UPDATE recipes SET is_image_recipe = FALSE WHERE is_image_recipe IS NULL;
