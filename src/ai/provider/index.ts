/**
 * Abstraction ارائه‌دهنده AI — MVP با Mock؛ provider واقعی بعداً جایگزین می‌شود.
 */
export type AIGenerateInput = {
  system: string;
  prompt: string;
  feature: string;
};

export type AIGenerateOutput = {
  text: string;
  model?: string;
  provider: string;
};

export interface AIProvider {
  generate(input: AIGenerateInput): Promise<AIGenerateOutput>;
}

function mockTextForFeature(feature: string, prompt: string): string {
  const studentMatch = prompt.match(/دانش‌آموز:\s*(.+)/);
  const studentName = studentMatch?.[1]?.trim() || "دانش‌آموز";

  if (feature === "session_summary") {
    return [
      "### خلاصه جلسه",
      `خلاصهٔ ساختاریافتهٔ یادداشت‌های جلسه مربوط به ${studentName} (پیشنهاد آزمایشی AI).`,
      "",
      "### مسائل اصلی",
      "- پیگیری موضوعات مطرح‌شده در یادداشت خام",
      "",
      "### مشاهدات",
      "- نیاز به تأیید مربی؛ تشخیص پزشکی/روان‌شناختی ارائه نشده است.",
      "",
      "### اقدامات پیشنهادی",
      "1. مرور کوتاه اهداف فعال با دانش‌آموز",
      "2. تعیین یک اقدام مشخص و قابل اندازه‌گیری برای هفتهٔ بعد",
      "",
      "### موارد نیازمند پیگیری",
      "- در صورت اشاره به مسائل حساس، ارجاع انسانی بررسی شود.",
    ].join("\n");
  }

  if (feature === "next_action_suggestion" || feature.includes("next_actions")) {
    return JSON.stringify(
      {
        text: [
          `پیشنهادهای اقدام برای ${studentName} (پیشنهاد تولیدشده توسط AI — تصمیم نهایی با مربی است).`,
          "تشخیص پزشکی/روان‌شناختی ندهید؛ مسائل حساس را به بررسی انسانی ارجاع دهید.",
        ].join("\n"),
        suggestions: [
          {
            title: "مرور برنامه هفتگی مطالعه",
            description: "با دانش‌آموز برنامهٔ کوتاه هفتگی را مرور و یک اولویت مشخص کنید.",
          },
          {
            title: "ثبت بازخورد جلسه قبل",
            description: "یک بازخورد کوتاه دربارهٔ پیشرفت نسبت به جلسه قبل بنویسید.",
          },
          {
            title: "تعیین زمان پیگیری",
            description: "تاریخ پیگیری بعدی را مشخص و در پرونده ثبت کنید.",
          },
        ],
      },
      null,
      2,
    );
  }

  if (feature.includes("suggested_questions") || feature.includes("questions")) {
    return [
      `سؤالات پیشنهادی جلسه بعد برای ${studentName}:`,
      "1. از هفتهٔ گذشته چه چیزی برایت مفیدتر بود؟",
      "2. در انجام اقدام‌های باز چه مانعی داشتی؟",
      "3. برای هفتهٔ بعد یک اولویت واقع‌بینانه چیست؟",
      "",
      "توجه: این‌ها پیشنهاد AI هستند؛ تشخیص پزشکی/روان‌شناختی محسوب نمی‌شوند.",
    ].join("\n");
  }

  if (feature.includes("session_topics") || feature.includes("topics")) {
    return [
      `موضوعات پیشنهادی جلسه برای ${studentName}:`,
      "- مرور اهداف فعال و موانع",
      "- وضعیت اقدامات باز",
      "- یک مهارت/علاقه برای تقویت انگیزه",
      "",
      "برچسب: پیشنهاد تولیدشده توسط AI — تصمیم نهایی با مربی انسان است.",
    ].join("\n");
  }

  return [
    `خلاصه وضعیت پیشنهادی برای ${studentName}:`,
    "- بر اساس اهداف فعال، جلسات اخیر و اقدامات باز یک تصویر کلی ساخته شده است.",
    "- پیشنهادهای عملی کوتاه برای جلسه بعد در نظر بگیرید.",
    "- مسائل حساس را به بررسی انسانی ارجاع دهید؛ تشخیص پزشکی ندهید.",
    "",
    "برچسب: پیشنهاد تولیدشده توسط AI — هنوز به provider واقعی متصل نیست (Mock).",
  ].join("\n");
}

export class MockAIProvider implements AIProvider {
  async generate(input: AIGenerateInput): Promise<AIGenerateOutput> {
    return {
      text: mockTextForFeature(input.feature, input.prompt),
      model: "mock-v1",
      provider: "mock",
    };
  }
}

let provider: AIProvider = new MockAIProvider();

/** کارخانهٔ provider — در MVP همیشه Mock برمی‌گرداند. */
export function getAIProvider(): AIProvider {
  return provider;
}

export function setAIProvider(next: AIProvider) {
  provider = next;
}
