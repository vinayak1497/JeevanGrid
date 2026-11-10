/**
 * Live production E2E — full citizen incident lifecycle against the
 * deployed Render API.
 *
 * guest submit -> duplicate click -> DDMA verify -> assign ->
 * responder accept -> en route -> GPS check-in -> start ->
 * situation update -> resolution -> DDMA approve -> resolved
 *
 * Also asserts negative authorization and validation cases.
 * Run: node e2e-live.mjs
 */
const BASE = process.env.E2E_BASE || 'https://jeevangrid.onrender.com/api';

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
}

function expect(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function login(email) {
  const res = await api('/auth/login', { method: 'POST', body: { email, password: 'Password123!' } });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.body;
}

async function main() {
  console.log(`\n=== LIVE E2E against ${BASE} ===\n`);

  const officer = await login('district@demo.com');
  const responder = await login('responder@demo.com');
  console.log(`  ✓ authenticated district officer + field responder`);

  // ---- 1. Guest submit -------------------------------------------------
  const idempotencyKey = `LIVE${Date.now()}`;
  const payload = {
    citizenName: 'Live E2E Citizen',
    phone: '+919999999997',
    locationName: 'Live E2E Marker, Mumbai Suburban',
    latitude: 19.0349,
    longitude: 72.8577,
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    emergencyType: 'FLOODING',
    urgency: 'HIGH',
    peopleAffected: 4,
    description: 'Live production end-to-end flood report for lifecycle verification.',
    reportSource: 'AI_ASSISTANT',
    originalDescription: 'Live production end-to-end flood report for lifecycle verification.',
    aiSummary: 'Live advisory summary.',
    accuracyM: 25,
    locationSource: 'GPS',
    locationCapturedAt: new Date().toISOString(),
    locationConfirmed: true,
    idempotencyKey,
  };

  const submit = await api('/emergency-reports', { method: 'POST', body: payload });
  expect(submit.status === 201, `guest submission accepted (201) — got ${submit.status}`);
  expect(submit.body.created === true, 'first submission created a new record');
  expect(submit.body.incidentStatus === 'NEW', `incident starts NEW — got ${submit.body.incidentStatus}`);
  expect(submit.body.verificationStatus === 'UNVERIFIED', 'report starts UNVERIFIED');
  expect(/^JG-\d{4}-[A-Z2-9]{6}$/.test(submit.body.incidentReference), `reference format JG-YYYY-XXXXXX — got ${submit.body.incidentReference}`);
  const reportId = submit.body.reportId;
  const incidentId = submit.body.incidentId;

  // ---- 2. Duplicate click ----------------------------------------------
  const dup = await api('/emergency-reports', { method: 'POST', body: payload });
  expect(dup.status === 200, `duplicate click returns 200 — got ${dup.status}`);
  expect(dup.body.duplicate === true, 'duplicate detected');
  expect(dup.body.created === false, 'duplicate created no new record');
  expect(dup.body.reportId === reportId, 'duplicate returned the original report id');

  // ---- 3. Validation ---------------------------------------------------
  const bad = await api('/emergency-reports', {
    method: 'POST',
    body: { ...payload, idempotencyKey: `LIVE${Date.now()}B`, longitude: null },
  });
  expect(bad.status === 400, `coordinate-pair validation rejected (400) — got ${bad.status}`);

  // ---- 4. Authorization ------------------------------------------------
  const anon = await api(`/incidents/${incidentId}`);
  expect(anon.status === 401, `anonymous incident read blocked (401) — got ${anon.status}`);

  const responderEarly = await api(`/incidents/${incidentId}/responder-action`, {
    method: 'PATCH',
    token: responder.token,
    body: { action: 'ACCEPT' },
  });
  expect(responderEarly.status === 403, `unassigned responder blocked (403) — got ${responderEarly.status}`);

  const citizenVerify = await api(`/incidents/${incidentId}/verify`, {
    method: 'PATCH',
    token: responder.token,
    body: { note: 'Responder must not be able to verify.' },
  });
  expect(citizenVerify.status === 403, `responder cannot verify (403) — got ${citizenVerify.status}`);

  // ---- 5. DDMA verify + assign ----------------------------------------
  const verify = await api(`/incidents/${incidentId}/verify`, {
    method: 'PATCH',
    token: officer.token,
    body: { note: 'Live E2E DDMA verification after human review.' },
  });
  expect(verify.status === 200, `DDMA verify ok — ${verify.status}`);
  expect(verify.body.incident.status === 'VERIFIED', `status VERIFIED — got ${verify.body.incident.status}`);

  const assign = await api(`/incidents/${incidentId}/assign`, {
    method: 'PATCH',
    token: officer.token,
    body: { responderId: responder.user.id, notes: 'Live E2E assignment.' },
  });
  expect(assign.status === 200, `DDMA assign ok — ${assign.status}`);
  expect(assign.body.incident.status === 'ASSIGNED', `status ASSIGNED — got ${assign.body.incident.status}`);

  // ---- 6. Responder lifecycle -----------------------------------------
  const accept = await api(`/incidents/${incidentId}/responder-action`, {
    method: 'PATCH', token: responder.token, body: { action: 'ACCEPT' },
  });
  expect(accept.body.incident.status === 'ACCEPTED', `status ACCEPTED — got ${accept.body.incident?.status}`);

  const enRoute = await api(`/incidents/${incidentId}/responder-action`, {
    method: 'PATCH', token: responder.token, body: { action: 'EN_ROUTE' },
  });
  expect(enRoute.body.incident.status === 'EN_ROUTE', `status EN_ROUTE — got ${enRoute.body.incident?.status}`);

  const checkIn = await api(`/incidents/${incidentId}/check-in`, {
    method: 'POST',
    token: responder.token,
    body: { source: 'GPS', latitude: 19.0349, longitude: 72.8577, accuracyM: 22, note: 'Live E2E GPS check-in.' },
  });
  expect(checkIn.status === 201, `GPS check-in ok — ${checkIn.status}`);
  expect(checkIn.body.incident.status === 'ON_SITE', `status ON_SITE — got ${checkIn.body.incident?.status}`);
  expect(checkIn.body.fieldReport?.reportType === 'ARRIVAL', 'arrival field report recorded');

  const start = await api(`/incidents/${incidentId}/responder-action`, {
    method: 'PATCH', token: responder.token, body: { action: 'START' },
  });
  expect(start.body.incident.status === 'IN_PROGRESS', `status IN_PROGRESS — got ${start.body.incident?.status}`);

  const situation = await api('/field-reports', {
    method: 'POST',
    token: responder.token,
    body: {
      incidentId,
      situationReport: 'Live E2E on-site situation update.',
      casualtiesRescued: 3,
      medicalRequired: false,
      markCompleted: false,
    },
  });
  expect(situation.status === 201, `situation update ok — ${situation.status}`);
  expect(situation.body.incidentStatus === 'IN_PROGRESS', `status stays IN_PROGRESS — got ${situation.body.incidentStatus}`);

  const resolution = await api(`/incidents/${incidentId}/resolution`, {
    method: 'POST',
    token: responder.token,
    body: {
      workCompleted: 'Live E2E response completed and area cleared.',
      situationAfter: 'Live E2E situation after response reviewed.',
      peopleAssisted: 3,
      remainingProblems: null,
      medicalRequired: false,
      notes: 'Live E2E resolution submitted for DDMA review.',
      latitude: 19.0349,
      longitude: 72.8577,
      accuracyM: 24,
    },
  });
  expect(resolution.status === 201, `resolution submitted — ${resolution.status}`);
  expect(
    resolution.body.incidentStatus === 'RESOLVED_PENDING_REVIEW',
    `status RESOLVED_PENDING_REVIEW — got ${resolution.body.incidentStatus}`
  );

  // ---- 7. DDMA review ---------------------------------------------------
  const review = await api(`/incidents/${incidentId}/review-resolution`, {
    method: 'POST',
    token: officer.token,
    body: { decision: 'APPROVE', note: 'Live E2E DDMA approved the resolution.' },
  });
  expect(review.status === 200, `DDMA review ok — ${review.status}`);
  expect(review.body.incident.status === 'RESOLVED', `final status RESOLVED — got ${review.body.incident?.status}`);

  // ---- 8. Audit trail ---------------------------------------------------
  const final = await api(`/incidents/${incidentId}`, { token: officer.token });
  expect(final.status === 200, `incident read back ok — ${final.status}`);
  const events = final.body.incident.events || [];
  const eventTypes = events.map((e) => e.eventType);
  expect(events.length === 10, `append-only event ledger has 10 events — got ${events.length}`);
  expect(eventTypes[0] === 'REPORT_SUBMITTED', 'first event REPORT_SUBMITTED');
  expect(eventTypes[eventTypes.length - 1] === 'RESOLUTION_APPROVED', 'last event RESOLUTION_APPROVED');
  expect(final.body.incident.resolutionDecision === 'APPROVED', 'resolution decision APPROVED');

  // ---- 9. Scoped read ---------------------------------------------------
  const citizenList = await api('/emergency-reports', { token: responder.token });
  expect(citizenList.status === 200, `scoped report list ok — ${citizenList.status}`);

  console.log(`\n  events: ${eventTypes.join(' -> ')}`);
  console.log(`\n=== LIVE E2E PASSED ===\n`);
}

main().catch((error) => {
  console.error('\n=== LIVE E2E FAILED ===');
  console.error(error.message || error);
  process.exit(1);
});
