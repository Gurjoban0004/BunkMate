import { Platform } from 'react-native';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export const encodeBase64 = (input) => {
    // Helper to encode utf8 string to base64
    const utf8 = unescape(encodeURIComponent(input));

    if (Platform.OS === 'web' && typeof btoa !== 'undefined') {
        return btoa(utf8);
    }

    let str = String(utf8);
    let output = '';
    for (let block, charCode, idx = 0, map = chars;
        str.charAt(idx | 0) || (map = '=', idx % 1);
        output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
        charCode = str.charCodeAt(idx += 3 / 4);
        block = block << 8 | charCode;
    }
    return output;
};

export const decodeBase64 = (input) => {
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (Platform.OS === 'web' && typeof atob !== 'undefined') {
        try {
            output = atob(str);
            return decodeURIComponent(escape(output));
        } catch (e) {
            return null;
        }
    }

    if (str.length % 4 == 1) return null;

    for (let bc = 0, bs, buffer, idx = 0;
        buffer = str.charAt(idx++);
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
            bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
        buffer = chars.indexOf(buffer);
    }

    try {
        return decodeURIComponent(escape(output));
    } catch (e) {
        return null;
    }
};
