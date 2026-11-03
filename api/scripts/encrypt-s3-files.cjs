// Upgrade tracked development objects in place; keys and API references stay stable.
require('ts-node/register');
const { Client } = require('pg');
const {
  S3StorageAdapter,
  EncryptedStorageAdapter,
} = require('../src/modules/files/storage');
(async () => {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.STORAGE_DRIVER !== 's3'
  )
    throw new Error('Development S3 only');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const raw = new S3StorageAdapter();
  const secure = new EncryptedStorageAdapter(raw);
  await db.connect();
  let encrypted = 0,
    missing = 0,
    existing = 0;
  try {
    const { rows } = await db.query(
      'SELECT storage_key,mime_type FROM file_record',
    );
    for (const file of rows) {
      let body;
      try {
        body = await raw.get(file.storage_key);
      } catch (error) {
        if (
          error.name === 'NoSuchKey' ||
          error.$metadata?.httpStatusCode === 404
        ) {
          missing++;
          continue;
        }
        throw error;
      }
      if (
        body.subarray(0, 22).toString().startsWith('SAFANOOR-ENCRYPTED-V1\n')
      ) {
        await secure.get(file.storage_key);
        existing++;
        continue;
      }
      await secure.put(file.storage_key, body, file.mime_type);
      if (!(await secure.get(file.storage_key)).equals(body))
        throw new Error('Encrypted readback mismatch');
      encrypted++;
    }
    console.log('Tracked S3 objects:', {
      encrypted,
      alreadyEncrypted: existing,
      notPresentOnS3: missing,
    });
  } finally {
    await db.end();
    raw.destroy();
  }
})().catch((error) => {
  console.error('S3 encryption:', error.name, error.message);
  process.exitCode = 1;
});
