"use client";

import React from "react";
import { Plus } from "lucide-react";

interface AddPersonButtonProps {
  className?: string;
}

export default function AddPersonButton({
  className = "",
}: AddPersonButtonProps) {
  return (
    <button
      type="button"
      aria-label="Add project"
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
  );
}
