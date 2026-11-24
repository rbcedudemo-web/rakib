"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { setSubjectActive } from "../lessons/actions";

export function SubjectToggle({ id, active }: { id: string; active: boolean }) {
  const { t } = useT();
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      title={t(on ? "admin.action.turnOff" : "admin.action.turnOn")}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          const r = await setSubjectActive(id, next);
          if (!r.ok) setOn(!next);
        })
      }
      className={cn("relative h-7 w-12 rounded-full transition-colors disabled:opacity-50", on ? "bg-primary-600" : "bg-neutral-300")}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
      <span className="sr-only">{t(on ? "admin.action.turnOff" : "admin.action.turnOn")}</span>
    </button>
  );
}
