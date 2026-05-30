/**
 * registerPushToken must:
 *  - return null (never throw) on a simulator / when permission is denied
 *  - use an Expo push token when an EAS projectId is configured
 *  - fall back to the raw FCM device token when no projectId is present
 *  - persist whichever token it obtains
 *
 * Note: registerPushToken loads expo-notifications/-device/-constants via dynamic
 * import() at call time, so mocks must be top-level (always active) with mutable
 * state — doMock inside isolateModules would not apply to those late imports.
 */

// Mutable state — names must start with `mock` to be usable inside jest.mock factories.
let mockIsDevice = true;
let mockProjectId: string | undefined = 'proj-123';
const mockGetExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[abc]' });
const mockGetDevicePushTokenAsync = jest.fn().mockResolvedValue({ data: 'fcm-raw-token' });
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native', () => ({ __esModule: true, Platform: { OS: 'android' } }));
jest.mock('@/lib/errorReporting', () => ({ __esModule: true, logError: jest.fn() }));
jest.mock('@/lib/firebase', () => ({ __esModule: true, db: {} }));
jest.mock('firebase/firestore', () => ({
  __esModule: true,
  doc: jest.fn(() => ({})),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: jest.fn(),
}));
jest.mock('expo-device', () => ({
  __esModule: true,
  get isDevice() {
    return mockIsDevice;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  get default() {
    return { expoConfig: mockProjectId ? { extra: { eas: { projectId: mockProjectId } } } : {} };
  },
}));
jest.mock('expo-notifications', () => ({
  __esModule: true,
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  getDevicePushTokenAsync: (...args: unknown[]) => mockGetDevicePushTokenAsync(...args),
  AndroidImportance: { MAX: 5 },
}));

import { registerPushToken } from '@/lib/notifications';

beforeEach(() => {
  mockIsDevice = true;
  mockProjectId = 'proj-123';
  mockUpdateDoc.mockClear();
  mockGetExpoPushTokenAsync.mockClear();
  mockGetDevicePushTokenAsync.mockClear();
  mockGetPermissionsAsync.mockClear().mockResolvedValue({ status: 'granted' });
  mockRequestPermissionsAsync.mockClear().mockResolvedValue({ status: 'granted' });
});

describe('registerPushToken', () => {
  it('returns null on a non-physical device without throwing', async () => {
    mockIsDevice = false;
    await expect(registerPushToken('user-1')).resolves.toBeNull();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('uses an Expo push token when a projectId is configured', async () => {
    mockProjectId = 'proj-123';
    const token = await registerPushToken('user-1');
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-123' });
    expect(mockGetDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[abc]');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { push_token: 'ExponentPushToken[abc]' });
  });

  it('falls back to the raw FCM device token when no projectId is present', async () => {
    mockProjectId = undefined;
    const token = await registerPushToken('user-1');
    expect(mockGetDevicePushTokenAsync).toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(token).toBe('fcm-raw-token');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { push_token: 'fcm-raw-token' });
  });

  it('returns null when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await expect(registerPushToken('user-1')).resolves.toBeNull();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
