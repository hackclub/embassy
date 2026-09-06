"use client";

import { useState } from "react";
import ProjectForm from "./ProjectForm";

export default function NewProjectButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-game" aria-haspopup="dialog">
        <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" className="h-10 w-10">
          <circle cx="38" cy="28" r="14" fill="#F7F9E8" stroke="#293500" strokeWidth="8" />
          <path
            d="M16 76c0-13 9.8-22 22-22s22 9 22 22"
            fill="#F7F9E8"
            stroke="#293500"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path d="M74 44v24M62 56h24" stroke="#293500" strokeWidth="8" strokeLinecap="round" />
        </svg>
        New project
      </button>

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
            aria-label="Add a project"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Add a project</h2>
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
