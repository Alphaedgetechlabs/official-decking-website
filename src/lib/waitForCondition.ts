export function waitForCondition(
  getValue: () => unknown,
  timeoutMs = 60_000,
  intervalMs = 40,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const tick = () => {
      if (getValue()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Timed out waiting for background task.'));
        return;
      }
      setTimeout(tick, intervalMs);
    };

    tick();
  });
}
