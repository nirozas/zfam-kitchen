-- Migration v5: Add parent_recipe_id to track recipe alterations
-- Run this in the Supabase SQL editor

-- Add parent_recipe_id column to recipes table
ALTER TABLE recipes 
  ADD COLUMN IF NOT EXISTS parent_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;

-- Index for fast "find all alterations of this recipe" queries
CREATE INDEX IF NOT EXISTS recipes_parent_recipe_id_idx ON recipes(parent_recipe_id);
