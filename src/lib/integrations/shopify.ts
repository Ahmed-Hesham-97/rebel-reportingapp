import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import { requestJson } from "@/lib/integrations/http";
import { isValidShopDomain, toShopDomain } from "@/lib/integrations/shopify-oauth";
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
  createdAt: string;
  displayFinancialStatus?: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  totalRefundedSet?: { shopMoney: { amount: string } } | null;
  customer?: { id: string; numberOfOrders: number; createdAt: string } | null;
  lineItems: { edges: Array<{ node: { quantity: number; originalTotalSet: { shopMoney: { amount: string } }; product: { id: string; title: string } | null } }> };
};

const SHOP_QUERY = `query StoreDetails { shop { name ianaTimezone currencyCode } }`;
const ORDERS_QUERY = `query Orders($query: String!, $cursor: String) {
  orders(first: 250, query: $query, sortKey: CREATED_AT, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      createdAt
      displayFinancialStatus
      totalPriceSet { shopMoney { amount currencyCode } }
      totalRefundedSet { shopMoney { amount } }
      customer { id numberOfOrders createdAt }
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
  const domain = toShopDomain(storeUrl);
  if (!isValidShopDomain(domain)) {
    throw new Error(`Shopify store URL must resolve to a myshopify.com domain (got "${storeUrl}").`);
  }
  return `https://${domain}/admin/api/2026-01/graphql.json`;
}

async function graphql<T>(storeUrl: string, token: string, query: string, variables?: Record<string, unknown>) {
  const response = await requestJson<ShopifyGraphQLResponse<T>>("shopify", endpoint(storeUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token.trim(),
    },
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

function queryFor(start: string, end: string, timezone: string) {
  // Must use shop-calendar dates — ISO slice(0,10) shifts a day for UTC+ shops.
  const since = formatInTimeZone(new Date(start), timezone, "yyyy-MM-dd");
  const until = formatInTimeZone(new Date(end), timezone, "yyyy-MM-dd");
  return `status:any created_at:>=${since} created_at:<${until}`;
}

async function fetchOrders(storeUrl: string, token: string, start: string, end: string, timezone: string) {
  const query = queryFor(start, end, timezone);
  const nodes: ShopifyOrder[] = [];
  let cursor: string | null = null;
  type OrdersPage = { orders: { nodes: ShopifyOrder[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };
  // Cap pages so a huge store cannot blow the report timeout; 5×250 covers typical months.
  for (let page = 0; page < 5; page++) {
    const response: OrdersPage = await graphql<OrdersPage>(storeUrl, token, ORDERS_QUERY, { query, cursor });
    nodes.push(...response.orders.nodes);
    if (!response.orders.pageInfo.hasNextPage) break;
    cursor = response.orders.pageInfo.endCursor;
  }
  return nodes;
}

function isNewCustomer(order: ShopifyOrder, periodStart: string) {
  const customer = order.customer;
  if (!customer) return false;
  if (customer.numberOfOrders <= 1) return true;
  return new Date(customer.createdAt).getTime() >= new Date(periodStart).getTime();
}

async function periodMetrics(storeUrl: string, token: string, start: string, end: string, timezone: string) {
  const orders = await fetchOrders(storeUrl, token, start, end, timezone);
  const products = new Map<string, ProductPerformance>();
  const customerIds = new Set<string>();
  let revenue = 0;
  let refunded = 0;
  let newCustomers = 0;
  let returningCustomers = 0;
  let currency = "USD";
  for (const order of orders) {
    revenue += Number(order.totalPriceSet.shopMoney.amount);
    refunded += Number(order.totalRefundedSet?.shopMoney.amount ?? 0);
    currency = order.totalPriceSet.shopMoney.currencyCode;
    const customerId = order.customer?.id;
    if (customerId && !customerIds.has(customerId)) {
      customerIds.add(customerId);
      if (isNewCustomer(order, start)) newCustomers += 1;
      else returningCustomers += 1;
    }
    for (const edge of order.lineItems.edges) {
      const item = edge.node;
      if (!item.product) continue;
      const existing = products.get(item.product.id) ?? { id: item.product.id, title: item.product.title, revenue: 0, orders: 0 };
      existing.revenue += Number(item.originalTotalSet.shopMoney.amount);
      existing.orders += 1;
      products.set(item.product.id, existing);
    }
  }
  return {
    revenue,
    orders: orders.length,
    aov: orders.length ? revenue / orders.length : 0,
    refundRate: revenue > 0 ? (refunded / revenue) * 100 : 0,
    newCustomers,
    returningCustomers,
    currency,
    products: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    nodes: orders,
  };
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

/** ShopifyQL PERCENT metrics arrive as decimals (0.25 = 25%). Store as display percentages. */
function ratePercent(value: string | null | undefined) {
  const parsed = number(value);
  if (parsed === null) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
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
    conversionRate: ratePercent(row.conversion_rate),
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
    const rateDelta = (key: string) => metric(ratePercent(current[key]), ratePercent(previous[key]));
    return {
      sessions: delta("sessions"),
      onlineStoreVisitors: delta("online_store_visitors"),
      addedToCartRate: rateDelta("added_to_cart_rate"),
      conversionRate: rateDelta("conversion_rate"),
      checkoutConversionRate: rateDelta("checkout_conversion_rate"),
      bounceRate: rateDelta("bounce_rate"),
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
    const since = formatInTimeZone(new Date(period.current.start), period.timezone, "yyyy-MM-dd");
    const until = formatInTimeZone(new Date(period.current.end), period.timezone, "yyyy-MM-dd");
    const query = `created_at:>=${since} created_at:<${until}`;
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

function dayKey(iso: string, timezone: string) {
  return formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd");
}

function dayOfMonth(isoDate: string) {
  return Number(isoDate.slice(8, 10));
}

function aggregateOrdersByDay(orders: ShopifyOrder[], timezone: string) {
  const totals = new Map<string, number>();
  for (const order of orders) {
    const key = dayKey(order.createdAt, timezone);
    totals.set(key, (totals.get(key) ?? 0) + Number(order.totalPriceSet.shopMoney.amount));
  }
  return totals;
}

async function fetchDailySeries(storeUrl: string, token: string, range: string) {
  const rows = await runShopifyql(
    storeUrl,
    token,
    `FROM sales SHOW total_sales GROUP BY day ${range} ORDER BY day ASC`,
  );
  const totals = new Map<string, number>();
  for (const row of rows) {
    const day = row.day ?? row.Day ?? null;
    if (!day) continue;
    totals.set(day, number(row.total_sales) ?? 0);
  }
  return totals;
}

/**
 * Builds a day-aligned current vs previous chart. Prefers ShopifyQL sales;
 * falls back to order createdAt buckets when `read_reports` is missing.
 */
async function fetchDailyRevenue(
  storeUrl: string,
  token: string,
  period: ReportPeriod,
  currentOrders: ShopifyOrder[],
  previousOrders: ShopifyOrder[],
): Promise<Array<{ date: string; current: number; previous: number }>> {
  let currentByDay: Map<string, number>;
  let previousByDay: Map<string, number>;
  try {
    const currentRange = shopifyqlRange(period.current.start, period.current.end, period.timezone);
    const previousRange = shopifyqlRange(period.previous.start, period.previous.end, period.timezone);
    [currentByDay, previousByDay] = await Promise.all([
      fetchDailySeries(storeUrl, token, currentRange),
      fetchDailySeries(storeUrl, token, previousRange),
    ]);
  } catch (error) {
    logger.warn({ err: error }, "shopify daily sales unavailable; falling back to order buckets");
    currentByDay = aggregateOrdersByDay(currentOrders, period.timezone);
    previousByDay = aggregateOrdersByDay(previousOrders, period.timezone);
  }

  const previousByDom = new Map<number, number>();
  for (const [date, amount] of previousByDay) previousByDom.set(dayOfMonth(date), amount);

  const currentDates = [...currentByDay.keys()].sort();
  if (!currentDates.length) {
    // Still emit previous-only days so an empty current month isn't a blank chart when we have history.
    return [...previousByDay.keys()]
      .sort()
      .map((date) => ({ date, current: 0, previous: previousByDay.get(date) ?? 0 }));
  }

  return currentDates.map((date) => ({
    date,
    current: currentByDay.get(date) ?? 0,
    previous: previousByDom.get(dayOfMonth(date)) ?? 0,
  }));
}

export async function fetchShopifyMetrics(storeUrl: string, token: string, period: ReportPeriod): Promise<ShopifyMetrics> {
  // Core order metrics first. Funnel / events / theme / daily are best-effort and never block commerce data.
  const [current, previous] = await Promise.all([
    periodMetrics(storeUrl, token, period.current.start, period.current.end, period.timezone),
    periodMetrics(storeUrl, token, period.previous.start, period.previous.end, period.timezone),
  ]);
  const [funnel, storeChanges, theme, dailyRevenue] = await Promise.all([
    fetchFunnel(storeUrl, token, period),
    fetchStoreChanges(storeUrl, token, period),
    fetchThemeStatus(storeUrl, token),
    fetchDailyRevenue(storeUrl, token, period, current.nodes, previous.nodes),
  ]);
  return {
    currency: current.currency,
    revenue: metric(current.revenue, previous.revenue),
    orders: metric(current.orders, previous.orders),
    aov: metric(current.aov, previous.aov),
    conversionRate: funnel?.conversionRate ?? null,
    newCustomers: metric(current.newCustomers, previous.newCustomers),
    returningCustomers: metric(current.returningCustomers, previous.returningCustomers),
    refundRate: metric(current.refundRate, previous.refundRate),
    topProducts: current.products,
    dailyRevenue,
    funnel,
    storeChanges,
    theme,
  };
}
