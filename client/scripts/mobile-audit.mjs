/**
 * Mobile layout audit.
 *
 * Walks every route at a small-phone width and reports:
 *  - horizontal overflow (document wider than the viewport)
 *  - any element whose box extends past the viewport's right edge
 *  - interactive controls smaller than the 44px tap-target floor
 *  - console errors
 *
 * Run: node scripts/mobile-audit.mjs
 */
import { createRequire } from 'node:module';

// Playwright is not a project dependency. Resolve it from the machine-level
// install so this audit runs without adding a dependency to the app.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:3001';
const WIDTH = Number(process.env.AUDIT_WIDTH || 360);
const HEIGHT = Number(process.env.AUDIT_HEIGHT || 740);

const ROUTES = [
  { path: '/', name: 'Landing' },
  { path: '/alerts', name: 'Alerts' },
  { path: '/guides', name: 'Guides' },
  { path: '/guides/flood', name: 'GuideDetail' },
  { path: '/resources', name: 'Resources' },
  { path: '/risk/Mumbai', name: 'RiskDashboard' },
  { path: '/report-emergency', name: 'EmergencyReport' },
  { path: '/assistant', name: 'Assistant' },
  { path: '/login', name: 'Login' },
  { path: '/register', name: 'Register' },
  { path: '/dashboard/district', name: 'DistrictDashboard', auth: 'district@demo.com' },
  { path: '/dashboard/responder', name: 'ResponderDashboard', auth: 'responder@demo.com' },
  { path: '/dashboard/health', name: 'HealthDashboard', auth: 'health@demo.com' },
  { path: '/dashboard/state', name: 'StateEocDashboard', auth: 'state@demo.com' },
  { path: '/dashboard/volunteer', name: 'VolunteerDashboard', auth: 'volunteer@demo.com' },
];

const auditScript = () => {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const overflow = doc.scrollWidth > vw + 1;

  const offenders = [];
  const small = [];

  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    const text = (el.textContent || '').trim().slice(0, 34);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };

  const all = Array.from(document.querySelectorAll('body *'));

  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Right-edge overflow past the viewport.
    if (rect.right > vw + 1.5) {
      const style = getComputedStyle(el);
      // Elements inside a deliberate horizontal scroller or a clipping
      // container (Leaflet panes) are not page-level overflow.
      let contained = false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const ps = getComputedStyle(parent);
        if (
          ps.overflowX === 'auto' ||
          ps.overflowX === 'scroll' ||
          ps.overflowX === 'hidden' ||
          ps.overflow === 'hidden' ||
          parent.classList.contains('leaflet-container')
        ) {
          contained = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!contained && style.position !== 'fixed') {
        offenders.push({
          reason: 'right-overflow',
          overflowPx: Math.round(rect.right - vw),
          el: describe(el),
        });
      }
    }

    // Tap target floor.
    const tag = el.tagName.toLowerCase();
    const interactive =
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      el.getAttribute('role') === 'button';
    if (interactive && el.offsetParent !== null) {
      // Inline links inside a paragraph are text, not targets.
      const inlineInText =
        tag === 'a' && getComputedStyle(el).display === 'inline' && rect.height < 30;
      // Leaflet's own markers and controls are map chrome, not page UI.
      const inMap = Boolean(el.closest('.leaflet-container'));
      // A checkbox inside a large label inherits the label as its hit area.
      const wrappedInLabel = (tag === 'input' && el.type === 'checkbox') || el.type === 'radio';
      const labelHit = wrappedInLabel
        ? el.closest('label')?.getBoundingClientRect()
        : null;
      const effective = labelHit && labelHit.height >= 44 && labelHit.width >= 44;

      const tooShort = rect.height < 44;
      // Width only matters for icon-style controls, not text links.
      const tooNarrow = rect.width < 44 && !effective && tag !== 'a';

      if (!inlineInText && !inMap && !effective && (tooShort || tooNarrow)) {
        small.push({
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          el: describe(el),
        });
      }
    }
  }

  // Fixed elements that overlap each other.
  const fixed = Array.from(document.querySelectorAll('body *'))
    .filter((el) => getComputedStyle(el).position === 'fixed')
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter((x) => x.rect.width > 0 && x.rect.height > 0);

  const overlaps = [];
  for (let i = 0; i < fixed.length; i += 1) {
    for (let j = i + 1; j < fixed.length; j += 1) {
      const a = fixed[i].rect;
      const b = fixed[j].rect;
      // Ignore an element fully containing the other.
      if (a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom) continue;
      if (b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom) continue;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 4 && oy > 4) {
        overlaps.push({
          overlap: `${Math.round(ox)}x${Math.round(oy)}`,
          a: describe(fixed[i].el),
          b: describe(fixed[j].el),
        });
      }
    }
  }

  return {
    overflow,
    scrollWidth: doc.scrollWidth,
    clientWidth: vw,
    offenders: offenders.slice(0, 12),
    small: small.slice(0, 12),
    smallCount: small.length,
    overlaps: overlaps.slice(0, 8),
  };
};

const run = async () => {
  const browser = await chromium.launch({
    // Reuse an already-downloaded Chromium so the audit does not need a
    // browser download on a fresh machine.
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 200)}`));

  let failures = 0;

  const login = async (email) => {
    const res = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email, password: 'Password123!' },
    });
    if (!res.ok()) return null;
    const body = await res.json();
    // localStorage is only reachable on a real origin.
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.evaluate((token) => {
      localStorage.setItem('jeevangrid_token', token);
    }, body.token);
    return body.token;
  };

  for (const route of ROUTES) {
    consoleErrors.length = 0;
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    if (route.auth) {
      const token = await login(route.auth);
      if (!token) {
        console.log(`SKIP  ${route.path.padEnd(26)} ${route.name.padEnd(20)} login failed`);
        continue;
      }
    } else {
      await page.evaluate(() => localStorage.removeItem('jeevangrid_token'));
    }
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(900);
    const result = await page.evaluate(auditScript);

    const issues = [];
    if (result.overflow) issues.push(`H-OVERFLOW ${result.scrollWidth}>${result.clientWidth}`);
    if (result.offenders.length) issues.push(`${result.offenders.length} right-overflow`);
    if (result.smallCount) issues.push(`${result.smallCount} small tap targets`);
    if (result.overlaps.length) issues.push(`${result.overlaps.length} fixed overlaps`);
    if (consoleErrors.length) issues.push(`${consoleErrors.length} console errors`);

    if (issues.length) failures += 1;
    console.log(
      `${issues.length ? 'FAIL' : 'PASS'}  ${route.path.padEnd(26)} ${route.name.padEnd(20)} ${
        issues.join(' | ') || 'clean'
      }`
    );

    if (result.offenders.length) {
      for (const o of result.offenders) {
        console.log(`        ↳ right-overflow +${o.overflowPx}px  ${o.el}`);
      }
    }
    if (result.overlaps.length) {
      for (const o of result.overlaps) {
        console.log(`        ↳ overlap ${o.overlap}  ${o.a}  ⟷  ${o.b}`);
      }
    }
    if (result.small.length) {
      for (const s of result.small) {
        console.log(`        ↳ tap ${s.size}  ${s.el}`);
      }
    }
    if (consoleErrors.length) {
      for (const e of consoleErrors.slice(0, 4)) console.log(`        ↳ console: ${e}`);
    }
  }

  await browser.close();
  console.log(`\n${ROUTES.length - failures}/${ROUTES.length} routes clean at ${WIDTH}px`);
  process.exit(failures > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
