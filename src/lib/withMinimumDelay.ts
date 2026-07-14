/** Minimum visible duration for OTP / matching transitions (2–3s UX buffer). */
export const MIN_OTP_TRANSITION_MS = 2500;

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
