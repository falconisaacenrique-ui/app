/**
 * Password-based encryption for backups (AES-GCM, key derived via PBKDF2),
 * so data can move between devices through any channel — email, drive,
 * messaging — without anyone but the password holder being able to read it.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 200_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncryptedBackup(text: string): boolean {
  try {
    return JSON.parse(text).lifehub === 'encrypted-backup';
  } catch {
    return false;
  }
}

export async function encryptText(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encoder.encode(plain)),
  );
  return JSON.stringify({
    lifehub: 'encrypted-backup',
    v: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(data),
  });
}

/** Returns the decrypted text, or null if the password or payload is wrong. */
export async function decryptText(payload: string, password: string): Promise<string | null> {
  try {
    const obj = JSON.parse(payload);
    if (obj.lifehub !== 'encrypted-backup') return null;
    const key = await deriveKey(password, fromBase64(obj.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(obj.iv) as BufferSource },
      key,
      fromBase64(obj.data) as BufferSource,
    );
    return decoder.decode(plain);
  } catch {
    return null;
  }
}
