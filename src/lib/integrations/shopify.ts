import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import { requestJson } from "@/lib/integrations/http";
import { logger } from "@/lib/logger";
import { metric, type ReportPeriod } from "@/lib/reports/date-range";
import type {
  ProductPerformance,
  ShopifyMetrics,
  StoreChange,
  StorefrontFunnel,
  ThemeStatus,
  TrafficSlice,
} from "@/types/report";

type ShopifyOrder = {
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  lineItems: { edges: Array<{ node: { quantity: number; originalTotalSet: { shopMoney: { amount: string } }; product: { id: string; title: string } | null } }> };
};

const SHOP_QUERY = `query StoreDetails { shop { name ianaTimezone currencyCode } }`;
const ORDERS_QUERY = `query Orders($query: String!) {
  orders(first: 250, query: $query, sortKey: CREATED_AT) {
    nodes {
      totalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 100) {
        edges { node { quantity originalTotalSet { shopMoney { amount } } product { id title } } }
      }
    }
  }
}`;

const ANALYTICS_QUERY = `query Analytics($query: String!) {
  shopifyqlQuery(query: $query) {
    tableData { columns { name } rows }
    parseErrors
  }
}`;
const EVENTS_QUERY = `query StoreChanges($query: String!) {
  events(first: 100, query: $query, sortKey: CREATED_AT, reverse: true) {
    nodes { id action createdAt message ... on BasicEvent { subjectType } }
  }
}`;
const THEME_QUERY = `query LiveTheme { themes(first: 1, roles: [MAIN]) { nodes { name role updatedAt } } }`;

function endpoint(storeUrl: string) {
  const domain = new URL(storeUrl).hostname;
  return `https://${domain}/admin/api/2026-01/graphql.json`;
}

async function graphql<T>(storeUrl: string, token: string, query: string, variables?: Record<string, unknown>) {
  const response = await requestJson<ShopifyGraphQLResponse<T>>("shopify", endpoint(storeUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (response.errors?.length) throw new Error(response.errors[0].message);
  return response.data;
}

type ShopifyGraphQLResponse<T> = { data: T; errors?: Array<{ message: string }> };

export async function testShopifyConnection(storeUrl: string, token: string) {
  const data = await graphql<{ shop: { name: string; ianaTimezone: string; currencyCode: string } }>(storeUrl, token, SHOP_QUERY);
  return { name: data.shop.name, timezone: data.shop.ianaTimezone, currency: data.shop.currencyCode };
}

function queryFor(start: string, end: string) {
  return `created_at:>=${start.slice(0, 10)} created_at:<${end.slice(0, 10)}`;
}

async function periodMetrics(storeUrl: string, token: string, start: string, end: string) {
  const response = await graphql<{ orders: { nodes: ShopifyOrder[] } }>(storeUrl, token, ORDERS_QUERY, { query: queryFor(start, end) });
  const orders = response.orders.nodes;
  const products = new Map<string, ProductPerformance>();
  let revenue = 0;
  let currency = "USD";
  for (const order of orders) {
    revenue += Number(order.totalPriceSet.shopMoney.amount);
    currency = order.totalPriceSet.shopMoney.currencyCode;
    for (const edge of order.lineItems.edges) {
      const item = edge.node;
      if (!item.product) continue;
      const existing = products.get(item.product.id) ?? { id: item.product.id, title: item.product.title, revenue: 0, orders: 0 };
      existing.revenue += Number(item.originalTotalSet.shopMoney.amount);
      existing.orders += 1;
      products.set(item.product.id, existing);
    }
  }
  return { revenue, orders: orders.length, aov: orders.length ? revenue / orders.length : 0, currency, products: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5) };
}

type QlTable = { columns: Array<{ name: string }>; rows: unknown[] } | null;
type QlResponse = { shopifyqlQuery: { tableData: QlTable; parseErrors: string[] } };

/** Rows come back keyed by column name on some API versions and positionally on others. */
function toRecords(table: QlTable): Array<Record<string, string | null>> {
  if (!table) return [];
  const names = table.columns.map((column) => column.name);
  return table.rows.map((row) => {
    if (Array.isArray(row)) return Object.fromEntries(names.map((name, index) => [name, (row[index] ?? null) as string | null]));
    return row as Record<string, string | null>;
  });
}

async function runShopifyql(storeUrl: string, token: string, query: string) {
  const response = await graphql<QlResponse>(storeUrl, token, ANALYTICS_QUERY, { query });
  const { tableData, parseErrors } = response.shopifyqlQuery;
  if (parseErrors?.length) throw new Error(`ShopifyQL: ${parseErrors.join("; ")}`);
  return toRecords(tableData);
}

function number(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** ShopifyQL date bounds are inclusive, so UNTIL is the last day inside the period. */
function shopifyqlRange(start: string, end: string, timezone: string) {
  const lastDay = new Date(new Date(end).getTime() - 24 * 60 * 60 * 1000);
  const since = formatInTimeZone(new Date(start), timezone, "yyyy-MM-dd");
  const until = formatInTimeZone(lastDay, timezone, "yyyy-MM-dd");
  return `SINCE ${since} UNTIL ${until}`;
}

const FUNNEL_METRICS = "sessions, online_store_visitors, added_to_cart_rate, conversion_rate, checkout_conversion_rate, bounce_rate";

async function funnelTotals(storeUrl: string, token: string, range: string) {
  const [row] = await runShopifyql(storeUrl, token, `FROM sessions SHOW ${FUNNEL_METRICS} ${range}`);
  return row ?? {};
}

async function trafficBreakdown(storeUrl: string, token: string, range: string, dimension: string): Promise<TrafficSlice[]> {
  const rows = await runShopifyql(
    storeUrl,
    token,
    `FROM sessions SHOW sessions, conversion_rate GROUP BY ${dimension} ${range} ORDER BY sessions DESC LIMIT 6`,
  );
  return rows.map((row) => ({
    label: row[dimension] ?? "Unknown",
    sessions: number(row.sessions) ?? 0,
    conversionRate: number(row.conversion_rate),
  }));
}

/** Returns null when the store's app is missing `read_reports` rather than failing the whole source. */
async function fetchFunnel(storeUrl: string, token: string, period: ReportPeriod): Promise<StorefrontFunnel | null> {
  const currentRange = shopifyqlRange(period.current.start, period.current.end, period.timezone);
  const previousRange = shopifyqlRange(period.previous.start, period.previous.end, period.timezone);
  try {
    const [current, previous, byReferrerSource, byDeviceType] = await Promise.all([
      funnelTotals(storeUrl, token, currentRange),
      funnelTotals(storeUrl, token, previousRange),
      trafficBreakdown(storeUrl, token, currentRange, "referrer_source"),
      trafficBreakdown(storeUrl, token, currentRange, "session_device_type"),
    ]);
    const delta = (key: string) => metric(number(current[key]), number(previous[key]));
    return {
      sessions: delta("sessions"),
      onlineStoreVisitors: delta("online_store_visitors"),
      addedToCartRate: delta("added_to_cart_rate"),
      conversionRate: delta("conversion_rate"),
      checkoutConversionRate: delta("checkout_conversion_rate"),
      bounceRate: delta("bounce_rate"),
      byReferrerSource,
      byDeviceType,
    };
  } catch (error) {
    logger.warn({ err: error }, "shopify storefront analytics unavailable");
    return null;
  }
}

const TRACKED_SUBJECTS = new Set(["PRODUCT", "PRODUCT_VARIANT", "COLLECTION", "PAGE", "ARTICLE", "BLOG"]);

async function fetchStoreChanges(storeUrl: string, token: string, period: ReportPeriod): Promise<StoreChange[]> {
  try {
    const query = `created_at:>=${period.current.start.slice(0, 10)} created_at:<${period.current.end.slice(0, 10)}`;
    const response = await graphql<{ events: { nodes: Array<{ id: string; action: string; createdAt: string; message: string; subjectType?: string }> } }>(
      storeUrl,
      token,
      EVENTS_QUERY,
      { query },
    );
    return response.events.nodes
      .filter((event) => TRACKED_SUBJECTS.has(event.subjectType ?? ""))
      .map((event) => ({
        id: event.id,
        subject: event.subjectType ?? "UNKNOWN",
        action: event.action,
        message: event.message.replace(/<[^>]*>/g, "").trim(),
        occurredAt: event.createdAt,
      }));
  } catch (error) {
    logger.warn({ err: error }, "shopify store changes unavailable");
    return [];
  }
}

async function fetchThemeStatus(storeUrl: string, token: string): Promise<ThemeStatus | null> {
  try {
    const response = await graphql<{ themes: { nodes: ThemeStatus[] } }>(storeUrl, token, THEME_QUERY);
    return response.themes.nodes[0] ?? null;
  } catch (error) {
    logger.warn({ err: error }, "shopify theme status unavailable");
    return null;
  }
}

export async function fetchShopifyMetrics(storeUrl: string, token: string, period: ReportPeriod): Promise<ShopifyMetrics> {
  const [current, previous, funnel, storeChanges, theme] = await Promise.all([
    periodMetrics(storeUrl, token, period.current.start, period.current.end),
    periodMetrics(storeUrl, token, period.previous.start, period.previous.end),
    fetchFunnel(storeUrl, token, period),
    fetchStoreChanges(storeUrl, token, period),
    fetchThemeStatus(storeUrl, token),
  ]);
  return {
    currency: current.currency,
    revenue: metric(current.revenue, previous.revenue),
    orders: metric(current.orders, previous.orders),
    aov: metric(current.aov, previous.aov),
    conversionRate: funnel?.conversionRate ?? null,
    newCustomers: metric(null, null),
    returningCustomers: metric(null, null),
    refundRate: metric(null, null),
    topProducts: current.products,
    dailyRevenue: [],
    funnel,
    storeChanges,
    theme,
  };
}
