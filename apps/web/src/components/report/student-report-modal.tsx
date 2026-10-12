"use client";

import React from "react";
import { X, Printer, Award, Calendar, BookOpen, AlertCircle, CheckCircle } from "lucide-react";

interface StudentReportModalProps {
  student: any;
  onClose: () => void;
}

export function StudentReportModal({ student, onClose }: StudentReportModalProps) {
  if (!student) return null;

  const attendance = student.attendanceDetails || { totalDays: 0, presentDays: 0, percentage: "0.0" };
  const percentage = parseFloat(attendance.percentage);
  const examResults = student.examResults || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-border-soft overflow-hidden print:border-none print:shadow-none print:max-w-none">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-soft bg-surface/50 print:bg-white print:border-b-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue font-black text-lg">
              {student.name?.charAt(0) || "S"}
            </div>
            <div>
              <h3 className="text-base font-black text-text-primary">
                Comprehensive Student Dossier
              </h3>
              <p className="text-xs text-text-muted font-medium">
                Official Academic Performance & Attendance Record
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border-soft text-xs font-bold text-text-primary hover:bg-surface-2 transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Dossier
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Student Profile Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface/40 border border-border-soft">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Student Name
              </p>
              <p className="text-sm font-black text-text-primary mt-0.5">
                {student.name}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Admission No
              </p>
              <p className="text-sm font-bold text-brand-blue mt-0.5">
                {student.admissionNo || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Attendance Standing
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {percentage >= 75 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle className="h-3.5 w-3.5" /> Good
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                    <AlertCircle className="h-3.5 w-3.5" /> At Risk
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Assessments Taken
              </p>
              <p className="text-sm font-black text-text-primary mt-0.5">
                {examResults.length}
              </p>
            </div>
          </div>

          {/* Attendance Stats Cards */}
          <div>
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-brand-blue" />
              Attendance Summary
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-border-soft bg-white text-center">
                <p className="text-[10px] font-bold text-text-muted uppercase">
                  Total Sessions
                </p>
                <p className="text-xl font-black text-text-primary mt-1">
                  {attendance.totalDays}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 text-center">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">
                  Sessions Present
                </p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  {attendance.presentDays}
                </p>
              </div>
              <div
                className={`p-3.5 rounded-xl border text-center ${
                  percentage >= 75
                    ? "border-blue-100 bg-blue-50/50 text-blue-700"
                    : "border-rose-100 bg-rose-50/50 text-rose-700"
                }`}
              >
                <p className="text-[10px] font-bold uppercase">
                  Attendance Percentage
                </p>
                <p className="text-xl font-black mt-1">{percentage}%</p>
              </div>
            </div>
          </div>

          {/* Exam Results Table */}
          <div>
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-brand-blue" />
              Examination Scorecards & Progress
            </h4>
            {examResults.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border-soft">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface/70 border-b border-border-soft">
                    <tr>
                      <th className="px-4 py-3 font-bold text-text-muted uppercase">
                        Exam Title
                      </th>
                      <th className="px-4 py-3 font-bold text-text-muted uppercase text-center">
                        Marks
                      </th>
                      <th className="px-4 py-3 font-bold text-text-muted uppercase text-center">
                        Percentage
                      </th>
                      <th className="px-4 py-3 font-bold text-text-muted uppercase text-center">
                        Grade
                      </th>
                      <th className="px-4 py-3 font-bold text-text-muted uppercase">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {examResults.map((r: any) => {
                      const pct =
                        r.maxMarks > 0
                          ? ((r.marksObtained / r.maxMarks) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr key={r.id} className="hover:bg-surface/30">
                          <td className="px-4 py-3 font-bold text-text-primary">
                            {r.exam?.title || "Examination"}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">
                            {r.marksObtained} / {r.maxMarks}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-text-primary">
                              {pct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue font-black text-xs">
                              {r.grade || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {r.remarks || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl border border-border-soft bg-surface/30 text-text-muted text-xs font-semibold">
                No examination records registered yet for this student.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border-soft bg-surface/30 print:hidden">
          <p className="text-[11px] text-text-muted">
            Educare LMS &copy; {new Date().getFullYear()} - Institutional Record
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-2 border border-border-soft text-xs font-bold text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
