"use client";

import { User, Printer, MapPin, Phone, ShieldCheck } from "lucide-react";
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
  };
}

// A small decorative barcode component
function Barcode({ value }: { value: string }) {
  // Deterministic bar widths based on char codes
  const bars = Array.from({ length: 28 }, (_, i) => {
    const code = value.charCodeAt(i % value.length) || 50;
    return ((code + i * 7) % 3) + 1; // 1, 2, or 3
  });
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-end gap-[1.5px] h-8">
        {bars.map((w, i) => (
          <div
            key={i}
            style={{ width: `${w * 2}px`, height: i % 5 === 0 ? "100%" : "75%" }}
            className="bg-slate-700 rounded-[1px]"
          />
        ))}
      </div>
      <p className="text-[7px] font-mono font-bold text-slate-500 tracking-[0.25em] uppercase">
        {value}
      </p>
    </div>
  );
}

export function IdCardClient({ student }: IdCardProps) {
  const centreAddress =
    student.address ||
    (student.centre === "Mannanam"
      ? "2nd Floor Gurukrupa Complex, Mannanam Jn, Kottayam"
      : "2nd Floor Castle Charis Complex, Kalathipady Jn, Kottayam");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .id-card-page {
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          background: linear-gradient(135deg, #e8edf5 0%, #d1dce8 50%, #c5d3e0 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1.5rem;
          gap: 2rem;
        }

        /* ---- FRONT CARD ---- */
        .id-card-front {
          position: relative;
          width: 340px;
          height: 540px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 30px 60px rgba(1,98,177,0.18), 0 4px 16px rgba(0,0,0,0.1);
          background: #ffffff;
        }

        /* Diagonal top accent */
        .id-card-front__bg-top {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 220px;
          background: linear-gradient(135deg, #0162b1 0%, #014d8a 60%, #012e5c 100%);
          clip-path: polygon(0 0, 100% 0, 100% 70%, 0 100%);
          z-index: 0;
        }

        /* Decorative circle accent */
        .id-card-front__circle1 {
          position: absolute;
          top: -60px; right: -60px;
          width: 200px; height: 200px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          z-index: 1;
        }
        .id-card-front__circle2 {
          position: absolute;
          top: 40px; left: -80px;
          width: 200px; height: 200px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          z-index: 1;
        }

        /* Gold accent strip */
        .id-card-front__gold-strip {
          position: absolute;
          top: 0; right: 32px;
          width: 4px; height: 180px;
          background: linear-gradient(180deg, #f5c842 0%, #e8a020 100%);
          border-radius: 0 0 4px 4px;
          z-index: 2;
        }

        .id-card-front__content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          padding: 0 24px;
        }

        /* Logo area */
        .id-card-front__logo-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          margin-bottom: 4px;
        }
        .id-card-front__logo-img {
          background: rgba(255,255,255,0.95);
          border-radius: 10px;
          padding: 5px 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        }
        .id-card-front__institute-tag {
          font-size: 8.5px;
          color: rgba(255,255,255,0.75);
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 16px;
        }

        /* Photo */
        .id-card-front__photo-ring {
          width: 104px; height: 104px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f5c842, #e8a020);
          padding: 3px;
          margin-bottom: 12px;
          box-shadow: 0 8px 24px rgba(1,98,177,0.25);
        }
        .id-card-front__photo-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          overflow: hidden;
          background: #e8edf5;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff;
        }

        /* Student name */
        .id-card-front__name {
          font-size: 18px;
          font-weight: 800;
          color: #0f1f3d;
          text-align: center;
          letter-spacing: -0.02em;
          line-height: 1.2;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        /* Role badge */
        .id-card-front__badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(90deg, #0162b1, #1a7fd4);
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 4px 14px;
          border-radius: 100px;
          margin-bottom: 18px;
          box-shadow: 0 2px 10px rgba(1,98,177,0.3);
        }

        /* Info grid */
        .id-card-front__info {
          width: 100%;
          background: #f5f8fc;
          border-radius: 14px;
          border: 1px solid #dde5ef;
          overflow: hidden;
          margin-bottom: 0;
        }
        .id-card-front__info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 14px;
          border-bottom: 1px solid #e4eaf2;
          gap: 8px;
        }
        .id-card-front__info-row:last-child {
          border-bottom: none;
        }
        .id-card-front__info-label {
          font-size: 9.5px;
          font-weight: 600;
          color: #8aa0ba;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }
        .id-card-front__info-value {
          font-size: 11px;
          font-weight: 700;
          color: #1a2d47;
          text-align: right;
          max-width: 60%;
          word-break: break-word;
        }
        .id-card-front__info-value--blood {
          color: #c0392b;
          font-size: 12px;
          font-weight: 800;
        }

        /* Footer barcode */
        .id-card-front__footer {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 10px 20px 14px;
          background: linear-gradient(180deg, transparent 0%, #f0f4f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          border-top: 1px solid #dde5ef;
        }

        /* ---- BACK CARD ---- */
        .id-card-back {
          position: relative;
          width: 340px;
          height: 540px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 30px 60px rgba(1,98,177,0.18), 0 4px 16px rgba(0,0,0,0.1);
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* Diagonal bottom accent for back */
        .id-card-back__bg-bottom {
          position: absolute;
          bottom: 0; left: 0;
          width: 100%; height: 200px;
          background: linear-gradient(135deg, #012e5c 0%, #014d8a 60%, #0162b1 100%);
          clip-path: polygon(0 40%, 100% 0, 100% 100%, 0 100%);
          z-index: 0;
        }
        .id-card-back__circle {
          position: absolute;
          bottom: -50px; left: -50px;
          width: 200px; height: 200px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          z-index: 1;
        }
        .id-card-back__gold-strip {
          position: absolute;
          bottom: 0; left: 32px;
          width: 4px; height: 160px;
          background: linear-gradient(0deg, #f5c842 0%, #e8a020 100%);
          border-radius: 4px 4px 0 0;
          z-index: 2;
        }

        .id-card-back__content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px;
        }

        .id-card-back__header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #dde5ef;
        }
        .id-card-back__header-icon {
          width: 34px; height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0162b1, #1a7fd4);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(1,98,177,0.25);
        }
        .id-card-back__header-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f1f3d;
          letter-spacing: -0.01em;
        }
        .id-card-back__header-sub {
          font-size: 9px;
          color: #8aa0ba;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .id-card-back__terms-title {
          font-size: 10px;
          font-weight: 700;
          color: #1a2d47;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .id-card-back__terms-list {
          list-style: none;
          padding: 0; margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }
        .id-card-back__terms-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 9.5px;
          color: #5a7290;
          line-height: 1.5;
          font-weight: 500;
        }
        .id-card-back__terms-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f5c842, #e8a020);
          flex-shrink: 0;
          margin-top: 4px;
        }

        /* Contact box */
        .id-card-back__contact {
          background: #f0f5fb;
          border-radius: 12px;
          border: 1px solid #dde5ef;
          padding: 12px 14px;
          margin-bottom: 16px;
        }
        .id-card-back__contact-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
        }
        .id-card-back__contact-row:last-child { margin-bottom: 0; }
        .id-card-back__contact-icon {
          width: 20px; height: 20px;
          border-radius: 6px;
          background: #0162b1;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .id-card-back__contact-text {
          font-size: 9.5px;
          color: #2c4764;
          font-weight: 600;
          line-height: 1.5;
        }

        /* Bottom: validity + signature (on top of blue bg) */
        .id-card-back__bottom {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding-top: 12px;
        }
        .id-card-back__validity {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 10px;
          padding: 8px 12px;
          backdrop-filter: blur(4px);
        }
        .id-card-back__validity-label {
          font-size: 8px;
          color: rgba(255,255,255,0.65);
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .id-card-back__validity-value {
          font-size: 13px;
          font-weight: 800;
          color: #f5c842;
          letter-spacing: 0.02em;
        }
        .id-card-back__signature {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .id-card-back__signature-line {
          width: 80px;
          border-bottom: 1.5px solid rgba(255,255,255,0.35);
        }
        .id-card-back__signature-label {
          font-size: 7.5px;
          color: rgba(255,255,255,0.55);
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        /* Controls */
        .id-card-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }
        .id-card-controls button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        .id-card-controls .btn-print {
          background: linear-gradient(135deg, #0162b1, #1a7fd4);
          color: #fff;
          box-shadow: 0 4px 16px rgba(1,98,177,0.3);
        }
        .id-card-controls .btn-print:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(1,98,177,0.4);
        }

        @media print {
          .id-card-page {
            background: white !important;
            padding: 0.5rem;
          }
          .id-card-controls { display: none !important; }
          .id-card-front, .id-card-back {
            box-shadow: none !important;
            border: 1px solid #ccc;
          }
        }
      `}</style>

      <div className="id-card-page print:bg-white">
        {/* Controls */}
        <div className="id-card-controls print:hidden">
          <button className="btn-print" onClick={() => window.print()}>
            <Printer size={15} /> Print ID Card
          </button>
        </div>

        {/* ===== FRONT CARD ===== */}
        <div className="id-card-front">
          {/* Background layers */}
          <div className="id-card-front__bg-top" />
          <div className="id-card-front__circle1" />
          <div className="id-card-front__circle2" />
          <div className="id-card-front__gold-strip" />

          <div className="id-card-front__content">
            {/* Logo */}
            <div className="id-card-front__logo-wrap">
              <div className="id-card-front__logo-img">
                <Image src={logoImage} alt="Educare Logo" width={90} height={28} style={{ objectFit: "contain" }} />
              </div>
            </div>
            <p className="id-card-front__institute-tag">Institute of Excellence</p>

            {/* Photo */}
            <div className="id-card-front__photo-ring">
              <div className="id-card-front__photo-inner">
                {student.photo ? (
                  <img src={student.photo} alt={student.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <User size={40} color="#8aa0ba" />
                )}
              </div>
            </div>

            {/* Name */}
            <h1 className="id-card-front__name">{student.name}</h1>

            {/* Badge */}
            <div className="id-card-front__badge">
              <ShieldCheck size={10} />
              {student.course || "Student"}
            </div>

            {/* Info rows */}
            <div className="id-card-front__info">
              <div className="id-card-front__info-row">
                <span className="id-card-front__info-label">Admission No</span>
                <span className="id-card-front__info-value">{student.admissionNo}</span>
              </div>
              <div className="id-card-front__info-row">
                <span className="id-card-front__info-label">Class / Division</span>
                <span className="id-card-front__info-value">{student.classLevel} – {student.division}</span>
              </div>
              <div className="id-card-front__info-row">
                <span className="id-card-front__info-label">Board</span>
                <span className="id-card-front__info-value">{student.board}</span>
              </div>
              <div className="id-card-front__info-row">
                <span className="id-card-front__info-label">Centre</span>
                <span className="id-card-front__info-value">{student.centre}</span>
              </div>
              <div className="id-card-front__info-row">
                <span className="id-card-front__info-label">Blood Group</span>
                <span className="id-card-front__info-value id-card-front__info-value--blood">{student.bloodGroup}</span>
              </div>
            </div>

            {/* Footer barcode */}
            <div className="id-card-front__footer">
              <Barcode value={student.admissionNo} />
            </div>
          </div>
        </div>

        {/* ===== BACK CARD ===== */}
        <div className="id-card-back">
          <div className="id-card-back__bg-bottom" />
          <div className="id-card-back__circle" />
          <div className="id-card-back__gold-strip" />

          <div className="id-card-back__content">
            {/* Header */}
            <div className="id-card-back__header">
              <div className="id-card-back__header-icon">
                <Image src={logoImage} alt="Educare Logo" width={22} height={22} style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }} />
              </div>
              <div>
                <div className="id-card-back__header-title">Educare Institute</div>
                <div className="id-card-back__header-sub">Student Identification Card</div>
              </div>
            </div>

            {/* Terms */}
            <p className="id-card-back__terms-title">Terms & Conditions</p>
            <ul className="id-card-back__terms-list">
              {[
                "This card is the property of Educare Institute and is strictly non-transferable.",
                "The cardholder must present this card upon request by any institute authority.",
                "Loss of this card must be reported immediately to the administration office.",
                "A replacement fee will be charged for lost or damaged cards.",
                "Misuse of this card may result in disciplinary action.",
              ].map((term, i) => (
                <li key={i} className="id-card-back__terms-item">
                  <span className="id-card-back__terms-dot" />
                  {term}
                </li>
              ))}
            </ul>

            {/* Contact */}
            <div className="id-card-back__contact">
              <div className="id-card-back__contact-row">
                <div className="id-card-back__contact-icon">
                  <MapPin size={11} color="white" />
                </div>
                <p className="id-card-back__contact-text">{centreAddress}</p>
              </div>
              <div className="id-card-back__contact-row">
                <div className="id-card-back__contact-icon">
                  <Phone size={11} color="white" />
                </div>
                <p className="id-card-back__contact-text">+91 9876 543 210 &nbsp;|&nbsp; +91 9876 543 211</p>
              </div>
            </div>

            {/* Bottom validity + signature (overlays blue bg) */}
            <div style={{ flex: 1 }} />
            <div className="id-card-back__bottom" style={{ position: "relative", zIndex: 20 }}>
              <div className="id-card-back__validity">
                <div className="id-card-back__validity-label">Valid Until</div>
                <div className="id-card-back__validity-value">May 2027</div>
              </div>
              <div className="id-card-back__signature">
                <div className="id-card-back__signature-line" />
                <div className="id-card-back__signature-label">Issuing Authority</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
