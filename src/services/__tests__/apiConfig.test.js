import { buildApiUrl, getApiBaseUrl } from '../apiConfig';

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
        expect(buildApiUrl('/api/erp-login', 'android', {})).toBe('https://presence-gurjobanpanjeta.vercel.app/api/erp-login');
    });
});
