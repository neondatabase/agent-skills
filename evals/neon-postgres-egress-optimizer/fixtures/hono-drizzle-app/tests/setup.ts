import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { categories, products, reviews } from "../src/db/schema";
import { $ } from "bun";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let databaseUrl: string;
let provisioned = false;

export async function provisionDatabase() {
  if (provisioned) return databaseUrl;

  if (process.env.DATABASE_URL) {
    databaseUrl = process.env.DATABASE_URL;
  } else {
    // claim create links its working directory and refuses an already linked one
    const dir = await mkdtemp(join(tmpdir(), "egress-eval-"));
    // Account credentials take precedence over the claimable project's identity
    const { NEON_API_KEY, NEON_PROFILE, ...env } = process.env;
    await $`bunx neon@latest claim create --no-env-pull`
      .cwd(dir)
      .env(env)
      .quiet();
    databaseUrl = (
      await $`bunx neon@latest connection-string`.cwd(dir).env(env).text()
    ).trim();
    process.env.DATABASE_URL = databaseUrl;
  }

  // Push schema using drizzle-kit
  await $`bunx drizzle-kit push --force`.env({
    ...process.env,
    DATABASE_URL: databaseUrl,
  });

  provisioned = true;
  return databaseUrl;
}

export function getTestDb() {
  const client = neon(databaseUrl);
  return drizzle({ client });
}

export async function seed() {
  const db = getTestDb();

  // Categories
  await db.insert(categories).values([
    { name: "Electronics", slug: "electronics" },
    { name: "Books", slug: "books" },
    { name: "Clothing", slug: "clothing" },
  ]);

  const description = `The latest model featuring a high-resolution display, long-lasting battery life, and premium build quality. Designed for professionals and enthusiasts alike, this product delivers exceptional performance across a wide range of tasks. The ergonomic design ensures comfort during extended use, while the advanced thermal management system keeps everything running smoothly. Package includes the main unit, charging cable, quick start guide, and a protective carrying case. Backed by a 2-year manufacturer warranty with worldwide coverage. For detailed specifications, compatibility information, and support resources, visit our product page.`;
  const rawPayload = {
    supplier: "TechDistributors Inc.",
    sku: "TD-2024-PRO-001",
    importedAt: "2025-11-14T08:30:00Z",
    source: "bulk-import-v3",
    originalListing: {
      title: "Professional Grade Equipment",
      htmlDescription:
        "<div class='product-detail'>" +
        "<p>Premium quality materials and construction. ".repeat(200) +
        "</p></div>",
      specifications: Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [
          `spec_${i}`,
          `value_${i}_${"detail".repeat(20)}`,
        ]),
      ),
      shippingMatrix: Array.from({ length: 100 }, (_, i) => ({
        region: `region_${i}`,
        carrier: `carrier_${i % 5}`,
        rate: (Math.random() * 50).toFixed(2),
        estimatedDays: Math.floor(Math.random() * 14) + 1,
      })),
    },
  };

  await db.insert(products).values([
    {
      name: "Laptop",
      price: "999.99",
      categoryId: 1,
      description,
      rawPayload,
      imageUrls: ["https://example.com/laptop.jpg"],
    },
    {
      name: "Phone",
      price: "699.99",
      categoryId: 1,
      description,
      rawPayload,
      imageUrls: ["https://example.com/phone.jpg"],
    },
    {
      name: "TypeScript Handbook",
      price: "29.99",
      categoryId: 2,
      description,
      rawPayload,
      imageUrls: ["https://example.com/ts-book.jpg"],
    },
    {
      name: "Winter Jacket",
      price: "149.99",
      categoryId: 3,
      description,
      rawPayload,
      imageUrls: ["https://example.com/jacket.jpg"],
    },
    {
      name: "Running Shoes",
      price: "89.99",
      categoryId: 3,
      description,
      rawPayload,
      imageUrls: ["https://example.com/shoes.jpg"],
    },
  ]);

  // Seed reviews
  await db.insert(reviews).values([
    { productId: 1, userName: "alice", rating: 5, body: "Great laptop!" },
    { productId: 1, userName: "bob", rating: 4, body: "Good value." },
    { productId: 1, userName: "charlie", rating: 3, body: "Decent." },
    { productId: 2, userName: "diana", rating: 5, body: "Love this phone." },
    { productId: 2, userName: "eve", rating: 4, body: "Nice screen." },
    { productId: 3, userName: "frank", rating: 5, body: "Excellent book." },
    { productId: 3, userName: "grace", rating: 4, body: "Very helpful." },
    { productId: 4, userName: "hank", rating: 3, body: "Runs small." },
    { productId: 5, userName: "iris", rating: 5, body: "Very comfortable." },
    { productId: 5, userName: "jack", rating: 4, body: "Good for running." },
  ]);
}

export async function cleanup() {
  const db = getTestDb();
  await db.execute(
    sql`TRUNCATE reviews, products, categories RESTART IDENTITY CASCADE`,
  );
}
