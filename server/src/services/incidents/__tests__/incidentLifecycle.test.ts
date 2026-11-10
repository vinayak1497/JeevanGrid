/**
 * Pure incident lifecycle tests. No database or network access.
 *
 * Run: npx tsx --test src/services/incidents/__tests__/incidentLifecycle.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  canManageIncident,
  canRespondToIncident,
  INCIDENT_STATUS,
  LifecycleError,
  nextStatusForAction,
} from '../incidentLifecycleService';
import { generateEmergencyReportId, generateIncidentReference } from '../../../utils/idGenerator';

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: 'incident-1',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    assignedToId: 'responder-1',
    report: { reportedByUserId: 'citizen-1' },
    ...overrides,
  };
}

describe('incident references', () => {
  it('generates a non-sequential, non-guessable JG reference', () => {
    const value = generateIncidentReference(new Date('2026-11-10T10:00:00.000Z'));
    assert.match(value, /^JG-\d{4}-[A-Z2-9]{6}$/);
  });

  it('generates the emergency report identifier with the same non-guessable shape', () => {
    const value = generateEmergencyReportId(new Date('2026-11-10T10:00:00.000Z'));
    assert.match(value, /^JG-\d{4}-[A-Z2-9]{6}$/);
  });
});

describe('incident lifecycle transitions', () => {
  it('follows the explicit responder and DDMA workflows', () => {
    assert.equal(nextStatusForAction('NEW', 'VERIFY'), 'VERIFIED');
    assert.equal(nextStatusForAction('VERIFIED', 'ASSIGN'), 'ASSIGNED');
    assert.equal(nextStatusForAction('ASSIGNED', 'ACCEPT'), 'ACCEPTED');
    assert.equal(nextStatusForAction('ACCEPTED', 'EN_ROUTE'), 'EN_ROUTE');
    assert.equal(nextStatusForAction('EN_ROUTE', 'ARRIVE'), 'ON_SITE');
    assert.equal(nextStatusForAction('ON_SITE', 'START'), 'IN_PROGRESS');
    assert.equal(nextStatusForAction('IN_PROGRESS', 'SUBMIT_RESOLUTION'), 'RESOLVED_PENDING_REVIEW');
    assert.equal(nextStatusForAction('RESOLVED_PENDING_REVIEW', 'APPROVE_RESOLUTION'), 'RESOLVED');
  });

  it('rejects invalid transitions instead of silently coercing status', () => {
    assert.throws(() => nextStatusForAction('RESOLVED', 'START'), LifecycleError);
    assert.throws(() => nextStatusForAction('IN_PROGRESS', 'VERIFY'), LifecycleError);
    assert.throws(() => nextStatusForAction('IN_PROGRESS', 'NOT_AN_ACTION' as never), LifecycleError);
  });

  it('supports duplicate suspicion and reopen paths', () => {
    assert.equal(INCIDENT_STATUS.DUPLICATE_SUSPECTED, 'DUPLICATE_SUSPECTED');
    assert.equal(nextStatusForAction('NEW', 'MARK_DUPLICATE'), 'DUPLICATE_SUSPECTED');
    assert.equal(nextStatusForAction('RESOLVED', 'REOPEN'), 'REOPENED');
  });
});

describe('incident authorization scope', () => {
  it('allows a district officer to manage only their district', () => {
    const officer = { id: 'officer-1', role: 'DISTRICT_OFFICER', district: 'Mumbai Suburban', state: 'Maharashtra' };
    const stateOfficer = { id: 'eoc-1', role: 'STATE_EOC', district: 'Mumbai Suburban', state: 'Maharashtra' };
    assert.equal(canManageIncident(officer, incident()), true);
    assert.equal(canManageIncident(stateOfficer, incident()), true);
    assert.equal(
      canManageIncident({ ...officer, district: 'Pune' }, incident()),
      false
    );
  });

  it('lets only the assigned responder respond to an active incident', () => {
    const assignedResponder = { id: 'responder-1', role: 'FIELD_RESPONDER', district: 'Mumbai Suburban', state: 'Maharashtra' };
    const unassignedResponder = { id: 'responder-2', role: 'FIELD_RESPONDER', district: 'Mumbai Suburban', state: 'Maharashtra' };
    assert.equal(canRespondToIncident(assignedResponder, incident()), true);
    assert.equal(canRespondToIncident(unassignedResponder, incident()), false);
  });
});
