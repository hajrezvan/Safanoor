import 'dotenv/config';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://safanoor:safanoor_dev@localhost:55432/safanoor_test';
