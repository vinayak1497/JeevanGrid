import { prisma } from '../../../utils/prisma';
import { alertConfig } from '../alertConfig';
import type { CapInfo } from '../alertNormalizationService';
import type { SourceFetchResult } from './types';

const FETCH_TIMEOUT_MS = 15000;
const CAP_FETCH_TIMEOUT_MS = 8000;
const CAP_FETCH_CONCURRENCY = 6;

/** Match a tag with or without namespace prefix: <event> or <cap:event>. */
function tagPattern(tag: string): string {
  return `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`;
}

/** Extract first occurrence of <tag>...</tag> (CDATA-aware, namespace-tolerant). */
function tagContent(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(tagPattern(tag)));
  if (!m) return null;
  let v = (m[1] ?? '').trim();
  // strip CDATA wrapper
  if (v.startsWith('<![CDATA[') && v.endsWith(']]>')) v = v.slice(9, -3);
  // strip nested tags for plain-text fields
  v = v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return v === '' ? null : v;
}

function allBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(tagPattern(tag), 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[0]);
  return out;
}

/** A SACHET CAP document link (FetchXMLFile / FetchAlertDetails carry full CAP XML). */
export function isCapDetailUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /FetchXMLFile|FetchAlertDetails|\.xml(\?|$)/i.test(url);
}

/**
 * Parse the SACHET India CAP RSS feed into CAP-ish items.
 * Preserves identifier/sender/sent/status/msgType/source/scope/category/event/
 * urgency/severity/certainty/effective/onset/expires/headline/description/
 * instruction/area/polygon/circle/geocode/references where the feed carries them.
 */
export function parseSachetRssItems(rssXml: string): CapInfo[] {
  const items: CapInfo[] = [];
  for (const block of allBlocks(rssXml, 'item')) {
    const cap: CapInfo = {
      identifier: tagContent(block, 'identifier') || tagContent(block, 'cap:identifier') || tagContent(block, 'guid'),
      sender: tagContent(block, 'sender') || tagContent(block, 'cap:sender'),
      sent: tagContent(block, 'sent') || tagContent(block, 'cap:sent') || tagContent(block, 'pubDate'),
      status: tagContent(block, 'status') || tagContent(block, 'cap:status'),
      msgType: tagContent(block, 'msgType') || tagContent(block, 'cap:msgType'),
      source: tagContent(block, 'source') || tagContent(block, 'cap:source'),
      scope: tagContent(block, 'scope') || tagContent(block, 'cap:scope'),
      language: tagContent(block, 'language'),
      category: tagContent(block, 'category') || tagContent(block, 'cap:category'),
      event: tagContent(block, 'event') || tagContent(block, 'cap:event'),
      urgency: tagContent(block, 'urgency') || tagContent(block, 'cap:urgency'),
      severity: tagContent(block, 'severity') || tagContent(block, 'cap:severity'),
      certainty: tagContent(block, 'certainty') || tagContent(block, 'cap:certainty'),
      effective: tagContent(block, 'effective') || tagContent(block, 'cap:effective'),
      onset: tagContent(block, 'onset') || tagContent(block, 'cap:onset'),
      expires: tagContent(block, 'expires') || tagContent(block, 'cap:expires'),
      headline: tagContent(block, 'title'),
      description: tagContent(block, 'description'),
      instruction: tagContent(block, 'instruction') || tagContent(block, 'cap:instruction'),
      areaDesc: tagContent(block, 'areaDesc') || tagContent(block, 'cap:areaDesc'),
      polygon: tagContent(block, 'polygon') || tagContent(block, 'cap:polygon'),
      circle: tagContent(block, 'circle') || tagContent(block, 'cap:circle'),
      geocode: tagContent(block, 'geocode') || tagContent(block, 'cap:geocode'),
      references: tagContent(block, 'references'),
      web: tagContent(block, 'link'),
      guid: tagContent(block, 'guid'),
      author: tagContent(block, 'author'),
    };
    // Keep items that carry at least an identifier-ish reference; the
    // normalization layer rejects anything without identifier/sent.
    if (cap.identifier || cap.guid || cap.web) {
      if (!cap.identifier && cap.guid) cap.identifier = cap.guid;
      items.push(cap);
    }
  }
  return items;
}

/**
 * Parse a full CAP XML alert document (<alert> or <cap:alert> with <info> blocks).
 * When several <info> language blocks exist, English is preferred so the
 * stored headline/description stay human-readable (regional blocks whose
 * source encoding is broken are still preserved inside rawPayload).
 */
export function parseCapXml(capXml: string): CapInfo | null {
  if (!/<(?:\w+:)?alert[\s>]/.test(capXml)) return null;
  const infoBlocks = allBlocks(capXml, 'info');
  const preferred =
    infoBlocks.find((b) => /^en\b/i.test(tagContent(b, 'language') || '')) ?? infoBlocks[0] ?? capXml;
  const info = preferred;
  const areaBlocks = allBlocks(info, 'area');
  const area = areaBlocks[0] ?? '';
  const identifier = tagContent(capXml, 'identifier');
  if (!identifier) return null;
  // Optional polygon document reference (<parameter><valueName>Polygon URL</valueName><value>…).
  let polygonUrl: string | null = null;
  for (const p of allBlocks(info, 'parameter')) {
    if (/polygon url/i.test(tagContent(p, 'valueName') || '')) {
      polygonUrl = tagContent(p, 'value');
      break;
    }
  }
  const cap: CapInfo = {
    identifier,
    sender: tagContent(capXml, 'sender'),
    sent: tagContent(capXml, 'sent'),
    status: tagContent(capXml, 'status'),
    msgType: tagContent(capXml, 'msgType'),
    source: tagContent(capXml, 'source'),
    scope: tagContent(capXml, 'scope'),
    language: tagContent(info, 'language'),
    category: tagContent(info, 'category'),
    event: tagContent(info, 'event'),
    urgency: tagContent(info, 'urgency'),
    severity: tagContent(info, 'severity'),
    certainty: tagContent(info, 'certainty'),
    effective: tagContent(info, 'effective'),
    onset: tagContent(info, 'onset'),
    expires: tagContent(info, 'expires'),
    headline: tagContent(info, 'headline'),
    description: tagContent(info, 'description'),
    instruction: tagContent(info, 'instruction'),
    areaDesc: tagContent(area || info, 'areaDesc'),
    polygon: tagContent(area || info, 'polygon'),
    circle: tagContent(area || info, 'circle'),
    geocode: tagContent(area || info, 'geocode'),
    polygonUrl,
    references: tagContent(capXml, 'references'),
    web: tagContent(capXml, 'web'),
  };
  return cap;
}

/** Pure helper: HTTP 304 means "do NOT download/reprocess the feed". */
export function isNotModifiedStatus(status: number): boolean {
  return status === 304;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch the SACHET CAP RSS feed with ETag-based caching.
 * - First request: GET feed, store body + ETag + Last-Modified.
 * - Later: send If-None-Match; on 304 do NOT reprocess.
 */
export async function fetchSachetFeed(): Promise<SourceFetchResult> {
  const started = Date.now();
  const feedUrl = alertConfig.sachetFeedUrl;

  if (!alertConfig.sachetEnabled) {
    return {
      source: 'SACHET', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started, error: 'SACHET integration disabled (SACHET_ENABLED=false)',
    };
  }

  const cached = await prisma.alertFeedCache.findUnique({ where: { sourceName: 'SACHET' } }).catch(() => null);

  const headers: Record<string, string> = {
    'User-Agent': 'JeevanGrid-Disaster-Platform/1.0 (+https://jeevangrid.in)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  };
  if (cached?.etag) headers['If-None-Match'] = cached.etag;
  else {
    const state = await prisma.alertSourceState.findUnique({ where: { name: 'SACHET' } }).catch(() => null);
    if (state?.etag) headers['If-None-Match'] = state.etag;
  }
  if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

  let res: Response;
  console.log('[SACHET] fetch started');
  try {
    res = await fetchWithTimeout(feedUrl, { headers }, FETCH_TIMEOUT_MS);
  } catch (e) {
    console.warn(`[SACHET] fetch completed: timeout/unreachable (${(e as Error).message})`);
    return {
      source: 'SACHET', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
      etag: cached?.etag ?? null, lastModified: cached?.lastModified ?? null,
      responseTimeMs: Date.now() - started, error: `feed fetch failed: ${(e as Error).message}`,
    };
  }
  const responseTimeMs = Date.now() - started;

  if (res.status === 304) {
    console.log(`[SACHET] fetch completed: HTTP 304 Not Modified in ${responseTimeMs}ms (cached, no reprocess)`);
    return {
      source: 'SACHET', outcome: 'NOT_MODIFIED', recordsFetched: 0, items: [],
      etag: cached?.etag ?? res.headers.get('etag'),
      lastModified: cached?.lastModified ?? res.headers.get('last-modified'),
      responseTimeMs, lastSuccessAt: new Date(),
    };
  }

  if (!res.ok) {
    console.warn(`[SACHET] fetch completed: HTTP ${res.status} in ${responseTimeMs}ms`);
    return {
      source: 'SACHET', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
      etag: cached?.etag ?? null, lastModified: cached?.lastModified ?? null,
      responseTimeMs, error: `feed HTTP ${res.status}`,
    };
  }

  const body = await res.text();
  const etag = res.headers.get('etag');
  const lastModified = res.headers.get('last-modified');

  // Persist cache + registry ETag bookkeeping.
  await prisma.alertFeedCache.upsert({
    where: { sourceName: 'SACHET' },
    update: { etag, lastModified, body: body.slice(0, 500000) },
    create: { sourceName: 'SACHET', etag, lastModified, body: body.slice(0, 500000) },
  }).catch(() => undefined);

  // RSS-level items only. Full CAP XML enrichment happens in the ingestion
  // layer (alertIngestionService), which skips CAP fetches for alerts already
  // stored with full detail — so steady-state syncs stay cheap.
  const rssItems = parseSachetRssItems(body);
  console.log(
    `[SACHET] fetch completed: HTTP 200 in ${responseTimeMs}ms, ` +
    `records discovered=${rssItems.length}, etag=${etag ? 'yes' : 'none'}`
  );

  return {
    source: 'SACHET', outcome: 'OK', recordsFetched: rssItems.length, items: rssItems,
    etag, lastModified, responseTimeMs, lastSuccessAt: new Date(),
  };
}
/**
 * Fetch + parse a single SACHET CAP XML document.
 * Returns null on any failure (caller falls back to RSS-level fields —
 * never fabricates detail).
 */
export async function fetchCapDetail(capUrl: string): Promise<CapInfo | null> {
  try {
    const capRes = await fetchWithTimeout(capUrl, {
      headers: { 'User-Agent': 'JeevanGrid-Disaster-Platform/1.0', Accept: 'application/xml, text/xml, */*' },
    }, CAP_FETCH_TIMEOUT_MS);
    if (!capRes.ok) return null;
    return parseCapXml(await capRes.text());
  } catch {
    return null;
  }
}

export const capFetchConcurrency = CAP_FETCH_CONCURRENCY;
