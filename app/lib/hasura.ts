const HASURA_URL = "https://hasura.polyinsiders.com/v1/graphql";
const HASURA_SECRET = "myadminsecretkey";

async function hasura<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(HASURA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": HASURA_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Hasura HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "Hasura error");
  return json.data as T;
}

export type HasuraMarket = {
  id: string;
  conditionId: string;
  title: string;
  slug: string;
  icon: string | null;
  volume: string;
  tradersCount: number;
  endDate: string;
  assetIds: string[];
  PolymarketMarketTags: { PolymarketTag: { slug: string; label: string } }[];
};

export type HasuraAsset = {
  id: string;
  recentUsdPerShare: string[] | null;
  volume: string | null;
  updatedAt: string;
};

const ACTIVE_MARKETS_QUERY = `
  query ActiveMarkets($from: timestamp!, $to: timestamp!, $limit: Int!) {
    PolymarketMarket(
      where: {
        endDate: { _gt: $from, _lt: $to }
        resolutionTransactionHash: { _is_null: true }
      }
      order_by: { endDate: desc }
      limit: $limit
    ) {
      id
      conditionId
      title
      slug
      icon
      volume
      tradersCount
      endDate
      assetIds
      PolymarketMarketTags {
        PolymarketTag { slug label }
      }
    }
  }
`;

export async function fetchActiveMarkets(opts?: {
  windowDays?: number;
  limit?: number;
}): Promise<HasuraMarket[]> {
  const now = new Date();
  const from = new Date(now.getTime() + 60 * 60 * 1000);
  const days = opts?.windowDays ?? 240;
  const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const data = await hasura<{ PolymarketMarket: HasuraMarket[] }>(ACTIVE_MARKETS_QUERY, {
    from: from.toISOString().replace(/\.\d+Z$/, ""),
    to: to.toISOString().replace(/\.\d+Z$/, ""),
    limit: opts?.limit ?? 200,
  });
  return data.PolymarketMarket;
}

const ASSET_PRICES_QUERY = `
  query AssetPrices($ids: [String!]!) {
    MarketAsset(where: { id: { _in: $ids } }) {
      id
      recentUsdPerShare
      volume
      updatedAt
    }
  }
`;

export async function fetchAssetPrices(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const data = await hasura<{ MarketAsset: HasuraAsset[] }>(ASSET_PRICES_QUERY, { ids });
  const out = new Map<string, number>();
  for (const a of data.MarketAsset) {
    const last = a.recentUsdPerShare?.[0];
    if (last != null) {
      const n = Number(last);
      if (Number.isFinite(n)) out.set(a.id, n);
    }
  }
  return out;
}
