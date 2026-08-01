import fencingLogo from '../assets/qm-fence-logo.png';

export const currentDomain = window.location.hostname;

type TradeType = 'fencing' | 'retaining-wall' | 'decking' | 'landscaping';

const DOMAIN_TRADE_TYPES: Record<string, TradeType> = {
  retainingwall: 'retaining-wall',
  decking: 'decking',
  landscaping: 'landscaping',
  fencing: 'fencing',
};

/** Strip local / Firebase Hosting suffixes (and preview-channel `--…`) to a site label. */
function siteLabelFromHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/\.firebaseapp\.com$/, '')
    .replace(/\.web\.app$/, '')
    .replace(/\.local$/, '')
    .split('--')[0]!;
}

/**
 * Resolve trade from hostname.
 * Supports: fencing.local, fencing.web.app, fencing.firebaseapp.com,
 * Firebase preview channels (fencing--channel-hash.web.app), and custom hosts
 * that embed the trade key (e.g. fencing.example.com).
 */
export function resolveTradeTypeFromHostname(hostname: string): TradeType {
  const host = hostname.toLowerCase();
  const siteLabel = siteLabelFromHostname(host);

  const bySite =
    Object.entries(DOMAIN_TRADE_TYPES).find(
      ([key]) =>
        siteLabel === key ||
        siteLabel.startsWith(`${key}.`) ||
        siteLabel.startsWith(`${key}-`),
    )?.[1] ?? null;

  if (bySite) return bySite;

  return (
    Object.entries(DOMAIN_TRADE_TYPES).find(([key]) => host.includes(key))?.[1] ??
    'fencing'
  );
}

const TRADE_CONFIG: Record<
  TradeType,
  {
    label: string;
    title: string;
    nounPlural: string;
    logoSrc: string;
    logoAlt: string;
    brandSuffix: string;
  }
> = {
  fencing: {
    label: 'fencing',
    title: 'Fencing',
    nounPlural: 'Fences',
    logoSrc: fencingLogo,
    logoAlt: 'QuoteMyFence',
    brandSuffix: 'MyFence',
  },
  'retaining-wall': {
    label: 'retaining wall',
    title: 'Retaining Wall',
    nounPlural: 'Retaining Walls',
    logoSrc: fencingLogo,
    logoAlt: 'QuoteMyRetainingWall',
    brandSuffix: 'MyRetainingWall',
  },
  decking: {
    label: 'decking',
    title: 'Decking',
    nounPlural: 'Decks',
    logoSrc: fencingLogo,
    logoAlt: 'QuoteMyDeck',
    brandSuffix: 'MyDeck',
  },
  landscaping: {
    label: 'landscaping',
    title: 'Landscaping',
    nounPlural: 'Landscaping Projects',
    logoSrc: fencingLogo,
    logoAlt: 'QuoteMyLandscaping',
    brandSuffix: 'MyLandscaping',
  },
};

// TODO: Temporary lock — app is hardcoded to 'decking' regardless of hostname.
// To switch trade: change 'decking' below to 'fencing' | 'retaining-wall' | 'landscaping'.
// To restore hostname-based branding: uncomment the resolveTradeTypeFromHostname line
// and delete the hardcoded assignment.
// const tradeType = resolveTradeTypeFromHostname(currentDomain);
const tradeType: TradeType = 'decking';
const tradeConfig = TRADE_CONFIG[tradeType];

/** Canonical jobType for this hostname — matches Firestore `jobType`. */
export const currentJobType: TradeType = tradeType;
export const isRetainingWall = tradeType === 'retaining-wall';
export const tradeLabel = tradeConfig.label;
export const tradeLabelTitle = tradeConfig.title;
export const tradeNounPlural = tradeConfig.nounPlural;
export const brandLogoSrc = tradeConfig.logoSrc;
export const brandLogoAlt = tradeConfig.logoAlt;
export const brandNamePrefix = 'Quote';
export const brandNameSuffix = tradeConfig.brandSuffix;
export const brandName = `${brandNamePrefix}${brandNameSuffix}`;
