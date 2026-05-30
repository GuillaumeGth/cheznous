/**
 * The error reporting layer must NEVER throw — it runs before React mounts, so a
 * throw here is an instant crash with no log. These tests assert that invariant
 * across every entry point and every kind of broken input.
 */

// Mock react-native so importing errorReporting doesn't pull the native module.
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'android' },
}));

// persistCrash lazy-imports these; resolve them so the queue can drain.
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'crash-1' });
jest.mock('firebase/firestore', () => ({
  __esModule: true,
  collection: jest.fn(() => ({})),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: jest.fn(() => 'ts'),
}));
jest.mock('@/lib/firebase', () => ({ __esModule: true, db: {} }));

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

type ErrorReportingModule = typeof import('@/lib/errorReporting');

function freshImport(): ErrorReportingModule {
  let mod!: ErrorReportingModule;
  jest.isolateModules(() => {
    mod = require('@/lib/errorReporting');
  });
  return mod;
}

afterEach(() => {
  mockAddDoc.mockClear();
  delete (global as { ErrorUtils?: unknown }).ErrorUtils;
});

describe('setupErrorReporting', () => {
  it('does not throw when ErrorUtils global is absent', () => {
    delete (global as { ErrorUtils?: unknown }).ErrorUtils;
    const { setupErrorReporting } = freshImport();
    expect(() => setupErrorReporting()).not.toThrow();
  });

  it('does not throw when ErrorUtils is malformed', () => {
    (global as { ErrorUtils?: unknown }).ErrorUtils = { foo: 'bar' };
    const { setupErrorReporting } = freshImport();
    expect(() => setupErrorReporting()).not.toThrow();
  });

  it('installs a global handler that never throws, even on garbage input', () => {
    let installed: ((error: unknown, isFatal?: boolean) => void) | undefined;
    (global as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => () => {},
      setGlobalHandler: (h: (error: unknown, isFatal?: boolean) => void) => {
        installed = h;
      },
    };
    const { setupErrorReporting } = freshImport();
    setupErrorReporting();

    expect(installed).toBeDefined();
    expect(() => installed!(new Error('boom'), true)).not.toThrow();
    expect(() => installed!('a string error', false)).not.toThrow();
    expect(() => installed!(undefined, true)).not.toThrow();
    expect(() => installed!(null, false)).not.toThrow();
  });

  it('is idempotent — calling twice does not throw or double-install', () => {
    const setGlobalHandler = jest.fn();
    (global as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => () => {},
      setGlobalHandler,
    };
    const { setupErrorReporting } = freshImport();
    setupErrorReporting();
    setupErrorReporting();
    expect(setGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it('preserves and calls the previous global handler', () => {
    const prev = jest.fn();
    let installed: ((error: unknown, isFatal?: boolean) => void) | undefined;
    (global as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => prev,
      setGlobalHandler: (h: (error: unknown, isFatal?: boolean) => void) => {
        installed = h;
      },
    };
    const { setupErrorReporting } = freshImport();
    setupErrorReporting();
    const err = new Error('x');
    installed!(err, true);
    expect(prev).toHaveBeenCalledWith(err, true);
  });
});

describe('logError', () => {
  it('never throws for any input shape', () => {
    const { logError } = freshImport();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logError(new Error('e'), 'ctx')).not.toThrow();
    expect(() => logError('plain string')).not.toThrow();
    expect(() => logError(undefined)).not.toThrow();
    expect(() => logError(null)).not.toThrow();
    expect(() => logError(circular, 'circular')).not.toThrow();
    expect(() => logError(42)).not.toThrow();
  });

  it('attempts to persist the crash report', async () => {
    const { logError } = freshImport();
    logError(new Error('persist me'), 'unit');
    // Drain several microtask/macrotask cycles for the two awaited dynamic imports
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('does not throw when persistence fails', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('firestore down'));
    const { logError } = freshImport();
    expect(() => logError(new Error('e'), 'ctx')).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});

describe('safe', () => {
  it('returns the function result on success', () => {
    const { safe } = freshImport();
    expect(safe(() => 42, 'ctx')).toBe(42);
  });

  it('returns the fallback and does not throw on failure', () => {
    const { safe } = freshImport();
    const result = safe(() => {
      throw new Error('boom');
    }, 'ctx', 'fallback');
    expect(result).toBe('fallback');
  });

  it('returns undefined when no fallback is given and fn throws', () => {
    const { safe } = freshImport();
    expect(safe(() => {
      throw new Error('boom');
    }, 'ctx')).toBeUndefined();
  });
});

describe('safeAsync', () => {
  it('resolves the function result on success', async () => {
    const { safeAsync } = freshImport();
    await expect(safeAsync(async () => 7, 'ctx')).resolves.toBe(7);
  });

  it('resolves the fallback on rejection, never rejects', async () => {
    const { safeAsync } = freshImport();
    await expect(
      safeAsync(async () => {
        throw new Error('boom');
      }, 'ctx', 'fb'),
    ).resolves.toBe('fb');
  });
});
