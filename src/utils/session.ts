const SESSION_KEY = 'qmf_session_phone';

export function getStoredPhoneId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSession(phoneId: string): void {
  try {
    localStorage.setItem(SESSION_KEY, phoneId);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures
  }
}

export function hasActiveSession(): boolean {
  return getStoredPhoneId() !== null;
}
