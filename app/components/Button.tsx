"use client";

interface AddPersonButtonProps {
  className?: string;
}

export default function AddPersonButton({
  className = "",
}: AddPersonButtonProps) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: "80px",
        height: "40px",
        borderRadius: "12px",
        border: "3px solid white",
        background: "linear-gradient(to bottom, #0088FF, #0088FF)",
        boxShadow: "0 10px 20px rgba(0,0,0,0.18)",
        position: "relative",
        overflow: "hidden",
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
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0))",
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
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0))",
          filter: "blur(1px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
