import React from "react";

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...rest }) => (
  <div className={`card ${className}`} {...rest}>{children}</div>
);

export const Chip: React.FC<{
  label: string;
  count?: number;
  active?: boolean;
  variant?: "char" | "scene" | "artist" | "other" | "default";
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}> = ({ label, count, active, variant = "default", onClick, removable, onRemove }) => (
  <span
    className={`chip chip-${variant} ${active ? "is-active" : ""} ${onClick ? "is-clickable" : ""}`}
    onClick={onClick}
  >
    <span className="chip-dot" />
    <span className="chip-label">{label}</span>
    {typeof count === "number" && <span className="chip-count">{count}</span>}
    {removable && (
      <button className="chip-x" onClick={(e) => { e.stopPropagation(); onRemove?.(); }} aria-label="remove">×</button>
    )}
  </span>
);

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>
);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: React.ReactNode;
}> = ({ variant = "secondary", size = "md", icon, children, className = "", ...rest }) => (
  <button className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`} {...rest}>
    {icon}{children}
  </button>
);
