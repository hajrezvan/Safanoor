"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_ITEM_STATUS,
  KNOWLEDGE_ITEM_STATUS_TITLES_FA,
} from "@/lib/enums";
import {
  createKnowledgeItemAction,
  updateKnowledgeItemAction,
} from "@/server/actions/knowledge";
import type { ActionState } from "@/server/actions/users";
import type { KnowledgeListItem } from "@/server/modules/knowledge/service";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";
const textareaClass =
  "min-h-28 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7";

const categoryOptions = Object.values(KNOWLEDGE_CATEGORIES);

export function KnowledgeForm({
  item,
  extraCategories = [],
}: {
  item?: KnowledgeListItem;
  extraCategories?: string[];
}) {
  const isEdit = Boolean(item);
  const [state, action, pending] = useActionState(
    isEdit ? updateKnowledgeItemAction : createKnowledgeItemAction,
    initial,
  );

  const categories = [
    ...new Set([...categoryOptions, ...extraCategories, item?.category].filter(Boolean) as string[]),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "ویرایش آیتم دانش" : "آیتم جدید بانک دانش"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          {isEdit ? <input type="hidden" name="id" value={item!.id} /> : null}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">عنوان</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={item?.title ?? ""}
              placeholder="مثلاً افت انگیزه بعد از نمره ضعیف"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">دسته</Label>
            <Input
              id="category"
              name="category"
              list="knowledge-categories"
              required
              defaultValue={item?.category ?? categoryOptions[0]}
              placeholder="دسته موضوعی"
            />
            <datalist id="knowledge-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">وضعیت</Label>
            <select
              id="status"
              name="status"
              defaultValue={item?.status ?? KNOWLEDGE_ITEM_STATUS.DRAFT}
              className={selectClass}
            >
              {Object.values(KNOWLEDGE_ITEM_STATUS).map((status) => (
                <option key={status} value={status}>
                  {KNOWLEDGE_ITEM_STATUS_TITLES_FA[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="questionScenario">سناریو / سؤال مربی</Label>
            <textarea
              id="questionScenario"
              name="questionScenario"
              required
              className={textareaClass}
              defaultValue={item?.questionScenario ?? ""}
              placeholder="موقعیتی که مربی با آن روبه‌رو می‌شود را توصیف کنید."
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="recommendedApproach">رویکرد پیشنهادی</Label>
            <textarea
              id="recommendedApproach"
              name="recommendedApproach"
              required
              className={textareaClass}
              defaultValue={item?.recommendedApproach ?? ""}
              placeholder="گام‌های عملی و لحن پیشنهادی برای مربی"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cautions">هشدارها و محدودیت‌ها</Label>
            <textarea
              id="cautions"
              name="cautions"
              className={textareaClass}
              defaultValue={item?.cautions ?? ""}
              placeholder="چه کارهایی نباید انجام شود و چه زمانی ارجاع لازم است"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tags">برچسب‌ها</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={item?.tags ?? ""}
              placeholder="با ویرگول جدا کنید؛ مثلاً انگیزه، نمره"
            />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm sm:col-span-2">
              {state.success}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "در حال ذخیره…" : isEdit ? "ذخیره تغییرات" : "ثبت آیتم"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
