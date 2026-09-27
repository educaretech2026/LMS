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
        <div className="relative bg-white w-[320px] h-[508px] rounded-xl overflow-hidden shadow-2xl shadow-brand-blue/10 print:shadow-none print:border-slate-300 flex flex-col isolate border border-slate-200/50">
          
          {/* Creative Background Elements (Front) - Modern Geometric Split with Textures */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#fafcff]">
            {/* SVG Noise Texture for tactile feel */}
            <div className="absolute inset-0 opacity-[0.35] mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
            
            {/* Top geometric angle */}
            <div className="absolute top-0 left-0 w-full h-[180px] bg-gradient-to-br from-[#014d8a] to-brand-blue" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 65%, 0 100%)' }}></div>
            {/* Secondary angle overlapping */}
            <div className="absolute top-0 left-0 w-full h-[190px] bg-brand-blue/30" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 0 100%)', zIndex: -1 }}></div>
            
            {/* Wireframe globe / concentric circles pattern in the bottom right */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full border-[1px] border-brand-blue/10"></div>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full border-[1px] border-brand-blue/15"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full border-[1px] border-brand-blue/20"></div>
            
            {/* Subtle tech grid over the white area - diagonal hatching */}
            <div className="absolute inset-0 opacity-[0.04] mt-[190px]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #0162b1 0, #0162b1 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }}></div>
          </div>

          {/* Header - Properly proportioned for 320px card */}
          <div className="px-4 pt-4 pb-4 flex flex-col items-center relative z-10 w-full">
            <div className="relative mb-2 flex justify-center items-center w-[240px] h-16 bg-white/95 p-2 rounded-lg shadow-sm border border-white/40 backdrop-blur-sm">
              <Image 
                src={logoImage} 
                alt="Logo" 
                width={240}
                height={80}
                className="object-contain w-full h-full" 
                priority
              />
            </div>
            <h2 className="text-[9px] font-bold text-white/95 tracking-[0.25em] uppercase mt-1 drop-shadow-md">
              Student Identification
            </h2>
          </div>

          <div className="flex flex-col items-center px-6 pt-3 pb-4 flex-1 relative z-10">
            
            {/* Photo Section */}
            <div className="relative mb-5 group mt-2">
              {/* Modern photo frame with offset borders */}
              <div className="absolute -inset-1.5 bg-gradient-to-b from-brand-blue/10 to-transparent rounded-lg transform rotate-3 transition-transform group-hover:rotate-6"></div>
              <div className="absolute -inset-1.5 bg-gradient-to-t from-sky-400/20 to-transparent rounded-lg transform -rotate-2 transition-transform group-hover:-rotate-4"></div>
              
              <div className="w-[110px] h-[135px] rounded-md border-2 border-white overflow-hidden bg-slate-50 relative flex justify-center items-center shadow-[0_8px_16px_rgba(0,0,0,0.1)] z-10">
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
              </h1>
              <div className="mt-1 flex justify-center">
                <div className="flex items-center gap-1.5 px-3 py-0.5 bg-gradient-to-r from-brand-blue/5 via-brand-blue/10 to-brand-blue/5 rounded-sm border-l-2 border-r-2 border-brand-blue">
                  <span className="w-1 h-1 bg-brand-blue rounded-full"></span>
                  <p className="text-[11px] font-bold text-brand-blue uppercase tracking-widest">
                    {student.course || "Student"}
                  </p>
                  <span className="w-1 h-1 bg-brand-blue rounded-full"></span>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="w-full flex-1 bg-white/80 backdrop-blur-sm rounded-lg p-3 border-t border-b border-brand-blue/10 relative shadow-sm">
              {/* Small accent corner brackets */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-brand-blue/40 rounded-tl"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-brand-blue/40 rounded-br"></div>

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
          
          {/* Bottom Thick Tech Bar */}
          <div className="h-2 w-full flex relative z-10 mt-auto">
             <div className="h-full w-1/3 bg-[#014d8a]"></div>
             <div className="h-full w-1/3 bg-brand-blue"></div>
             <div className="h-full w-1/3 bg-sky-400"></div>
          </div>
        </div>

        {/* ==================== BACK OF CARD ==================== */}
        <div className="relative bg-white w-[320px] h-[508px] rounded-xl overflow-hidden shadow-2xl shadow-brand-blue/10 print:shadow-none print:border-slate-300 flex flex-col isolate border border-slate-200/50">
          
          {/* Creative Background Elements (Back) */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#fafcff]">
             {/* SVG Noise Texture for tactile feel */}
             <div className="absolute inset-0 opacity-[0.35] mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
             
             {/* Diagonal hatching on back */}
             <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #0162b1 0, #0162b1 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }}></div>
             
             {/* Abstract bottom geometric shape */}
             <div className="absolute bottom-0 right-0 w-full h-[150px] bg-brand-blue/5" style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }}></div>
             <div className="absolute bottom-0 right-0 w-full h-[100px] bg-brand-blue/10" style={{ clipPath: 'polygon(30% 100%, 100% 20%, 100% 100%)' }}></div>
          </div>

          <div className="flex flex-col h-full p-6 relative z-10">
            
            {/* Header - Properly proportioned for 320px card */}
            <div className="mb-6 flex justify-center border-b border-brand-blue/10 pb-4 relative w-full">
              <div className="relative flex justify-center items-center w-[220px] h-14">
                <Image 
                  src={logoImage} 
                  alt="Logo" 
                  width={220}
                  height={70}
                  className="object-contain opacity-90 grayscale w-full h-full" 
                />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                Terms & Conditions
                <div className="flex-1 flex h-px bg-slate-200">
                   <div className="w-1/3 h-full bg-brand-blue/40"></div>
                </div>
              </h3>
              <ul className="text-[9px] text-slate-600 space-y-2 text-justify leading-relaxed pl-3 list-none relative">
                {/* Custom modern bullets */}
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-brand-blue/10 rounded-full"></div>
                
                <li className="relative"><span className="absolute -left-3 top-1.5 w-1 h-1 bg-brand-blue rounded-full"></span>This card is the property of the issuing institution and is non-transferable.</li>
                <li className="relative"><span className="absolute -left-3 top-1.5 w-1 h-1 bg-brand-blue/70 rounded-full"></span>The cardholder must present this card upon request by any authorized personnel.</li>
                <li className="relative"><span className="absolute -left-3 top-1.5 w-1 h-1 bg-brand-blue/50 rounded-full"></span>Loss or damage of this card must be reported immediately to the administration.</li>
                <li className="relative"><span className="absolute -left-3 top-1.5 w-1 h-1 bg-brand-blue/30 rounded-full"></span>A replacement fee will be applicable for lost or damaged cards.</li>
                <li className="relative"><span className="absolute -left-3 top-1.5 w-1 h-1 bg-brand-blue/20 rounded-full"></span>If found, please return this card to the issuing authority.</li>
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-brand-blue/10 space-y-2 relative">
              {student.centre && (
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <Building className="w-3.5 h-3.5 text-brand-blue" />
                  </div>
                  <p className="text-[9px] text-slate-700 font-medium uppercase tracking-wide">
                    {student.centre}
                  </p>
                </div>
              )}
              {student.address && (
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-blue" />
                  </div>
                  <p className="text-[9px] text-slate-700 font-medium whitespace-pre-wrap leading-tight">
                    {student.address}
                  </p>
                </div>
              )}
              {student.phone && (
                <div className="flex items-center gap-2">
                  <div>
                    <Phone className="w-3.5 h-3.5 text-brand-blue" />
                  </div>
                  <p className="text-[9px] text-slate-700 font-medium">
                    {student.phone}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between items-end bg-white/90 backdrop-blur-sm p-3 rounded border-l-2 border-brand-blue shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative">
              <div className="relative z-10">
                <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">Valid Until</p>
                <p className="text-[10px] text-slate-900 font-bold">
                  {student.validUntil || "-"}
                </p>
              </div>
              
              <div className="text-center relative z-10">
                <div className="w-20 border-b-2 border-slate-800 mb-1.5 inline-block"></div>
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
