import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import {
  FinanceDemoDto,
  CostItemDto,
  MemberFinanceDto,
  CreateCostItemDto,
  CreateProgramEventDto,
  ProgramEventDetailDto,
  ProgramEventSummaryDto,
  ProgramEventsPageDto,
} from './finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async mine(actor: Actor): Promise<MemberFinanceDto> {
    await this.access.require(
      actor,
      'read',
      {
        type: 'member_finance',
        ownerId: actor.personId,
      },
      'detail',
    );
    const membership = await one<{ groupId: string }>(
      this.db,
      `SELECT group_id AS "groupId" FROM membership
       WHERE person_id=$1 AND role='member' AND valid_to IS NULL`,
      [actor.personId],
    );
    if (!membership)
      return { groupId: null, canViewGroupFinance: false, status: 'no_group' };
    const { groupId } = membership;
    const canViewGroupFinance =
      (await this.access.level(actor, 'read', {
        type: 'program_event',
        groupIds: [groupId],
      })) === 'detail';
    const result = await one<{ hasCosts: boolean }>(
      this.db,
      `SELECT EXISTS(
        SELECT 1 FROM program_event p WHERE p.group_id=$1 AND (
          p.total_amount>0 OR p.member_payment_amount>0 OR EXISTS(
            SELECT 1 FROM cost_item c WHERE c.owner_type='program_event'
            AND c.owner_id=p.id AND c.amount>0
          )
        )
      ) AS "hasCosts"`,
      [groupId],
    );
    return {
      ...(process.env.NODE_ENV === 'development' &&
      !actor.isParent &&
      !actor.isAdmin &&
      !actor.external
        ? { demoAvailable: true }
        : {}),
      groupId,
      canViewGroupFinance,
      status: result?.hasCosts ? 'costs_defined' : 'no_costs',
    };
  }

  async demo(actor: Actor): Promise<FinanceDemoDto> {
    if (
      process.env.NODE_ENV !== 'development' ||
      actor.isParent ||
      actor.external ||
      actor.isAdmin
    )
      throw new NotFoundException();
    await this.access.require(
      actor,
      'read',
      { type: 'member_finance', ownerId: actor.personId },
      'detail',
    );
    const samples = [
      {
        id: 'sample-camp',
        title: 'اردوی مشهد — نمونه',
        date: '2026-11-06',
        lines: [
          { title: 'رفت‌وبرگشت', amount: 400000 },
          { title: 'خوراک', amount: 500000 },
          { title: 'اقامت', amount: 300000 },
        ],
        payments: [
          { date: '2026-11-01', amount: 700000 },
          { date: '2026-11-04', amount: 500000 },
        ],
      },
      {
        id: 'sample-trip',
        title: 'برنامهٔ فرهنگی یک‌روزه — نمونه',
        date: '2026-11-18',
        lines: [
          { title: 'رفت‌وبرگشت', amount: 300000 },
          { title: 'ورودی و برنامه', amount: 250000 },
          { title: 'خوراک', amount: 300000 },
        ],
        payments: [{ date: '2026-11-09', amount: 350000 }],
      },
      {
        id: 'sample-books',
        title: 'بستهٔ کتاب سیر مطالعاتی — نمونه',
        date: '2026-11-10',
        lines: [
          { title: 'دو جلد کتاب', amount: 250000 },
          { title: 'ارسال', amount: 30000 },
        ],
        payments: [],
      },
    ];
    const items = samples.map((item) => {
      const amount = item.lines.reduce((sum, line) => sum + line.amount, 0);
      const paid = item.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      return {
        ...item,
        amount,
        paid,
        remaining: amount - paid,
        status:
          paid === amount
            ? ('settled' as const)
            : paid > 0
              ? ('partial' as const)
              : ('unpaid' as const),
      };
    });
    return {
      isDemo: true,
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      paid: items.reduce((sum, item) => sum + item.paid, 0),
      remaining: items.reduce((sum, item) => sum + item.remaining, 0),
    };
  }

  async list(
    actor: Actor,
    groupId: string,
    query: PaginationDto,
  ): Promise<ProgramEventsPageDto> {
    await this.access.require(
      actor,
      'read',
      { type: 'program_event', groupIds: [groupId] },
      'detail',
    );
    await this.requireVisibleGroup(groupId);
    const canManage = await this.canManageGroup(actor, groupId);
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM program_event p WHERE p.group_id=$1',
      [groupId],
    );
    const items = await rows<ProgramEventSummaryDto>(
      this.db,
      `SELECT p.id,p.group_id AS "groupId",p.kind,p.title,p.camp_id AS "campId",
        p.held_at AS "heldAt",p.place,p.notes,
        p.total_amount AS "totalAmount",
        p.member_payment_amount AS "memberPaymentAmount",
        COALESCE((
          SELECT count(*)::int FROM cost_item c
          WHERE c.owner_type='program_event' AND c.owner_id=p.id
        ),0) AS "itemCount",
        p.created_by AS "createdBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
        $2::boolean AS "canManage"
       FROM program_event p
       WHERE p.group_id=$1
       ORDER BY p.created_at DESC,p.id
       LIMIT $3 OFFSET $4`,
      [groupId, canManage, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async create(
    actor: Actor,
    groupId: string,
    input: CreateProgramEventDto,
  ): Promise<ProgramEventDetailDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'program_event', groupIds: [groupId] },
      'detail',
    );
    await this.requireManagedGroup(actor, groupId);

    const totalAmount = this.parseAmount(input.totalAmount, 'مبلغ کل');
    const memberPaymentAmount = this.parseAmount(
      input.memberPaymentAmount,
      'مبلغ پرداختی نیروها',
    );

    if (input.kind === 'camp') {
      if (!input.campId)
        throw new BadRequestException('اردو را از فهرست اردوها انتخاب کن.');
      return this.createForCamp(
        actor,
        groupId,
        input.campId,
        totalAmount,
        memberPaymentAmount,
      );
    }

    const title = input.title?.trim() ?? '';
    if (title.length < 2) throw new BadRequestException('عنوان را وارد کن.');
    const heldAt = this.parseHeldAt(input.heldAt);
    const place = input.place?.trim() || null;
    const notes = input.notes?.trim() || null;
    const created = await this.db.transaction(async (manager) => {
      const row = await one<{ id: string }>(
        manager,
        `INSERT INTO program_event(
           group_id,kind,title,held_at,place,notes,
           total_amount,member_payment_amount,created_by
         )
         VALUES($1,'custom',$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          groupId,
          title,
          heldAt,
          place,
          notes,
          totalAmount,
          memberPaymentAmount,
          actor.personId,
        ],
      );
      if (!row) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'program_event.created',
        'program_event',
        row.id,
        { kind: 'custom' },
        manager,
      );
      return row;
    });
    return this.get(actor, created.id);
  }

  private async createForCamp(
    actor: Actor,
    groupId: string,
    campId: string,
    totalAmount: number,
    memberPaymentAmount: number,
  ): Promise<ProgramEventDetailDto> {
    const camp = await one<{
      id: string;
      groupId: string;
      title: string;
      place: string | null;
      startsOn: string;
    }>(
      this.db,
      `SELECT id,group_id AS "groupId",title,place,starts_on::text AS "startsOn"
       FROM camp WHERE id=$1`,
      [campId],
    );
    if (!camp) throw new NotFoundException('اردو یافت نشد.');
    if (camp.groupId !== groupId)
      throw new BadRequestException('اردو متعلق به این گروه نیست.');
    const existing = await one<{ id: string }>(
      this.db,
      `SELECT id FROM program_event
       WHERE group_id=$1 AND kind='camp' AND camp_id=$2`,
      [groupId, campId],
    );
    if (existing) return this.get(actor, existing.id);
    const heldAt = this.parseHeldAt(camp.startsOn);
    const created = await this.db.transaction(async (manager) => {
      const row = await one<{ id: string }>(
        manager,
        `INSERT INTO program_event(
           group_id,kind,title,camp_id,held_at,place,
           total_amount,member_payment_amount,created_by
         )
         VALUES($1,'camp',$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          groupId,
          camp.title,
          camp.id,
          heldAt,
          camp.place,
          totalAmount,
          memberPaymentAmount,
          actor.personId,
        ],
      );
      if (!row) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'program_event.created',
        'program_event',
        row.id,
        { kind: 'camp', campId },
        manager,
      );
      return row;
    });
    return this.get(actor, created.id);
  }

  async get(actor: Actor, id: string): Promise<ProgramEventDetailDto> {
    const destination = await this.loadSummary(id);
    await this.access.require(
      actor,
      'read',
      { type: 'program_event', id, groupIds: [destination.groupId] },
      'detail',
    );
    const canManage = await this.canManageGroup(actor, destination.groupId);
    const items = await rows<CostItemDto>(
      this.db,
      `SELECT id,owner_type AS "ownerType",owner_id AS "ownerId",title,amount,
        per_person AS "perPerson",created_by AS "createdBy",created_at AS "createdAt"
       FROM cost_item
       WHERE owner_type='program_event' AND owner_id=$1
       ORDER BY created_at,id`,
      [id],
    );
    return {
      ...destination,
      itemCount: items.length,
      canManage,
      items,
    };
  }

  async addCostItem(
    actor: Actor,
    destinationId: string,
    input: CreateCostItemDto,
  ): Promise<ProgramEventDetailDto> {
    const destination = await this.loadSummary(destinationId);
    await this.access.require(
      actor,
      'update',
      {
        type: 'program_event',
        id: destinationId,
        groupIds: [destination.groupId],
      },
      'detail',
    );
    await this.requireManagedGroup(actor, destination.groupId);
    const title = input.title.trim();
    if (!title) throw new BadRequestException('عنوان هزینه را وارد کن.');
    if (!Number.isInteger(input.amount) || input.amount < 0)
      throw new BadRequestException('مبلغ باید عدد صحیح تومان باشد.');
    const perPerson = input.perPerson === true;
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        `INSERT INTO cost_item(owner_type,owner_id,title,amount,per_person,created_by)
         VALUES('program_event',$1,$2,$3,$4,$5)`,
        [destinationId, title, input.amount, perPerson, actor.personId],
      );
      await rows(
        manager,
        'UPDATE program_event SET updated_at=now() WHERE id=$1',
        [destinationId],
      );
      await this.audit.record(
        actor.personId,
        'cost_item.created',
        'program_event',
        destinationId,
        { amount: input.amount },
        manager,
      );
    });
    return this.get(actor, destinationId);
  }

  async removeCostItem(
    actor: Actor,
    destinationId: string,
    itemId: string,
  ): Promise<ProgramEventDetailDto> {
    const destination = await this.loadSummary(destinationId);
    await this.access.require(
      actor,
      'update',
      {
        type: 'program_event',
        id: destinationId,
        groupIds: [destination.groupId],
      },
      'detail',
    );
    await this.requireManagedGroup(actor, destination.groupId);
    await this.db.transaction(async (manager) => {
      const deleted = await one<{ id: string }>(
        manager,
        `DELETE FROM cost_item
         WHERE id=$1 AND owner_type='program_event' AND owner_id=$2
         RETURNING id`,
        [itemId, destinationId],
      );
      if (!deleted) throw new NotFoundException();
      await rows(
        manager,
        'UPDATE program_event SET updated_at=now() WHERE id=$1',
        [destinationId],
      );
      await this.audit.record(
        actor.personId,
        'cost_item.deleted',
        'program_event',
        destinationId,
        {},
        manager,
      );
    });
    return this.get(actor, destinationId);
  }

  private async loadSummary(id: string): Promise<ProgramEventSummaryDto> {
    const row = await one<ProgramEventSummaryDto>(
      this.db,
      `SELECT p.id,p.group_id AS "groupId",p.kind,p.title,p.camp_id AS "campId",
        p.held_at AS "heldAt",p.place,p.notes,
        p.total_amount AS "totalAmount",
        p.member_payment_amount AS "memberPaymentAmount",
        COALESCE((
          SELECT count(*)::int FROM cost_item c
          WHERE c.owner_type='program_event' AND c.owner_id=p.id
        ),0) AS "itemCount",
        p.created_by AS "createdBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
        false AS "canManage"
       FROM program_event p WHERE p.id=$1`,
      [id],
    );
    if (!row) throw new NotFoundException();
    return row;
  }

  private parseAmount(value: number, label: string): number {
    if (!Number.isInteger(value) || value < 0)
      throw new BadRequestException(`${label} باید عدد صحیح تومان باشد.`);
    if (value > 1_000_000_000_000)
      throw new BadRequestException(`${label} بیش از حد بزرگ است.`);
    return value;
  }

  private parseHeldAt(value?: string | null): string | null {
    if (value === undefined || value === null || value === '') return null;
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T12:00:00.000Z`;
    const date = new Date(trimmed);
    if (Number.isNaN(date.valueOf()))
      throw new BadRequestException('تاریخ برنامه معتبر نیست.');
    return date.toISOString();
  }

  private async requireVisibleGroup(groupId: string): Promise<void> {
    if (
      !(await one(this.db, 'SELECT 1 FROM organization_group WHERE id=$1', [
        groupId,
      ]))
    )
      throw new NotFoundException();
  }

  private async requireManagedGroup(
    actor: Actor,
    groupId: string,
  ): Promise<void> {
    await this.requireVisibleGroup(groupId);
    if (!(await this.isGroupMentor(actor, groupId)))
      throw new BadRequestException(
        'فقط مربی صاحب گروه می‌تواند هزینه‌های برنامه را مدیریت کند.',
      );
  }

  private async canManageGroup(
    actor: Actor,
    groupId: string,
  ): Promise<boolean> {
    return this.isGroupMentor(actor, groupId);
  }

  private async isGroupMentor(actor: Actor, groupId: string): Promise<boolean> {
    return !!(await one(
      this.db,
      'SELECT 1 FROM organization_group WHERE id=$1 AND owner_person_id=$2',
      [groupId, actor.personId],
    ));
  }
}
