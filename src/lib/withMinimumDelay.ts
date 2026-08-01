/** No artificial UI wait — resolve as soon as the underlying promise completes. */
export const MIN_OTP_TRANSITION_MS = 0;

export async function withMinimumDelay<T>(
  promise: Promise<T>,
  minimumMs = MIN_OTP_TRANSITION_MS,
): Promise<T> {
  const start = Date.now();
  const result = await promise;
  const remaining = minimumMs - (Date.now() - start);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return result;
}
