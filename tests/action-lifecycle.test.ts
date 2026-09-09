import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { ACTION_STATUS, ACTION_TYPE, PRIORITY, ROLE_KEYS } from "@/lib/enums";

const dbPath=path.join(os.tmpdir(),`safanoor-actions-${Date.now()}.db`);
process.env.DATABASE_PATH=dbPath;
let service: typeof import("@/server/modules/plans/service");
const ids={user:"usr_test",student:"student_test",action:""};

describe("action lifecycle",()=>{
 beforeAll(async()=>{
  const sqlite=new Database(dbPath); migrate(drizzle(sqlite,{schema}),{migrationsFolder:path.join(process.cwd(),"drizzle")}); sqlite.close();
  const {db}=await import("@/db/client"); const now=new Date().toISOString();
  db.insert(schema.roles).values({id:"role_student",key:ROLE_KEYS.STUDENT,titleFa:"دانش‌آموز",createdAt:now}).run();
  db.insert(schema.users).values({id:ids.user,username:"action_student",passwordHash:"x",fullName:"دانش‌آموز تست",roleId:"role_student",isActive:true,createdAt:now,updatedAt:now}).run();
  db.insert(schema.grades).values({id:"grade_test",key:"test",titleFa:"پایه تست",ordering:1,createdAt:now}).run();
  db.insert(schema.students).values({id:ids.student,userId:ids.user,gradeId:"grade_test",status:"active",createdAt:now,updatedAt:now}).run();
  service=await import("@/server/modules/plans/service");
  const created = service.createAction({studentId:ids.student,title:"تمرین روزانه",type:ACTION_TYPE.PRACTICE,assigneeUserId:ids.user,startDate:"2019-12-01T00:00:00.000Z",deadline:"2020-01-01T00:00:00.000Z",status:ACTION_STATUS.TODO,priority:PRIORITY.HIGH,createdBy:ids.user});
  ids.action = created!.id;
 });
 afterAll(()=>{for(const suffix of ["","-wal","-shm"]){const p=`${dbPath}${suffix}`;if(fs.existsSync(p))fs.unlinkSync(p);}});
 it("accepts configured transitions",()=>{
  expect(service.transitionActionStatus(ids.action,ACTION_STATUS.IN_PROGRESS)!.status).toBe(ACTION_STATUS.IN_PROGRESS);
  expect(service.transitionActionStatus(ids.action,ACTION_STATUS.DONE)!.status).toBe(ACTION_STATUS.DONE);
 });
 it("rejects invalid transitions",()=>{
  expect(()=>service.transitionActionStatus(ids.action,ACTION_STATUS.CANCELLED)).toThrow("مجاز نیست");
 });
 it("only reports open overdue actions",()=>{
  service.transitionActionStatus(ids.action,ACTION_STATUS.IN_PROGRESS);
  expect(service.listOverdueActions({studentId:ids.student}).map(a=>a.id)).toContain(ids.action);
  service.transitionActionStatus(ids.action,ACTION_STATUS.DONE);
  expect(service.listOverdueActions({studentId:ids.student}).map(a=>a.id)).not.toContain(ids.action);
 });
});
