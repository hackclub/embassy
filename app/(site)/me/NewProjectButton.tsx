"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import ProjectForm from "./ProjectForm";
import { useBodyScrollLock } from "./useBodyScrollLock";

interface AddPersonButtonProps {
  className?: string;
}

export default function AddPersonButton({
  className = "",
}: AddPersonButtonProps) {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  return (
    <>
      <button
        type="button"
        aria-label="Add project"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`group relative flex items-center justify-center transition-transform duration-75 ease-out active:translate-y-[2px] active:shadow-none ${className}`}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "40px",
          background: "#ff902f",

          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "18px",
            borderRadius: "58px",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "2px",
            left: "10px",
            right: "10px",
            height: "20px",
            borderRadius: "58px",
            filter: "blur(1px)",
            pointerEvents: "none",
          }}
        />
        <Plus
          size={22}
          strokeWidth={3}
          color="white"
          className="relative z-10 transition-transform duration-150 ease-out group-active:scale-75"
        />
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
