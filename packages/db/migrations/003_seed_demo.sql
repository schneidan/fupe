-- Sample seed data for development / demo
-- Panera Bread → Panera Brands → JAB Holding Company (PE)

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT * FROM cypher('fupe_graph', $$
  MERGE (jab:Entity {id: 'jab-holding'})
    SET jab.name = 'JAB Holding Company', jab.type = 'PE_FIRM'
  MERGE (paneraBrands:Entity {id: 'panera-brands'})
    SET paneraBrands.name = 'Panera Brands Inc.', paneraBrands.type = 'SUBSIDIARY'
  MERGE (panera:Entity {id: 'panera-bread'})
    SET panera.name = 'Panera Bread', panera.type = 'BRAND'
  MERGE (c:Citation {id: 'pe-db-1'})
    SET c.url = 'https://example.com/pe-database', c.title = 'PE Database'
  MERGE (panera)-[:OWNED_BY {percentage: 100}]->(paneraBrands)
  MERGE (paneraBrands)-[:OWNED_BY {percentage: 100}]->(jab)
  MERGE (panera)-[:HAS_CITATION]->(c)
$$) AS (result agtype);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (3, 'fupe_graph', 'Seed: Panera Bread ownership chain demo')
ON CONFLICT (version) DO NOTHING;
