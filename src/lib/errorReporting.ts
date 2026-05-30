import { Alert, Platform } from 'react-native';

/**
 * Crash & error reporting — designed to be bulletproof.
 *
 * Hard rules:
 *  - This module must NEVER throw, even if Firebase, the network, or the JS
 *    runtime is in a broken state. It runs before React mounts, so a throw here
 *    means an instant crash with no log — the exact failure mode we're guarding
 *    against.
 *  - It imports NOTHING risky at module top. Firebase is loaded lazily inside
 *    persistCrash via dynamic import, so a broken Firebase init can't take the
 *    error handler down with it.
 */

// ErrorUtils is a React Native runtime global, not a named export.
type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsType = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
};

// Queue crashes that happen before Firebase is reachable, flush them later.
const pending: Array<Record<string, unknown>> = [];
const MAX_PENDING = 50;
let flushing = false;

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    });
  } catch {
    return String(value);
  }
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(safeStringify(value));
}

function buildReport(error: Error, isFatal: boolean, context?: string): Record<string, unknown> {
  return {
    message: (error?.message ?? String(error)).substring(0, 2000),
    stack: (error?.stack ?? '').substring(0, 4000),
    name: error?.name ?? 'Error',
    isFatal: !!isFatal,
    context: context ?? null,
    platform: Platform.OS,
    appState: 'running',
    ts_client: new Date().toISOString(),
  };
}

/**
 * Persist a crash report to Firestore. Never throws. If Firebase is unavailable
 * the report is queued and retried on the next successful call.
 */
async function persistCrash(report: Record<string, unknown>): Promise<void> {
  if (pending.length < MAX_PENDING) pending.push(report);
  await flushPending();
}

async function flushPending(): Promise<void> {
  if (flushing || pending.length === 0) return;
  flushing = true;
  try {
    // require() (not dynamic import) keeps Firebase out of this module's top-level
    // dependencies while still letting Jest intercept it. Loaded only when there's
    // actually something to report.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { collection, addDoc, serverTimestamp } = require('firebase/firestore');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require('./firebase');
    // Drain the queue; stop if any write fails so we retry next time.
    while (pending.length > 0) {
      const report = pending[0];
      await addDoc(collection(db, 'crash_reports'), { ...report, ts: serverTimestamp() });
      pending.shift();
    }
  } catch {
    // Firebase not ready or offline — keep the queue for the next attempt.
  } finally {
    flushing = false;
  }
}

let installed = false;

/**
 * Install global error handlers. Idempotent and never throws.
 */
export function setupErrorReporting(): void {
  if (installed) return;
  installed = true;

  // 1. Global uncaught JS error handler.
  try {
    const EU = (globalThis as { ErrorUtils?: ErrorUtilsType }).ErrorUtils;
    if (EU?.setGlobalHandler && EU?.getGlobalHandler) {
      const prev = EU.getGlobalHandler();
      EU.setGlobalHandler((error, isFatal) => {
        try {
          const e = toError(error);
          const report = buildReport(e, !!isFatal, 'globalHandler');
          // eslint-disable-next-line no-console
          console.error(`[CRASH][fatal=${isFatal}]`, report.message, '\n', report.stack);
          void persistCrash(report);
          if (__DEV__) {
            Alert.alert(isFatal ? '💥 Fatal crash' : '⚠️ JS Error', `${e.message}\n\n${e.stack ?? ''}`.substring(0, 1000));
          }
        } catch {
          // swallow — never re-throw inside the global handler
        }
        try {
          prev?.(error, isFatal);
        } catch {
          /* swallow */
        }
      });
    }
  } catch {
    /* swallow */
  }

  // 2. Hermes unhandled promise rejection tracker.
  try {
    const hermes = (globalThis as {
      HermesInternal?: {
        enablePromiseRejectionTracker?: (opts: {
          allRejections: boolean;
          onUnhandled: (id: number, error: unknown) => void;
        }) => void;
      };
    }).HermesInternal;
    hermes?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, error) => logError(error, 'unhandledPromiseRejection'),
    });
  } catch {
    /* swallow */
  }
}

/**
 * Manually log a non-fatal error. Never throws.
 */
export function logError(error: unknown, context?: string): void {
  try {
    const e = toError(error);
    // eslint-disable-next-line no-console
    console.error(`[ERROR][${context ?? 'manual'}]`, e.message);
    void persistCrash(buildReport(e, false, context));
  } catch {
    /* swallow */
  }
}

/**
 * Run a function, logging any throw instead of letting it propagate.
 * Returns the function's result, or `fallback` if it threw.
 */
export function safe<T>(fn: () => T, context: string, fallback?: T): T | undefined {
  try {
    return fn();
  } catch (e) {
    logError(e, context);
    return fallback;
  }
}

/**
 * Async variant of `safe`.
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    logError(e, context);
    return fallback;
  }
}
