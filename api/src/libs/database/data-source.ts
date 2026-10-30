import { Defaults1792195200003 } from './migrations/1792195200003-Defaults';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Foundation1792195200000 } from './migrations/1792195200000-Foundation';
import { Invariants1792195200001 } from './migrations/1792195200001-Invariants';
import { OptionalIdentity1792195200004 } from './migrations/1792195200004-OptionalIdentity';
import { AssistantInvite1792195200005 } from './migrations/1792195200005-AssistantInvite';
import { Communications1792195200006 } from './migrations/1792195200006-Communications';
import { Meetings1792195200007 } from './migrations/1792195200007-Meetings';
import { StudyPath1792195200008 } from './migrations/1792195200008-StudyPath';
import { Finance1792195200009 } from './migrations/1792195200009-Finance';
import { Camps1792195200010 } from './migrations/1792195200010-Camps';
import { Album1792195200011 } from './migrations/1792195200011-Album';
import { Consultations1792195200012 } from './migrations/1792195200012-Consultations';
import { ConsultationPrivateNote1792195200013 } from './migrations/1792195200013-ConsultationPrivateNote';
import { LocationOption1792195200014 } from './migrations/1792195200014-LocationOption';
import { ProgramEventAmounts1792195200015 } from './migrations/1792195200015-ProgramEventAmounts';
import { DashboardPolicy1792195200016 } from './migrations/1792195200016-DashboardPolicy';

import { PolicySeed1792195200002 } from './migrations/1792195200002-PolicySeed';

config();
export const databaseOptions = {
  type: 'postgres' as const,
  url:
    process.env.DATABASE_URL ??
    'postgresql://safanoor:safanoor_dev@localhost:55432/safanoor',
  synchronize: false,
  migrations: [
    Foundation1792195200000,
    Invariants1792195200001,
    PolicySeed1792195200002,
    Defaults1792195200003,
    OptionalIdentity1792195200004,
    AssistantInvite1792195200005,
    Communications1792195200006,
    Meetings1792195200007,
    StudyPath1792195200008,
    Finance1792195200009,
    Camps1792195200010,
    Album1792195200011,
    Consultations1792195200012,
    ConsultationPrivateNote1792195200013,
    LocationOption1792195200014,
    ProgramEventAmounts1792195200015,
    DashboardPolicy1792195200016,
  ],
  logging: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
};
export default new DataSource(databaseOptions);
