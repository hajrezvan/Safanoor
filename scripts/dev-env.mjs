import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const key=randomBytes(32).toString('base64');
const shared={DATABASE_URL:'postgresql://safanoor:safanoor_dev@localhost:55432/safanoor',JWT_SECRET:randomBytes(48).toString('hex'),ENCRYPTION_KEYS:JSON.stringify({v1:key}),ENCRYPTION_KEY_ID:'v1',NATIONAL_ID_HMAC_KEY:randomBytes(48).toString('hex'),APP_ORIGIN:'http://localhost:3033',HOST:'0.0.0.0',PORT:'3001',NODE_ENV:'development',MONEY_UNIT:'toman',STORAGE_DRIVER:'local',LOCAL_STORAGE_PATH:'.storage',STORAGE_SIGNING_KEY:randomBytes(48).toString('hex')};
if(!existsSync('api/.env')) { writeFileSync('api/.env',Object.entries(shared).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});console.log('🔑 Created local API environment with random development keys.'); }
if(!existsSync('ui/.env.local')) writeFileSync('ui/.env.local','API_INTERNAL_URL=http://localhost:3001\nNEXT_PUBLIC_API_BASE_URL=/\n',{mode:0o600});

if (!existsSync('.env')) writeFileSync('.env', `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nDB_APP_PASSWORD=${randomBytes(32).toString('hex')}\nS3_ACCESS_KEY=safanoor-local\nS3_SECRET_KEY=${randomBytes(32).toString('hex')}\nAPP_ORIGIN=http://localhost:8080\n`, {mode:0o600});
