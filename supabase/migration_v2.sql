-- Migration to support multiple categories, ingredient ordering, and country of origin

-- 1. Add country_origin to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS country_origin TEXT;

-- 2. Add order_index to recipe_ingredients to preserve order
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- 3. Create recipe_categories join table for multiple categories
CREATE TABLE IF NOT EXISTS recipe_categories (
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, category_id)
);

-- Enable RLS on the new table
ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Recipe categories are public." ON recipe_categories FOR SELECT USING (true);

-- Allow authenticated users to manage their recipe categories
-- (Technically simplified for now to match the user's existing simple policies)
CREATE POLICY "Users can manage recipe categories." ON recipe_categories FOR ALL USING (
    EXISTS (
        SELECT 1 FROM recipes 
        WHERE id = recipe_categories.recipe_id 
        AND (author_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
);

-- Migrate existing main categories to the join table
INSERT INTO recipe_categories (recipe_id, category_id)
SELECT id, category_id FROM recipes
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
