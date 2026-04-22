import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { BEAN_PRICES, coffeeCatalog, hardwareUsd, skuFor } from "./coffee-catalog";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);
  const regionModuleService = container.resolve(Modules.REGION);

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  const existingRegions = await regionModuleService.listRegions({}, { take: 1 });
  if (existingRegions.length > 0) {
    logger.info(
      `Seed skipped: at least one region already present (e.g. "${existingRegions[0].name}"). Seed is idempotent.`
    );
    return;
  }

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        { currency_code: "eur", is_default: true },
        { currency_code: "usd" },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: defaultSalesChannel[0].id },
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Europe",
          currency_code: "eur",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "European Warehouse",
          address: {
            city: "Copenhagen",
            country_code: "DK",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [{ name: "Default Shipping Profile", type: "default" }],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "European Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Europe",
        geo_zones: countries.map((country_code) => ({
          country_code,
          type: "country" as const,
        })),
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          { currency_code: "usd", amount: 10 },
          { currency_code: "eur", amount: 10 },
          { region_id: region.id, amount: 10 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          { currency_code: "usd", amount: 15 },
          { currency_code: "eur", amount: 15 },
          { region_id: region.id, amount: 15 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: any = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: { type: "publishable" },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Webshop",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });

  // ──────────────────────────────────────────────────────────────────────
  // Aurelia coffee catalog
  // ──────────────────────────────────────────────────────────────────────
  logger.info("Seeding product categories...");
  const categoryNames = [
    "Single Origin",
    "Blends",
    "Brewers",
    "Grinders & Scales",
    "Accessories",
  ];
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: categoryNames.map((name) => ({ name, is_active: true })),
    },
  });
  const categoryByName = new Map(categoryResult.map((c: any) => [c.name, c.id]));

  logger.info(`Seeding ${coffeeCatalog.length} coffee products...`);
  const productsInput = coffeeCatalog.map((item) => {
    const categoryId = categoryByName.get(item.category);
    if (!categoryId) {
      throw new Error(`[seed] missing category "${item.category}" for ${item.handle}`);
    }
    const baseProduct = {
      title: item.title,
      handle: item.handle,
      description: item.description,
      status: ProductStatus.PUBLISHED,
      weight: item.kind === "bean" ? 250 : 800,
      shipping_profile_id: shippingProfile!.id,
      images: [{ url: item.image }],
      thumbnail: item.image,
      category_ids: [categoryId],
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    };

    if (item.kind === "bean") {
      const sizes = ["250g", "1kg"] as const;
      const grinds = ["Whole Bean", "Ground"] as const;
      return {
        ...baseProduct,
        options: [
          { title: "Size", values: [...sizes] },
          { title: "Grind", values: [...grinds] },
        ],
        variants: sizes.flatMap((size) =>
          grinds.map((grind) => ({
            title: `${size} / ${grind}`,
            sku: skuFor("bean", item.handle, size, grind),
            options: { Size: size, Grind: grind },
            prices: [
              { amount: BEAN_PRICES[size].eur, currency_code: "eur" },
              { amount: BEAN_PRICES[size].usd, currency_code: "usd" },
            ],
          }))
        ),
      };
    }

    // hardware
    const eur = item.priceEur!;
    return {
      ...baseProduct,
      options: [{ title: "Format", values: ["Standard"] }],
      variants: [
        {
          title: "Standard",
          sku: skuFor("hardware", item.handle),
          options: { Format: "Standard" },
          prices: [
            { amount: eur, currency_code: "eur" },
            { amount: hardwareUsd(eur), currency_code: "usd" },
          ],
        },
      ],
    };
  });

  await createProductsWorkflow(container).run({
    input: { products: productsInput },
  });

  logger.info("Seeding inventory levels...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = inventoryItems.map(
    (inventoryItem: any) => ({
      location_id: stockLocation.id,
      stocked_quantity: 1_000_000,
      inventory_item_id: inventoryItem.id,
    })
  );

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  });

  // ──────────────────────────────────────────────────────────────────────
  // Demo customers + orders
  //
  // These back the widget's "authenticated flow" demos (past orders,
  // saved addresses). Auth identities/passwords are intentionally NOT
  // seeded — that requires the auth emailpass provider and a richer
  // bootstrap; the widget demo falls back to anonymous mode gracefully.
  // ──────────────────────────────────────────────────────────────────────
  logger.info("Seeding demo customers...");
  const customerModuleService: any = container.resolve(Modules.CUSTOMER);
  const demoCustomers = await customerModuleService.createCustomers([
    {
      email: "alice.demo@aurelia-coffee.local",
      first_name: "Alice",
      last_name: "Demo",
      company_name: "Aurelia Demo Co.",
    },
    {
      email: "bob.demo@aurelia-coffee.local",
      first_name: "Bob",
      last_name: "Demo",
      company_name: "Aurelia Demo Co.",
    },
  ]);
  const [alice, bob] = demoCustomers;
  logger.info(`[seed] created demo customers: ${alice.email}, ${bob.email}`);

  logger.info("Seeding demo orders...");
  try {
    const orderModuleService: any = container.resolve(Modules.ORDER);

    const { data: allVariants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "sku", "title"],
    });
    const variantBySku = new Map<string, any>(
      allVariants.map((v: any) => [v.sku, v])
    );

    const orderSpecs: Array<{
      customer: any;
      items: Array<{ sku: string; qty: number; price: number; title: string }>;
    }> = [
      {
        customer: alice,
        items: [
          { sku: skuFor("bean", "ethiopian-yirgacheffe", "250g", "Whole Bean"), qty: 1, price: BEAN_PRICES["250g"].eur, title: "Ethiopian Yirgacheffe — 250g / Whole Bean" },
          { sku: skuFor("hardware", "hario-v60-02-ceramic"),                     qty: 1, price: 2800,                    title: "Hario V60 02 Ceramic (White)" },
        ],
      },
      {
        customer: alice,
        items: [
          { sku: skuFor("bean", "house-blend", "1kg", "Whole Bean"),             qty: 2, price: BEAN_PRICES["1kg"].eur,  title: "Aurelia House Blend — 1kg / Whole Bean" },
          { sku: skuFor("hardware", "v60-filters-100"),                           qty: 1, price:  700,                    title: "Hario V60 02 Paper Filters 100ct" },
        ],
      },
      {
        customer: bob,
        items: [
          { sku: skuFor("bean", "espresso-blend", "250g", "Ground"),             qty: 1, price: BEAN_PRICES["250g"].eur, title: "Aurelia Espresso Blend — 250g / Ground" },
          { sku: skuFor("hardware", "bialetti-moka-6"),                           qty: 1, price: 3500,                    title: "Bialetti Moka Express 6" },
        ],
      },
      {
        customer: bob,
        items: [
          { sku: skuFor("bean", "colombian-huila", "1kg", "Whole Bean"),         qty: 1, price: BEAN_PRICES["1kg"].eur,  title: "Colombian Huila — 1kg / Whole Bean" },
          { sku: skuFor("hardware", "fellow-stagg-ekg"),                          qty: 1, price: 18500,                   title: "Fellow Stagg EKG Electric Kettle" },
        ],
      },
    ];

    const orderDtos = orderSpecs.map((o) => {
      const items = o.items.map((i) => {
        const variant = variantBySku.get(i.sku);
        if (!variant) {
          throw new Error(`[seed] could not find variant for sku=${i.sku}`);
        }
        return {
          title: i.title,
          quantity: i.qty,
          unit_price: i.price,
          variant_id: variant.id,
        };
      });
      const subtotal = items.reduce((n, it) => n + it.unit_price * it.quantity, 0);
      return {
        email: o.customer.email,
        customer_id: o.customer.id,
        currency_code: "eur",
        region_id: region.id,
        sales_channel_id: defaultSalesChannel[0].id,
        items,
        subtotal,
        total: subtotal,
      };
    });

    await orderModuleService.createOrders(orderDtos);
    logger.info(`[seed] created ${orderDtos.length} demo orders.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(
      `[seed] could not create demo orders: ${msg}. Continuing — the widget's auth flow will still work in anonymous mode.`
    );
  }

  logger.info("Seed complete.");
}
