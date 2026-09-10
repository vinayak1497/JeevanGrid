import { prisma } from '../../utils/prisma';
import { alertConfig, SourceHealth } from './alertConfig';

export interface SourceDefinition {
  name: string;
  authority: string;
  enabled: boolean;
  feedUrl?: string;
}

export function sourceDefinitions(): SourceDefinition[] {
  return [
    {
      name: 'SACHET',
      authority: 'NDMA SACHET (Common Alerting Protocol)',
      enabled: alertConfig.sachetEnabled,
      feedUrl: alertConfig.sachetFeedUrl,
    },
    {
      name: 'IMD',
      authority: 'India Meteorological Department',
      enabled: alertConfig.imdEnabled,
      feedUrl: alertConfig.imdApiBaseUrl || undefined,
    },
    {
      name: 'CWC',
      authority: 'Central Water Commission',
      enabled: alertConfig.cwcEnabled,
    },
    {
      name: 'INCOIS',
      authority: 'Indian National Centre for Ocean Information Services',
      enabled: alertConfig.incoisEnabled,
    },
  ];
}

/** Ensure one registry row per known source (idempotent). */
export async function ensureSourceStates() {
  for (const def of sourceDefinitions()) {
    const needsConfig =
      def.enabled &&
      ((def.name === 'IMD' && !alertConfig.imdApiKey) ||
        (def.name === 'CWC' && !alertConfig.cwcApiKey) ||
        (def.name === 'INCOIS' && !alertConfig.incoisApiKey));
    await prisma.alertSourceState.upsert({
      where: { name: def.name },
      update: {
        authority: def.authority,
        enabled: def.enabled,
        feedUrl: def.feedUrl ?? undefined,
        // Fail closed: disabled → UNAVAILABLE; enabled-but-uncredentialed → CONFIGURATION_REQUIRED.
        status: (!def.enabled
          ? ('UNAVAILABLE' as SourceHealth)
          : needsConfig
            ? ('CONFIGURATION_REQUIRED' as SourceHealth)
            : undefined) as SourceHealth | undefined,
      },
      create: {
        name: def.name,
        authority: def.authority,
        enabled: def.enabled,
        status: !def.enabled
          ? ('UNAVAILABLE' as SourceHealth)
          : needsConfig
            ? ('CONFIGURATION_REQUIRED' as SourceHealth)
            : ('UNAVAILABLE' as SourceHealth),
        feedUrl: def.feedUrl,
      },
    });
  }
}

export async function getSourceStates() {
  await ensureSourceStates().catch(() => undefined);
  return prisma.alertSourceState.findMany({ orderBy: { name: 'asc' } });
}

export async function updateSourceState(
  name: string,
  patch: Partial<{
    status: SourceHealth;
    lastAttemptAt: Date;
    lastSuccessAt: Date;
    lastDataAt: Date;
    lastError: string | null;
    responseTimeMs: number | null;
    recordsFetched: number;
    recordsAccepted: number;
    recordsRejected: number;
    etag: string | null;
    lastModified: string | null;
    enabled: boolean;
    feedUrl: string | null;
  }>
) {
  return prisma.alertSourceState.upsert({
    where: { name },
    update: { ...patch },
    create: {
      name,
      authority: name,
      enabled: true,
      status: 'UNAVAILABLE',
      ...patch,
    },
  });
}

export async function recordSourceAttempt(name: string) {
  return updateSourceState(name, { lastAttemptAt: new Date(), status: 'UNAVAILABLE' }).catch(
    () => undefined
  );
}
