"use client";

import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortDirection = "asc" | "desc" | null;

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSortField?: string;
  currentDirection?: SortDirection;
  onSort: (field: string) => void;
  align?: "left" | "center" | "right";
  className?: string;
}

export function SortableHeader({
  label,
  field,
  currentSortField,
  currentDirection,
  onSort,
  align = "left",
  className = "",
}: SortableHeaderProps) {
  const isActive = currentSortField === field;

  const getAlignClass = () => {
    if (align === "right") return "justify-end text-right";
    if (align === "center") return "justify-center text-center";
    return "justify-start text-left";
  };

  return (
    <th
      className={`px-4 sm:px-5 py-3 text-xs font-bold text-text-muted uppercase select-none transition-colors ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`group flex items-center gap-1.5 w-full hover:text-brand-blue cursor-pointer transition-colors ${getAlignClass()} ${
          isActive ? "text-brand-blue font-black" : ""
        }`}
      >
        <span>{label}</span>
        <span className="shrink-0 transition-transform">
          {isActive ? (
            currentDirection === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-brand-blue" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-brand-blue" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </span>
      </button>
    </th>
  );
}
