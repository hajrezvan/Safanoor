"use client";

import { useEffect, useRef } from "react";
import { schoolAction } from "@/server/actions/school";

const PREFIX = "safanoor.school.lesson-view.";

export function LessonViewTracker({ lessonId }: { lessonId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const storageKey = `${PREFIX}${lessonId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage can be unavailable; the server still deduplicates this view.
    }
    const form = new FormData();
    form.set("operation", "lesson-view");
    form.set("lessonId", lessonId);
    form.set("sessionKey", `${lessonId}:${crypto.randomUUID()}`);
    void schoolAction({}, form).catch(() => undefined);
  }, [lessonId]);

  return null;
}
