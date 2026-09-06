import { buildApiUrl, getApiBaseUrl, setRuntimeApiBase, DEFAULT_NATIVE_API_BASE } from '../apiConfig';

afterEach(() => setRuntimeApiBase(''));

describe('apiConfig', () => {
    test('uses relative API paths on web', () => {
        expect(getApiBaseUrl('web', {})).toBe('');
        expect(buildApiUrl('/api/erp-login', 'web', {})).toBe('/api/erp-login');
    });

    test('uses Expo public API base for native builds when provided', () => {
        const env = { EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com/' };
        expect(getApiBaseUrl('android', env)).toBe('https://api.example.com');
        expect(buildApiUrl('/api/erp-login', 'android', env)).toBe('https://api.example.com/api/erp-login');
    });

    test('falls back to the production API host for native builds', () => {
        expect(buildApiUrl('/api/erp-login', 'android', {})).toBe(`${DEFAULT_NATIVE_API_BASE}/api/erp-login`);
    });

    test('a remote-config override wins over the build-time value, but only if it is an https origin', () => {
        const env = { EXPO_PUBLIC_API_BASE_URL: 'https://built-in.example' };
        setRuntimeApiBase('https://moved.example/');
        expect(getApiBaseUrl('android', env)).toBe('https://moved.example');
        setRuntimeApiBase('http://insecure.example');
        expect(getApiBaseUrl('android', env)).toBe('https://built-in.example');
        setRuntimeApiBase('https://evil.example/api/erp-login?x=');
        expect(getApiBaseUrl('android', env)).toBe('https://built-in.example');
        expect(getApiBaseUrl('web', env)).toBe('');
    });
});
