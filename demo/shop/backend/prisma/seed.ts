/**
 * Deterministic seed for the ATW Reference Shop.
 *
 * - 3 handwritten users (FR-005, Clarification Q2). Credentials in README.md.
 * - 20 handwritten coffee products. UUIDs derived via UUID v5 from a fixed
 *   namespace + handle, so re-running the seed is idempotent and produces
 *   the same ids across runs (Principle VIII — Reproducibility).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

// Fixed namespace UUID (generated once for this project; do not change).
const NAMESPACE = "6b8b4567-3270-4bd1-bf39-f1c5be89a421";

/** UUID v5 from a namespace + name (RFC 4122 §4.3). */
function uuidV5(namespace: string, name: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(nsBytes).update(name).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const SEEDED_USERS: Array<{ email: string; password: string; displayName: string }> = [
  { email: "alice@example.com", password: "alicepass", displayName: "Alice Rivera" },
  { email: "bob@example.com", password: "bobpass", displayName: "Bob Kimathi" },
  { email: "carla@example.com", password: "carlapass", displayName: "Carla Nguyen" },
];

const SEEDED_PRODUCTS: Array<{
  handle: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
}> = [
  {
    handle: "midnight-roast-1kg-whole",
    name: "Midnight Roast 1 kg whole bean",
    description:
      "Dark, syrupy, low-acid espresso blend roasted to bring out cocoa and dried-fig notes. Whole bean, 1 kg bag.",
    priceCents: 3400,
    imageUrl: "/products/midnight-roast-1kg-whole.jpg",
  },
  {
    handle: "midnight-roast-1kg-ground",
    name: "Midnight Roast 1 kg ground",
    description:
      "Dark, syrupy, low-acid espresso blend — pre-ground for espresso machines. 1 kg bag.",
    priceCents: 3400,
    imageUrl: "/products/midnight-roast-1kg-ground.jpg",
  },
  {
    handle: "midnight-roast-500g-whole",
    name: "Midnight Roast 500 g whole bean",
    description: "Half-kilo of the Midnight Roast flagship, whole bean.",
    priceCents: 1800,
    imageUrl: "/products/midnight-roast-500g-whole.jpg",
  },
  {
    handle: "ethiopian-yirgacheffe-500g",
    name: "Ethiopian Yirgacheffe 500 g",
    description:
      "Bright, floral single origin. Washed process. Jasmine and bergamot in the cup. Whole bean.",
    priceCents: 2200,
    imageUrl: "/products/ethiopian-yirgacheffe-500g.jpg",
  },
  {
    handle: "colombia-huila-500g",
    name: "Colombia Huila 500 g",
    description:
      "Balanced, medium-bodied single origin from the Huila region. Caramel and red-apple notes.",
    priceCents: 2000,
    imageUrl: "/products/colombia-huila-500g.jpg",
  },
  {
    handle: "guatemala-antigua-500g",
    name: "Guatemala Antigua 500 g",
    description:
      "Chocolate-forward, full-body classic from the Antigua volcanic soils. Whole bean.",
    priceCents: 2100,
    imageUrl: "/products/guatemala-antigua-500g.jpg",
  },
  {
    handle: "kenya-aa-500g",
    name: "Kenya AA 500 g",
    description:
      "Wine-like, black-currant single origin. Bright and complex. Whole bean.",
    priceCents: 2600,
    imageUrl: "/products/kenya-aa-500g.jpg",
  },
  {
    handle: "house-blend-1kg-whole",
    name: "House Blend 1 kg whole bean",
    description:
      "Medium roast, everyday drinker. Works for pour-over, French press, and drip. 1 kg.",
    priceCents: 2800,
    imageUrl: "/products/house-blend-1kg-whole.jpg",
  },
  {
    handle: "decaf-swiss-water-500g",
    name: "Decaf Swiss Water 500 g",
    description:
      "Chemical-free decaffeinated. Smooth, nutty, and sweet. Whole bean.",
    priceCents: 2400,
    imageUrl: "/products/decaf-swiss-water-500g.jpg",
  },
  {
    handle: "cold-brew-blend-1kg",
    name: "Cold Brew Blend 1 kg",
    description:
      "Coarse-friendly blend tuned for 16-hour steeps. Chocolate and molasses. Whole bean.",
    priceCents: 3000,
    imageUrl: "/products/cold-brew-blend-1kg.jpg",
  },
  {
    handle: "aeropress-travel-kit",
    name: "AeroPress Travel Kit",
    description:
      "Classic immersion-plus-pressure brewer with travel cap. Makes a single cup anywhere.",
    priceCents: 3900,
    imageUrl: "/products/aeropress-travel-kit.jpg",
  },
  {
    handle: "v60-pour-over-set",
    name: "V60 Pour-Over Set",
    description:
      "Ceramic V60 dripper, server, and 100-pack of filters. A complete pour-over starter.",
    priceCents: 4500,
    imageUrl: "/products/v60-pour-over-set.jpg",
  },
  {
    handle: "burr-grinder-manual",
    name: "Manual Burr Grinder",
    description:
      "Stainless-steel conical burr, adjustable grind size. Hand-cranked, travel-friendly.",
    priceCents: 6900,
    imageUrl: "/products/burr-grinder-manual.jpg",
  },
  {
    handle: "moka-pot-6cup",
    name: "Moka Pot 6-cup",
    description:
      "Classic Italian stovetop espresso maker. Aluminium, 6-cup capacity.",
    priceCents: 3200,
    imageUrl: "/products/moka-pot-6cup.jpg",
  },
  {
    handle: "double-wall-glass-mug",
    name: "Double-Wall Glass Mug (pair)",
    description:
      "Two 350 ml double-walled glass mugs. Keeps espresso hot and hands cool.",
    priceCents: 2400,
    imageUrl: "/products/double-wall-glass-mug.jpg",
  },
  {
    handle: "pour-over-kettle-1l",
    name: "Gooseneck Pour-Over Kettle 1 L",
    description:
      "Stovetop gooseneck kettle with 1-litre capacity. Essential for pour-over precision.",
    priceCents: 4800,
    imageUrl: "/products/pour-over-kettle-1l.jpg",
  },
  {
    handle: "barista-cleaning-tablets",
    name: "Espresso Machine Cleaning Tablets",
    description:
      "Food-safe descale + backflush tablets. 20-pack. Extends the life of home machines.",
    priceCents: 1800,
    imageUrl: "/products/barista-cleaning-tablets.jpg",
  },
  {
    handle: "chocolate-espresso-beans",
    name: "Dark Chocolate Espresso Beans 250 g",
    description:
      "Whole roasted espresso beans wrapped in dark chocolate. A snack-caffeine hybrid.",
    priceCents: 1200,
    imageUrl: "/products/chocolate-espresso-beans.jpg",
  },
  {
    handle: "coffee-scale-0.1g",
    name: "Coffee Scale (0.1 g precision)",
    description:
      "Pour-over scale with built-in timer. Precision to 0.1 g up to 3 kg.",
    priceCents: 3800,
    imageUrl: "/products/coffee-scale-0.1g.jpg",
  },
  {
    handle: "milk-frothing-pitcher",
    name: "Milk Frothing Pitcher 600 ml",
    description:
      "Stainless-steel pitcher for silky microfoam. 600 ml is the latte-art sweet spot.",
    priceCents: 1600,
    imageUrl: "/products/milk-frothing-pitcher.jpg",
  },
];

async function main(): Promise<void> {
  for (const u of SEEDED_USERS) {
    const id = uuidV5(NAMESPACE, "user:" + u.email);
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email.toLowerCase() },
      update: { displayName: u.displayName, passwordHash },
      create: {
        id,
        email: u.email.toLowerCase(),
        passwordHash,
        displayName: u.displayName,
      },
    });
  }

  for (const p of SEEDED_PRODUCTS) {
    const id = uuidV5(NAMESPACE, "product:" + p.handle);
    await prisma.product.upsert({
      where: { handle: p.handle },
      update: {
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        inStock: true,
      },
      create: {
        id,
        handle: p.handle,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        inStock: true,
      },
    });
  }

  console.log(
    `Seeded ${SEEDED_USERS.length} users and ${SEEDED_PRODUCTS.length} products.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
