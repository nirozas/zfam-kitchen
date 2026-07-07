-- 1. Create a function to convert string to Title Case
CREATE OR REPLACE FUNCTION to_title_case(str TEXT)
RETURNS TEXT AS $$
DECLARE
  words TEXT[];
  word TEXT;
  result TEXT := '';
BEGIN
  words := regexp_split_to_array(trim(lower(str)), '\s+');
  FOREACH word IN ARRAY words
  LOOP
    IF result != '' THEN
      result := result || ' ';
    END IF;
    result := result || upper(substr(word, 1, 1)) || substr(word, 2);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Clean up duplicate ingredients in the `ingredients` table.
-- We group by lower(name) and keep the one with the lowest id.
DO $$ 
DECLARE
    r RECORD;
    primary_id BIGINT;
    dup_ids BIGINT[];
BEGIN
    FOR r IN 
        SELECT to_title_case(trim(name)) as cname, array_agg(id ORDER BY id) as ids
        FROM ingredients
        GROUP BY to_title_case(trim(name))
        HAVING count(id) > 1
    LOOP
        primary_id := r.ids[1];
        dup_ids := r.ids[2:array_length(r.ids, 1)];
        
        -- Update recipe_ingredients to point to the primary_id
        UPDATE recipe_ingredients 
        SET ingredient_id = primary_id 
        WHERE ingredient_id = ANY(dup_ids);
        
        -- Delete the duplicate ingredients
        DELETE FROM ingredients WHERE id = ANY(dup_ids);
    END LOOP;
END $$;

-- 3. Capitalize and trim all remaining ingredients in the `ingredients` table.
UPDATE ingredients
SET name = to_title_case(trim(name))
WHERE name != to_title_case(trim(name));

-- 4. Capitalize all items in the `shopping_cart` table.
UPDATE shopping_cart
SET name = to_title_case(name)
WHERE name != to_title_case(name);

-- 5. Capitalize keys in category_breakdown for shopping_receipts.
DO $$ 
DECLARE
    r RECORD;
    new_json JSONB;
    k TEXT;
    v JSONB;
BEGIN
    FOR r IN SELECT id, category_breakdown FROM shopping_receipts WHERE category_breakdown IS NOT NULL
    LOOP
        new_json := '{}'::jsonb;
        FOR k, v IN SELECT * FROM jsonb_each(r.category_breakdown)
        LOOP
            new_json := jsonb_set(new_json, ARRAY[to_title_case(k)], v, true);
        END LOOP;
        
        UPDATE shopping_receipts
        SET category_breakdown = new_json
        WHERE id = r.id;
    END LOOP;
END $$;

-- Clean up the function
DROP FUNCTION to_title_case(TEXT);
