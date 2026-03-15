import { Platform } from 'react-native';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Convert a UTF-8 string to a binary string safely without deprecated unescape/escape
function utf8ToBinary(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
        } else if (code < 0x10000) {
            bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
        } else {
            bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
        }
    }
    return String.fromCharCode(...bytes);
}

function binaryToUtf8(binary) {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}

export const encodeBase64 = (input) => {
    if (Platform.OS === 'web' && typeof btoa !== 'undefined') {
        return btoa(utf8ToBinary(input));
    }

    const utf8 = utf8ToBinary(input);
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

    if (Platform.OS === 'web' && typeof atob !== 'undefined') {
        try {
            const binary = atob(str);
            return binaryToUtf8(binary);
        } catch (e) {
            return null;
        }
    }

    if (str.length % 4 === 1) return null;

    let output = '';
    for (let bc = 0, bs, buffer, idx = 0;
        buffer = str.charAt(idx++);
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
            bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
        buffer = chars.indexOf(buffer);
    }

    try {
        return binaryToUtf8(output);
    } catch (e) {
        return null;
    }
};
