"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import ProjectForm from "./ProjectForm";
import { useBodyScrollLock } from "./useBodyScrollLock";

export default function NewProjectButton({
  variant = "pill",
}: {
  variant?: "pill" | "tile";
}) {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  return (
    <>
      {variant === "tile" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="project-card-add flex items-center gap-3 p-4"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff902f] text-white"
          >
            <Plus size={18} strokeWidth={3} />
          </span>
          <span className="text-sm text-govuk-black">New project</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff902f] px-4 py-2 text-sm text-white transition-transform duration-75 ease-out active:translate-y-[2px]"
        >
          <Plus size={16} strokeWidth={3} aria-hidden="true" />
          New project
        </button>
      )}

      {open && (
        <div
          className="game-popup-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="game-popup"
            role="dialog"
            aria-modal="true"
            aria-label="New project"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">New project</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-govuk-grey-4 hover:text-govuk-black"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ProjectForm onSuccess={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
