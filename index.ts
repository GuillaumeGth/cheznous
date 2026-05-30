// Error reporting must be installed FIRST, before any other module is
// evaluated, so that a throw during module initialization (the failure mode
// that causes an instant crash with no log) is captured.
import { setupErrorReporting, logError } from './src/lib/errorReporting';

setupErrorReporting();

// Load the app entry via require (not a static import) so it runs AFTER the
// handlers above are installed, and so a synchronous throw during module
// evaluation is caught and logged instead of killing the process silently.
try {
  require('expo-router/entry');
} catch (e) {
  logError(e, 'app-entry-init');
  // Re-throw so the platform still surfaces the failure, but now it's logged.
  throw e;
}
