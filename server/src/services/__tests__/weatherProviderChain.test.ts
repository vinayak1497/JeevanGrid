/**
 * Live weather provider fallback chain.
 *
 * Open-Meteo is free but rate-limits shared datacenter IPs (HTTP 429).
 * A production instance on a shared IP must still return an honest live
 * observation, so the chain tries each provider in order and only reports
 * "unavailable" when every provider has genuinely failed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { firstAvailableProvider } from '../weatherProviderChain';

describe('live weather provider chain', () => {
  it('returns the first provider that succeeds', async () => {
    const order: string[] = [];
    const result = await firstAvailableProvider<string>([
      async () => {
        order.push('a');
        return null;
      },
      async () => {
        order.push('b');
        return 'live-observation';
      },
      async () => {
        order.push('c');
        return 'never-reached';
      },
    ]);

    assert.equal(result, 'live-observation');
    assert.deepEqual(order, ['a', 'b']);
  });

  it('falls through a provider that throws instead of aborting the chain', async () => {
    const result = await firstAvailableProvider<string>([
      async () => {
        throw new Error('HTTP 429');
      },
      async () => 'recovered',
    ]);

    assert.equal(result, 'recovered');
  });

  it('returns null when every provider fails or is empty', async () => {
    const result = await firstAvailableProvider<string>([
      async () => null,
      async () => {
        throw new Error('network unreachable');
      },
      async () => undefined as unknown as string,
    ]);

    assert.equal(result, null);
  });

  it('does not call later providers once one succeeds', async () => {
    let laterCalls = 0;
    await firstAvailableProvider<string>([
      async () => 'ok',
      async () => {
        laterCalls += 1;
        return 'no';
      },
    ]);

    assert.equal(laterCalls, 0);
  });
});
