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
        <div className="relative bg-white w-[320px] h-[508px] rounded-xl overflow-hidden border border-slate-200 shadow-xl print:shadow-none print:border-slate-300 flex flex-col isolate">
          
          {/* Creative Background Elements (Front) */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Top right gradient blob */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-blue/10 rounded-full blur-3xl"></div>
            {/* Bottom left gradient blob */}
            <div className="absolute bottom-10 -left-16 w-56 h-56 bg-sky-400/10 rounded-full blur-2xl"></div>
            {/* Right side subtle accent */}
            <div className="absolute top-1/2 -right-8 w-24 h-32 bg-indigo-500/5 rounded-full blur-xl transform -translate-y-1/2"></div>
            {/* Subtle dot pattern */}
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
          </div>

          {/* Header */}
          <div className="bg-brand-blue px-4 pt-5 pb-4 flex flex-col items-center relative z-10 shadow-md">
            {/* Subtle geometric pattern overlay in header */}
            <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 75%, #ffffff 75%, #ffffff), linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 75%, #ffffff 75%, #ffffff)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}></div>
            
            <div className="h-10 relative w-[140px] mb-1 bg-white/95 p-1.5 rounded-md shadow-sm backdrop-blur-sm">
              <Image 
                src={logoImage} 
                alt="Logo" 
                fill 
                className="object-contain" 
                priority
              />
            </div>
            <h2 className="text-[9px] font-bold text-white tracking-[0.2em] uppercase mt-2 opacity-90 drop-shadow-sm relative">
              Student Identification
            </h2>
          </div>

          <div className="flex flex-col items-center px-6 pt-6 pb-4 flex-1 relative z-10">
            
            {/* Photo Section */}
            <div className="relative mb-5 group">
              {/* Decorative aura behind photo */}
              <div className="absolute -inset-2 bg-gradient-to-tr from-brand-blue/20 via-sky-300/20 to-transparent rounded-xl blur-md -z-10 group-hover:blur-lg transition-all"></div>
              
              <div className="w-[110px] h-[135px] rounded border-[3px] border-white overflow-hidden bg-slate-50 relative flex justify-center items-center shadow-lg ring-1 ring-slate-100">
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
              <h1 className="text-[18px] font-bold text-slate-900 leading-tight mb-1 uppercase tracking-tight break-words relative inline-block">
                {student.name || "-"}
                {/* Subtle underline accent */}
                <div className="absolute -bottom-1 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-brand-blue/30 to-transparent"></div>
              </h1>
              <div className="mt-1.5 inline-block px-3 py-0.5 bg-brand-blue/5 rounded-full border border-brand-blue/10 backdrop-blur-sm">
                <p className="text-[11px] font-semibold text-brand-blue uppercase tracking-widest">
                  {student.course || "Student"}
                </p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="w-full flex-1 bg-white/60 backdrop-blur-md rounded-xl p-3 border border-white/40 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative">
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
          
          {/* Bottom Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-brand-blue via-sky-400 to-brand-blue mt-auto relative z-10"></div>
        </div>

        {/* ==================== BACK OF CARD ==================== */}
        <div className="relative bg-white w-[320px] h-[508px] rounded-xl overflow-hidden border border-slate-200 shadow-xl print:shadow-none print:border-slate-300 flex flex-col isolate">
          
          {/* Creative Background Elements (Back) */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
             {/* Diagonal stripe pattern */}
             <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }}></div>
             {/* Soft bottom glow */}
             <div className="absolute -bottom-32 left-1/2 transform -translate-x-1/2 w-80 h-64 bg-brand-blue/5 rounded-[100%] blur-3xl"></div>
          </div>

          <div className="flex flex-col h-full p-6 relative z-10">
            
            <div className="mb-5 flex justify-center border-b border-slate-100/80 pb-4 relative">
              {/* Back watermark accent */}
              <div className="absolute inset-0 flex items-center justify-center -z-10 opacity-[0.03]">
                 <Image src={logoImage} alt="Watermark" width={200} height={200} className="object-contain" />
              </div>

              <div className="h-8 relative w-[120px] bg-white/50 backdrop-blur-sm rounded">
                <Image 
                  src={logoImage} 
                  alt="Logo" 
                  fill 
                  className="object-contain opacity-70 grayscale" 
                />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                Terms & Conditions
                <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></span>
              </h3>
              <ul className="text-[9px] text-slate-600 space-y-2 text-justify leading-relaxed pl-3 list-disc marker:text-brand-blue/40">
                <li>This card is the property of the issuing institution and is non-transferable.</li>
                <li>The cardholder must present this card upon request by any authorized personnel.</li>
                <li>Loss or damage of this card must be reported immediately to the administration.</li>
                <li>A replacement fee will be applicable for lost or damaged cards.</li>
                <li>If found, please return this card to the issuing authority.</li>
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100/80 space-y-2">
              {student.centre && (
                <div className="flex items-start gap-2 group">
                  <div className="bg-brand-blue/5 p-1 rounded-md text-brand-blue group-hover:bg-brand-blue/10 transition-colors">
                    <Building className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <p className="text-[9px] text-slate-700 font-medium uppercase mt-0.5">
                    {student.centre}
                  </p>
                </div>
              )}
              {student.address && (
                <div className="flex items-start gap-2 group">
                  <div className="bg-brand-blue/5 p-1 rounded-md text-brand-blue group-hover:bg-brand-blue/10 transition-colors">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <p className="text-[9px] text-slate-700 font-medium whitespace-pre-wrap leading-tight mt-0.5">
                    {student.address}
                  </p>
                </div>
              )}
              {student.phone && (
                <div className="flex items-center gap-2 group">
                  <div className="bg-brand-blue/5 p-1 rounded-md text-brand-blue group-hover:bg-brand-blue/10 transition-colors">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <p className="text-[9px] text-slate-700 font-medium">
                    {student.phone}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between items-end bg-gradient-to-br from-slate-50 to-white p-3 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-12 h-12 bg-brand-blue/5 rounded-full blur-md"></div>
              <div className="relative z-10">
                <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">Valid Until</p>
                <p className="text-[10px] text-slate-900 font-bold">
                  {student.validUntil || "-"}
                </p>
              </div>
              
              <div className="text-center relative z-10">
                <div className="w-20 border-b border-slate-300 mb-1.5 inline-block"></div>
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
