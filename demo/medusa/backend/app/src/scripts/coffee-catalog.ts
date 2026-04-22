/**
 * Aurelia demo catalog — 50 coffee + brewing-gear products.
 *
 * `kind` drives the variant shape at seed time:
 *   - "bean"     → Size (250 g / 1 kg) × Grind (Whole Bean / Ground)  = 4 variants
 *   - "hardware" → single "Standard" variant
 *
 * Prices are in minor units (cents) per Medusa v2 convention.
 */

export type CatalogItem = {
  title: string;
  handle: string;
  description: string;
  category: "Single Origin" | "Blends" | "Brewers" | "Grinders & Scales" | "Accessories";
  kind: "bean" | "hardware";
  image: string;
  // For hardware: price in EUR cents (USD = EUR + 25% for simplicity)
  // For beans: price is ignored (beans use the default bean-pricing table)
  priceEur?: number;
};

// Public product images hosted on picsum — deterministic seeds keep them stable
// across seed runs. Real demo would swap in branded coffee photography.
const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

export const coffeeCatalog: CatalogItem[] = [
  // ────── Single Origin (12) ───────────────────────────────────────────
  { title: "Ethiopian Yirgacheffe",   handle: "ethiopian-yirgacheffe",   category: "Single Origin", kind: "bean", image: img("yirgacheffe"), description: "Washed Yirgacheffe with bright floral aromatics, citrus acidity and a clean bergamot finish. Best brewed as pour-over." },
  { title: "Colombian Huila",         handle: "colombian-huila",         category: "Single Origin", kind: "bean", image: img("huila"),        description: "Balanced Andean coffee from the Huila highlands: caramel sweetness, red apple, milk chocolate body." },
  { title: "Brazilian Cerrado Santos",handle: "brazilian-cerrado",       category: "Single Origin", kind: "bean", image: img("cerrado"),      description: "Classic Brazilian profile. Chocolate, hazelnut and brown sugar. Low acidity and crema-rich for espresso." },
  { title: "Kenyan AA",               handle: "kenyan-aa",               category: "Single Origin", kind: "bean", image: img("kenyan-aa"),    description: "High-grown Kenyan with juicy blackcurrant, winey acidity and a sparkling finish." },
  { title: "Guatemalan Antigua",      handle: "guatemalan-antigua",      category: "Single Origin", kind: "bean", image: img("antigua"),      description: "Volcanic-soil Antigua coffee: cocoa, baking spice, and orange zest with full body." },
  { title: "Costa Rican Tarrazú",     handle: "costa-rican-tarrazu",     category: "Single Origin", kind: "bean", image: img("tarrazu"),      description: "Honey-processed Tarrazú with silky mouthfeel, almond, honey sweetness and citrus blossom." },
  { title: "Panamanian Geisha",       handle: "panamanian-geisha",       category: "Single Origin", kind: "bean", image: img("geisha"),       description: "Rare and floral Geisha varietal — jasmine, bergamot and white peach. Small batch, limited release." },
  { title: "Sumatran Mandheling",     handle: "sumatran-mandheling",     category: "Single Origin", kind: "bean", image: img("mandheling"),   description: "Wet-hulled Indonesian classic. Earthy and herbal with low acidity and a long tobacco finish." },
  { title: "Rwandan Bourbon",         handle: "rwandan-bourbon",         category: "Single Origin", kind: "bean", image: img("rwandan"),      description: "Natural-processed Bourbon varietal: red fruit, brown sugar and a cola-like finish." },
  { title: "Peruvian Chanchamayo",    handle: "peruvian-chanchamayo",    category: "Single Origin", kind: "bean", image: img("chanchamayo"),  description: "Organic shade-grown Chanchamayo. Gentle milk-chocolate and vanilla notes, very approachable." },
  { title: "Honduran San Marcos",     handle: "honduran-san-marcos",     category: "Single Origin", kind: "bean", image: img("honduran"),     description: "Medium-roast Honduran: toffee, orange and caramel. An easy daily drinker." },
  { title: "Nicaraguan Matagalpa",    handle: "nicaraguan-matagalpa",    category: "Single Origin", kind: "bean", image: img("matagalpa"),    description: "Balanced cup from Matagalpa: walnut, cocoa and dried fruit. Plays well with milk." },

  // ────── Blends (8) ───────────────────────────────────────────────────
  { title: "Aurelia House Blend",     handle: "house-blend",             category: "Blends",        kind: "bean", image: img("house-blend"),  description: "Our flagship medium roast. Chocolate, nut and citrus in balance — equally happy as pour-over or espresso." },
  { title: "Aurelia Espresso Blend",  handle: "espresso-blend",          category: "Blends",        kind: "bean", image: img("espresso"),     description: "Designed for espresso. Bold and creamy, with caramel sweetness and a dense crema." },
  { title: "Morning Glory Blend",     handle: "morning-glory",           category: "Blends",        kind: "bean", image: img("morning"),      description: "Light-medium breakfast blend. Bright, smooth and orange-forward." },
  { title: "Midnight Roast",          handle: "midnight-roast",          category: "Blends",        kind: "bean", image: img("midnight"),     description: "Full-bodied dark roast. Smoky, molasses-like and heavy — great with steamed milk." },
  { title: "Breakfast Blend",         handle: "breakfast-blend",         category: "Blends",        kind: "bean", image: img("breakfast"),    description: "Medium and sweet, with nutty tones. An easy-drinking morning cup." },
  { title: "Italian Espresso",        handle: "italian-espresso",        category: "Blends",        kind: "bean", image: img("italian"),      description: "Traditional dark Italian style. Intense, bittersweet, classic crema." },
  { title: "Mocha Java Blend",        handle: "mocha-java",              category: "Blends",        kind: "bean", image: img("mocha-java"),   description: "The classic Yemen–Java pairing reimagined: chocolate, fruit-forward, and bright on the finish." },
  { title: "Decaf House Blend",       handle: "decaf-house",             category: "Blends",        kind: "bean", image: img("decaf"),        description: "Swiss Water Process decaf with full body, caramel and gentle acidity. All of the flavour, none of the jitters." },

  // ────── Brewers (10) ─────────────────────────────────────────────────
  { title: "Hario V60 02 Ceramic (White)", handle: "hario-v60-02-ceramic", category: "Brewers", kind: "hardware", image: img("hario-v60"),    priceEur: 2800, description: "The icon of pour-over. Ceramic dripper, cone shape, single hole for full control of extraction." },
  { title: "Chemex Classic 6-Cup",        handle: "chemex-classic-6",      category: "Brewers", kind: "hardware", image: img("chemex"),       priceEur: 5200, description: "Hand-blown borosilicate glass pour-over brewer. Crystal-clear cup, no residue." },
  { title: "Aeropress Original",          handle: "aeropress-original",    category: "Brewers", kind: "hardware", image: img("aeropress"),    priceEur: 3800, description: "Immersion plus pressure brewer. Forgiving, fast, travel-ready." },
  { title: "Kalita Wave 185 (Stainless)", handle: "kalita-wave-185",       category: "Brewers", kind: "hardware", image: img("kalita"),       priceEur: 4200, description: "Flat-bottom pour-over with three holes — delivers a consistent extraction." },
  { title: "French Press 1L (Glass)",     handle: "french-press-1l",       category: "Brewers", kind: "hardware", image: img("french-press"), priceEur: 3200, description: "Classic immersion brewer. Full-bodied cups, the easiest way into home coffee." },
  { title: "Aeropress Go",                handle: "aeropress-go",          category: "Brewers", kind: "hardware", image: img("aeropress-go"), priceEur: 4200, description: "Travel-sized Aeropress with included mug. Fits in a backpack." },
  { title: "Hario Switch Immersion V60",  handle: "hario-switch",          category: "Brewers", kind: "hardware", image: img("switch"),       priceEur: 5600, description: "Hybrid dripper: pour-over and immersion brewing in one device." },
  { title: "Bialetti Moka Express 6",     handle: "bialetti-moka-6",       category: "Brewers", kind: "hardware", image: img("moka"),         priceEur: 3500, description: "Aluminium stovetop espresso maker. The Italian kitchen staple." },
  { title: "Bialetti Brikka 4",           handle: "bialetti-brikka-4",     category: "Brewers", kind: "hardware", image: img("brikka"),       priceEur: 4800, description: "Pressurised moka pot that produces a true crema — the stovetop answer to a barista espresso." },
  { title: "Hario NEXT Siphon 5-Cup",     handle: "hario-siphon",          category: "Brewers", kind: "hardware", image: img("siphon"),       priceEur: 12500, description: "Theatrical vacuum siphon brewer. Clean, bright cups and beautiful on the counter." },

  // ────── Grinders & Scales (8) ────────────────────────────────────────
  { title: "Comandante C40 MK4",            handle: "comandante-c40",   category: "Grinders & Scales", kind: "hardware", image: img("comandante"), priceEur: 28500, description: "Hand grinder with Nitro Blade steel burrs. The reference for manual grinding." },
  { title: "1Zpresso JX-Pro",               handle: "1zpresso-jx-pro",  category: "Grinders & Scales", kind: "hardware", image: img("1zpresso"),   priceEur: 19500, description: "Hand grinder with 48 mm conical burrs. Great range from espresso to French press." },
  { title: "Timemore C2",                   handle: "timemore-c2",      category: "Grinders & Scales", kind: "hardware", image: img("timemore-c2"),priceEur:  8500, description: "Entry-level hand grinder with surprising precision for the price." },
  { title: "Baratza Encore",                handle: "baratza-encore",   category: "Grinders & Scales", kind: "hardware", image: img("encore"),     priceEur: 16500, description: "Electric conical-burr workhorse for home brewing. 40 grind settings." },
  { title: "Fellow Ode Gen 2",              handle: "fellow-ode-gen2",  category: "Grinders & Scales", kind: "hardware", image: img("ode"),        priceEur: 32500, description: "Flat-burr electric grinder, brew-focused and gorgeous. Quiet and precise." },
  { title: "Hario Mini Slim+",              handle: "hario-mini-slim",  category: "Grinders & Scales", kind: "hardware", image: img("mini-slim"),  priceEur:  4900, description: "Compact travel grinder from Hario. Ceramic burrs, easy to pack." },
  { title: "Acaia Pearl S",                 handle: "acaia-pearl-s",    category: "Grinders & Scales", kind: "hardware", image: img("pearl-s"),    priceEur: 16900, description: "Fast-response coffee scale with app sync and multiple brewing modes." },
  { title: "Timemore Black Mirror Basic",   handle: "timemore-scale",   category: "Grinders & Scales", kind: "hardware", image: img("black-mirror"),priceEur:  5500, description: "Minimalist precision scale with built-in timer. 0.1 g resolution." },

  // ────── Accessories (12) ─────────────────────────────────────────────
  { title: "Aurelia Ceramic Mug 12oz",       handle: "aurelia-mug-12",       category: "Accessories", kind: "hardware", image: img("mug"),        priceEur: 1500, description: "Embossed Aurelia logo on a 12 oz ceramic mug. Stoneware, dishwasher-safe." },
  { title: "Aurelia Travel Tumbler 16oz",    handle: "aurelia-tumbler-16",   category: "Accessories", kind: "hardware", image: img("tumbler"),    priceEur: 2900, description: "Vacuum-insulated stainless tumbler. Keeps coffee hot for 6 hours." },
  { title: "Hario V60 02 Paper Filters 100ct", handle: "v60-filters-100",    category: "Accessories", kind: "hardware", image: img("v60-filter"), priceEur:  700, description: "Bleached paper filters for the Hario V60 02. Clean cup, fast flow." },
  { title: "Chemex Bonded Filters Square 100ct", handle: "chemex-filters-100", category: "Accessories", kind: "hardware", image: img("chemex-filter"), priceEur: 1600, description: "Square bonded filters for the 6-cup Chemex. Extra-thick for maximum clarity." },
  { title: "Aeropress Micro-Filters 350ct",  handle: "aeropress-filters-350",category: "Accessories", kind: "hardware", image: img("aero-filter"),priceEur: 1200, description: "Standard paper micro-filters for the Aeropress — enough for a year of daily brewing." },
  { title: "Fellow Stagg EKG Electric Kettle", handle: "fellow-stagg-ekg",   category: "Accessories", kind: "hardware", image: img("stagg-ekg"),  priceEur: 18500, description: "Variable-temperature 0.9 L gooseneck kettle. Precise pours for pour-over coffee." },
  { title: "Hario Buono Drip Kettle 1.2L",   handle: "hario-buono-kettle",   category: "Accessories", kind: "hardware", image: img("buono"),      priceEur: 5500, description: "Stovetop gooseneck kettle with a narrow spout for controlled pours." },
  { title: "Coffee Storage Canister 1lb",    handle: "coffee-canister-1lb",  category: "Accessories", kind: "hardware", image: img("canister"),   priceEur: 2400, description: "Airtight, UV-protected coffee canister. Keeps beans fresh for weeks." },
  { title: "Aurelia Canvas Tote",            handle: "aurelia-tote",         category: "Accessories", kind: "hardware", image: img("tote"),       priceEur: 1800, description: "Heavy-duty cotton canvas tote with the Aurelia wordmark." },
  { title: "Coffee Brewing Starter Kit",     handle: "starter-kit",          category: "Accessories", kind: "hardware", image: img("starter"),    priceEur: 6900, description: "V60 dripper, filters, scoop and glass server. Everything to start brewing at home." },
  { title: "Aurelia Cupping Spoon",          handle: "cupping-spoon",        category: "Accessories", kind: "hardware", image: img("spoon"),      priceEur: 1900, description: "Traditional stainless-steel cupping spoon. Essential kit for tasting flights." },
  { title: "Aurelia Barista Apron",          handle: "barista-apron",        category: "Accessories", kind: "hardware", image: img("apron"),      priceEur: 3900, description: "Heavy-duty cotton apron with leather accents. Because spills happen." },
];

// Bean pricing shared by all coffee products — keeps the seed deterministic
// without per-product overrides. Prices are integer minor units.
export const BEAN_PRICES: Record<"250g" | "1kg", { eur: number; usd: number }> = {
  "250g": { eur: 1800, usd: 2200 },
  "1kg":  { eur: 5500, usd: 6800 },
};

// Hardware USD price is derived from EUR price with a flat 25 % uplift —
// demo-only shortcut, not a real FX rule.
export const hardwareUsd = (eur: number) => Math.round(eur * 1.25);

export function skuFor(kind: "bean" | "hardware", handle: string, size?: string, grind?: string) {
  if (kind === "bean") {
    return `BEAN-${handle.toUpperCase()}-${size}-${(grind ?? "").toUpperCase().replace(/\s+/g, "")}`;
  }
  return `HW-${handle.toUpperCase()}`;
}
