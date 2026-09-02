-- Expanded seed: fast food / QSR PE portfolios + independent holdouts

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT * FROM cypher('fupe_graph', $$

  MERGE (roark:Entity {id: 'roark-capital'})
    SET roark.name = 'Roark Capital Group', roark.type = 'PE_FIRM'
  MERGE (blackstone:Entity {id: 'blackstone'})
    SET blackstone.name = 'Blackstone Inc.', blackstone.type = 'PE_FIRM'
  MERGE (jab:Entity {id: 'jab-holding'})
    SET jab.name = 'JAB Holding Company', jab.type = 'PE_FIRM'

  MERGE (inspire:Entity {id: 'inspire-brands'})
    SET inspire.name = 'Inspire Brands', inspire.type = 'SUBSIDIARY'
  MERGE (gotoFoods:Entity {id: 'goto-foods'})
    SET gotoFoods.name = 'GoTo Foods', gotoFoods.type = 'SUBSIDIARY'
  MERGE (inspire)-[:OWNED_BY {percentage: 100}]->(roark)
  MERGE (gotoFoods)-[:OWNED_BY {percentage: 100}]->(roark)

  MERGE (subway:Entity {id: 'subway'})
    SET subway.name = 'Subway', subway.type = 'BRAND'
  MERGE (dunkin:Entity {id: 'dunkin'})
    SET dunkin.name = "Dunkin'", dunkin.type = 'BRAND'
  MERGE (arbys:Entity {id: 'arbys'})
    SET arbys.name = "Arby's", arbys.type = 'BRAND'
  MERGE (sonic:Entity {id: 'sonic'})
    SET sonic.name = 'Sonic Drive-In', sonic.type = 'BRAND'
  MERGE (jimmy:Entity {id: 'jimmy-johns'})
    SET jimmy.name = "Jimmy John's", jimmy.type = 'BRAND'
  MERGE (bww:Entity {id: 'buffalo-wild-wings'})
    SET bww.name = 'Buffalo Wild Wings', bww.type = 'BRAND'
  MERGE (baskin:Entity {id: 'baskin-robbins'})
    SET baskin.name = 'Baskin-Robbins', baskin.type = 'BRAND'
  MERGE (auntie:Entity {id: 'auntie-annes'})
    SET auntie.name = "Auntie Anne's", auntie.type = 'BRAND'

  MERGE (subway)-[:OWNED_BY {percentage: 100}]->(roark)
  MERGE (dunkin)-[:OWNED_BY {percentage: 100}]->(inspire)
  MERGE (arbys)-[:OWNED_BY {percentage: 100}]->(inspire)
  MERGE (sonic)-[:OWNED_BY {percentage: 100}]->(inspire)
  MERGE (jimmy)-[:OWNED_BY {percentage: 100}]->(inspire)
  MERGE (bww)-[:OWNED_BY {percentage: 100}]->(inspire)
  MERGE (baskin)-[:OWNED_BY {percentage: 100}]->(inspire)
  MERGE (auntie)-[:OWNED_BY {percentage: 100}]->(gotoFoods)

  MERGE (krispy:Entity {id: 'krispy-kreme'})
    SET krispy.name = 'Krispy Kreme', krispy.type = 'BRAND'
  MERGE (pret:Entity {id: 'pret-a-manger'})
    SET pret.name = 'Pret A Manger', pret.type = 'BRAND'
  MERGE (caribou:Entity {id: 'caribou-coffee'})
    SET caribou.name = 'Caribou Coffee', caribou.type = 'BRAND'
  MERGE (einstein:Entity {id: 'einstein-bros'})
    SET einstein.name = 'Einstein Bros. Bagels', einstein.type = 'BRAND'

  MERGE (krispy)-[:OWNED_BY {percentage: 100}]->(jab)
  MERGE (pret)-[:OWNED_BY {percentage: 100}]->(jab)
  MERGE (caribou)-[:OWNED_BY {percentage: 100}]->(jab)
  MERGE (einstein)-[:OWNED_BY {percentage: 100}]->(jab)

  MERGE (jersey:Entity {id: 'jersey-mikes'})
    SET jersey.name = "Jersey Mike's", jersey.type = 'BRAND'
  MERGE (jersey)-[:OWNED_BY {percentage: 100}]->(blackstone)

  MERGE (costco:Entity {id: 'costco'})
    SET costco.name = 'Costco', costco.type = 'BRAND'
  MERGE (innout:Entity {id: 'in-n-out'})
    SET innout.name = 'In-N-Out Burger', innout.type = 'BRAND'
  MERGE (cfa:Entity {id: 'chick-fil-a'})
    SET cfa.name = 'Chick-fil-A', cfa.type = 'BRAND'
  MERGE (chipotle:Entity {id: 'chipotle'})
    SET chipotle.name = 'Chipotle Mexican Grill', chipotle.type = 'BRAND'
  MERGE (mcd:Entity {id: 'mcdonalds'})
    SET mcd.name = "McDonald's", mcd.type = 'BRAND'
  MERGE (raising:Entity {id: 'raising-canes'})
    SET raising.name = "Raising Cane's", raising.type = 'BRAND'

  MERGE (c_roark:Citation {id: 'cite-roark'})
    SET c_roark.url = 'https://www.roarkcapital.com/about',
        c_roark.title = 'Roark Capital portfolio (official)'
  MERGE (c_subway:Citation {id: 'cite-subway-roark'})
    SET c_subway.url = 'https://www.restaurantbusinessonline.com/financing/roark-capital-gobbles-another-restaurant-chain',
        c_subway.title = 'Restaurant Business: Roark acquires Subway (2024)'
  MERGE (c_jab:Citation {id: 'cite-jab'})
    SET c_jab.url = 'https://en.wikipedia.org/wiki/JAB_Holding',
        c_jab.title = 'Wikipedia: JAB Holding Company'
  MERGE (c_blackstone:Citation {id: 'cite-jersey-mikes'})
    SET c_blackstone.url = 'https://www.blackstone.com/news/press/blackstone-acquires-majority-stake-in-jersey-mikes-subs/',
        c_blackstone.title = 'Blackstone: Jersey Mikes majority stake'
  MERGE (c_innout:Citation {id: 'cite-innout'})
    SET c_innout.url = 'https://en.wikipedia.org/wiki/In-N-Out_Burger',
        c_innout.title = 'Wikipedia: In-N-Out Burger (family-owned)'
  MERGE (c_cfa:Citation {id: 'cite-cfa'})
    SET c_cfa.url = 'https://en.wikipedia.org/wiki/Chick-fil-A',
        c_cfa.title = 'Wikipedia: Chick-fil-A (Cathy family)'
  MERGE (c_costco:Citation {id: 'cite-costco'})
    SET c_costco.url = 'https://en.wikipedia.org/wiki/Costco',
        c_costco.title = 'Wikipedia: Costco (public company)'

  MERGE (roark)-[:HAS_CITATION]->(c_roark)
  MERGE (subway)-[:HAS_CITATION]->(c_subway)
  MERGE (jab)-[:HAS_CITATION]->(c_jab)
  MERGE (jersey)-[:HAS_CITATION]->(c_blackstone)
  MERGE (innout)-[:HAS_CITATION]->(c_innout)
  MERGE (cfa)-[:HAS_CITATION]->(c_cfa)
  MERGE (costco)-[:HAS_CITATION]->(c_costco)

$$) AS (result agtype);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  4,
  'fupe_graph',
  'Expanded QSR seed: Roark/Inspire/GoTo, JAB, Blackstone portfolios + independent chains'
)
ON CONFLICT (version) DO NOTHING;
