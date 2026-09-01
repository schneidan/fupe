-- 1. Enable Trigram Fuzzy Search for brand/product name auto-complete
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Load the Apache AGE Extension
CREATE EXTENSION IF NOT EXISTS age;

-- 3. Load AGE module into search path
SET search_path = ag_catalog, "$user", public;

-- 4. Create the main corporate ownership graph
SELECT create_graph('fupe_ownership_graph');
