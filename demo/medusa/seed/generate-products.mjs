#!/usr/bin/env node
/**
 * T064 / US4 — Deterministic Aurelia product generator.
 *
 * Run: `node generate-products.mjs > products.json`
 * Output: 300 products (200 coffees + 100 gear) with a seeded PRNG so
 * the same invocation produces byte-identical JSON on every platform.
 */

// --- seeded PRNG (mulberry32) -----------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const sample = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
};

// --- data pools -------------------------------------------------------------
const ORIGINS = [
  { country: "Colombia", region: "Huila", iso: "CO", categories: ["cat_latam"] },
  { country: "Colombia", region: "Nariño", iso: "CO", categories: ["cat_latam"] },
  { country: "Colombia", region: "Tolima", iso: "CO", categories: ["cat_latam"] },
  { country: "Colombia", region: "Cauca", iso: "CO", categories: ["cat_latam"] },
  { country: "Ethiopia", region: "Yirgacheffe", iso: "ET", categories: ["cat_africa"] },
  { country: "Ethiopia", region: "Sidamo", iso: "ET", categories: ["cat_africa"] },
  { country: "Ethiopia", region: "Guji", iso: "ET", categories: ["cat_africa"] },
  { country: "Kenya", region: "Nyeri", iso: "KE", categories: ["cat_africa"] },
  { country: "Kenya", region: "Kirinyaga", iso: "KE", categories: ["cat_africa"] },
  { country: "Rwanda", region: "Rulindo", iso: "RW", categories: ["cat_africa"] },
  { country: "Burundi", region: "Kayanza", iso: "BI", categories: ["cat_africa"] },
  { country: "Brazil", region: "Cerrado Mineiro", iso: "BR", categories: ["cat_latam"] },
  { country: "Brazil", region: "Sul de Minas", iso: "BR", categories: ["cat_latam"] },
  { country: "Costa Rica", region: "Tarrazú", iso: "CR", categories: ["cat_latam"] },
  { country: "Costa Rica", region: "West Valley", iso: "CR", categories: ["cat_latam"] },
  { country: "Guatemala", region: "Huehuetenango", iso: "GT", categories: ["cat_latam"] },
  { country: "Guatemala", region: "Antigua", iso: "GT", categories: ["cat_latam"] },
  { country: "Honduras", region: "Marcala", iso: "HN", categories: ["cat_latam"] },
  { country: "Peru", region: "Cajamarca", iso: "PE", categories: ["cat_latam"] },
  { country: "El Salvador", region: "Apaneca", iso: "SV", categories: ["cat_latam"] },
  { country: "Nicaragua", region: "Jinotega", iso: "NI", categories: ["cat_latam"] },
  { country: "Panama", region: "Boquete", iso: "PA", categories: ["cat_latam"] },
  { country: "Bolivia", region: "Caranavi", iso: "BO", categories: ["cat_latam"] },
  { country: "Mexico", region: "Chiapas", iso: "MX", categories: ["cat_latam"] },
  { country: "Indonesia", region: "Sumatra Gayo", iso: "ID", categories: ["cat_asia"] },
  { country: "Indonesia", region: "Java", iso: "ID", categories: ["cat_asia"] },
  { country: "Timor-Leste", region: "Ermera", iso: "TL", categories: ["cat_asia"] },
  { country: "Papua New Guinea", region: "Sigri", iso: "PG", categories: ["cat_asia"] },
  { country: "Yemen", region: "Haraz", iso: "YE", categories: ["cat_asia"] },
  { country: "India", region: "Chikmagalur", iso: "IN", categories: ["cat_asia"] },
];

const PROCESSES = [
  { name: "Washed",   categoryId: "cat_washed" },
  { name: "Natural",  categoryId: "cat_natural" },
  { name: "Honey",    categoryId: "cat_honey" },
  { name: "Anaerobic Natural", categoryId: "cat_anaerobic" },
  { name: "Anaerobic Washed",  categoryId: "cat_anaerobic" },
  { name: "Carbonic Maceration", categoryId: "cat_anaerobic" },
  { name: "Black Honey", categoryId: "cat_honey" },
  { name: "Yellow Honey", categoryId: "cat_honey" },
];

const VARIETIES = [
  "Bourbon", "Caturra", "Typica", "Geisha", "SL28", "SL34", "Heirloom",
  "Catuai", "Mundo Novo", "Pacamara", "Kent", "S-795", "Ruiru 11",
  "Batian", "Pink Bourbon", "Yellow Bourbon", "Villa Sarchi", "Villalobos",
];

const NOTES_BY_PROFILE = {
  chocolate: ["cocoa", "milk chocolate", "dark chocolate", "cacao nib", "brownie"],
  nutty:     ["almond", "hazelnut", "walnut", "pecan", "praline"],
  citrus:    ["lemon zest", "orange peel", "grapefruit", "bergamot", "tangerine"],
  berry:     ["blueberry", "strawberry", "red currant", "raspberry", "blackberry"],
  stone:     ["peach", "apricot", "plum", "cherry", "nectarine"],
  tropical:  ["pineapple", "mango", "passion fruit", "lychee", "guava"],
  floral:    ["jasmine", "bergamot flower", "lavender", "rose hip", "orange blossom"],
  spiced:    ["cinnamon", "clove", "cardamom", "baker's spice", "black pepper"],
  sweet:     ["honey", "panela", "brown sugar", "caramel", "molasses"],
  malty:     ["malt", "toasted grain", "biscuit", "shortbread"],
};

const PROFILES = Object.keys(NOTES_BY_PROFILE);

const BLEND_SIZES = ["250g", "500g", "1kg"];
const ROAST_LEVELS = ["Light", "Medium-Light", "Medium", "Medium-Dark"];
const FORMATS = ["whole bean", "filter grind", "espresso grind"];

// Fixed hero products referenced from orders.json.
const HERO_PRODUCTS = [
  {
    id: "prod_col_huila_001",
    handle: "colombia-huila-pulped-natural",
    title: "Colombia Huila — Pulped Natural",
    description:
      "Hand-thrown harvest from Finca La Esperanza in Acevedo, Huila. Pulped-natural process dries the mucilage-coated parchment on raised beds for 18 days, lending a soft, panela-like sweetness and a cocoa-heavy finish. Tastes of red cherry, cocoa, panela.",
    category_ids: ["cat_single_origin", "cat_natural", "cat_latam"],
    collection_ids: ["col_chocolate_notes", "col_best_sellers"],
    origin_country: "CO",
    material: "Arabica — Caturra, Colombia varieties",
    process: "Pulped Natural",
    variety: "Caturra, Colombia",
    flavor_notes: ["red cherry", "cocoa", "panela"],
    roast_level: "Medium-Light",
    variants: [
      { handle: "250g", title: "250g whole bean", sku: "COL-HUI-001-250",  inventory_quantity: 80, price: 1990 },
      { handle: "1kg",  title: "1kg whole bean",  sku: "COL-HUI-001-1000", inventory_quantity: 25, price: 6990 },
    ],
  },
  {
    id: "prod_eth_yirga_001",
    handle: "ethiopia-yirgacheffe-washed",
    title: "Ethiopia Yirgacheffe — Washed",
    description:
      "Heirloom varieties grown above 2,000 m in Yirgacheffe. Fully washed, soaked 36 h, sun-dried on raised African beds. Delicate, tea-like body with jasmine florals and bergamot brightness. Tastes of jasmine, bergamot, lemon zest.",
    category_ids: ["cat_single_origin", "cat_washed", "cat_africa", "cat_filter"],
    collection_ids: ["col_filter_focus", "col_new_arrivals"],
    origin_country: "ET",
    material: "Arabica — Heirloom",
    process: "Washed",
    variety: "Heirloom",
    flavor_notes: ["jasmine", "bergamot", "lemon zest"],
    roast_level: "Light",
    variants: [
      { handle: "250g", title: "250g whole bean", sku: "ETH-YIR-001-250", inventory_quantity: 60, price: 2390 },
    ],
  },
  {
    id: "prod_ken_karundul_001",
    handle: "kenya-karundul-sl28",
    title: "Kenya Karundul AA — SL28",
    description:
      "AA-screen SL28 from Karundul Factory, Nyeri. Long wet fermentation and extended soak produce an intense blackcurrant-and-tomato profile with a syrupy body. Tastes of blackcurrant, tomato, brown sugar.",
    category_ids: ["cat_single_origin", "cat_washed", "cat_africa"],
    collection_ids: ["col_microlots", "col_fruit_forward"],
    origin_country: "KE",
    material: "Arabica — SL28",
    process: "Washed",
    variety: "SL28",
    flavor_notes: ["blackcurrant", "tomato", "brown sugar"],
    roast_level: "Medium-Light",
    variants: [
      { handle: "250g", title: "250g whole bean", sku: "KEN-KAR-001-250", inventory_quantity: 40, price: 2490 },
    ],
  },
  {
    id: "prod_kettle_copper_001",
    handle: "copper-pour-over-kettle",
    title: "Copper Pour-Over Kettle — 900 ml",
    description:
      "Polished copper kettle with a swan-neck spout for precise pour control. Capacity 900 ml; stovetop-safe on gas and electric; not induction-compatible. Hand-spun in Spain.",
    category_ids: ["cat_kettles", "cat_manual_brewers"],
    collection_ids: ["col_best_sellers"],
    material: "Copper with walnut handle",
    variants: [
      { handle: "default", title: "900 ml — Copper", sku: "KTL-COP-001", inventory_quantity: 30, price: 820 },
    ],
  },
  {
    id: "prod_filter_v60_001",
    handle: "ceramic-v60-dripper-01",
    title: "Ceramic V60 Dripper — Size 01",
    description:
      "Classic 60° conical dripper in white ceramic. Size 01 brews one to two cups. Pairs with V60-01 paper filters.",
    category_ids: ["cat_manual_brewers"],
    collection_ids: ["col_starter_packs"],
    material: "Ceramic",
    variants: [
      { handle: "01", title: "Size 01 — White", sku: "V60-CER-01-WHT", inventory_quantity: 50, price: 990 },
    ],
  },
];

// --- generators -------------------------------------------------------------
function pricePoints(base) {
  return {
    "250g": base,
    "500g": Math.round(base * 1.9),
    "1kg":  Math.round(base * 3.5),
  };
}

function flavorNotesForOrigin(origin) {
  // Each origin has characteristic profiles; we bias the selection.
  const weights = {
    Ethiopia: ["floral", "citrus", "berry", "stone"],
    Kenya:    ["berry", "citrus", "sweet"],
    Rwanda:   ["berry", "floral", "stone"],
    Burundi:  ["berry", "citrus"],
    Colombia: ["chocolate", "nutty", "stone", "sweet"],
    Brazil:   ["chocolate", "nutty", "malty", "sweet"],
    "Costa Rica": ["citrus", "stone", "sweet", "chocolate"],
    Guatemala:["chocolate", "nutty", "stone"],
    Honduras: ["chocolate", "sweet", "nutty"],
    Peru:     ["chocolate", "nutty", "sweet"],
    "El Salvador": ["chocolate", "stone", "sweet"],
    Nicaragua:["chocolate", "nutty", "sweet"],
    Panama:   ["floral", "stone", "tropical"],
    Bolivia:  ["chocolate", "nutty", "sweet"],
    Mexico:   ["chocolate", "nutty", "spiced"],
    Indonesia:["malty", "spiced", "chocolate"],
    "Timor-Leste": ["chocolate", "nutty", "spiced"],
    "Papua New Guinea": ["stone", "nutty", "chocolate"],
    Yemen:    ["spiced", "berry", "chocolate"],
    India:    ["spiced", "chocolate", "nutty"],
  };
  const profiles = weights[origin.country] ?? PROFILES;
  const chosen = sample(profiles, Math.max(2, Math.min(3, Math.floor(rng() * 3) + 2)));
  const notes = [];
  for (const p of chosen) {
    notes.push(pick(NOTES_BY_PROFILE[p]));
  }
  return notes;
}

function roastForProcess(process) {
  if (process.name.includes("Anaerobic") || process.name.includes("Carbonic")) {
    return pick(["Light", "Medium-Light"]);
  }
  if (process.name === "Natural") return pick(["Medium-Light", "Medium"]);
  return pick(ROAST_LEVELS);
}

function makeCoffee(index) {
  const origin = pick(ORIGINS);
  const process = pick(PROCESSES);
  const variety = pick(VARIETIES);
  const flavorNotes = flavorNotesForOrigin(origin);
  const roast = roastForProcess(process);
  const id = `prod_coffee_${String(index).padStart(3, "0")}`;
  const lotWord = pick(["Microlot", "Lot", "Harvest", "Parcel", "Reserve", "Cosecha"]);
  const farm = pick([
    "Finca La Esperanza", "Finca San Antonio", "Estate Hillside",
    "Cooperativa El Paraíso", "Finca Las Nubes", "Wote Concession",
    "Finca El Roble", "Cooperativa Los Pinos", "Estate del Sol",
    "Finca La Palma", "Cooperativa Santa María", "Estate La Aurora",
  ]);
  const title = `${origin.country} ${origin.region} — ${process.name} ${variety}`;
  const handle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + `-${String(index).padStart(3, "0")}`;
  const basePrice = 1690 + Math.floor(rng() * 1400);
  const prices = pricePoints(basePrice);
  const variants = BLEND_SIZES.filter(() => rng() > 0.25).map((size) => ({
    handle: size,
    title: `${size} whole bean`,
    sku: `${origin.iso}-${origin.region.slice(0, 3).toUpperCase()}-${String(index).padStart(3, "0")}-${size.replace("g", "").replace("kg", "000")}`,
    inventory_quantity: 5 + Math.floor(rng() * 80),
    price: prices[size],
  }));
  if (variants.length === 0) {
    variants.push({
      handle: "250g",
      title: "250g whole bean",
      sku: `${origin.iso}-${origin.region.slice(0, 3).toUpperCase()}-${String(index).padStart(3, "0")}-250`,
      inventory_quantity: 20,
      price: prices["250g"],
    });
  }

  const category_ids = [
    "cat_single_origin",
    process.categoryId,
    ...origin.categories,
  ];
  if (flavorNotes.some((n) => /cocoa|chocolate|brownie|cacao/.test(n))) {
    category_ids.push("cat_filter");
  }

  const collectionOptions = ["col_microlots", "col_new_arrivals", "col_filter_focus",
    "col_chocolate_notes", "col_fruit_forward", "col_limited_releases",
    "col_cup_of_excellence", "col_best_sellers"];
  const collection_ids = sample(collectionOptions, 1 + Math.floor(rng() * 2));

  const description = `${lotWord} harvest from ${farm} in ${origin.region}, ${origin.country}. ${process.name} process. Variety: ${variety}. Cupping notes: ${flavorNotes.join(", ")}. Recommended roast: ${roast.toLowerCase()}.`;

  return {
    id,
    handle,
    title,
    description,
    category_ids,
    collection_ids,
    origin_country: origin.iso,
    material: `Arabica — ${variety}`,
    process: process.name,
    variety,
    flavor_notes: flavorNotes,
    roast_level: roast,
    variants,
  };
}

function makeBlend(index) {
  const id = `prod_blend_${String(index).padStart(3, "0")}`;
  const themes = [
    { name: "Hearth",         notes: ["cocoa", "hazelnut", "caramel"],      roast: "Medium" },
    { name: "Lighthouse",     notes: ["bergamot", "stone fruit", "honey"],   roast: "Medium-Light" },
    { name: "Iron Gate",      notes: ["cocoa nib", "fig", "black pepper"],   roast: "Medium-Dark" },
    { name: "Evenfall",       notes: ["caramel", "almond", "shortbread"],    roast: "Medium" },
    { name: "Aurora",         notes: ["raspberry", "cocoa", "orange peel"],  roast: "Medium-Light" },
    { name: "North Star",     notes: ["chocolate", "toffee", "walnut"],      roast: "Medium" },
    { name: "Dawn Chorus",    notes: ["jasmine", "apricot", "honey"],        roast: "Light" },
    { name: "Tidepool",       notes: ["blackberry", "cocoa", "brown sugar"], roast: "Medium-Light" },
    { name: "Cellar",         notes: ["dark chocolate", "prune", "clove"],   roast: "Medium-Dark" },
    { name: "Meridian",       notes: ["milk chocolate", "hazelnut", "malt"], roast: "Medium" },
  ];
  const theme = themes[index % themes.length];
  const basePrice = 1890 + Math.floor(rng() * 700);
  const prices = pricePoints(basePrice);
  const useEspresso = rng() > 0.35;
  const title = `${theme.name} ${useEspresso ? "Espresso" : "Blend"}`;
  const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `-${String(index).padStart(3, "0")}`;
  const description = `Seasonal ${useEspresso ? "espresso " : ""}blend balancing ${sample(["Colombia", "Brazil", "Ethiopia", "Guatemala", "Costa Rica", "Honduras"], 3).join(", ")}. Cupping notes: ${theme.notes.join(", ")}. Recommended roast: ${theme.roast.toLowerCase()}.`;
  const variants = BLEND_SIZES.map((size) => ({
    handle: size,
    title: `${size} whole bean`,
    sku: `BLEND-${theme.name.slice(0, 3).toUpperCase()}-${String(index).padStart(3, "0")}-${size.replace("g", "").replace("kg", "000")}`,
    inventory_quantity: 20 + Math.floor(rng() * 100),
    price: prices[size],
  }));
  return {
    id,
    handle,
    title,
    description,
    category_ids: useEspresso ? ["cat_blends", "cat_espresso"] : ["cat_blends", "cat_filter"],
    collection_ids: sample(["col_seasonal_espresso", "col_best_sellers", "col_chocolate_notes", "col_starter_packs"], 1 + Math.floor(rng() * 2)),
    origin_country: null,
    material: "Arabica blend",
    process: "Blend",
    variety: "Multi-origin",
    flavor_notes: theme.notes,
    roast_level: theme.roast,
    variants,
  };
}

function makeDecaf(index) {
  const id = `prod_decaf_${String(index).padStart(3, "0")}`;
  const methods = ["Swiss Water", "Mountain Water", "Ethyl Acetate (sugar-cane)", "CO₂ Supercritical"];
  const method = pick(methods);
  const origin = pick([ORIGINS[0], ORIGINS[7], ORIGINS[11], ORIGINS[15]]);
  const title = `${origin.country} ${origin.region} Decaf — ${method}`;
  const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `-${String(index).padStart(3, "0")}`;
  const notes = ["milk chocolate", "toffee", "almond"].concat(sample(["orange peel", "dried apple", "brown sugar"], 1));
  const basePrice = 2090;
  const prices = pricePoints(basePrice);
  return {
    id,
    handle,
    title,
    description: `Decaffeinated via ${method}. Origin: ${origin.region}, ${origin.country}. Cupping notes: ${notes.join(", ")}.`,
    category_ids: ["cat_decaf", "cat_single_origin"],
    collection_ids: ["col_low_caffeine"],
    origin_country: origin.iso,
    material: "Arabica",
    process: `Decaf — ${method}`,
    variety: "Multiple",
    flavor_notes: notes,
    roast_level: "Medium",
    variants: BLEND_SIZES.slice(0, 2).map((size) => ({
      handle: size,
      title: `${size} whole bean`,
      sku: `DECAF-${origin.iso}-${String(index).padStart(3, "0")}-${size.replace("g", "").replace("kg", "000")}`,
      inventory_quantity: 25,
      price: prices[size],
    })),
  };
}

function makeGear(index) {
  const templates = [
    { kind: "grinder",     title: "Hand Grinder",          cat: ["cat_grinders"],                          price: 9900, mat: "Stainless steel + walnut" },
    { kind: "grinder",     title: "Flat-Burr Electric Grinder", cat: ["cat_grinders"],                    price: 34900, mat: "Aluminum + titanium-coated steel burrs" },
    { kind: "brewer",      title: "Glass V60 Dripper — 02", cat: ["cat_manual_brewers"],                   price: 1290, mat: "Heat-resistant glass" },
    { kind: "brewer",      title: "AeroPress",             cat: ["cat_manual_brewers"],                    price: 3490, mat: "Polypropylene" },
    { kind: "brewer",      title: "Chemex 6-cup",          cat: ["cat_manual_brewers"],                    price: 4290, mat: "Borosilicate glass" },
    { kind: "brewer",      title: "Kalita Wave 185",       cat: ["cat_manual_brewers"],                    price: 2890, mat: "Stainless steel" },
    { kind: "brewer",      title: "Moka Pot — 3 cup",      cat: ["cat_manual_brewers", "cat_espresso"],   price: 2490, mat: "Aluminum" },
    { kind: "brewer",      title: "French Press — 350ml",  cat: ["cat_manual_brewers"],                    price: 2290, mat: "Borosilicate glass + steel" },
    { kind: "kettle",      title: "Gooseneck Electric Kettle", cat: ["cat_kettles"],                      price: 7900, mat: "Stainless steel" },
    { kind: "kettle",      title: "Stovetop Whistling Kettle", cat: ["cat_kettles"],                       price: 4200, mat: "Stainless steel" },
    { kind: "filter",      title: "V60 Paper Filters — 100 pack", cat: ["cat_filters_paper"],              price: 690,  mat: "Unbleached paper" },
    { kind: "filter",      title: "Chemex Paper Filters — 50 pack", cat: ["cat_filters_paper"],            price: 890,  mat: "Bleached paper" },
    { kind: "filter",      title: "AeroPress Filters — 350 pack", cat: ["cat_filters_paper"],              price: 490,  mat: "Paper" },
    { kind: "scale",       title: "Pour-Over Scale — 2 kg", cat: ["cat_scales"],                          price: 4900, mat: "Glass + silicone" },
    { kind: "scale",       title: "Espresso Scale — 0.1 g",cat: ["cat_scales"],                           price: 5900, mat: "Silicone + steel" },
    { kind: "mug",         title: "Ceramic Cupping Bowl",  cat: ["cat_mugs"],                              price: 690,  mat: "Ceramic" },
    { kind: "mug",         title: "Double-Wall Espresso Cup",  cat: ["cat_mugs", "cat_espresso"],          price: 1290, mat: "Double-wall glass" },
    { kind: "mug",         title: "Porcelain Pour-Over Mug",  cat: ["cat_mugs"],                           price: 890,  mat: "Porcelain" },
    { kind: "storage",     title: "Airtight Coffee Canister", cat: ["cat_storage"],                        price: 1990, mat: "Stainless steel + silicone" },
    { kind: "storage",     title: "Vacuum-Seal Coffee Vault", cat: ["cat_storage"],                        price: 3990, mat: "Anodized aluminum" },
    { kind: "cleaning",    title: "Group-Head Cleaning Tablets — 60", cat: ["cat_cleaning"],               price: 1290, mat: "Food-safe cleaning" },
    { kind: "cleaning",    title: "Brush Set — 3 pcs",    cat: ["cat_cleaning", "cat_barista_tools"],     price: 890,  mat: "Natural bristle + wood" },
    { kind: "barista_tool",title: "Tamper — 58 mm",       cat: ["cat_barista_tools", "cat_espresso"],    price: 2490, mat: "Stainless steel + walnut" },
    { kind: "barista_tool",title: "WDT Tool",             cat: ["cat_barista_tools", "cat_espresso"],    price: 1690, mat: "Stainless steel" },
    { kind: "gift_set",    title: "Starter Gift Set",     cat: ["cat_gift_sets"],                        price: 8900, mat: "Curated selection" },
    { kind: "gift_set",    title: "Brew Master Gift Set", cat: ["cat_gift_sets"],                        price: 14900, mat: "Curated selection" },
    { kind: "subscription",title: "Monthly Single-Origin Subscription", cat: ["cat_subscriptions"],       price: 2290, mat: "Rotating origins" },
    { kind: "subscription",title: "Espresso Blend Subscription",        cat: ["cat_subscriptions"],       price: 2090, mat: "Rotating blends" },
  ];
  const t = templates[index % templates.length];
  const suffix = index >= templates.length ? ` (Variant ${Math.floor(index / templates.length) + 1})` : "";
  const id = `prod_gear_${String(index).padStart(3, "0")}`;
  const title = t.title + suffix;
  const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `-${String(index).padStart(3, "0")}`;
  return {
    id,
    handle,
    title,
    description: `${t.title}. Material: ${t.mat}. Part of the Aurelia brewing-tool lineup.`,
    category_ids: t.cat,
    collection_ids: sample(["col_best_sellers", "col_gift_ready", "col_starter_packs"], 1),
    origin_country: null,
    material: t.mat,
    process: t.kind,
    variety: null,
    flavor_notes: [],
    roast_level: null,
    variants: [
      {
        handle: "default",
        title: "Standard",
        sku: `GEAR-${t.kind.slice(0, 3).toUpperCase()}-${String(index).padStart(3, "0")}`,
        inventory_quantity: 15 + Math.floor(rng() * 80),
        price: t.price,
      },
    ],
  };
}

// --- emit -------------------------------------------------------------------
const products = [...HERO_PRODUCTS];

const HERO_IDS = new Set(HERO_PRODUCTS.map((p) => p.id));

// 160 single-origins + 40 blends + 10 decaf + 90 gear = 300
let nextIdx = 1;
for (let i = 0; i < 160; i++) {
  const p = makeCoffee(nextIdx++);
  if (!HERO_IDS.has(p.id)) products.push(p);
}
for (let i = 0; i < 40; i++) {
  const p = makeBlend(i + 1);
  if (!HERO_IDS.has(p.id)) products.push(p);
}
for (let i = 0; i < 10; i++) {
  const p = makeDecaf(i + 1);
  if (!HERO_IDS.has(p.id)) products.push(p);
}
for (let i = 0; i < 90; i++) {
  const p = makeGear(i + 1);
  if (!HERO_IDS.has(p.id)) products.push(p);
}

// Ensure exactly 300.
const output = products.slice(0, 300);
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
