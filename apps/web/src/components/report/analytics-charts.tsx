"use client";

import React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  accentColor?: "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan";
  onClick?: () => void;
}

const colorMap = {
  blue: {
    bg: "bg-blue-50/50 hover:bg-blue-50/80 border-blue-100/80",
    iconBg: "bg-blue-600 text-white shadow-blue-500/20",
    text: "text-blue-700",
    accent: "text-blue-600",
  },
  emerald: {
    bg: "bg-emerald-50/50 hover:bg-emerald-50/80 border-emerald-100/80",
    iconBg: "bg-emerald-600 text-white shadow-emerald-500/20",
    text: "text-emerald-700",
    accent: "text-emerald-600",
  },
  violet: {
    bg: "bg-violet-50/50 hover:bg-violet-50/80 border-violet-100/80",
    iconBg: "bg-violet-600 text-white shadow-violet-500/20",
    text: "text-violet-700",
    accent: "text-violet-600",
  },
  amber: {
    bg: "bg-amber-50/50 hover:bg-amber-50/80 border-amber-100/80",
    iconBg: "bg-amber-600 text-white shadow-amber-500/20",
    text: "text-amber-700",
    accent: "text-amber-600",
  },
  rose: {
    bg: "bg-rose-50/50 hover:bg-rose-50/80 border-rose-100/80",
    iconBg: "bg-rose-600 text-white shadow-rose-500/20",
    text: "text-rose-700",
    accent: "text-rose-600",
  },
  cyan: {
    bg: "bg-cyan-50/50 hover:bg-cyan-50/80 border-cyan-100/80",
    iconBg: "bg-cyan-600 text-white shadow-cyan-500/20",
    text: "text-cyan-700",
    accent: "text-cyan-600",
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = "blue",
  onClick,
}: MetricCardProps) {
  const c = colorMap[accentColor] || colorMap.blue;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-xs transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      } ${c.bg}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black tracking-tight text-text-primary">
              {value}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-text-muted font-medium pt-0.5">{subtitle}</p>
          )}
        </div>

        <div
          className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-md ${c.iconBg}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-border-soft/60 flex items-center gap-1.5 text-xs font-semibold">
          {trend.isNeutral ? (
            <Minus className="h-3.5 w-3.5 text-gray-400" />
          ) : trend.isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
          )}
          <span
            className={
              trend.isNeutral
                ? "text-gray-500"
                : trend.isPositive
                ? "text-emerald-700"
                : "text-rose-700"
            }
          >
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}

// ── SVG Donut Chart ──────────────────────────────────────────
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerTitle,
  centerValue,
  size = 180,
  strokeWidth = 24,
}: {
  segments: DonutSegment[];
  centerTitle?: string;
  centerValue?: string | number;
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          {/* Background Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            segments.map((seg, i) => {
              const strokeDasharray = `${(seg.value / total) * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedPercent * circumference;
              accumulatedPercent += seg.value / total;

              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              );
            })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {centerValue !== undefined && (
            <span className="text-xl font-black text-text-primary">
              {centerValue}
            </span>
          )}
          {centerTitle && (
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              {centerTitle}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 text-xs">
        {segments.map((seg, idx) => {
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={idx} className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-md shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-semibold text-text-secondary min-w-[90px]">
                {seg.label}
              </span>
              <span className="font-bold text-text-primary ml-auto">
                {seg.value.toLocaleString()}
              </span>
              <span className="text-text-muted text-[11px] font-medium w-12 text-right">
                ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Multi-Bar Comparison Chart ────────────────────────────────
export interface BarGroup {
  label: string;
  values: {
    name: string;
    value: number;
    color: string;
  }[];
}

export function BarComparisonChart({
  groups,
  maxValue,
  height = 190,
}: {
  groups: BarGroup[];
  maxValue?: number;
  height?: number;
}) {
  const calcMax =
    maxValue ||
    Math.max(
      1,
      ...groups.flatMap((g) => g.values.map((v) => v.value))
    );

  return (
    <div className="space-y-3 w-full">
      <div
        className="flex items-end gap-3 sm:gap-6 border-b border-border-soft pb-2 px-2 overflow-x-auto"
        style={{ height }}
      >
        {groups.map((group, gi) => (
          <div
            key={gi}
            className="flex-1 min-w-[60px] flex flex-col items-center justify-end h-full group"
          >
            <div className="flex items-end gap-1.5 w-full justify-center h-full pb-1">
              {group.values.map((v, vi) => {
                const heightPct = Math.min(100, (v.value / calcMax) * 100);
                return (
                  <div
                    key={vi}
                    className="relative flex-1 max-w-[20px] rounded-t-md transition-all duration-500 hover:brightness-110"
                    style={{
                      height: `${Math.max(4, heightPct)}%`,
                      backgroundColor: v.color,
                    }}
                    title={`${group.label} - ${v.name}: ${v.value.toLocaleString()}`}
                  />
                );
              })}
            </div>
            <span className="text-[11px] font-semibold text-text-muted truncate max-w-[75px] text-center mt-1">
              {group.label}
            </span>
          </div>
        ))}
      </div>

      {/* Dynamic legend from first group */}
      {groups.length > 0 && groups[0].values.length > 0 && (
        <div className="flex items-center justify-center gap-5 pt-1 text-xs">
          {groups[0].values.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5 font-medium text-text-secondary">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: v.color }}
              />
              <span>{v.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Funnel Chart ─────────────────────────────────────────────
export interface FunnelStage {
  label: string;
  count: number;
  percentage?: number;
  color?: string;
}

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="space-y-2.5 w-full">
      {stages.map((stage, idx) => {
        const widthPct = Math.max(8, (stage.count / max) * 100);
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-text-secondary">{stage.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-bold">
                  {stage.count.toLocaleString()}
                </span>
                {stage.percentage !== undefined && (
                  <span className="text-[11px] text-text-muted font-medium">
                    ({stage.percentage}%)
                  </span>
                )}
              </div>
            </div>
            <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: stage.color || "#4f46e5",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Radial Progress Gauge ────────────────────────────────────
export function RadialGauge({
  value,
  max = 100,
  label,
  sublabel,
  color = "#4f46e5",
  size = 130,
}: {
  value: number;
  max?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  size?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black text-text-primary">
            {pct.toFixed(0)}%
          </span>
          {label && (
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              {label}
            </span>
          )}
        </div>
      </div>
      {sublabel && (
        <p className="text-xs font-semibold text-text-muted mt-2">{sublabel}</p>
      )}
    </div>
  );
}
