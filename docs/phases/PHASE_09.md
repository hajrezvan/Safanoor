# گزارش فاز ۹ — مربی‌یار هوشمند

لایه AI با `AIProvider` / `MockAIProvider` و کارخانهٔ `getAIProvider()` پیاده‌سازی شد. Context Builder فقط برش محدود از پرونده (اهداف فعال، اقدامات باز، جلسات اخیر، ارجاع‌ها، برنامه، دانش، و یادداشت‌های مجاز) را وارد prompt می‌کند و هرگز کل DB را dump نمی‌کند.

سرویس `mentor-assist` تعامل را در `ai_interactions` با metadata (feature، model، contextMeta، output، createdBy، studentId) ذخیره می‌کند. صفحات `/staff/mentor/ai` و لینک از پرونده دانش‌آموز/داشبورد مربی، خروجی را با برچسب «پیشنهاد تولیدشده توسط AI» و Accept/Reject نشان می‌دهند.

Server actions در `src/server/actions/ai.ts` مجوز `ai.use` و محدودهٔ دانش‌آموز را اعمال می‌کنند. کمک‌مربی به‌صورت پیش‌فرض به AI دسترسی ندارد.
