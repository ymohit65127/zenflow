// AES-256-GCM credential encryption/decryption
// Credentials are encrypted with an org-scoped key derived from org_id + ENCRYPTION_SECRET

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function deriveKey(orgId: string): Buffer {
  const secret = process.env.ENCRYPTION_SECRET ?? 'zenflow-default-secret-change-in-production';
  return crypto.scryptSync(orgId + secret, 'zenflow-salt', 32);
}

export type EncryptedCredentials = {
  iv: string;
  tag: string;
  ciphertext: string;
};

export function encryptCredentials(
  data: Record<string, unknown>,
  orgId: string
): EncryptedCredentials {
  const key = deriveKey(orgId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(data);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

export function decryptCredentials(
  enc: EncryptedCredentials,
  orgId: string
): Record<string, unknown> {
  const key = deriveKey(orgId);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(enc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, 'hex')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>;
}
