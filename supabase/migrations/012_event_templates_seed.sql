-- Seed event templates for Phase 3c
INSERT INTO public.event_templates (slug, name, description, default_duration_min, default_bell_offset_min, menu_json, bring_json, theme_slug)
VALUES
  (
    'taco_night',
    'Taco night',
    'Classic taco night with all the fixings',
    120,
    15,
    '[{"title":"Tacos","items":[{"name":"Beef tacos","notes":"","dietaryTags":[]},{"name":"Chicken tacos","notes":"","dietaryTags":[]},{"name":"Veggie tacos","notes":"","dietaryTags":["vegetarian"]}]},{"title":"Sides","items":[{"name":"Rice","notes":"","dietaryTags":[]},{"name":"Beans","notes":"","dietaryTags":["vegan"]}]}]'::jsonb,
    '[{"name":"Tortillas","quantity":"1","category":"supplies","isRequired":true,"isClaimable":true,"notes":""},{"name":"Salsa","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Guacamole","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Drinks","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""}]'::jsonb,
    'taco_night'
  ),
  (
    'potluck',
    'Potluck',
    'Everyone brings a dish to share',
    180,
    0,
    '[{"title":"Potluck","items":[{"name":"Bring a dish to share","notes":"","dietaryTags":[]}]}]'::jsonb,
    '[{"name":"Main dish","quantity":"1","category":"other","isRequired":true,"isClaimable":true,"notes":""},{"name":"Side or salad","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Dessert","quantity":"1","category":"dessert","isRequired":false,"isClaimable":true,"notes":""},{"name":"Drinks","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""}]'::jsonb,
    'potluck'
  ),
  (
    'game_night',
    'Game night',
    'Dinner and games',
    180,
    30,
    '[{"title":"Dinner","items":[{"name":"Pizza or easy mains","notes":"","dietaryTags":[]}]},{"title":"Snacks","items":[{"name":"Chips and dip","notes":"","dietaryTags":[]}]}]'::jsonb,
    '[{"name":"Pizza","quantity":"1","category":"other","isRequired":false,"isClaimable":true,"notes":""},{"name":"Snacks","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Drinks","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""}]'::jsonb,
    'game_night'
  ),
  (
    'brunch',
    'Brunch',
    'Weekend brunch together',
    120,
    0,
    '[{"title":"Brunch","items":[{"name":"Eggs","notes":"","dietaryTags":[]},{"name":"Pastries","notes":"","dietaryTags":[]},{"name":"Fruit","notes":"","dietaryTags":["vegan"]}]}]'::jsonb,
    '[{"name":"Mimosas or juice","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""},{"name":"Pastries or bread","quantity":"1","category":"other","isRequired":false,"isClaimable":true,"notes":""},{"name":"Fruit","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""}]'::jsonb,
    'brunch'
  )
ON CONFLICT (slug) DO NOTHING;
