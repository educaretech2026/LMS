"use client";

import React from "react";
import { Calendar, Filter, X, RefreshCw } from "lucide-react";

export interface FilterState {
  datePreset: "month" | "last30" | "today" | "year" | "custom";
  startDate: string;
  endDate: string;
  batchId: string;
  centreId: string;
}

interface ReportFilterBarProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  batches: { id: string; name: string }[];
  centres?: { id: string; name: string }[];
  onRefresh?: () => void;
  loading?: boolean;
}

export function ReportFilterBar({
  filters,
  onChange,
  batches,
  centres = [],
  onRefresh,
  loading = false,
}: ReportFilterBarProps) {
  const handlePresetChange = (preset: FilterState["datePreset"]) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === "today") {
      start = today;
      end = today;
    } else if (preset === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    } else if (preset === "last30") {
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      end = today;
    } else if (preset === "year") {
      start = new Date(today.getFullYear(), 0, 1);
      end = today;
    }

    onChange({
      ...filters,
      datePreset: preset,
      ...(preset !== "custom"
        ? {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
          }
        : {}),
    });
  };

  const handleReset = () => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    onChange({
      datePreset: "month",
      startDate: firstOfMonth.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
      batchId: "",
      centreId: "",
    });
  };

  const hasActiveFilters =
    filters.batchId !== "" ||
    filters.centreId !== "" ||
    filters.datePreset !== "month";

  return (
    <div className="bg-white rounded-2xl border border-border-soft p-3 sm:p-4 shadow-2xs space-y-3.5 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Date presets pill selector - scrollable horizontally on mobile */}
        <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border-soft/60 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {[
            { id: "today", label: "Today" },
            { id: "month", label: "This Month" },
            { id: "last30", label: "Last 30 Days" },
            { id: "year", label: "This Year" },
            { id: "custom", label: "Custom Range" },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetChange(preset.id as FilterState["datePreset"])}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 whitespace-nowrap ${
                filters.datePreset === preset.id
                  ? "bg-white text-brand-blue shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Action icons / Reset */}
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface hover:bg-surface-2 border border-border-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Inputs row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1 border-t border-border-soft/60">
        {/* Start Date */}
        <div>
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Start Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                onChange({
                  ...filters,
                  startDate: e.target.value,
                  datePreset: "custom",
                })
              }
              className="w-full h-9.5 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
          </div>
        </div>

        {/* End Date */}
        <div>
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            End Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                onChange({
                  ...filters,
                  endDate: e.target.value,
                  datePreset: "custom",
                })
              }
              className="w-full h-9.5 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
          </div>
        </div>

        {/* Batch filter */}
        <div>
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Batch / Section
          </label>
          <select
            value={filters.batchId}
            onChange={(e) => onChange({ ...filters, batchId: e.target.value })}
            className="w-full h-9.5 rounded-lg border border-border-soft bg-surface px-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Centre filter if multiple */}
        <div>
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Campus / Centre
          </label>
          <select
            value={filters.centreId}
            onChange={(e) => onChange({ ...filters, centreId: e.target.value })}
            className="w-full h-9.5 rounded-lg border border-border-soft bg-surface px-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
          >
            <option value="">All Centres</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
