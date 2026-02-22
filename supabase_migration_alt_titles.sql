-- Add alternative_titles column to recipes table
ALTER TABLE recipes ADD COLUMN alternative_titles text;

-- Update the search index to include alternative_titles for better performance
DROP INDEX IF EXISTS recipes_title_idx;
CREATE INDEX recipes_title_idx ON recipes USING gin(to_tsvector('english', title || ' ' || coalesce(description, '') || ' ' || coalesce(alternative_titles, '')));
