"use client";

import React, { useState } from "react";
import { Filter, X, RefreshCw, ChevronDown, ChevronUp, Layers } from "lucide-react";

export interface HierarchyFilterState {
  datePreset: "month" | "last30" | "today" | "year" | "custom";
  startDate: string;
  endDate: string;
  academicYearId: string;
  centreId: string;
  boardId: string;
  standardId: string;
  batchId: string;
  subjectId: string;
}

interface ReportFilterBarProps {
  filters: HierarchyFilterState;
  onChange: (newFilters: HierarchyFilterState) => void;
  academicYears: { id: string; name: string }[];
  centres: { id: string; name: string }[];
  boards: { id: string; name: string }[];
  standards: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  onRefresh?: () => void;
  loading?: boolean;
}

export function ReportFilterBar({
  filters,
  onChange,
  academicYears = [],
  centres = [],
  boards = [],
  standards = [],
  batches = [],
  subjects = [],
  onRefresh,
  loading = false,
}: ReportFilterBarProps) {
  const [showAdvancedHierarchy, setShowAdvancedHierarchy] = useState(false);

  const handlePresetChange = (preset: HierarchyFilterState["datePreset"]) => {
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
      academicYearId: "",
      centreId: "",
      boardId: "",
      standardId: "",
      batchId: "",
      subjectId: "",
    });
  };

  const hasActiveFilters =
    filters.academicYearId !== "" ||
    filters.centreId !== "" ||
    filters.boardId !== "" ||
    filters.standardId !== "" ||
    filters.batchId !== "" ||
    filters.subjectId !== "" ||
    filters.datePreset !== "month";

  return (
    <div className="bg-white rounded-2xl border border-border-soft p-3 sm:p-4 shadow-2xs space-y-3.5 print:hidden">
      {/* Top row: Presets + Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Date presets pill selector */}
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
              onClick={() => handlePresetChange(preset.id as HierarchyFilterState["datePreset"])}
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

        {/* Right side controls: Hierarchy Toggle, Reset, Refresh */}
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowAdvancedHierarchy(!showAdvancedHierarchy)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              showAdvancedHierarchy || filters.boardId || filters.standardId || filters.subjectId || filters.academicYearId
                ? "bg-brand-blue/10 text-brand-blue border-brand-blue/30"
                : "bg-surface hover:bg-surface-2 text-text-secondary border-border-soft"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Academic Hierarchy</span>
            {showAdvancedHierarchy ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface hover:bg-surface-2 border border-border-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary filter inputs: Dates + Centre + Batch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1 border-t border-border-soft/60">
        <div>
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Start Date
          </label>
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

        <div>
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            End Date
          </label>
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

        <div>
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Centre / Branch
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
      </div>

      {/* Advanced Academic Hierarchy row (collapsible or always accessible) */}
      {showAdvancedHierarchy && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-3 border-t border-border-soft/60 animate-in fade-in slide-in-from-top-1">
          {/* Academic Year */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Academic Year
            </label>
            <select
              value={filters.academicYearId}
              onChange={(e) => onChange({ ...filters, academicYearId: e.target.value })}
              className="w-full h-9.5 rounded-lg border border-border-soft bg-surface px-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
            >
              <option value="">All Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          {/* Board */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Educational Board
            </label>
            <select
              value={filters.boardId}
              onChange={(e) =>
                onChange({
                  ...filters,
                  boardId: e.target.value,
                  standardId: "",
                })
              }
              className="w-full h-9.5 rounded-lg border border-border-soft bg-surface px-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
            >
              <option value="">All Boards</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Standard / Class */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Class / Standard
            </label>
            <select
              value={filters.standardId}
              onChange={(e) => onChange({ ...filters, standardId: e.target.value })}
              className="w-full h-9.5 rounded-lg border border-border-soft bg-surface px-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
            >
              <option value="">All Classes</option>
              {standards.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Subject
            </label>
            <select
              value={filters.subjectId}
              onChange={(e) => onChange({ ...filters, subjectId: e.target.value })}
              className="w-full h-9.5 rounded-lg border border-border-soft bg-surface px-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
            >
              <option value="">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
