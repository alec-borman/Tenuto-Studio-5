export const TENUTO_CODE_STORAGE_KEY = 'tenuto_studio_5_code_memory_v1';
export const DEFAULT_CODE_DEBOUNCE_MS = 500;

export class DebouncedCodeMemory {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private pendingCode: string | null = null;
  private readonly storageKey: string;
  private readonly debounceMs: number;

  constructor(
    storageKey: string = TENUTO_CODE_STORAGE_KEY,
    debounceMs: number = DEFAULT_CODE_DEBOUNCE_MS
  ) {
    this.storageKey = storageKey;
    this.debounceMs = Math.max(50, debounceMs);
  }

  /**
   * Loads the persisted `.ten` source code from localStorage, falling back to `fallbackCode`
   * when storage is empty or unavailable.
   */
  public load(fallbackCode: string = 'pno: c4:4'): string {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return fallbackCode;
      }
      const saved = window.localStorage.getItem(this.storageKey);
      if (typeof saved === 'string' && saved.trim().length > 0) {
        return saved;
      }
    } catch {
      // Ignore storage read restrictions in sandboxed contexts
    }
    return fallbackCode;
  }

  /**
   * Schedules a debounced write to localStorage after `debounceMs` of idle time.
   * Resets the timer if called again before the window elapses.
   */
  public scheduleSave(code: string, onSaved?: (savedCode: string) => void): void {
    this.pendingCode = code;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
    }

    this.timerId = setTimeout(() => {
      this.timerId = null;
      const toWrite = this.pendingCode;
      this.pendingCode = null;
      if (toWrite !== null) {
        this.writeImmediate(toWrite);
        onSaved?.(toWrite);
      }
    }, this.debounceMs);
  }

  /**
   * Immediately commits any pending debounced code to localStorage (used on `beforeunload`
   * so refreshing the page mid-debounce never loses recent keystrokes).
   */
  public flush(onSaved?: (savedCode: string) => void): boolean {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.pendingCode !== null) {
      const toWrite = this.pendingCode;
      this.pendingCode = null;
      this.writeImmediate(toWrite);
      onSaved?.(toWrite);
      return true;
    }
    return false;
  }

  /**
   * Cancels any pending timer without writing to storage (used on component unmount in tests).
   */
  public cancelPending(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.pendingCode = null;
  }

  /**
   * Clears both pending timers and the persisted localStorage entry.
   */
  public clear(): void {
    this.cancelPending();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.storageKey);
      }
    } catch {
      // Ignore storage removal errors
    }
  }

  public hasPendingSave(): boolean {
    return this.pendingCode !== null;
  }

  private writeImmediate(code: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, code);
      }
    } catch {
      // Ignore quota or private-browsing storage errors
    }
  }
}
