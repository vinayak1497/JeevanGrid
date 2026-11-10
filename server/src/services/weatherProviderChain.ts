/**
 * Ordered live-provider chain.
 *
 * A provider returns a usable value or `null`/throws when it cannot serve
 * the request. The chain returns the first usable value and stops there, so
 * a rate-limited provider never costs more than one attempt.
 */
export type LiveProvider<T> = () => Promise<T | null | undefined>;

export async function firstAvailableProvider<T>(
  providers: Array<LiveProvider<T>>,
  onError?: (error: unknown, providerIndex: number) => void
): Promise<T | null> {
  for (let index = 0; index < providers.length; index += 1) {
    try {
      const value = await providers[index]();
      if (value !== null && value !== undefined) return value;
    } catch (error) {
      onError?.(error, index);
    }
  }
  return null;
}
