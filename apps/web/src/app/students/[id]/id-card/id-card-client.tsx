"use client";

import { User, Printer, Download, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import logoImage from "@/logos/logo1.png";
import { useEffect } from "react";

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
  };
}

export function IdCardClient({ student }: IdCardProps) {
  // Add a simple barcode generation using a generic font or CSS pattern
  // For simplicity, we just use a styled div pattern to mock a barcode.
  
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-8 font-sans print:bg-white print:p-0 print:min-h-0">
      
      {/* Controls (Hidden on Print) */}
      <div className="mb-8 flex gap-4 print:hidden">
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
        >
          <Printer className="h-4 w-4" /> Print ID Card
        </button>
      </div>

      {/* The ID Card */}
      {/* Standard CR80 Size in mm is 54x86, we scale it up slightly for web view but keep aspect ratio */}
      <div className="relative bg-white w-[320px] h-[510px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-200 print:shadow-none print:border-slate-300">
        
        {/* Top Header Background */}
        <div className="absolute top-0 left-0 w-full h-[180px] bg-gradient-to-br from-brand-blue to-[#1e3a8a] rounded-b-[40px] z-0">
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
        </div>

        <div className="relative z-10 flex flex-col items-center pt-6 px-6 h-full">
          
          {/* Institute Logo / Name */}
          <div className="text-center mb-5 flex flex-col items-center">
            <div className="bg-white p-1 rounded-lg shadow-sm mb-1">
              <Image src={logoImage} alt="Educare Logo" width={100} height={30} className="object-contain" />
            </div>
            <p className="text-[9px] text-blue-100 font-semibold tracking-[0.2em] uppercase">Institute of Excellence</p>
          </div>

          {/* Photo */}
          <div className="w-32 h-32 bg-white rounded-2xl p-1.5 shadow-lg mb-4 rotate-1 hover:rotate-0 transition-transform">
            <div className="w-full h-full bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
              {student.photo ? (
                <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-slate-300" />
              )}
            </div>
          </div>

          {/* Student Info */}
          <div className="text-center w-full">
            <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">{student.name}</h2>
            <div className="inline-block bg-blue-50 text-brand-blue px-3 py-1 rounded-full text-xs font-black uppercase mt-1.5 mb-4 border border-blue-100">
              {student.course || "Student"}
            </div>

            <div className="w-full space-y-2 text-left bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Admission No</span>
                <span className="font-bold text-slate-800">{student.admissionNo}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Class / Div</span>
                <span className="font-bold text-slate-800">{student.classLevel} - {student.division}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Blood Group</span>
                <span className="font-bold text-red-600">{student.bloodGroup}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">DOB</span>
                <span className="font-bold text-slate-800">12/05/2008</span>
              </div>
            </div>
          </div>

          {/* Footer & Barcode */}
          <div className="absolute bottom-0 left-0 w-full bg-brand-blue/5 p-4 flex flex-col items-center justify-center border-t border-brand-blue/10">
            {/* Fake Barcode */}
            <div className="flex items-center justify-center h-8 w-48 mb-2 opacity-70">
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-2 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-0.5 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1.5 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-3 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-0.5 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-2 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1.5 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-0.5 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-2 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1.5 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-0.5 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-2 h-full bg-slate-800 mx-[1px]"></div>
              <div className="w-1 h-full bg-slate-800 mx-[1px]"></div>
            </div>
            <p className="text-[8px] text-slate-500 font-bold tracking-widest">{student.admissionNo}</p>
          </div>

        </div>
      </div>
      
      {/* Back side of ID Card */}
      <div className="relative bg-white w-[320px] h-[510px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-200 mt-8 print:mt-4 print:shadow-none print:border-slate-300 flex flex-col justify-between p-6">
        <div>
          <h3 className="font-bold text-center text-slate-800 mb-6 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">Terms & Conditions</h3>
          <ul className="text-[10px] text-slate-500 space-y-3 list-disc pl-3">
            <li>This card is the property of Educare Institute and is non-transferable.</li>
            <li>The cardholder must present this card upon request by the authorities.</li>
            <li>Loss of this card must be reported immediately to the administration office.</li>
            <li>A fee will be charged for a replacement card.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="w-3 h-3 text-brand-blue shrink-0 mt-0.5" />
              <p className="text-[9px] text-slate-600 font-medium">
                {student.address ? (
                  <span className="whitespace-pre-wrap">{student.address}</span>
                ) : (
                  student.centre === 'Mannanam' 
                    ? "Educare Institute, 2nd Floor Gurukrupa Complex, Mannanam Jn." 
                    : "Educare Institute, 2nd Floor Castle Charis Complex, Kalathipady Jn."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 text-brand-blue shrink-0" />
              <p className="text-[9px] text-slate-600 font-medium">+91 9876543210</p>
            </div>
          </div>
          
          <div className="flex justify-between items-end pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400">
              Valid until:<br/>May 2027
            </div>
            <div className="text-center">
              <div className="w-16 h-8 border-b border-slate-300 mb-1 inline-block"></div>
              <p className="text-[8px] font-bold text-slate-500 uppercase">Issuing Authority</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
