"use client";

import { User, Printer, MapPin, Phone, Building } from "lucide-react";
import Image from "next/image";
import logoImage from "@/logos/logo1.png";

interface IdCardProps {
  student: {
    admissionNo: string;
    name: string;
    board: string;
    classLevel: string;
    division: string;
    centre: string;
    bloodGroup: string;
    phone: string;
    photo: string | null;
    course: string;
    address?: string;
    validUntil?: string;
  };
}

// Simple Barcode generator using inline blocks
function Barcode({ value }: { value: string }) {
  if (!value) return null;
  
  // Deterministic bar widths based on char codes
  const bars = Array.from({ length: 42 }, (_, i) => {
    const code = value.charCodeAt(i % value.length) || 50;
    return ((code + i * 11) % 4) + 1; // 1, 2, 3, or 4
  });
  
  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-end h-10 justify-center w-full">
        {bars.map((w, i) => (
          <div
            key={i}
            style={{ width: `${w}px` }}
            className={`bg-slate-900 ${i % 7 === 0 ? 'h-full' : 'h-[85%]'} mx-[0.5px]`}
          />
        ))}
      </div>
    </div>
  );
}

export function IdCardClient({ student }: IdCardProps) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-12 gap-8 font-sans print:bg-transparent print:p-0 print:gap-8 print:min-h-0">
      
      {/* Controls */}
      <div className="print:hidden">
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
        >
          <Printer className="h-4 w-4" /> Print ID Card
        </button>
      </div>

      <div className="flex flex-col gap-8 print:flex-row print:flex-wrap print:gap-8">
        
        {/* ==================== FRONT OF CARD ==================== */}
        <div className="relative bg-white w-[320px] h-[508px] rounded-xl overflow-hidden border border-slate-200 shadow-sm print:shadow-none print:border-slate-300 flex flex-col">
          
          {/* Header */}
          <div className="bg-brand-blue px-4 pt-5 pb-4 flex flex-col items-center">
            <div className="h-10 relative w-[140px] mb-1 bg-white p-1 rounded">
              <Image 
                src={logoImage} 
                alt="Logo" 
                fill 
                className="object-contain" 
                priority
              />
            </div>
            <h2 className="text-[9px] font-bold text-white tracking-[0.2em] uppercase mt-2 opacity-90">
              Student Identification
            </h2>
          </div>

          <div className="flex flex-col items-center px-6 pt-6 pb-4 flex-1">
            
            {/* Photo Section */}
            <div className="relative mb-5">
              <div className="w-[110px] h-[135px] rounded border border-slate-200 overflow-hidden bg-slate-50 relative flex justify-center items-center shadow-sm">
                {student.photo ? (
                  <img 
                    src={student.photo} 
                    alt={student.name || "Student"} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User className="w-12 h-12 text-slate-300" />
                )}
              </div>
            </div>

            {/* Student Name and Role */}
            <div className="text-center mb-5 w-full">
              <h1 className="text-[18px] font-bold text-slate-900 leading-tight mb-1 uppercase tracking-tight break-words">
                {student.name || "-"}
              </h1>
              <p className="text-[11px] font-medium text-brand-blue uppercase tracking-widest">
                {student.course || "Student"}
              </p>
            </div>

            {/* Info Grid */}
            <div className="w-full flex-1">
              <div className="grid grid-cols-[1fr_2fr] gap-x-2 gap-y-2 text-[10px]">
                
                <div className="text-slate-500 font-medium uppercase text-right border-r border-slate-200 pr-2">Adm No</div>
                <div className="font-bold text-slate-900 pl-1">{student.admissionNo || "-"}</div>
                
                <div className="text-slate-500 font-medium uppercase text-right border-r border-slate-200 pr-2">Class</div>
                <div className="font-bold text-slate-900 pl-1">
                  {student.classLevel || "-"} {student.division ? `(${student.division})` : ''}
                </div>
                
                <div className="text-slate-500 font-medium uppercase text-right border-r border-slate-200 pr-2">Board</div>
                <div className="font-bold text-slate-900 pl-1">{student.board || "-"}</div>
                
                <div className="text-slate-500 font-medium uppercase text-right border-r border-slate-200 pr-2">Blood</div>
                <div className="font-bold text-red-600 pl-1">{student.bloodGroup || "-"}</div>
                
              </div>
            </div>
            
          </div>
          
          <div className="h-1.5 w-full bg-brand-blue mt-auto"></div>
        </div>

        {/* ==================== BACK OF CARD ==================== */}
        <div className="relative bg-white w-[320px] h-[508px] rounded-xl overflow-hidden border border-slate-200 shadow-sm print:shadow-none print:border-slate-300 flex flex-col">
          
          <div className="flex flex-col h-full p-6">
            
            <div className="mb-5 flex justify-center border-b border-slate-100 pb-4">
              <div className="h-8 relative w-[120px]">
                <Image 
                  src={logoImage} 
                  alt="Logo" 
                  fill 
                  className="object-contain opacity-70 grayscale" 
                />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">
                Terms & Conditions
              </h3>
              <ul className="text-[9px] text-slate-600 space-y-2 text-justify leading-relaxed pl-3 list-disc">
                <li>This card is the property of the issuing institution and is non-transferable.</li>
                <li>The cardholder must present this card upon request by any authorized personnel.</li>
                <li>Loss or damage of this card must be reported immediately to the administration.</li>
                <li>A replacement fee will be applicable for lost or damaged cards.</li>
                <li>If found, please return this card to the issuing authority.</li>
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              {student.centre && (
                <div className="flex items-start gap-2">
                  <Building className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-slate-700 font-medium uppercase">
                    {student.centre}
                  </p>
                </div>
              )}
              {student.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-slate-700 font-medium whitespace-pre-wrap leading-tight">
                    {student.address}
                  </p>
                </div>
              )}
              {student.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <p className="text-[9px] text-slate-700 font-medium">
                    {student.phone}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div>
                <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">Valid Until</p>
                <p className="text-[10px] text-slate-900 font-bold">
                  {student.validUntil || "-"}
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-20 border-b border-slate-400 mb-1.5 inline-block"></div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  Issuing Authority
                </p>
              </div>
            </div>
            
            <div className="mt-4 flex flex-col items-center">
              <Barcode value={student.admissionNo} />
              <p className="text-[8px] font-mono mt-1.5 text-slate-500 tracking-[0.2em]">
                {student.admissionNo || "-"}
              </p>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
