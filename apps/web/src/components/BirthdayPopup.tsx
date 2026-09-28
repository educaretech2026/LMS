"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import { fetchApi } from "@/lib/api";

export function BirthdayPopup() {
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetchApi("/students/birthdays/today")
      .then((data) => {
        if (Array.isArray(data)) {
          setBirthdays(data);
        }
      })
      .catch((err) => console.error("Failed to fetch birthdays:", err));
  }, []);

  if (!visible || birthdays.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white rounded-xl shadow-2xl border border-brand-blue/20 overflow-hidden w-80 relative">
        <div className="bg-gradient-to-r from-brand-blue to-sky-500 p-3 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 animate-pulse text-yellow-300" />
            <span className="font-bold text-sm tracking-wide">Today's Birthdays! 🎂</span>
          </div>
          <button 
            onClick={() => setVisible(false)}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-4 max-h-[300px] overflow-y-auto">
          <ul className="space-y-3">
            {birthdays.map((bday, i) => (
              <li key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-blue/10 to-sky-400/20 flex items-center justify-center text-brand-blue font-bold text-lg border border-brand-blue/10">
                  {bday.firstName?.charAt(0) || "S"}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{bday.firstName} {bday.lastName}</p>
                  <p className="text-xs text-slate-500">
                    {bday.classLevel || "Student"} • {bday.admissionNo}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
