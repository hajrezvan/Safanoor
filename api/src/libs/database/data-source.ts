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
import { PersonAncestorSummary1792195200017 } from './migrations/1792195200017-PersonAncestorSummary';
import { StudyPathCover1792195200018 } from './migrations/1792195200018-StudyPathCover';
import { Lms1792195200019 } from './migrations/1792195200019-Lms';
import { StudyPathItemFiles1792195200020 } from './migrations/1792195200020-StudyPathItemFiles';
import { PhotoAlbumTitle1792195200021 } from './migrations/1792195200021-PhotoAlbumTitle';

import { PolicySeed1792195200002 } from './migrations/1792195200002-PolicySeed';

import { StudyReading1792195200022 } from './migrations/1792195200022-StudyReading';

import { MemberFinance1792195200023 } from './migrations/1792195200023-MemberFinance';

import { Avatar1792195200024 } from './migrations/1792195200024-Avatar';
import { StorageSettings1792195200025 } from './migrations/1792195200025-StorageSettings';
import { ActiveRole1792195200026 } from './migrations/1792195200026-ActiveRole';
import { TechManagerReadPolicies1792195200027 } from './migrations/1792195200027-TechManagerReadPolicies';
import { RestrictSuperiorProfiles1792195200028 } from './migrations/1792195200028-RestrictSuperiorProfiles';

import { IndependentAssistantGroup1792195200029 } from './migrations/1792195200029-IndependentAssistantGroup';

import { ReadingPages1792195200030 } from './migrations/1792195200030-ReadingPages';
import { DirectorReports1792195200031 } from './migrations/1792195200031-DirectorReports';
import { CampStaffOnly1792195200032 } from './migrations/1792195200032-CampStaffOnly';
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
    PersonAncestorSummary1792195200017,
    StudyPathCover1792195200018,
    Lms1792195200019,
    StudyPathItemFiles1792195200020,
    PhotoAlbumTitle1792195200021,
    StudyReading1792195200022,
    MemberFinance1792195200023,
    Avatar1792195200024,
    StorageSettings1792195200025,
    ActiveRole1792195200026,
    TechManagerReadPolicies1792195200027,
    RestrictSuperiorProfiles1792195200028,
    IndependentAssistantGroup1792195200029,
    ReadingPages1792195200030,
    DirectorReports1792195200031,
    CampStaffOnly1792195200032,
  ],
  logging: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
};
export default new DataSource(databaseOptions);
