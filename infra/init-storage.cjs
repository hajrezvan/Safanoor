const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});
(async () => {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
      console.log('✅ Private storage bucket is ready.');
      return;
    } catch (error) {
      if (['BucketAlreadyExists', 'BucketAlreadyOwnedByYou'].includes(error.name)) return;
      if (attempt === 29) throw new Error('Storage initialization failed.');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
