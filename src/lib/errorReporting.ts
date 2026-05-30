import { Alert } from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ErrorUtils is a RN runtime global, not a named export
declare const ErrorUtils: {
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

async function persistCrash(error: Error, isFatal: boolean, context?: string) {
  try {
    await addDoc(collection(db, 'crash_reports'), {
      message: error.message ?? String(error),
      stack: (error.stack ?? '').substring(0, 4000),
      isFatal: isFatal ?? false,
      context: context ?? null,
      platform: 'android',
      ts: serverTimestamp(),
    });
  } catch {
    // Never throw while handling a crash
  }
}

export function setupErrorReporting() {
  // 1. Global JS error handler (sync throws + unhandled promise rejections via Hermes)
  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const msg = error?.message ?? String(error);
    const stack = (error?.stack ?? '').substring(0, 800);
    console.error(`[CRASH][fatal=${isFatal}]`, msg, '\n', stack);
    persistCrash(error instanceof Error ? error : new Error(msg), isFatal ?? false);
    if (__DEV__) {
      Alert.alert(
        isFatal ? '💥 Fatal crash' : '⚠️ JS Error',
        msg + '\n\n' + stack,
        [{ text: 'OK' }],
      );
    }
    prevHandler(error, isFatal);
  });

  // 2. Intercept console.error to persist important runtime errors
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    // Only persist errors that look like real crashes, not React prop warnings
    if (msg.includes('Error') || msg.includes('crash') || msg.includes('exception')) {
      persistCrash(new Error(msg), false, 'console.error').catch(() => {});
    }
  };
}

export function logError(error: unknown, context?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  console.error(`[ERROR][${context ?? 'manual'}]`, e.message);
  persistCrash(e, false, context).catch(() => {});
}
