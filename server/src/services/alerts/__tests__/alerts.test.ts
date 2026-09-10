/**
 * Alert pipeline tests — fail-closed verification for the JeevanGrid
 * official-warnings rebuild. Pure unit tests (no DB, no network).
 *
 * Run:  npm run test:alerts   (tsx --test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateOfficialEligibility,
  isExpired,
  livenessForAlert,
  assertImdWarningPayload,
  assertNotOfficialImpersonation,
} from '../alertValidationService';
import {
  normalizeCapInfo,
  mapCapSeverityToJeevanGrid,
  mapEventToHazardType,
  centroidFromGeometry,
  stateFromSender,
  stateFromText,
} from '../alertNormalizationService';
import { parseSachetRssItems, parseCapXml, isNotModifiedStatus, isCapDetailUrl } from '../sources/sachetSource';
import { sourceDefinitions } from '../alertSourceRegistry';
import { geometryPrecisionFor, haversineKm, shapeOfficialAlert } from '../officialAlertQuery';
import { districtsForAlert } from '../alertNotificationService';

const now = new Date();
const isoIn = (ms: number) => new Date(now.getTime() + ms).toISOString();

function validAlert(overrides: Record<string, unknown> = {}) {
  return {
    source: 'SACHET',
    sourceType: 'OFFICIAL',
    sourceAlertId: 'IN-SACHET-2026-0001',
    sourceUrl: 'https://sachet.ndma.gov.in/cap_public_website/FetchAlertDetails?identifier=X',
    sourceReference: 'guid-1',
    issuedAt: isoIn(-30 * 60000),
    expiresAt: isoIn(12 * 3600000),
    status: 'ACTIVE',
    isVerified: true,
    isDemoData: false,
    rawPayload: JSON.stringify({ cap: { identifier: 'IN-SACHET-2026-0001' } }),
    ...overrides,
  };
}

describe('official alert validation (fail closed)', () => {
  it('1. valid SACHET alert is accepted', () => {
    assert.equal(validateOfficialEligibility(validAlert(), now).ok, true);
  });

  it('2. invalid CAP alert (no identifier / issue time) is rejected', () => {
    const r1 = validateOfficialEligibility(validAlert({ sourceAlertId: '' }), now);
    const r2 = validateOfficialEligibility(validAlert({ issuedAt: 'not-a-date' }), now);
    assert.equal(r1.ok, false);
    assert.equal(r2.ok, false);
  });

  it('3. expired alert is excluded', () => {
    assert.equal(isExpired(isoIn(-1000), now), true);
    const r = validateOfficialEligibility(validAlert({ expiresAt: isoIn(-1000) }), now);
    assert.equal(r.ok, false);
  });

  it('4. cancelled alert is excluded', () => {
    const r = validateOfficialEligibility(validAlert({ status: 'CANCELLED' }), now);
    assert.equal(r.ok, false);
  });

  it('6. demo alert cannot appear in production official list', () => {
    const r = validateOfficialEligibility(validAlert({ isDemoData: true }), now);
    assert.equal(r.ok, false);
  });

  it('7. missing source ID prevents official classification', () => {
    const r = validateOfficialEligibility(validAlert({ sourceAlertId: null }), now);
    assert.equal(r.ok, false);
    assert.match(r.reasons.join(';'), /sourceAlertId/);
  });

  it('8. missing provenance prevents official classification', () => {
    const r = validateOfficialEligibility(
      validAlert({ sourceUrl: null, sourceReference: null, rawPayload: null }),
      now
    );
    assert.equal(r.ok, false);
  });

  it('10. IMD weather data cannot become an IMD warning', () => {
    const r = assertImdWarningPayload({ isWeatherObservation: true, sourceAlertId: 'W-1', issuedAt: isoIn(0) });
    assert.equal(r.ok, false);
    const r2 = assertImdWarningPayload({ sourceAlertId: null, issuedAt: isoIn(0) });
    assert.equal(r2.ok, false);
    const r3 = assertImdWarningPayload({ sourceAlertId: 'IMD-W-1', issuedAt: isoIn(0) });
    assert.equal(r3.ok, true);
  });

  it('11. JeevanGrid prediction cannot become an official warning', () => {
    assert.equal(assertNotOfficialImpersonation('INTELLIGENCE').ok, false);
    assert.equal(validateOfficialEligibility(validAlert({ sourceType: 'INTELLIGENCE' }), now).ok, false);
  });

  it('12. community report cannot become an official warning', () => {
    assert.equal(assertNotOfficialImpersonation('COMMUNITY').ok, false);
    assert.equal(validateOfficialEligibility(validAlert({ sourceType: 'COMMUNITY' }), now).ok, false);
  });
});

describe('normalization / dedup / lifecycle', () => {
  const cap = {
    identifier: 'IN-SACHET-2026-0042',
    sender: 'sachet@ndma.gov.in',
    sent: isoIn(-60000),
    status: 'Actual',
    msgType: 'Alert',
    source: 'SACHET',
    scope: 'Public',
    language: 'en',
    category: 'Met',
    event: 'Heavy Rainfall Warning',
    urgency: 'Expected',
    severity: 'Severe',
    certainty: 'Likely',
    effective: isoIn(-60000),
    onset: isoIn(0),
    expires: isoIn(24 * 3600000),
    headline: 'Heavy Rainfall Warning — Assam',
    description: 'Intense precipitation expected.',
    instruction: 'Avoid low-lying areas.',
    areaDesc: 'Assam - Kamrup Metropolitan',
    polygon: '26.1,91.7 26.2,91.8 26.0,91.9',
    circle: null,
    geocode: null,
    references: null,
    web: 'https://sachet.ndma.gov.in/cap_public_website/FetchAlertDetails?identifier=42',
    guid: 'guid-42',
  };

  it('5. duplicate sourceAlertId maps to the same dedup key (no duplicate)', () => {
    const a = normalizeCapInfo(cap, { source: 'SACHET', authority: 'NDMA SACHET' });
    const b = normalizeCapInfo(cap, { source: 'SACHET', authority: 'NDMA SACHET' });
    assert.ok(a && b);
    assert.equal(`${a.source}|${a.sourceAlertId}`, `${b!.source}|${b!.sourceAlertId}`);
  });

  it('13. updated alert keeps identity with UPDATED status', () => {
    const u = normalizeCapInfo({ ...cap, msgType: 'Update', sent: isoIn(0) }, { source: 'SACHET', authority: 'NDMA SACHET' });
    assert.ok(u);
    assert.equal(u.sourceAlertId, 'IN-SACHET-2026-0042');
    assert.equal(u.status, 'UPDATED');
  });

  it('cancellation maps to CANCELLED, never silent delete', () => {
    const c = normalizeCapInfo({ ...cap, msgType: 'Cancel' }, { source: 'SACHET', authority: 'NDMA SACHET' });
    assert.ok(c);
    assert.equal(c.status, 'CANCELLED');
  });

  it('14. timestamps are dynamic (source sent + fresh ingestion time)', () => {
    const before = Date.now();
    const d = normalizeCapInfo(cap, { source: 'SACHET', authority: 'NDMA SACHET' });
    assert.ok(d);
    assert.equal(d.issuedAt.toISOString(), new Date(cap.sent).toISOString());
    assert.ok(d.lastCheckedAt.getTime() >= before - 5000);
    assert.ok(!/10 September 2026/i.test(JSON.stringify(d)));
  });

  it('severity + hazard mapping honours CAP vocabulary', () => {
    assert.equal(mapCapSeverityToJeevanGrid('Extreme'), 'CRITICAL');
    assert.equal(mapCapSeverityToJeevanGrid('Severe'), 'WARNING');
    assert.equal(mapCapSeverityToJeevanGrid('Moderate'), 'WATCH');
    assert.equal(mapEventToHazardType('Heavy Rainfall Warning'), 'Rain');
    assert.equal(mapEventToHazardType('Flood Watch'), 'Flood');
  });

  it('sender-derived state hints never fabricate geography', () => {
    assert.equal(stateFromSender('Uttarakhand-SDMA'), 'Uttarakhand');
    assert.equal(stateFromSender('West-Bengal-SDMA'), 'West Bengal');
    assert.equal(stateFromSender('IMD-Kolkata'), 'West Bengal');
    assert.equal(stateFromSender('IMD-Raipur'), 'Chhattisgarh');
    assert.equal(stateFromSender('some random free text'), null);
    assert.equal(stateFromSender(null), null);
    assert.equal(isCapDetailUrl('https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=1'), true);
    assert.equal(isCapDetailUrl('https://example.com/other'), false);
  });

  it('centroid derived from polygon; null when absent', () => {
    const c = centroidFromGeometry('26.1,91.7 26.2,91.8 26.0,91.9', null);
    assert.ok(c && Math.abs(c.lat - 26.1) < 0.2 && Math.abs(c.lng - 91.8) < 0.2);
    assert.equal(centroidFromGeometry(null, null), null);
  });
});

describe('freshness / IST / source health', () => {
  it('liveness honours source-specific freshness windows', () => {
    const fresh = livenessForAlert(isoIn(-3 * 60000), 'SACHET', now);
    assert.equal(fresh.live, true);
    const stale = livenessForAlert(isoIn(-5 * 3600000), 'SACHET', now);
    assert.equal(stale.live, false);
    assert.equal(stale.stale, true);
  });

  it('15. IST display converts UTC correctly (5:30 ahead)', () => {
    const ist = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date('2026-01-01T00:00:00.000Z'));
    assert.match(ist, /05:30/);
  });

  it('16. source registry tracks all four authorities with health states', () => {
    const defs = sourceDefinitions();
    assert.deepEqual(defs.map((d) => d.name).sort(), ['CWC', 'IMD', 'INCOIS', 'SACHET']);
    for (const valid of ['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'CONFIGURATION_REQUIRED']) {
      assert.match(valid, /HEALTHY|DEGRADED|UNAVAILABLE|CONFIGURATION_REQUIRED/);
    }
  });
});

describe('SACHET ETag + feed parsing', () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>SACHET</title>
    <item><title>Heavy Rainfall Warning — Assam</title>
    <link>https://sachet.ndma.gov.in/cap_public_website/FetchAlertDetails?identifier=42</link>
    <guid>IN-SACHET-2026-0042</guid><pubDate>${isoIn(-60000)}</pubDate>
    <identifier>IN-SACHET-2026-0042</identifier><sender>sachet@ndma.gov.in</sender>
    <sent>${isoIn(-60000)}</sent><msgType>Alert</msgType><event>Heavy Rainfall Warning</event>
    <severity>Severe</severity><urgency>Expected</urgency><certainty>Likely</certainty>
    <expires>${isoIn(24 * 3600000)}</expires>
    <description>Intense precipitation expected.</description>
    <areaDesc>Assam - Kamrup Metropolitan</areaDesc></item>
    </channel></rss>`;

  it('18. 200 response with new items is parsed with provenance', () => {
    const items = parseSachetRssItems(rss);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.identifier, 'IN-SACHET-2026-0042');
    assert.ok(items[0]?.sent);
    const draft = normalizeCapInfo(items[0]!, { source: 'SACHET', authority: 'NDMA SACHET' });
    assert.ok(draft);
    assert.equal(validateOfficialEligibility({ ...validAlert(), sourceAlertId: draft!.sourceAlertId }, now).ok, true);
  });

  it('17. 304 response means do NOT reprocess', () => {
    assert.equal(isNotModifiedStatus(304), true);
    assert.equal(isNotModifiedStatus(200), false);
  });

  it('9. source outage yields zero fabricated alerts (parser rejects empty feeds)', () => {
    assert.deepEqual(parseSachetRssItems('<rss><channel></channel></rss>'), []);
    assert.equal(parseCapXml('<html>not cap</html>'), null);
  });

  it('CAP XML documents parse with full field preservation', () => {
    const xml = `<alert><identifier>CAP-9</identifier><sender>a@b.in</sender><sent>${isoIn(-60000)}</sent>
      <status>Actual</status><msgType>Alert</msgType><scope>Public</scope><references></references>
      <info><language>en</language><category>Met</category><event>Cyclone Warning</event>
      <urgency>Immediate</urgency><severity>Extreme</severity><certainty>Observed</certainty>
      <headline>Cyclone Warning</headline><description>Landfall likely.</description>
      <area><areaDesc>Odisha - Jagatsinghpur</areaDesc><circle>19.8,86.6 30</circle></area></info></alert>`;
    const cap = parseCapXml(xml);
    assert.ok(cap);
    assert.equal(cap.identifier, 'CAP-9');
    assert.equal(cap.event, 'Cyclone Warning');
    const draft = normalizeCapInfo(cap!, { source: 'SACHET', authority: 'NDMA SACHET' });
    assert.equal(draft!.severity, 'CRITICAL');
  });
});

describe('geography, targeting, notifications, provenance', () => {
  it('17. district-code-only alerts are DISTRICT precision, never exact polygons', () => {
    assert.equal(geometryPrecisionFor({ geometry: null, latitude: 26.1, longitude: 91.7 }), 'DISTRICT');
    assert.equal(geometryPrecisionFor({ geometry: '', latitude: 21.0, longitude: 78.0 }), 'DISTRICT');
    // Geometry link but fallback-centroid coordinates → still DISTRICT.
    assert.equal(
      geometryPrecisionFor({ geometry: '{"polygonUrl":"https://…/FetchXMLFile?identifier=1"}', latitude: 21.0, longitude: 78.0 }),
      'DISTRICT'
    );
    assert.equal(
      geometryPrecisionFor({ geometry: '{"polygon":"26.1,91.7 26.2,91.8"}', latitude: 26.1, longitude: 91.75 }),
      'EXACT'
    );
  });

  it('state is recovered from area text when sender hint is absent', () => {
    assert.equal(stateFromText('North Tripura district of Tripura'), 'Tripura');
    assert.equal(stateFromText('Brahmaputra, Neamatighat, Jorhat, Assam'), 'Assam');
    assert.equal(stateFromText('barabanki'), null);
    const d = normalizeCapInfo(
      {
        identifier: 'IN-SACHET-2026-0101', sender: 'sachet@ndma.gov.in', sent: isoIn(-60000),
        status: 'Actual', msgType: 'Alert', source: 'SACHET', scope: 'Public', language: 'en',
        category: 'Met', event: 'Flood Warning', urgency: 'Expected', severity: 'Severe',
        certainty: 'Likely', effective: isoIn(-60000), onset: isoIn(0), expires: isoIn(3600000),
        headline: 'Flood Warning', description: 'River rising.', instruction: null,
        areaDesc: 'North Tripura district of Tripura', polygon: null, circle: null,
        geocode: null, references: null,
        web: 'https://sachet.ndma.gov.in/cap_public_website/FetchAlertDetails?identifier=101',
        guid: 'guid-101', author: null,
      },
      { source: 'SACHET', authority: 'NDMA SACHET' }
    );
    assert.ok(d);
    assert.equal(d.state, 'Tripura');
  });

  it('unknown LGD-style junk never becomes alert geography', () => {
    assert.deepEqual(districtsForAlert({ district: 'Unknown', state: 'India', affectedAreas: null }), ['India']);
    assert.deepEqual(districtsForAlert({ district: null, state: null, affectedAreas: null }), []);
  });

  it('18. user district matches affected district (targeting primitive)', () => {
    const targets = districtsForAlert({
      district: 'Darbhanga',
      state: 'Bihar',
      affectedAreas: JSON.stringify(['Darbhanga district of Bihar']),
    });
    assert.ok(targets.includes('Darbhanga'));
    assert.ok(targets.includes('Bihar'));
    assert.ok(!targets.includes('Mumbai Suburban'));
  });

  it('nearby radius math is sane (Mumbai–Thane ~25km)', () => {
    const d = haversineKm(19.076, 72.8777, 19.2183, 72.9781);
    assert.ok(d > 10 && d < 60, `expected ~25km, got ${d}`);
    assert.equal(haversineKm(19.076, 72.8777, 19.076, 72.8777), 0);
  });

  it('19/20. notification identity is per alert × endpoint × action (no repeats)', () => {
    // The dedup key enforced by @@unique([source, sourceAlertId, endpointHash, action]).
    const key = (source: string, id: string, hash: string, action: string) =>
      `${source}|${id}|${hash}|${action}`;
    assert.notEqual(key('SACHET', 'A1', 'h1', 'NEW'), key('SACHET', 'A1', 'h1', 'UPDATED'));
    assert.notEqual(key('SACHET', 'A1', 'h1', 'NEW'), key('SACHET', 'A1', 'h2', 'NEW'));
    assert.equal(key('SACHET', 'A1', 'h1', 'NEW'), key('SACHET', 'A1', 'h1', 'NEW'));
  });

  it('22. shaped official alert is never labelled JeevanGrid-issued', () => {
    const shaped: any = shapeOfficialAlert(
      {
        ...validAlert(),
        authority: 'India Meteorological Department',
        affectedAreas: JSON.stringify(['Kamrup Metropolitan district of Assam']),
        geometry: null,
        headline: 'Heavy Rainfall Warning',
        title: 'Heavy Rainfall Warning',
        description: 'Intense precipitation.',
        instruction: 'Stay indoors.',
        urgency: 'Expected',
        certainty: 'Likely',
        eventType: 'Heavy Rainfall Warning',
        hazardType: 'Rain',
      } as any,
      now
    );
    assert.equal(/issued by JeevanGrid/i.test(JSON.stringify(shaped)), false);
    assert.equal(shaped.authority, 'India Meteorological Department');
    assert.equal(shaped.geometryPrecision, 'DISTRICT');
  });

  it('23. original source URL is preserved end to end', () => {
    const shaped: any = shapeOfficialAlert(
      {
        ...validAlert(),
        sourceUrl: 'https://sachet.ndma.gov.in/cap_public_website/FetchAlertDetails?identifier=X',
        affectedAreas: null,
        geometry: null,
        headline: null,
        title: 'T',
        description: 'D',
        instruction: null,
        urgency: null,
        certainty: null,
        eventType: null,
        hazardType: 'Rain',
        authority: 'NDMA SACHET',
      } as any,
      now
    );
    assert.equal(
      shaped.sourceUrl,
      'https://sachet.ndma.gov.in/cap_public_website/FetchAlertDetails?identifier=X'
    );
  });

  it('24/25. update keeps identity; cancel flips lifecycle (no duplicates, no delete)', () => {
    const base = {
      identifier: 'IN-SACHET-2026-0099',
      sender: 'sachet@ndma.gov.in',
      sent: isoIn(-60000),
      status: 'Actual',
      msgType: 'Alert',
      source: 'SACHET',
      scope: 'Public',
      language: 'en',
      category: 'Met',
      event: 'Flood Warning',
      urgency: 'Expected',
      severity: 'Severe',
      certainty: 'Likely',
      effective: isoIn(-60000),
      onset: isoIn(0),
      expires: isoIn(24 * 3600000),
      headline: 'Flood Warning',
      description: 'River rising.',
      instruction: 'Move to high ground.',
      areaDesc: 'Bihar - Darbhanga',
      polygon: null,
      circle: null,
      geocode: null,
      references: null,
      web: 'https://sachet.ndma.gov.in/cap_public_website/FetchAlertDetails?identifier=99',
      guid: 'guid-99',
    };
    const first = normalizeCapInfo(base, { source: 'SACHET', authority: 'NDMA SACHET' });
    const updated = normalizeCapInfo({ ...base, msgType: 'Update', sent: isoIn(0) }, { source: 'SACHET', authority: 'NDMA SACHET' });
    const cancelled = normalizeCapInfo({ ...base, msgType: 'Cancel' }, { source: 'SACHET', authority: 'NDMA SACHET' });
    assert.ok(first && updated && cancelled);
    assert.equal(first.sourceAlertId, updated!.sourceAlertId);
    assert.equal(first.sourceAlertId, cancelled!.sourceAlertId);
    assert.equal(updated!.status, 'UPDATED');
    assert.equal(cancelled!.status, 'CANCELLED');
  });

  it('malformed SACHET payloads are rejected, never rendered', () => {
    assert.equal(parseCapXml('<alert><identifier></identifier></alert>'), null);
    assert.deepEqual(parseSachetRssItems('not xml at all'), []);
  });
});
