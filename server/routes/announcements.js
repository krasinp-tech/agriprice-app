const express = require('express');
const router = express.Router();

const THAI_ANNOUNCEMENT_FEEDS = [
  { name: 'กระทรวงเกษตรและสหกรณ์', url: 'https://www.moac.go.th/site-home' },
  { name: 'กรมส่งเสริมการเกษตร', url: 'https://www.doae.go.th/home-new-2024/' },
  { name: 'กรมวิชาการเกษตร', url: 'https://www.doa.go.th/' },
  { name: 'สำนักงานเศรษฐกิจการเกษตร', url: 'https://www.oae.go.th/' },
];

const THAI_GOV_ALLOWED_HOST_SUFFIXES = ['go.th'];

const THAI_ANNOUNCEMENT_KEYWORDS = [
  'ผลไม้', 'เกษตร', 'พืชสวน', 'พืชไร่', 'สวน', 'ทุเรียน', 'มังคุด', 'เงาะ',
  'ลองกอง', 'ลำไย', 'ลิ้นจี่', 'สับปะรด', 'ยางพารา', 'ปาล์ม', 'มันสำปะหลัง',
  'อ้อย', 'ข้าวโพด', 'พริก', 'มะพร้าว', 'ไม้ผล', 'พืชพันธุ์', 'เกษตรกร',
];

let thaiAnnouncementCache = {
  expiresAt: 0,
  staleUntil: 0,
  items: [],
  refreshPromise: null,
  retryAfter: 0,
};

const ANNOUNCEMENT_CACHE_TTL_MS = 15 * 60 * 1000;
const ANNOUNCEMENT_STALE_TTL_MS = 6 * 60 * 60 * 1000;
const ANNOUNCEMENT_RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const ANNOUNCEMENT_FETCH_TIMEOUT_MS = 1800;

const FALLBACK_ANNOUNCEMENTS = [
  {
    title: 'Ministry of Agriculture and Cooperatives updates',
    link: 'https://www.moac.go.th/site-home',
    source: 'MOAC',
    published_at: null,
    content: '',
  },
  {
    title: 'Department of Agricultural Extension news',
    link: 'https://www.doae.go.th/home-new-2024/',
    source: 'DOAE',
    published_at: null,
    content: '',
  },
  {
    title: 'Department of Agriculture announcements',
    link: 'https://www.doa.go.th/',
    source: 'DOA',
    published_at: null,
    content: '',
  },
  {
    title: 'Office of Agricultural Economics updates',
    link: 'https://www.oae.go.th/',
    source: 'OAE',
    published_at: null,
    content: '',
  },
];

// --- Parsers and Helpers ---
function decodeXmlEntities(input) {
  return String(input || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/');
}

function stripHtml(input) {
  return String(input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickFirstTag(itemXml, tagNames) {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = itemXml.match(re);
    if (match && match[1]) return decodeXmlEntities(stripHtml(match[1]));
  }
  return '';
}

function normalizePublishedAt(value) {
  const ts = Date.parse(value || '');
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function looksLikeThaiAgriNews(title, summary) {
  const haystack = `${title || ''} ${summary || ''}`.toLowerCase();
  return THAI_ANNOUNCEMENT_KEYWORDS.some((keyword) => haystack.includes(String(keyword).toLowerCase()));
}

function isThaiGovernmentUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    const host = String(parsed.hostname || '').toLowerCase();
    return THAI_GOV_ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch (_) {
    return false;
  }
}

function parseRssItems(xml, sourceName) {
  const items = [];
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  const chunks = String(xml || '').match(itemRegex) || [];

  for (const chunk of chunks) {
    const title = pickFirstTag(chunk, ['title']);
    const link = pickFirstTag(chunk, ['link']);
    const summary = pickFirstTag(chunk, ['description', 'content:encoded']);
    const publishedAt = normalizePublishedAt(pickFirstTag(chunk, ['pubDate', 'dc:date']));
    const source = pickFirstTag(chunk, ['source']) || sourceName || 'ข่าวไทย';

    if (!title || !link) continue;
    items.push({ title, link, summary, source, publishedAt });
  }

  return items;
}

function parseHtmlNewsItems(html, feedUrl, sourceName) {
  const items = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(String(html || ''))) && items.length < 80) {
    const rawHref = decodeXmlEntities(match[1] || '').trim();
    const rawText = decodeXmlEntities(stripHtml(match[2] || '')).trim();

    if (!rawHref || !rawText) continue;
    if (rawText.length < 14 || rawText.length > 240) continue;

    let resolved;
    try {
      resolved = new URL(rawHref, feedUrl).toString();
    } catch (_) {
      continue;
    }

    if (!isThaiGovernmentUrl(resolved)) continue;
    
    const key = `${resolved}|${rawText}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      title: rawText,
      link: resolved,
      summary: '',
      source: sourceName || 'หน่วยงานรัฐ',
      publishedAt: null,
    });
  }

  return items;
}

async function fetchThaiAnnouncementItems() {
  const settled = await Promise.allSettled(
    THAI_ANNOUNCEMENT_FEEDS.map(async (feed) => {
      const response = await fetch(feed.url, {
        method: 'GET',
        signal: AbortSignal.timeout(ANNOUNCEMENT_FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'AgripriceBot/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      });
      if (!response.ok) return [];
      const body = await response.text();
      const rssItems = parseRssItems(body, feed.name);
      if (rssItems.length) return rssItems;
      return parseHtmlNewsItems(body, feed.url, feed.name);
    })
  );

  const collected = [];
  for (const result of settled) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      collected.push(...result.value);
    }
  }

  const dedupMap = new Map();
  collected.forEach((item) => {
    const key = String(item.link || '').trim();
    if (!key) return;
    if (!dedupMap.has(key)) dedupMap.set(key, item);
  });

  const uniqueItems = Array.from(dedupMap.values()).filter((item) => isThaiGovernmentUrl(item.link));
  const agriOnly = uniqueItems.filter((item) => looksLikeThaiAgriNews(item.title, item.summary));
  return (agriOnly.length ? agriOnly : uniqueItems)
    .sort((a, b) => {
      const ta = Date.parse(a.publishedAt || '') || 0;
      const tb = Date.parse(b.publishedAt || '') || 0;
      return tb - ta;
    })
    .slice(0, 30)
    .map((item) => ({
      title: item.title,
      link: item.link,
      source: item.source,
      published_at: item.publishedAt,
      content: item.summary || '',
    }));
}

async function refreshThaiAnnouncementCache() {
  try {
    const finalItems = await fetchThaiAnnouncementItems();

    if (finalItems.length) {
      thaiAnnouncementCache.items = finalItems;
      thaiAnnouncementCache.expiresAt = Date.now() + ANNOUNCEMENT_CACHE_TTL_MS;
      thaiAnnouncementCache.staleUntil = Date.now() + ANNOUNCEMENT_STALE_TTL_MS;
      thaiAnnouncementCache.retryAfter = 0;
      return finalItems;
    }

    thaiAnnouncementCache.retryAfter = Date.now() + ANNOUNCEMENT_RETRY_COOLDOWN_MS;
    if (thaiAnnouncementCache.items.length) {
      thaiAnnouncementCache.expiresAt = Date.now() + ANNOUNCEMENT_RETRY_COOLDOWN_MS;
      thaiAnnouncementCache.staleUntil = Date.now() + ANNOUNCEMENT_STALE_TTL_MS;
    }
    return thaiAnnouncementCache.items;
  } catch (_) {
    thaiAnnouncementCache.retryAfter = Date.now() + ANNOUNCEMENT_RETRY_COOLDOWN_MS;
    return thaiAnnouncementCache.items;
  }
}

function refreshThaiAnnouncementsInBackground() {
  if (thaiAnnouncementCache.refreshPromise) return;
  if (Date.now() < thaiAnnouncementCache.retryAfter) return;

  thaiAnnouncementCache.refreshPromise = refreshThaiAnnouncementCache()
    .finally(() => {
      thaiAnnouncementCache.refreshPromise = null;
    });
}

function getAnnouncementResponseItems(limit) {
  const now = Date.now();
  const hasUsableCache = thaiAnnouncementCache.items.length && now < thaiAnnouncementCache.staleUntil;
  const source = hasUsableCache ? thaiAnnouncementCache.items : FALLBACK_ANNOUNCEMENTS;
  return source.slice(0, limit);
}

/**
 * GET /api/announcements
 */
router.get('/', async (req, res) => {
  try {
    const limitRaw = Number.parseInt(String(req.query.limit || '6'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 12)) : 6;
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=3600');

    if (Date.now() < thaiAnnouncementCache.expiresAt && thaiAnnouncementCache.items.length) {
      return res.json({
        success: true,
        data: thaiAnnouncementCache.items.slice(0, limit),
        message: 'ok',
      });
    }

    refreshThaiAnnouncementsInBackground();

    res.json({
      success: true,
      data: getAnnouncementResponseItems(limit),
      message: 'ok',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'โหลดข่าวประชาสัมพันธ์ไม่สำเร็จ' });
  }
});

module.exports = router;
