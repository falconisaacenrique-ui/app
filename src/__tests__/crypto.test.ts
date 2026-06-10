import { describe, expect, it } from 'vitest';
import { decryptText, encryptText, isEncryptedBackup } from '../crypto';

describe('encrypted backups', () => {
  it('round-trips with the right password', async () => {
    const secret = JSON.stringify({ notes: ['private thought'] });
    const payload = await encryptText(secret, 'correct horse battery');
    expect(isEncryptedBackup(payload)).toBe(true);
    expect(payload).not.toContain('private thought');
    expect(await decryptText(payload, 'correct horse battery')).toBe(secret);
  });

  it('fails cleanly with the wrong password', async () => {
    const payload = await encryptText('data', 'right');
    expect(await decryptText(payload, 'wrong')).toBeNull();
  });

  it('rejects non-backup payloads', async () => {
    expect(isEncryptedBackup('{"foo":1}')).toBe(false);
    expect(await decryptText('not even json', 'pw')).toBeNull();
  });
});
