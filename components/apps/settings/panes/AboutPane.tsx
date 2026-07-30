"use client";

import { useEffect, useState } from "react";

export default function AboutPane() {
  const [storage, setStorage] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then((estimate) => {
      if (estimate.usage === undefined) return;
      setStorage(`${(estimate.usage / (1024 * 1024)).toFixed(1)} MB used`);
    });
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 pt-6 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold text-white"
        style={{ background: "var(--accent-primary)" }}
      >
        OS
      </div>
      <h2 className="text-[15px] font-semibold">LLM-OS</h2>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Version 1.0 · Web Edition
      </p>
      {storage && (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          {storage}
        </p>
      )}
    </div>
  );
}
