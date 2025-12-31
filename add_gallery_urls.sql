-- Add gallery_urls column to recipes table if it doesn't exist
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS gallery_urls jsonb DEFAULT '[]'::jsonb;
