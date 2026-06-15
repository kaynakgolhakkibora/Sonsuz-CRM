import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DAY_IDX = { "Pazartesi":1, "Sali":2, "Carsamba":3, "Persembe":4, "Cuma":5, "Cumartesi":6, "Pazar":0 };
const TR_DAYS_MAP = { "Pazartesi":"Pazartesi", "Salı":"Sali", "Çarşamba":"Carsamba", "Perşembe":"Persembe", "Cuma":"Cuma", "Cumartesi":"Cumartesi", "Pazar":"Pazar" };

function nextWeekday(day, from = new Date()) {
  const key = TR_DAYS_MAP[day] || day;
  const target = DAY_IDX[key] !== undefined ? DAY_IDX[key] : DAY_IDX[day];
  const d = new Date(from);
  let limit = 0;
  while (d.getDay() !== target && limit < 8) { d.setDate(d.getDate() + 1); limit++; }
  return d;
}

function buildSchedule(day, count, from) {
  const dates = [];
  const d = nextWeekday(day, from);
  for (let i = 0; i < count; i++) {
    dates.push({ id: uid(), date: new Date(d).toISOString(), status: "upcoming", note: "" });
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

function buildSchedule2(day1, day2, count, from) {
  const dates = [];
  const d1 = nextWeekday(day1, from);
  const d2 = nextWeekday(day2, from);
  const slots = [new Date(d1), new Date(d2)].sort((a, b) => a - b);
  let slotIdx = 0;
  for (let i = 0; i < count; i++) {
    dates.push({ id: uid(), date: new Date(slots[slotIdx]).toISOString(), status: "upcoming", note: "" });
    slotIdx = 1 - slotIdx;
    if (slotIdx === 0) {
      slots[0].setDate(slots[0].getDate() + 7);
      slots[1].setDate(slots[1].getDate() + 7);
    }
  }
  dates.sort((a, b) => new Date(a.date) - new Date(b.date));
  return dates;
}

function uid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }); }

function addDays(iso, n) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString(); }
function expiry30() { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; }
function daysLeft(iso) { if (!iso) return null; return Math.ceil((new Date(iso) - new Date()) / 86400000); }
function fmtDate(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { weekday:"short", day:"numeric", month:"long" }); }
function fmtMed(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"long" }); }
function fmtShort(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"short" }); }
function calcBalance(schedule) { return schedule.filter(l => l.status === "upcoming").length; }
function calcNextPayment(schedule) { const up = schedule.filter(l => l.status === "upcoming"); if (!up.length) return null; const d = new Date(up[up.length-1].date); d.setDate(d.getDate()+7); return d.toISOString(); }
function midday(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function isToday(iso) { return midday(new Date(iso)).getTime() === midday().getTime(); }
function paymentOverdueDays(iso) { if (!iso) return 0; const diff = Math.floor((midday() - midday(new Date(iso))) / 86400000); return diff > 0 ? diff : 0; }

function getPaketDonemler(student) {
  const schedule = student.schedule || [];
  const donemler = [];
  const chunks = [];
  for (let i = 0; i < schedule.length; i += 4) {
    chunks.push(schedule.slice(i, i + 4));
  }
  chunks.forEach((chunk, idx) => {
    if (chunk.length === 0) return;
    const label = fmtShort(chunk[0].date) + " - " + fmtShort(chunk[chunk.length - 1].date);
    const firstDate = chunk[0].date;
    donemler.push({ idx, label, firstDate, chunk });
  });
  return donemler;
}

const INSTRUMENTS = ["Davul","Piyano","Gitar"];
const DAYS = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const TIMES = [];
for (let h=10;h<=19;h++) for (let m=0;m<60;m+=15) TIMES.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

function Pill({ label, bg, color }) {
  return <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, background:bg, color, whiteSpace:"nowrap" }}>{label}</span>;
}

function StatusPill({ status }) {
  const M = { upcoming:{label:"Planlandı",bg:"#f3f4f6",color:"#6b7280"}, completed:{label:"Katıldı",bg:"#d1fae5",color:"#065f46"}, noshow:{label:"No-Show",bg:"#fee2e2",color:"#991b1b"}, lastminute:{label:"Son Dakika",bg:"#ffedd5",color:"#9a3412"}, telafi:{label:"Telafi",bg:"#dbeafe",color:"#1e40af"} };
  const s = M[status] || M.upcoming;
  return <Pill label={s.label} bg={s.bg} color={s.color} />;
}

function Btn({ children, onClick, bg="#111", color="#fff", outline=false, mb=8 }) {
  return (
    <button onClick={onClick} style={{ width:"100%", background:outline?"transparent":bg, color:outline?bg:color, border:outline?`2px solid ${bg}`:"none", borderRadius:14, padding:"13px 16px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", marginBottom:mb, display:"block" }}>
      {children}
    </button>
  );
}

function NoteArea({ value, onChange, placeholder="Açıklama ekle..." }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Açıklama (opsiyonel)</label>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 12px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", outline:"none", resize:"none", background:"#fafafa", color:"#111" }} />
    </div>
  );
}

function Sheet({ title, subtitle, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"flex-end", justifyContent:"center", background:"rgba(0,0,0,0.5)" }}>
      <div style={{ background:"#fff", width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", boxShadow:"0 -4px 30px rgba(0,0,0,.15)", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", borderBottom:"1px solid #f0f0f0" }}>
          <div>
            <span style={{ fontWeight:700, fontSize:16, color:"#111", display:"block" }}>{title}</span>
            {subtitle && <span style={{ fontSize:12, color:"#888" }}>{subtitle}</span>}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, color:"#aaa", cursor:"pointer", lineHeight:1 }}>x</button>
        </div>
        <div style={{ padding:"16px 20px 28px", maxHeight:"74vh", overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}

const INP = { width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", background:"#fafafa", color:"#111" };
const LBL = { display:"block", fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:4, marginTop:14 };

function ActionSheet({ student, lessonId, onClose, onAction, onUndoLesson }) {
  const [step, setStep] = useState("main");
  const [note, setNote] = useState("");
  const lesson = lessonId ? student.schedule.find(l=>l.id===lessonId) : student.schedule.find(l=>l.status==="upcoming");
  const activeTelafi = student.telafi_records.filter(r=>!r.done).length;
  const willWarn = activeTelafi === 4;
  const willFreeze = activeTelafi === 5;
  const reset = (s) => { setNote(""); setStep(s); };
  const act = (a) => onAction(a, note, lessonId || lesson?.id);

  const TelafiWarn = () => (
    <>
      {willWarn && <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#92400e", fontWeight:600 }}>Uyari: Bu telafi ile 5. hakka ulasilacak.</div>}
      {willFreeze && <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#991b1b", fontWeight:600 }}>Uyari: 6. telafi limiti — program dondurulacak.</div>}
    </>
  );

  return (
    <Sheet title={student.name} subtitle={lesson ? fmtDate(lesson.date)+" - "+student.time : ""} onClose={onClose}>
      {step === "main" && <>
        <Btn bg="#10b981" onClick={() => act("attended")}>Katıldı</Btn>
        <Btn bg="#1f2937" onClick={() => reset("yapildi")}>Yapıldı Say</Btn>
        <Btn bg="#3b82f6" onClick={() => reset("telafi")}>Telafi Hakkı Oluştur</Btn>
        <Btn bg="#f59e0b" onClick={() => act("freeze")}>Programı Dondur</Btn>
      </>}
      {step === "telafi" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>24 saat önceden iptal</p>
        <TelafiWarn />
        <NoteArea value={note} onChange={setNote} placeholder="Neden iptal edildi?" />
        <Btn bg="#3b82f6" onClick={() => act("telafi")}>Telafi Hakkı Oluştur</Btn>
        <Btn bg="#111" outline onClick={() => reset("main")}>Geri</Btn>
      </>}
      {step === "yapildi" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Neden yapıldı sayılıyor?</p>
        <Btn bg="#f97316" onClick={() => reset("sondakika")}>Son Dakika İptali</Btn>
        <Btn bg="#ef4444" onClick={() => reset("noshow")}>Habersiz Gelmedi</Btn>
        <Btn bg="#111" outline onClick={() => reset("main")}>Geri</Btn>
      </>}
      {step === "sondakika" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Son dakika iptali — telafi verilsin mi?</p>
        <TelafiWarn />
        <NoteArea value={note} onChange={setNote} />
        <Btn bg="#3b82f6" onClick={() => act("lm-telafi")}>Telafiye Al</Btn>
        <Btn bg="#374151" onClick={() => act("lm-notelafi")}>Telafi Verme</Btn>
        <Btn bg="#111" outline onClick={() => reset("yapildi")}>Geri</Btn>
      </>}
      {step === "noshow" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Habersiz gelmedi — aciklama ekle</p>
        <NoteArea value={note} onChange={setNote} />
        <Btn bg="#ef4444" onClick={() => act("noshow")}>Kaydet</Btn>
        <Btn bg="#111" outline onClick={() => reset("yapildi")}>Geri</Btn>
      </>}
    </Sheet>
  );
}

function TelafiSheet({ record, studentName, onClose, onDone }) {
  const [step, setStep] = useState("main");
  const [note, setNote] = useState("");
  const days = daysLeft(record.expiry);
  const expired = days !== null && days < 0;
  const urgent = !expired && days !== null && days <= 7;

  return (
    <Sheet title="Telafi Dersi" subtitle={studentName} onClose={onClose}>
      <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#0369a1", textTransform:"uppercase", letterSpacing:1 }}>İptal Edilen Ders</p>
        <p style={{ margin:"4px 0 0", fontSize:15, fontWeight:700, color:"#111" }}>{fmtDate(record.lessonDate)}</p>
        {record.note && <p style={{ margin:"4px 0 0", fontSize:13, color:"#475569", fontStyle:"italic" }}>{record.note}</p>}
      </div>
      <div style={{ background: expired?"#fee2e2":urgent?"#fffbeb":"#f0fdf4", border:`1px solid ${expired?"#fca5a5":urgent?"#fcd34d":"#bbf7d0"}`, borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Son Geçerlilik</p>
            <p style={{ margin:"4px 0 0", fontSize:15, fontWeight:700, color: expired?"#dc2626":urgent?"#d97706":"#166534" }}>{fmtMed(record.expiry)}</p>
          </div>
          <div style={{ background: expired?"#dc2626":urgent?"#d97706":"#16a34a", color:"#fff", borderRadius:20, padding:"6px 14px", fontWeight:800, fontSize:14 }}>
            {expired ? "Süresi Doldu" : `${days} gün`}
          </div>
        </div>
      </div>
      {record.done
        ? <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px" }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>Telafi Yapıldı</p>
            {record.doneAt && <p style={{ margin:"4px 0 0", fontSize:13, color:"#4ade80" }}>{record.doneAt}</p>}
          </div>
        : step === "main"
          ? <Btn bg="#10b981" onClick={() => setStep("done")}>Telafi Yapıldı Isaretke</Btn>
          : <>
              <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Tarih ve saati yaz:</p>
              <NoteArea value={note} onChange={setNote} placeholder="Örn: 22 Mayis yapildi" />
              <Btn bg="#10b981" onClick={() => { onDone(record.id, note || fmtDate(new Date().toISOString())); onClose(); }}>Kaydet</Btn>
              <Btn bg="#111" outline onClick={() => setStep("main")}>Geri</Btn>
            </>
      }
    </Sheet>
  );
}

function ShiftSheet({ lesson, student, onClose, onShift }) {
  return (
    <Sheet title="Ders Tarihi Kaydır" subtitle={fmtDate(lesson.date)+" - "+student.time} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>Bu dersten itibaren tüm planlanmış dersler ileri alınır.</p>
      <Btn bg="#6366f1" onClick={() => { onShift(lesson.id, 7); onClose(); }}>1 Hafta İleri Al</Btn>
      <Btn bg="#8b5cf6" onClick={() => { onShift(lesson.id, 14); onClose(); }}>2 Hafta İleri Al</Btn>
      <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
    </Sheet>
  );
}

function DuzenleSheet({ student, onClose, onDuzenle }) {
  const [f, setF] = useState({
    name: student.name, phone: student.phone || "", veli_adi: student.veli_adi || "",
    dogum_tarihi: student.dogum_tarihi || "", ucret: student.ucret || "",
    instrument: student.instrument, day: student.day, time: student.time,
    day2: student.day2 || "", time2: student.time2 || "",
  });
  const [ikiGun, setIkiGun] = useState(!!(student.day2));
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <Sheet title="Öğrenciyi Düzenle" subtitle={student.name} onClose={onClose}>
      <label style={LBL}>Ad Soyad</label>
      <input style={INP} value={f.name} onChange={e=>s("name",e.target.value)} />
      <label style={LBL}>Veli Adı</label>
      <input style={INP} value={f.veli_adi} onChange={e=>s("veli_adi",e.target.value)} placeholder="Veli adı soyadı" />
      <label style={LBL}>Doğum Tarihi (opsiyonel)</label>
      <input style={INP} type="date" value={f.dogum_tarihi||""} onChange={e=>s("dogum_tarihi",e.target.value)} />
      <label style={LBL}>Telefon (WhatsApp)</label>
      <input style={INP} value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="905xxxxxxxxx" type="tel" />
      <label style={LBL}>4 Ders Ücreti (TL)</label>
      <input style={INP} value={f.ucret} onChange={e=>s("ucret",e.target.value)} placeholder="5600" type="number" />
      <label style={LBL}>Enstrüman</label>
      <select style={INP} value={f.instrument} onChange={e=>s("instrument",e.target.value)}>
        {INSTRUMENTS.map(i=><option key={i}>{i}</option>)}
      </select>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={LBL}>1. Gün</label><select style={INP} value={f.day} onChange={e=>s("day",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div><label style={LBL}>Saat</label><select style={INP} value={f.time} onChange={e=>s("time",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div style={{ marginTop:14 }}>
        <button onClick={() => { setIkiGun(!ikiGun); if(ikiGun){ s("day2",""); s("time2",""); } }} style={{ background:ikiGun?"#111":"#f3f4f6", color:ikiGun?"#fff":"#555", border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          {ikiGun ? "✓ Haftada 2 Gün" : "+ Haftada 2 Gün Ekle"}
        </button>
      </div>
      {ikiGun && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><label style={LBL}>2. Gün</label><select style={INP} value={f.day2} onChange={e=>s("day2",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label style={LBL}>Saat</label><select style={INP} value={f.time2} onChange={e=>s("time2",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
      )}
      <div style={{ marginTop:16 }}>
        <Btn bg="#111" onClick={() => { if(f.name.trim()){ onDuzenle(student.id, f); onClose(); } }}>Kaydet</Btn>
        <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function EkDersSheet({ student, onClose, onEkDersEkle }) {
  const now = new Date();
  const [date, setDate] = useState(now.toISOString().split("T")[0]);
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const ekDersBirimUcret = student.ucret ? Math.round(student.ucret / 4) : 0;
  return (
    <Sheet title="Ek Ders Ekle" subtitle={student.name} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Bu ders pakete dahil değil, ayrıca ücretlendirilecek.</p>
      {ekDersBirimUcret > 0 && (
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginBottom:12 }}>
          <p style={{ margin:0, fontSize:13, color:"#166534", fontWeight:700 }}>Ek ders ücreti: {ekDersBirimUcret.toLocaleString("tr-TR")} TL</p>
          <p style={{ margin:"2px 0 0", fontSize:12, color:"#4ade80" }}>Paket ücreti ({(student.ucret||0).toLocaleString("tr-TR")} TL) ÷ 4</p>
        </div>
      )}
      <label style={LBL}>Tarih</label>
      <input style={INP} type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <label style={LBL}>Saat</label>
      <select style={INP} value={time} onChange={e=>setTime(e.target.value)}>
        {TIMES.map(t=><option key={t}>{t}</option>)}
      </select>
      <label style={LBL}>Not (opsiyonel)</label>
      <input style={INP} value={note} onChange={e=>setNote(e.target.value)} placeholder="Konu vb." />
      <div style={{ marginTop:16 }}>
        <Btn bg="#6366f1" onClick={() => { onEkDersEkle(student.id, { id:uid(), date: date+"T"+time+":00", note, createdAt: new Date().toISOString(), odendi: false }); onClose(); }}>Ek Ders Kaydet</Btn>
        <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function DetailSheet({ student, onClose, onRecharge, onLessonClick, onShift, onTelafiDone, onMesaj, onÖdeme, onDelete, onEkDersEkle, onDuzenle, onUndoLesson, onUnrecharge }) {
  const [tab, setTab] = useState("takvim");
  const [telafiSel, setTelafiSel] = useState(null);
  const [shiftSel, setShiftSel] = useState(null);
  const [showEkDers, setShowEkDers] = useState(false);
  const [showDuzenle, setShowDuzenle] = useState(false);
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const bal = calcBalance(student.schedule);
  const np = calcNextPayment(student.schedule);
  const active = student.telafi_records.filter(r=>!r.done);
  const done = student.telafi_records.filter(r=>r.done);
  const ekDersler = student.ek_dersler || [];
  const upcomingDersler = student.schedule.filter(l => l.status === "upcoming");
  const canUnrecharge = upcomingDersler.length >= 4 && upcomingDersler.slice(-4).every(l => l.status === "upcoming");

  return (
    <>
      <Sheet title={student.name} onClose={onClose}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          <Pill label={student.instrument} bg="#f3f4f6" color="#374151" />
          <Pill label={student.day+" "+student.time} bg="#f3f4f6" color="#374151" />
          {student.day2 ? <Pill label={student.day2+" "+student.time2} bg="#e0e7ff" color="#3730a3" /> : null}
          {student.veli_adi ? <Pill label={"Veli: "+student.veli_adi} bg="#fef9c3" color="#854d0e" /> : null}
          {student.frozen ? <Pill label="Dondurulmus" bg="#dbeafe" color="#1d4ed8" /> : null}
          {ekDersler.length > 0 ? <Pill label={"+"+ekDersler.length+" ek ders"} bg="#ede9fe" color="#5b21b6" /> : null}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
          {[
            { label:"Kalan Ders", val:bal, bg:"#f9fafb", color:"#111" },
            { label:"Aktif Telafi", val:active.length, bg: active.length>4?"#fee2e2":active.length===4?"#fffbeb":"#eff6ff", color: active.length>4?"#dc2626":active.length===4?"#d97706":"#2563eb" },
            { label:"No-Show", val:student.no_show, bg:"#fff1f2", color:"#e11d48" },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
              <p style={{ fontSize:24, fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
              <p style={{ fontSize:10, color:"#888", margin:"2px 0 0", fontWeight:600 }}>{s.label}</p>
            </div>
          ))}
        </div>
        {np ? (
          <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Tahmini Sonraki Ödeme</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:700, color:"#111" }}>{fmtMed(np)}</p>
              </div>
              <span style={{ fontSize:22 }}>💳</span>
            </div>
          </div>
        ) : null}
        {student.odemeler && student.odemeler.length > 0 ? (
          <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Ödeme Geçmişi</p>
            {[...student.odemeler].reverse().map((o,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#444", marginBottom:5 }}>
                <span>{fmtMed(o.tarih)}{o.donem ? " - "+o.donem : ""}{o.ekDersSayisi > 0 ? " +"+o.ekDersSayisi+" ek" : ""}</span>
                <span style={{ color:"#111", fontWeight:700 }}>{typeof o.tutar === "number" ? o.tutar.toLocaleString("tr-TR")+" TL" : (student.ucret ? student.ucret.toLocaleString("tr-TR")+" TL" : o.tutar)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
          {[
            { key:"takvim", label:"Dersler" },
            { key:"telafi", label:"Telafi"+(active.length>0?" ("+active.length+")":"") },
            { key:"ekders", label:"Ek Ders"+(ekDersler.length>0?" ("+ekDersler.length+")":"") }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex:1, background:tab===t.key?"#111":"#f3f4f6", color:tab===t.key?"#fff":"#555", border:"none", borderRadius:10, padding:"9px 8px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "takvim" && (() => {
          const LessonCard = ({ l }) => {
            const clickable = l.status === "upcoming";
            const undoable = l.status === "completed" || l.status === "noshow" || l.status === "lastminute" || l.status === "telafi";
            return (
              <div key={l.id} style={{ background:clickable?"#f9fafb":"#fff", border:clickable?"1.5px solid #d1d5db":"1px solid #f3f4f6", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ cursor:clickable?"pointer":"default", flex:1 }} onClick={() => clickable && onLessonClick(student, l.id)}>
                    <p style={{ margin:0, fontWeight:600, fontSize:14, color:"#111" }}>{fmtDate(l.date)}</p>
                    <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{student.time}{clickable ? " · işlem yap" : ""}</p>
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <StatusPill status={l.status} />
                    {clickable ? <button onClick={() => setShiftSel(l)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"4px 8px", cursor:"pointer", fontSize:14, color:"#6366f1" }}>shift</button> : null}
                    {undoable ? (
                      <button onClick={() => { if(window.confirm("Bu dersi 'Planlandı' durumuna geri al?")) onUndoLesson(student.id, l.id, l.status); }} style={{ background:"#fef3c7", border:"none", borderRadius:8, padding:"4px 8px", cursor:"pointer", fontSize:11, color:"#92400e", fontWeight:700 }}>Geri Al</button>
                    ) : null}
                  </div>
                </div>
                {l.note ? <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", marginTop:6 }}><p style={{ margin:0, fontSize:12, color:"#475569", fontStyle:"italic" }}>{l.note}</p></div> : null}
              </div>
            );
          };
          const upcomingD = student.schedule.filter(l => l.status === "upcoming");
          const gecmisDersler = student.schedule.filter(l => l.status !== "upcoming");
          const güncelGecmisSayisi = gecmisDersler.length % 4;
          const güncelGecmis = güncelGecmisSayisi > 0 ? gecmisDersler.slice(-güncelGecmisSayisi) : [];
          const eskiPaketler = güncelGecmisSayisi > 0 ? gecmisDersler.slice(0, -güncelGecmisSayisi) : gecmisDersler;
          const güncel = [...güncelGecmis, ...upcomingD];
          return (
            <div>
              {eskiPaketler.length > 0 ? (
                <div style={{ marginBottom:8 }}>
                  <button onClick={() => setGecmisAcik(!gecmisAcik)} style={{ width:"100%", background:"#f3f4f6", border:"none", borderRadius:10, padding:"10px 12px", fontSize:13, fontWeight:700, color:"#555", cursor:"pointer", fontFamily:"inherit", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>Geçmiş Dersler ({eskiPaketler.length})</span>
                    <span>{gecmisAcik ? "▲" : "▼"}</span>
                  </button>
                  {gecmisAcik && <div style={{ marginTop:6 }}>{eskiPaketler.map(l => <LessonCard key={l.id} l={l} />)}</div>}
                </div>
              ) : null}
              {güncel.map(l => <LessonCard key={l.id} l={l} />)}
            </div>
          );
        })()}

        {tab === "telafi" ? (
          <div>
            {student.telafi_records.length === 0 ? <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Aktif telafi hakkı yok</p> : null}
            {active.length > 0 ? (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Bekleyen</p>
                {active.map(r => {
                  const d = daysLeft(r.expiry);
                  const exp = d !== null && d < 0;
                  const urg = !exp && d !== null && d <= 7;
                  return (
                    <div key={r.id} onClick={() => setTelafiSel(r)} style={{ background:exp?"#fff1f2":urg?"#fffbeb":"#f0f9ff", border:"1.5px solid "+(exp?"#fca5a5":urg?"#fcd34d":"#bae6fd"), borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#111" }}>{fmtDate(r.lessonDate)} dersi</p>
                          {r.note ? <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b", fontStyle:"italic" }}>{r.note}</p> : null}
                          <p style={{ margin:"4px 0 0", fontSize:12, color:"#888" }}>Son geçerlilik: <strong style={{ color: exp?"#dc2626":urg?"#d97706":"#0369a1" }}>{fmtMed(r.expiry)}</strong></p>
                        </div>
                        <div style={{ background:exp?"#dc2626":urg?"#d97706":"#0ea5e9", color:"#fff", borderRadius:20, padding:"4px 10px", fontSize:12, fontWeight:800, flexShrink:0, marginLeft:8 }}>
                          {exp?"Doldu":d+"g"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {done.length > 0 ? (
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Yapilmis</p>
                {done.map(r => (
                  <div key={r.id} style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>{fmtDate(r.lessonDate)} dersi yapildi</p>
                    {r.doneAt ? <p style={{ margin:"3px 0 0", fontSize:12, color:"#4ade80" }}>{r.doneAt}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "ekders" ? (
          <div>
            <Btn bg="#6366f1" mb={12} onClick={() => setShowEkDers(true)}>Ek Ders Ekle</Btn>
            {ekDersler.length === 0
              ? <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Henüz ek ders yok</p>
              : [...ekDersler].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e => (
                  <div key={e.id} style={{ background: e.odendi?"#f0fdf4":"#faf5ff", border:"1px solid "+(e.odendi?"#bbf7d0":"#e9d5ff"), borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <p style={{ margin:0, fontWeight:700, fontSize:14, color:e.odendi?"#166534":"#5b21b6" }}>{fmtDate(e.date)}</p>
                        <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{new Date(e.date).toLocaleTimeString("tr-TR", {hour:"2-digit",minute:"2-digit"})}</p>
                        {e.note ? <p style={{ margin:"4px 0 0", fontSize:12, color:"#475569", fontStyle:"italic" }}>{e.note}</p> : null}
                      </div>
                      <Pill label={e.odendi?"Ödendi":"Ödenmedi"} bg={e.odendi?"#d1fae5":"#ede9fe"} color={e.odendi?"#065f46":"#5b21b6"} />
                    </div>
                  </div>
                ))
            }
          </div>
        ) : null}

        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8 }}>
          <Btn bg="#6366f1" onClick={() => setShowDuzenle(true)}>Öğrenciyi Düzenle</Btn>
          <Btn bg="#111" onClick={() => { onRecharge(student.id, new Date().toISOString().split("T")[0]); onClose(); }}>Paket Yükle (4 Ders)</Btn>
          {canUnrecharge ? (
            <Btn bg="#f59e0b" onClick={() => { if(window.confirm("Son 4 upcoming dersi sil ve son ödemeyi geri al?")){ onUnrecharge(student.id); onClose(); } }}>Son Paketi Geri Al ↩</Btn>
          ) : null}
          <Btn bg="#25D366" onClick={() => { onMesaj(student); onClose(); }}>Mesaj Şablonları</Btn>
          <Btn bg="#ef4444" onClick={() => { if(window.confirm(student.name+" silinsin mi?")){ onDelete(student.id); onClose(); } }}>Öğrenciyi Sil</Btn>
        </div>
      </Sheet>
      {telafiSel ? <TelafiSheet record={telafiSel} studentName={student.name} onClose={() => setTelafiSel(null)} onDone={(id, note) => { onTelafiDone(student.id, id, note); setTelafiSel(null); }} /> : null}
      {shiftSel ? <ShiftSheet lesson={shiftSel} student={student} onClose={() => setShiftSel(null)} onShift={(lid, days) => { onShift(student.id, lid, days); setShiftSel(null); }} /> : null}
      {showEkDers ? <EkDersSheet student={student} onClose={() => setShowEkDers(false)} onEkDersEkle={(sid, ders) => { onEkDersEkle(sid, ders); setShowEkDers(false); }} /> : null}
      {showDuzenle ? <DuzenleSheet student={student} onClose={() => setShowDuzenle(false)} onDuzenle={onDuzenle} /> : null}
    </>
  );
}

function AddSheet({ onClose, onAdd }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({ name:"", phone:"", veli_adi:"", dogum_tarihi:"", instrument:"Davul", day:"Pazartesi", time:"15:00", day2:"", time2:"", count:4, firstDate:todayISO, ucret:"" });
  const [ikiGun, setIkiGun] = useState(false);
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const previewDates = () => {
    if (!f.name) return "";
    const from = new Date(f.firstDate + "T12:00:00");
    if (ikiGun && f.day2) return buildSchedule2(f.day, f.day2, f.count, from).map(l=>fmtShort(l.date)).join(" - ");
    return buildSchedule(f.day, f.count, from).map(l=>fmtShort(l.date)).join(" - ");
  };
  return (
    <Sheet title="Yeni Öğrenci" onClose={onClose}>
      <label style={LBL}>Ad Soyad</label>
      <input style={INP} value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Öğrenci adı" />
      <label style={LBL}>Veli Adı</label>
      <input style={INP} value={f.veli_adi} onChange={e=>s("veli_adi",e.target.value)} placeholder="Veli adı soyadı" />
      <label style={LBL}>Doğum Tarihi (opsiyonel)</label>
      <input style={INP} type="date" value={f.dogum_tarihi||""} onChange={e=>s("dogum_tarihi",e.target.value)} />
      <label style={LBL}>Telefon (WhatsApp)</label>
      <input style={INP} value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="905xxxxxxxxx" type="tel" />
      <label style={LBL}>4 Ders Ücreti (TL)</label>
      <input style={INP} value={f.ucret} onChange={e=>s("ucret",e.target.value)} placeholder="5600" type="number" />
      <label style={LBL}>Enstrüman</label>
      <select style={INP} value={f.instrument} onChange={e=>s("instrument",e.target.value)}>
        {INSTRUMENTS.map(i=><option key={i}>{i}</option>)}
      </select>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={LBL}>1. Gün</label><select style={INP} value={f.day} onChange={e=>s("day",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div><label style={LBL}>Saat</label><select style={INP} value={f.time} onChange={e=>s("time",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div style={{ marginTop:14 }}>
        <button onClick={() => { setIkiGun(!ikiGun); if(ikiGun){ s("day2",""); s("time2",""); } }} style={{ background:ikiGun?"#111":"#f3f4f6", color:ikiGun?"#fff":"#555", border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          {ikiGun ? "✓ Haftada 2 Gün" : "+ Haftada 2 Gün Ekle"}
        </button>
      </div>
      {ikiGun && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><label style={LBL}>2. Gün</label><select style={INP} value={f.day2} onChange={e=>s("day2",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label style={LBL}>Saat</label><select style={INP} value={f.time2} onChange={e=>s("time2",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
      )}
      <label style={LBL}>Paket (ders sayısı)</label>
      <input style={INP} type="number" value={f.count} onChange={e=>s("count",Math.max(1,parseInt(e.target.value)||1))} min={1} max={12} />
      <label style={LBL}>İlk Ders Tarihi</label>
      <input style={INP} type="date" value={f.firstDate} onChange={e=>s("firstDate",e.target.value)} />
      {f.name ? <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginTop:12, fontSize:12, color:"#166534" }}><strong>Planlanacak dersler:</strong><br />{previewDates()}</div> : null}
      <div style={{ marginTop:16 }}><Btn bg="#111" onClick={() => { if(f.name.trim()){ onAdd(f, ikiGun); onClose(); } }}>Kaydet</Btn></div>
    </Sheet>
  );
}

function msgDersHatirlatma(student) { return "Günaydın :) Bugünkü ders saatimiz "+student.time+". Lütfen 5 dakika önce hazır olun."; }
function msgIlkDersÖdeme() { return "Sayın velimiz, yeni ders paketi bugünkü ders ile başlamaktadır. Bu sebeple bugün ödeme gününüzdür. İlginiz için teşekkür ederiz."; }
function msgÖdemeHatirlatma() { return "Merhaba,\nDers ödemesini henüz tarafımıza ulaşmış olarak göremiyoruz.\nÖdemenizi uygun olduğunuzda gerçekleştirmenizi rica ederiz. Herhangi bir sorunuz olması durumunda bizimle iletişime geçebilirsiniz.\nTeşekkür eder, iyi günler dileriz.\nBodrum Sonsuz Sanat"; }
function msgÖdemeHatirlatma2() { return "Merhaba,\nDers ödemesi hâlâ tarafımıza ulaşmamıştır.\nEğitim programının kesintisiz şekilde devam edebilmesi ve öğrencimizin gün/saat planlamasının korunabilmesi için ödemenizin bu hafta içerisinde tamamlanmasını rica ederiz.\nTeşekkür eder, iyi günler dileriz.\nBodrum Sonsuz Sanat"; }
function msgÖdemeHatirlatma3() { return "Merhaba,\n\nDers ödemesi hâlâ tarafımıza ulaşmamıştır.\n\nDüzenli ödeme yapılmayan programlarda öğrencinin gün ve saatini korumamız mümkün olmamaktadır. Bu nedenle ödemenin belirtilen süre içerisinde tamamlanmaması durumunda programınız dondurulacak, ayrılan gün ve saat bekleme listesindeki öğrenciler için kullanıma açılacaktır.\n\nLütfen ödemenizi en kısa sürede gerçekleştiriniz.\n\nTeşekkür eder, iyi günler dileriz.\n\nBodrum Sonsuz Sanat"; }
function msgDondurmaUyarisi() { return "Merhaba,\n\nÖdeme konusunda daha önce tarafınıza bilgilendirme yapılmış olmasına rağmen ödemeniz henüz tarafımıza ulaşmamıştır.\n\nEğitim programlarımız sabit gün ve saat planlamasıyla yürütüldüğü için, düzenli ödeme yapılmayan programlarda öğrencinin gün ve saatini korumamız mümkün olmamaktadır.\n\nBu nedenle programınızı bugün itibarıyla donduruyoruz. Ayrılan gün ve saat, bekleme listesindeki diğer öğrencilerin kullanımına açılacaktır.\n\nİlerleyen dönemde programa devam etmek istemeniz halinde, o tarihteki uygun kontenjan durumuna göre yeni bir gün ve saat planlaması yapılabilir.\n\nAnlayışınız için teşekkür eder, iyi günler dileriz.\n\nBodrum Sonsuz Sanat"; }

function msgPaketOzeti(student) {
  const tamamlanan = student.schedule.filter(l => l.status !== "upcoming");
  const sonPaket = tamamlanan.slice(-4);
  let dersler = ""; let donem = "";
  if (sonPaket.length > 0) {
    donem = fmtShort(sonPaket[0].date) + " - " + fmtShort(sonPaket[sonPaket.length-1].date);
    sonPaket.forEach(l => { dersler += (l.status === "completed" ? "Katıldı" : "Katilmadi") + " - " + fmtShort(l.date) + "\n"; });
  }
  const aktifTelafi = (student.telafi_records||[]).filter(r => !r.done);
  const yapilanTelafi = (student.telafi_records||[]).filter(r => r.done);
  let msg = "Sonsuz Sanat - Ders Ozeti\n\nÖğrenci: "+student.name+"\nDonem: "+donem+"\n\nDersler:\n"+dersler;
  if (aktifTelafi.length > 0) { msg += "\nTelafi Haklari ("+aktifTelafi.length+"):\n"; aktifTelafi.forEach(r => { msg += "- "+fmtShort(r.lessonDate)+" dersi\n"; }); }
  if (yapilanTelafi.length > 0) { msg += "\nYapılan Telafiler:\n"; yapilanTelafi.forEach(r => { msg += "- "+fmtShort(r.lessonDate)+" dersi - "+(r.doneAt||"yapildi")+"\n"; }); }
  const upcoming = student.schedule.filter(l => l.status === "upcoming");
  if (upcoming.length > 0) { msg += "\nYeni donem: "+fmtMed(upcoming[0].date)+"\nÖdeme: "+fmtMed(upcoming[0].date); }
  return msg;
}

function MesajSheet({ student, onClose }) {
  const msgs = [
    { key:"ders", label:"Ders Hatırlatma", text:msgDersHatirlatma(student) },
    { key:"ilkders", label:"İlk Ders - Ödeme Günu", text:msgIlkDersÖdeme() },
    { key:"ozet", label:"Paket Sonu Özeti", text:msgPaketOzeti(student) },
    { key:"odeme1", label:"Ödeme Hatırlatma (1.)", text:msgÖdemeHatirlatma() },
    { key:"odeme2", label:"Ödeme Hatırlatma (2.)", text:msgÖdemeHatirlatma2() },
    { key:"odeme3", label:"Ödeme Hatırlatma (3.)", text:msgÖdemeHatirlatma3() },
    { key:"dondur", label:"Dondurma Uyarısı", text:msgDondurmaUyarisi() },
  ];
  const send = (text) => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else navigator.clipboard.writeText(text);
  };
  return (
    <Sheet title="Mesaj Şablonları" subtitle={student.name} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.map(m => (
          <div key={m.key} style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #f0f0f0" }}>
              <span style={{ fontWeight:700, fontSize:14, color:"#111" }}>{m.label}</span>
              <button onClick={() => send(m.text)} style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{student.phone ? "WhatsApp" : "Kopyala"}</button>
            </div>
            <div style={{ padding:"10px 14px" }}><p style={{ margin:0, fontSize:12, color:"#555", lineHeight:1.6, whiteSpace:"pre-line" }}>{m.text}</p></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function ÖdemeSheet({ student, onClose, onÖdemeAl, onMesajGonder }) {
  const [odemeDate, setÖdemeDate] = useState(new Date().toISOString().split("T")[0]);
  const ekDersler = student.ek_dersler || [];
  const odenmemisEk = ekDersler.filter(e => !e.odendi);
  const ekDersBirimUcret = student.ucret ? Math.round(student.ucret / 4) : 0;
  const ekToplam = odenmemisEk.length * ekDersBirimUcret;
  const toplam = (student.ucret || 0) + ekToplam;
  const donemler = getPaketDonemler(student);
  const upcomingDonem = donemler.filter(d => d.chunk.some(l => l.status === "upcoming"));
  const [secilenDonem, setSecilenDonem] = useState(upcomingDonem.length > 0 ? upcomingDonem[0].label : "");
  return (
    <Sheet title="Paket Yükle" subtitle={student.name} onClose={onClose}>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:13, color:"#166534", fontWeight:700 }}>4 yeni ders eklenecek.</p>
        {odenmemisEk.length > 0 ? (
          <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #bbf7d0" }}>
            <p style={{ margin:0, fontSize:13, color:"#5b21b6", fontWeight:700 }}>{odenmemisEk.length} ek ders: +{ekToplam.toLocaleString("tr-TR")} TL</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#7e22ce" }}>Toplam: {toplam.toLocaleString("tr-TR")} TL</p>
          </div>
        ) : null}
      </div>
      <label style={LBL}>Hangi Dönem İçin?</label>
      {donemler.length > 0 ? (
        <select style={{ ...INP, marginBottom:12 }} value={secilenDonem} onChange={e=>setSecilenDonem(e.target.value)}>
          <option value="">Dönem seçin...</option>
          {donemler.map((d,i) => <option key={i} value={d.label}>{d.label}</option>)}
          <option value="Yeni paket">Yeni paket (tarih yok)</option>
        </select>
      ) : (
        <input style={{ ...INP, marginBottom:12 }} value={secilenDonem} onChange={e=>setSecilenDonem(e.target.value)} placeholder="Örn: 20 May - 10 Haz" />
      )}
      <label style={LBL}>Ödeme Tarihi</label>
      <input style={{ ...INP, marginBottom:12 }} type="date" value={odemeDate} onChange={e=>setÖdemeDate(e.target.value)} />
      <Btn bg="#10b981" onClick={() => { onÖdemeAl(student.id, odemeDate, secilenDonem); onClose(); }}>Ödeme Alındı - Paketi Yukle</Btn>
      <Btn bg="#f97316" onClick={() => { onMesajGonder(student); onClose(); }}>Ödeme Hatırlatmasi Gonder</Btn>
      <Btn bg="#6b7280" onClick={onClose} outline>İptal</Btn>
    </Sheet>
  );
}

function WeekCal({ students, offset, setOffset, onStudentClick }) {
  const now = new Date();
  const dow = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (dow===0?6:dow-1) + offset*7);
  start.setHours(0,0,0,0);
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  const label = fmtMed(days[0].toISOString()) + " - " + fmtMed(days[6].toISOString());
  const todayMid = midday();
  const SC = { upcoming:"#3b82f6", completed:"#10b981", telafi:"#8b5cf6", lastminute:"#f97316", noshow:"#ef4444" };
  const lessonsOn = (d) => {
    const res = [];
    students.forEach(s => s.schedule.forEach(l => {
      const ld = midday(new Date(l.date));
      if (ld.getTime() === d.getTime()) res.push({s,l});
    }));
    return res.sort((a,b)=>a.s.time.localeCompare(b.s.time));
  };
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, background:"#fff", borderRadius:14, padding:"10px 14px", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <button onClick={()=>setOffset(o=>o-1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#111" }}>{label}</p>
          {offset!==0 ? <button onClick={()=>setOffset(0)} style={{ background:"none", border:"none", fontSize:11, color:"#3b82f6", fontWeight:600, cursor:"pointer", padding:0, marginTop:2 }}>Bugüne dön</button> : null}
        </div>
        <button onClick={()=>setOffset(o=>o+1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>›</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {days.map((d,i) => {
          const lessons = lessonsOn(midday(d));
          const today = d.getTime() === todayMid.getTime();
          return (
            <div key={i} style={{ background:today?"#f0f9ff":"#fff", border:today?"1.5px solid #bae6fd":"1px solid #f0f0f0", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:lessons.length?"1px solid #f0f0f0":"none" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:today?"#0ea5e9":"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:15, color:today?"#fff":"#374151" }}>{d.getDate()}</div>
                <div>
                  <p style={{ margin:0, fontWeight:700, fontSize:14, color:today?"#0369a1":"#111" }}>{d.toLocaleDateString("tr-TR",{weekday:"long"})}</p>
                  <p style={{ margin:0, fontSize:11, color:"#999" }}>{d.toLocaleDateString("tr-TR",{day:"numeric",month:"short"})}{today?" · Bugün":""}</p>
                </div>
                <p style={{ margin:"0 0 0 auto", fontSize:12, color:lessons.length?"#666":"#ccc", fontWeight:600 }}>{lessons.length?lessons.length+" ders":"Ders yok"}</p>
              </div>
              {lessons.map(({s,l},li) => (
                <div key={li} onClick={()=>onStudentClick(s)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:li<lessons.length-1?"1px solid #f8f8f8":"none", cursor:"pointer", background:l.status!=="upcoming"?"#fafafa":"transparent" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:4, height:36, borderRadius:4, background:SC[l.status]||"#94a3b8", flexShrink:0 }} />
                    <div>
                      <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                      <p style={{ margin:"1px 0 0", fontSize:12, color:"#888" }}>{s.time} · {s.instrument}</p>
                    </div>
                  </div>
                  <StatusPill status={l.status} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BugünDersleri({ students, onWA }) {
  const todayLessons = [];
  students.forEach(s => {
    s.schedule.forEach(l => {
      if (isToday(l.date) && l.status === "upcoming") todayLessons.push({ student: s, lesson: l });
    });
  });
  todayLessons.sort((a,b) => a.student.time.localeCompare(b.student.time));
  if (todayLessons.length === 0) return null;
  return (
    <div style={{ background:"#f0f9ff", border:"1.5px solid #bae6fd", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#0369a1" }}>Bugünün Dersleri ({todayLessons.length})</p>
      {todayLessons.map(({student, lesson}) => (
        <div key={lesson.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #e0f2fe" }}>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{student.name}</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#0369a1" }}>{student.time} · {student.instrument}</p>
          </div>
          {student.phone ? (
            <button onClick={() => onWA(student)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>WA</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BugünÖdemeleri({ students, onÖdemeAl, onMesaj }) {
  const [odemeModal, setÖdemeModal] = useState(null);
  const [odemeDate, setÖdemeDate] = useState(new Date().toISOString().split("T")[0]);
  const [secilenDonem, setSecilenDonem] = useState("");

  const bugünÖdeme = students.filter(s => {
    if (s.frozen) return false;
    const bugünDers = s.schedule.find(l => l.status === "upcoming" && isToday(l.date));
    if (!bugünDers) return false;
    const tamamlanan = s.schedule.filter(l => l.status !== "upcoming" && l.status !== "telafi");
    if (tamamlanan.length % 4 !== 0) return false;
    return !(s.odemeler||[]).some(o => o.tarih === new Date().toISOString().split("T")[0]);
  });

  const gecikenler = students.filter(s => {
    if (s.frozen) return false;
    const tamamlanan = s.schedule.filter(l => l.status !== "upcoming" && l.status !== "telafi");
    if (tamamlanan.length === 0) return false;
    const paketSayisi = Math.floor(tamamlanan.length / 4);
    if (paketSayisi === 0) return false;
    const sonPaketIdx = (paketSayisi - 1) * 4;
    const sonPaketIlkDers = tamamlanan[sonPaketIdx];
    if (!sonPaketIlkDers) return false;
    const ilkDersTarih = midday(new Date(sonPaketIlkDers.date));
    if (ilkDersTarih >= midday()) return false;
    const sonPaketDersler = tamamlanan.slice(sonPaketIdx, sonPaketIdx + 4);
    const paketDonem = fmtShort(sonPaketDersler[0].date) + " - " + fmtShort(sonPaketDersler[sonPaketDersler.length-1].date);
    const odemeler = s.odemeler || [];
    if (odemeler.some(o => o.donem === paketDonem)) return false;
    return !odemeler.some(o => midday(new Date(o.tarih)) >= ilkDersTarih);
  });

  if (bugünÖdeme.length === 0 && gecikenler.length === 0) return null;

  return (
    <>
    <div style={{ marginBottom:14 }}>
      {bugünÖdeme.length > 0 ? (
        <div style={{ background:"#fff7ed", border:"1.5px solid #fb923c", borderRadius:14, padding:"12px 16px", marginBottom:10 }}>
          <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#c2410c" }}>Bugün Ödemesi Gelenler ({bugünÖdeme.length})</p>
          {bugünÖdeme.map(s => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fed7aa" }}>
              <div>
                <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#9a3412" }}>{s.instrument} · {s.day}</p>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => onMesaj(s)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>WA</button>
                <button onClick={() => { setÖdemeDate(new Date().toISOString().split("T")[0]); const d=getPaketDonemler(s); const up=d.filter(x=>x.chunk.some(l=>l.status==="upcoming")); setSecilenDonem(up.length>0?up[0].label:""); setÖdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Yapıldı</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {gecikenler.length > 0 ? (
        <div style={{ background:"#fff1f2", border:"1.5px solid #fca5a5", borderRadius:14, padding:"12px 16px" }}>
          <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#be123c" }}>Geciken Ödemeler ({gecikenler.length})</p>
          {gecikenler.map(s => {
            const tS = s.schedule.filter(l => l.status !== "upcoming" && l.status !== "telafi");
            const pS = Math.floor(tS.length / 4);
            const ilkDers = tS[(pS-1)*4];
            const geciken = ilkDers ? paymentOverdueDays(ilkDers.date) : 0;
            return (
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fecdd3" }}>
                <div>
                  <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#be123c" }}><strong>{geciken} gün</strong> gecikti</p>
                </div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"flex-end" }}>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; if(p) window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msgÖdemeHatirlatma()),"_blank"); }} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>WA 1</button>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; if(p) window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msgÖdemeHatirlatma2()),"_blank"); }} style={{ background:"#fef9c3", color:"#854d0e", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>WA 2</button>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; if(p) window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msgÖdemeHatirlatma3()),"_blank"); }} style={{ background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>WA 3</button>
                  <button onClick={() => { setÖdemeDate(new Date().toISOString().split("T")[0]); const tSS=s.schedule.filter(l=>l.status!=="upcoming"&&l.status!=="telafi"); const pSS=Math.floor(tSS.length/4); const son=tSS.slice((pSS-1)*4,(pSS-1)*4+4); setSecilenDonem(son.length>0?fmtShort(son[0].date)+" - "+fmtShort(son[son.length-1].date):""); setÖdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Yapıldı</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
    {odemeModal ? (
      <Sheet title="Ödeme Alındı" subtitle={odemeModal.name} onClose={() => setÖdemeModal(null)}>
        <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Hangi dönem için?</p>
        {getPaketDonemler(odemeModal).length > 0 ? (
          <select style={{ ...INP, marginBottom:12 }} value={secilenDonem} onChange={e=>setSecilenDonem(e.target.value)}>
            <option value="">Dönem seçin...</option>
            {getPaketDonemler(odemeModal).map((d,i) => <option key={i} value={d.label}>{d.label}</option>)}
          </select>
        ) : (
          <input style={{ ...INP, marginBottom:12 }} value={secilenDonem} onChange={e=>setSecilenDonem(e.target.value)} placeholder="Örn: 20 May - 10 Haz" />
        )}
        <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Ödeme tarihi:</p>
        <input style={INP} type="date" value={odemeDate} onChange={e=>setÖdemeDate(e.target.value)} />
        <div style={{ marginTop:16 }}>
          <Btn bg="#10b981" onClick={() => { onÖdemeAl(odemeModal.id, odemeDate, secilenDonem); setÖdemeModal(null); }}>Kaydet</Btn>
          <Btn bg="#111" outline onClick={() => setÖdemeModal(null)}>İptal</Btn>
        </div>
      </Sheet>
    ) : null}
    </>
  );
}

function GelirRaporu({ students }) {
  const [ayOffset, setAyOffset] = useState(0);
  const simdi = new Date();
  const hedefAy = new Date(simdi.getFullYear(), simdi.getMonth() + ayOffset, 1);
  const ayAdi = hedefAy.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  const ayÖdemeleri = [];
  students.forEach(s => {
    (s.odemeler || []).forEach(o => {
      const oTarih = new Date(o.tarih);
      if (oTarih.getFullYear() === hedefAy.getFullYear() && oTarih.getMonth() === hedefAy.getMonth()) {
        const gercekTutar = typeof o.tutar === "number" ? o.tutar : (s.ucret || 0);
        ayÖdemeleri.push({ ...o, tutar: gercekTutar, paketUcret: o.paketUcret||(typeof o.tutar!=="number"?(s.ucret||0):0), ekTutar: o.ekTutar||0, ogrenci: s.name });
      }
    });
  });
  const toplamGelir = ayÖdemeleri.reduce((sum, o) => sum + o.tutar, 0);
  const paketGeliri = ayÖdemeleri.reduce((sum, o) => sum + (o.paketUcret || 0), 0);
  const ekGeliri = ayÖdemeleri.reduce((sum, o) => sum + (o.ekTutar || 0), 0);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, background:"#fff", borderRadius:14, padding:"10px 14px", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <button onClick={()=>setAyOffset(o=>o-1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111", textTransform:"capitalize" }}>{ayAdi}</p>
          {ayOffset!==0 ? <button onClick={()=>setAyOffset(0)} style={{ background:"none", border:"none", fontSize:11, color:"#3b82f6", fontWeight:600, cursor:"pointer", padding:0, marginTop:2 }}>Bu aya dön</button> : null}
        </div>
        <button onClick={()=>setAyOffset(o=>o+1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>›</button>
      </div>
      <div style={{ background:"linear-gradient(135deg, #059669, #10b981)", borderRadius:18, padding:"20px", marginBottom:14, color:"#fff" }}>
        <p style={{ margin:0, fontSize:12, opacity:0.85, fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>Toplam Tahsilat</p>
        <p style={{ margin:"6px 0 0", fontSize:34, fontWeight:800 }}>{toplamGelir.toLocaleString("tr-TR")} TL</p>
        <p style={{ margin:"4px 0 0", fontSize:13, opacity:0.85 }}>{ayÖdemeleri.length} ödeme alındı</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:"14px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>Paket Geliri</p>
          <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:"#111" }}>{paketGeliri.toLocaleString("tr-TR")} TL</p>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:"14px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>Ek Ders Geliri</p>
          <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:"#5b21b6" }}>{ekGeliri.toLocaleString("tr-TR")} TL</p>
        </div>
      </div>
      <div style={{ background:"#fff", borderRadius:14, padding:"16px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:"#111" }}>Bu Ayki Ödemeler</p>
        {ayÖdemeleri.length === 0
          ? <p style={{ textAlign:"center", color:"#bbb", padding:"20px 0", fontWeight:600 }}>Bu ay ödeme yok</p>
          : [...ayÖdemeleri].reverse().map((o, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: i < ayÖdemeleri.length-1 ? "1px solid #f0f0f0" : "none" }}>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111" }}>{o.ogrenci}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{fmtMed(o.tarih)}{o.donem ? " · "+o.donem : ""}{o.ekDersSayisi > 0 ? " +"+o.ekDersSayisi+" ek ders" : ""}</p>
                </div>
                <p style={{ margin:0, fontSize:15, fontWeight:800, color:"#059669" }}>{typeof o.tutar === "number" ? o.tutar.toLocaleString("tr-TR")+" TL" : o.tutar}</p>
              </div>
            ))
        }
      </div>
    </div>
  );
}

export default function App() {
  const [giris, setGiris] = useState(() => sessionStorage.getItem("crm_auth") === "ok");
  const [sifre, setSifre] = useState("");
  const [sifreHata, setSifreHata] = useState(false);
  const SIFRE = "sonsuz2024";
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [detailSt, setDetailSt] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("all");
  const [mainTab, setMainTab] = useState("bugün");
  const [weekOffset, setWeekOffset] = useState(0);
  const [toast, setToast] = useState(null);
  const [mesajSt, setMesajSt] = useState(null);
  const [odemeSt, setÖdemeSt] = useState(null);
  const [odemeKaydetModal, setÖdemeKaydetModal] = useState(null);
  const [odemeKaydetDate, setÖdemeKaydetDate] = useState(new Date().toISOString().split("T")[0]);
  const [odemeKaydetDonem, setÖdemeKaydetDonem] = useState("");
  const [search, setSearch] = useState("");

  const pop = (msg, ms=3000) => { setToast(msg); setTimeout(()=>setToast(null), ms); };

  const loadStudents = async () => {
    const { data, error } = await supabase.from("students").select("*").order("created_at");
    if (!error && data) setStudents(data);
    setLoading(false);
  };

  useEffect(() => { loadStudents(); document.title = "Sonsuz Sanat CRM"; }, []);

  const saveStudent = async (student) => {
    const { error } = await supabase.from("students").upsert({
      id: student.id, name: student.name, phone: student.phone || "",
      veli_adi: student.veli_adi || "", dogum_tarihi: student.dogum_tarihi || "",
      ucret: student.ucret || 0, instrument: student.instrument,
      day: student.day, time: student.time, day2: student.day2 || "", time2: student.time2 || "",
      no_show: student.no_show, frozen: student.frozen,
      odemeler: student.odemeler || [], telafi_records: student.telafi_records || [],
      schedule: student.schedule || [], ek_dersler: student.ek_dersler || [],
    });
    if (error) console.error("Kayıt hatası:", error);
  };

  const updLesson = (schedule, lid, status, note="") => {
    if (lid) return schedule.map(l => l.id===lid ? {...l,status,note} : l);
    const i = schedule.findIndex(l=>l.status==="upcoming");
    if (i===-1) return schedule;
    const s=[...schedule]; s[i]={...s[i],status,note}; return s;
  };

  const mkTelafi = (student, lid, note) => {
    const lesson = lid ? student.schedule.find(l=>l.id===lid) : student.schedule.find(l=>l.status==="upcoming");
    return { id:uid(), lessonDate:lesson?.date||new Date().toISOString(), note, createdAt:new Date().toISOString(), expiry:expiry30(), done:false, doneAt:null };
  };

  const handleAction = async (sid, action, note="", lid=null) => {
    let msg = "Kaydedildi";
    const updated = students.map(s => {
      if (s.id !== sid) return s;
      switch(action) {
        case "attended": msg = "Katılım kaydedildi"; return {...s, schedule: updLesson(s.schedule, lid, "completed")};
        case "telafi": {
          const rec = mkTelafi(s, lid, note||"24 saat oncesi iptal");
          const recs = [...s.telafi_records, rec];
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "6. telafi - program donduruldu" : ac===5 ? "5. telafi uyarisi" : "Telafi oluşturuldu";
          return {...s, frozen, telafi_records:recs, schedule: updLesson(s.schedule, lid, "telafi", note)};
        }
        case "lm-telafi": {
          const rec = mkTelafi(s, lid, note||"Son dakika iptali");
          const recs = [...s.telafi_records, rec];
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "6. telafi - program donduruldu" : "Son dakika + telafi kaydedildi";
          return {...s, frozen, telafi_records:recs, schedule: updLesson(s.schedule, lid, "lastminute", note||"Son dakika iptali")};
        }
        case "lm-notelafi": msg = "Son dakika iptali"; return {...s, schedule: updLesson(s.schedule, lid, "lastminute", note||"Son dakika iptali")};
        case "noshow": msg = "No-show kaydedildi"; return {...s, no_show:s.no_show+1, schedule: updLesson(s.schedule, lid, "noshow", note||"Habersiz gelmedi")};
        case "freeze": msg = s.frozen ? "Program aktif edildi" : "Program donduruldu"; return {...s, frozen:!s.frozen};
        default: return s;
      }
    });
    setStudents(updated);
    await saveStudent(updated.find(s => s.id === sid));
    pop(msg);
    setActionModal(null);
  };

  const handleUndoLesson = async (sid, lid, prevStatus) => {
    const updated = students.map(s => {
      if (s.id !== sid) return s;
      const newSchedule = s.schedule.map(l => l.id === lid ? {...l, status:"upcoming", note:""} : l);
      const noShowDelta = prevStatus === "noshow" ? -1 : 0;
      return {...s, schedule: newSchedule, no_show: Math.max(0, s.no_show + noShowDelta)};
    });
    setStudents(updated);
    await saveStudent(updated.find(s => s.id === sid));
    pop("Ders 'Planlandı' durumuna alındı");
  };

  const handleUnrecharge = async (sid) => {
    const updated = students.map(s => {
      if (s.id !== sid) return s;
      const upcomingIdxs = s.schedule.map((l,i) => l.status === "upcoming" ? i : -1).filter(i => i !== -1);
      if (upcomingIdxs.length < 4) return s;
      const toRemove = new Set(upcomingIdxs.slice(-4));
      const newSchedule = s.schedule.filter((_, i) => !toRemove.has(i));
      const newOdemeler = (s.odemeler || []).slice(0, -1);
      return {...s, schedule: newSchedule, odemeler: newOdemeler};
    });
    setStudents(updated);
    await saveStudent(updated.find(s => s.id === sid));
    pop("Son paket geri alındı");
  };

  const handleTelafiDone = async (sid, tid, note) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s, telafi_records: s.telafi_records.map(r => r.id!==tid ? r : {...r, done:true, doneAt:note||fmtDate(new Date().toISOString())})
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Telafi yapıldı");
  };

  const handleShift = async (sid, fromLid, days) => {
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const idx = s.schedule.findIndex(l=>l.id===fromLid);
      if (idx===-1) return s;
      return {...s, schedule: s.schedule.map((l,i) => i>=idx && l.status==="upcoming" ? {...l, date:addDays(l.date,days)} : l)};
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop((days/7)+" hafta ileri alındı");
  };

  const handleDelete = async (sid) => {
    await supabase.from("students").delete().eq("id", sid);
    setStudents(p => p.filter(s => s.id !== sid));
    pop("Öğrenci silindi");
  };

  const handleRecharge = async (sid, odemeDate) => {
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const last = [...s.schedule].reverse().find(l=>l.status==="upcoming") || [...s.schedule].reverse().find(l=>true);
      const from = last ? new Date(new Date(last.date).getTime()+7*86400000) : new Date();
      const newLessons = s.day2 ? buildSchedule2(s.day, s.day2, 4, from) : buildSchedule(s.day, 4, from);
      const odemeler = [...(s.odemeler||[]), { tarih: odemeDate||new Date().toISOString().split("T")[0], tutar:"4 ders", odendi:true }];
      return {...s, schedule:[...s.schedule, ...newLessons], odemeler};
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("4 ders yüklendi");
  };

  const handleAdd = async (f, ikiGun) => {
    const from = new Date((f.firstDate||new Date().toISOString().split("T")[0])+"T12:00:00");
    const schedule = (ikiGun && f.day2) ? buildSchedule2(f.day, f.day2, f.count, from) : buildSchedule(f.day, f.count, from);
    const newStudent = {
      id: uid(), name: f.name, phone: f.phone||"", veli_adi: f.veli_adi||"", dogum_tarihi: f.dogum_tarihi||"",
      ucret: parseInt(f.ucret)||0, instrument: f.instrument, day: f.day, time: f.time,
      day2: (ikiGun && f.day2) ? f.day2 : "", time2: (ikiGun && f.time2) ? f.time2 : "",
      no_show: 0, frozen: false, odemeler: [], telafi_records: [], schedule, ek_dersler: [],
    };
    setStudents(p=>[...p, newStudent]);
    await saveStudent(newStudent);
    pop("Öğrenci eklendi");
  };

  const handleÖdemeKaydet = async (sid, tarih, donem) => {
    const odemeDate = tarih||new Date().toISOString().split("T")[0];
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const ucret = s.ucret||0;
      const odenmemisEk = (s.ek_dersler||[]).filter(e => !e.odendi);
      const ekDersBirimUcret = ucret > 0 ? Math.round(ucret / 4) : 0;
      const ekTutar = odenmemisEk.length * ekDersBirimUcret;
      const toplamTutar = ucret + ekTutar;
      const ekDersler = (s.ek_dersler||[]).map(e => e.odendi ? e : {...e, odendi:true});
      let finalDonem = donem || "";
      if (!finalDonem) {
        const upcoming = s.schedule.filter(l => l.status === "upcoming");
        if (upcoming.length > 0) finalDonem = fmtShort(upcoming[0].date)+" - "+fmtShort(upcoming[upcoming.length-1].date);
        else { const gecmis = s.schedule.filter(l => l.status !== "upcoming"); const son4 = gecmis.slice(-4); if (son4.length > 0) finalDonem = fmtShort(son4[0].date)+" - "+fmtShort(son4[son4.length-1].date); }
      }
      const odemeler = [...(s.odemeler||[]), { tarih:odemeDate, tutar:toplamTutar, paketUcret:ucret, ekDersSayisi:odenmemisEk.length, ekTutar, donem:finalDonem, odendi:true }];
      return {...s, odemeler, ek_dersler: ekDersler};
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ödeme kaydedildi");
  };

  const handleDuzenle = async (sid, f) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s, name: f.name, phone: f.phone, veli_adi: f.veli_adi||"", dogum_tarihi: f.dogum_tarihi||"",
      ucret: parseInt(f.ucret)||0, instrument: f.instrument, day: f.day, time: f.time,
      day2: f.day2||"", time2: f.time2||""
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Bilgiler güncellendi");
  };

  const handleEkDersEkle = async (sid, ders) => {
    const updated = students.map(s => s.id!==sid ? s : { ...s, ek_dersler: [...(s.ek_dersler||[]), ders] });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ek ders eklendi");
  };

  const handleWADers = (student) => {
    const text = msgDersHatirlatma(student);
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else { navigator.clipboard.writeText(text); pop("Mesaj kopyalandı"); }
  };

  // Ödeme bekliyor mu?
  // Mantık: her tamamlanmış 4'lü paket için o paketin ilk ders tarihinden sonra
  // yapılmış bir ödeme var mı? Yoksa ödeme bekliyor.
  // Aktif paket (henüz 4 dolmamış): ilk dersi tamamlandıysa ve o dersten sonra
  // hiç ödeme yapılmamışsa ödeme bekliyor.
  const isÖdemeBekleyen = (s) => {
    if (s.frozen) return false;
    const schedule = s.schedule || [];
    const odemeler = s.odemeler || [];
    const tamamlanan = schedule.filter(l => l.status !== "upcoming" && l.status !== "telafi");
    const paketSayisi = Math.floor(tamamlanan.length / 4);

    // Tamamlanmış 4'lü paketler: her biri için ödeme var mı?
    for (let p = 0; p < paketSayisi; p++) {
      const paketDersler = tamamlanan.slice(p * 4, p * 4 + 4);
      if (paketDersler.length < 4) continue;
      const ilkDersTarih = midday(new Date(paketDersler[0].date));
      if (ilkDersTarih > midday()) continue;
      // Bu paket için ödeme var mı? (tarih bazlı: ilk dersten sonra yapılmış p+1. ödeme)
      const paketDonem = fmtShort(paketDersler[0].date) + " - " + fmtShort(paketDersler[paketDersler.length-1].date);
      // Donem etiketiyle eşleşen ödeme
      if (odemeler.some(o => o.donem === paketDonem)) continue;
      // Eski kayıtlar: donem etiketi olmayan ödemeler sırayla eşleşir
      const eskiOdemeler = odemeler.filter(o => !o.donem);
      if (eskiOdemeler.length > p) continue;
      return true;
    }

    // Aktif paket (henüz 4 dolmamış): ilk dersi tamamlandıysa ödeme zamanı
    const aktifTamamlanan = tamamlanan.slice(paketSayisi * 4);
    if (aktifTamamlanan.length >= 1) {
      const ilkDers = aktifTamamlanan[0];
      const ilkDersTarih = midday(new Date(ilkDers.date));
      if (ilkDersTarih <= midday()) {
        // İlk dersin tarihinden sonra (veya aynı gün) yapılmış herhangi bir ödeme var mı?
        const odemeVar = odemeler.some(o => midday(new Date(o.tarih)) >= ilkDersTarih);
        if (!odemeVar) return true;
      }
    }

    return false;
  };

  const todayPayments = students.filter(isÖdemeBekleyen);
  const filtered = students.filter(s => {
    if (search.trim() && !s.name.toLowerCase().includes(search.toLowerCase().trim())) return false;
    if (filter==="active") return !s.frozen;
    if (filter==="frozen") return s.frozen;
    if (filter==="telafi") return s.telafi_records.some(r=>!r.done);
    if (filter==="odeme") return isÖdemeBekleyen(s);
    return true;
  });

  const stats = { total:students.length, active:students.filter(s=>!s.frozen).length, frozen:students.filter(s=>s.frozen).length, odeme:todayPayments.length };
  const telafiWarnList = students.filter(s => s.telafi_records.filter(r=>!r.done).length===5 && !s.frozen);

  if (!giris) {
    return (
      <div style={{ fontFamily:"sans-serif", background:"#111", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:"#fff", borderRadius:20, padding:"40px 32px", width:"100%", maxWidth:360, boxShadow:"0 8px 40px rgba(0,0,0,.3)" }}>
          <p style={{ fontSize:11, letterSpacing:3, color:"#999", textTransform:"uppercase", margin:"0 0 6px" }}>Sonsuz Sanat</p>
          <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 28px", color:"#111" }}>Öğrenci Yönetimi</h1>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Şifre</label>
          <input type="password" value={sifre} onChange={e => { setSifre(e.target.value); setSifreHata(false); }}
            onKeyDown={e => { if (e.key === "Enter") { if (sifre === SIFRE) { sessionStorage.setItem("crm_auth","ok"); setGiris(true); } else setSifreHata(true); } }}
            placeholder="Şifrenizi girin"
            style={{ width:"100%", border:sifreHata?"1.5px solid #ef4444":"1.5px solid #e5e7eb", borderRadius:10, padding:"12px 14px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", marginBottom:sifreHata?6:16 }} />
          {sifreHata && <p style={{ color:"#ef4444", fontSize:12, fontWeight:600, marginBottom:12 }}>Şifre hatalı</p>}
          <button onClick={() => { if (sifre === SIFRE) { sessionStorage.setItem("crm_auth","ok"); setGiris(true); } else setSifreHata(true); }}
            style={{ width:"100%", background:"#111", color:"#fff", border:"none", borderRadius:12, padding:"13px", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>Giriş</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ fontFamily:"sans-serif", background:"#f4f4f0", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}><p style={{ fontSize:32 }}>🎵</p><p style={{ fontWeight:700, color:"#666" }}>Yükleniyor...</p></div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"sans-serif", background:"#f4f4f0", minHeight:"100vh" }}>
      <div style={{ background:"#111", color:"#fff", padding:"16px 20px 0" }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12 }}>
          <div>
            <p style={{ fontSize:10, letterSpacing:3, color:"#666", textTransform:"uppercase", margin:0 }}>Sonsuz Sanat</p>
            <h1 style={{ fontSize:20, fontWeight:800, margin:"2px 0 0", letterSpacing:-0.5 }}>Öğrenci Yönetimi</h1>
          </div>
          <button onClick={()=>setShowAdd(true)} style={{ background:"#fff", color:"#111", border:"none", borderRadius:12, padding:"9px 18px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>+ Ekle</button>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", gap:4 }}>
          {[{key:"bugün",label:"Bugün"},{key:"liste",label:"Liste"},{key:"takvim",label:"Takvim"},{key:"gelir",label:"Gelir"}].map(t=>(
            <button key={t.key} onClick={()=>setMainTab(t.key)} style={{ flex:1, background:mainTab===t.key?"#fff":"transparent", color:mainTab===t.key?"#111":"#888", border:"none", borderRadius:"10px 10px 0 0", padding:"10px 0", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"14px 14px 80px" }}>
        {mainTab === "bugün" ? (
          <div>
            {(() => {
              const bugün = new Date();
              const bugünMD = (bugün.getMonth()+1)+"-"+bugün.getDate();
              const dogumGünleri = students.filter(s => { if (!s.dogum_tarihi) return false; const d = new Date(s.dogum_tarihi); return (d.getMonth()+1)+"-"+d.getDate() === bugünMD; });
              if (dogumGünleri.length === 0) return null;
              return (
                <div style={{ background:"#fdf4ff", border:"1.5px solid #e879f9", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                  <p style={{ margin:"0 0 8px", fontWeight:700, fontSize:13, color:"#86198f" }}>Bugün Doğum Günü</p>
                  {dogumGünleri.map(s => {
                    const yaş = new Date().getFullYear() - new Date(s.dogum_tarihi).getFullYear();
                    return (<div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0" }}><p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p><span style={{ fontSize:13, color:"#86198f", fontWeight:600 }}>{yaş} yaş</span></div>);
                  })}
                </div>
              );
            })()}
            <BugünDersleri students={students} onWA={handleWADers} />
            {students.filter(s => calcBalance(s.schedule) === 0 && !s.frozen).length > 0 ? (
              <div style={{ background:"#faf5ff", border:"1.5px solid #d8b4fe", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#7e22ce" }}>Paketi Biten Öğrenciler</p>
                {students.filter(s => calcBalance(s.schedule) === 0 && !s.frozen).map(s => (
                  <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f3e8ff" }}>
                    <div><p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p><p style={{ margin:"2px 0 0", fontSize:12, color:"#7e22ce" }}>Paket tamamlandı</p></div>
                    <button onClick={() => setMesajSt(s)} style={{ background:"#a855f7", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Özet</button>
                  </div>
                ))}
              </div>
            ) : null}
            <BugünÖdemeleri students={students} onÖdemeAl={handleÖdemeKaydet} onMesaj={(s)=>setMesajSt(s)} />
            {students.filter(s=>{ const l=s.schedule.find(x=>x.status==="upcoming"); return l&&isToday(l.date); }).length===0 && !students.some(s=>isÖdemeBekleyen(s)) ? (
              <div style={{ textAlign:"center", padding:"48px 20px" }}><p style={{ fontSize:36 }}>☀️</p><p style={{ fontWeight:600, color:"#aaa" }}>Bugün için bir şey yok</p></div>
            ) : null}
          </div>
        ) : null}

        {mainTab === "takvim" ? <WeekCal students={students} offset={weekOffset} setOffset={setWeekOffset} onStudentClick={setDetailSt} /> : null}
        {mainTab === "gelir" ? <GelirRaporu students={students} /> : null}

        {mainTab === "liste" ? (
          <div>
            {telafiWarnList.length > 0 ? (
              <div style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#92400e" }}>Telafi limitine yaklaşan öğrenciler:</p>
                {telafiWarnList.map(s=>(<p key={s.id} style={{ margin:"4px 0 0", fontSize:13, color:"#78350f" }}>· {s.name} 5/6 telafi</p>))}
              </div>
            ) : null}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
              {[
                { label:"Toplam", val:stats.total, bg:"#fff", color:"#111" },
                { label:"Aktif", val:stats.active, bg:"#ecfdf5", color:"#059669" },
                { label:"Donuk", val:stats.frozen, bg:"#eff6ff", color:"#3b82f6" },
                { label:"Ödeme", val:stats.odeme, bg:stats.odeme>0?"#fff7ed":"#f9fafb", color:stats.odeme>0?"#ea580c":"#999" },
              ].map(s=>(
                <div key={s.label} onClick={()=>s.label==="Ödeme"&&setFilter("odeme")} style={{ background:s.bg, borderRadius:12, padding:"12px 6px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,.05)", cursor:s.label==="Ödeme"?"pointer":"default" }}>
                  <p style={{ fontSize:22, fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
                  <p style={{ fontSize:10, color:"#999", margin:"2px 0 0", fontWeight:600 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Öğrenci ara..." style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:12, padding:"11px 14px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", background:"#fff", color:"#111" }} />
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
              {[{key:"all",label:"Tümü"},{key:"active",label:"Aktif"},{key:"frozen",label:"Dondurulmuş"},{key:"telafi",label:"Telafi"},{key:"odeme",label:"Ödeme"}].map(f=>(
                <button key={f.key} onClick={()=>setFilter(f.key)} style={{ flexShrink:0, background:filter===f.key?"#111":"#fff", color:filter===f.key?"#fff":"#555", border:"none", borderRadius:20, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>{f.label}</button>
              ))}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.map(s => {
                const bal = calcBalance(s.schedule);
                const np = calcNextPayment(s.schedule);
                const ac = s.telafi_records.filter(r=>!r.done).length;
                const warn = ac===5 && !s.frozen;
                const nextL = s.schedule.find(l=>l.status==="upcoming");
                const payDue = isÖdemeBekleyen(s);
                const ekCount = (s.ek_dersler||[]).length;
                return (
                  <div key={s.id} style={{ background:s.frozen?"#f0f9ff":"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.07)", border:warn?"1.5px solid #fcd34d":payDue?"1.5px solid #fb923c":s.frozen?"1.5px solid #bfdbfe":"1.5px solid transparent" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setDetailSt(s)}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <p style={{ fontWeight:700, fontSize:15, margin:0, color:"#111" }}>{s.name}</p>
                          {s.frozen ? <Pill label="Donuk" bg="#dbeafe" color="#1d4ed8" /> : null}
                          {warn ? <Pill label="5/6 Telafi" bg="#fef3c7" color="#92400e" /> : null}
                          {payDue ? <Pill label="Ödeme" bg="#ffedd5" color="#c2410c" /> : null}
                          {ekCount>0 ? <Pill label={"+"+ekCount+" ek"} bg="#ede9fe" color="#5b21b6" /> : null}
                        </div>
                        <p style={{ fontSize:12, color:"#999", margin:"3px 0 2px", fontWeight:500 }}>
                          {s.instrument} · {s.day} {s.time}
                          {s.day2 ? <span style={{ color:"#6366f1" }}> + {s.day2} {s.time2}</span> : null}
                          {s.ucret ? <span style={{ marginLeft:8, color:"#059669", fontWeight:700 }}>{s.ucret.toLocaleString("tr-TR")} TL</span> : null}
                        </p>
                        {s.veli_adi ? <p style={{ fontSize:11, color:"#888", margin:"0 0 4px" }}>Veli: {s.veli_adi}</p> : null}
                        {nextL ? <p style={{ fontSize:12, color:"#0369a1", fontWeight:600, margin:"0 0 6px", background:"#f0f9ff", display:"inline-block", borderRadius:6, padding:"2px 8px" }}>{fmtDate(nextL.date)}</p> : null}
                        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                          <span style={{ fontSize:12, color:"#444" }}><strong>{bal}</strong> ders kaldi</span>
                          {np ? <span style={{ fontSize:12, color:"#6b7280" }}><strong>{fmtShort(np)}</strong> odeme</span> : null}
                          {(() => { const done = s.schedule.filter(l=>l.status==="completed").length; const total = s.schedule.filter(l=>l.status!=="upcoming").length; if(total===0) return null; const pct = Math.round(done/total*100); const color = pct>=80?"#059669":pct>=60?"#d97706":"#dc2626"; return <span style={{ fontSize:12, color }}><strong>{done}/{total}</strong> <strong>{pct}%</strong> devam</span>; })()}
                        </div>
                        {ac>0 ? <div style={{ marginTop:4 }}><span style={{ fontSize:12, color:ac>4?"#d97706":"#2563eb" }}><strong>{ac}/6</strong> aktif telafi</span></div> : null}
                        {s.no_show>0 ? <div><span style={{ fontSize:12, color:"#dc2626" }}><strong>{s.no_show}</strong> no-show</span></div> : null}
                      </div>
                      <button onClick={()=>setActionModal({student:s,lessonId:null})} style={{ background:s.frozen?"#e0f2fe":"#111", color:s.frozen?"#0369a1":"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", marginLeft:10, flexShrink:0, fontFamily:"inherit" }}>İşlem</button>
                      {payDue ? <button onClick={()=>{ const tS=s.schedule.filter(l=>l.status!=="upcoming"&&l.status!=="telafi"); const pS=Math.floor(tS.length/4); const aktif=tS.slice(pS*4); const ilk=aktif[0]; setÖdemeKaydetDonem(ilk?fmtShort(ilk.date)+" - ?":""); setÖdemeKaydetDate(new Date().toISOString().split("T")[0]); setÖdemeKaydetModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:700, cursor:"pointer", marginLeft:6, flexShrink:0 }}>💳</button> : null}
                      <button onClick={()=>setMesajSt(s)} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:10, padding:"8px 10px", fontSize:16, cursor:"pointer", marginLeft:6, flexShrink:0 }}>💬</button>
                    </div>
                  </div>
                );
              })}
              {filtered.length===0 ? (
                <div style={{ textAlign:"center", padding:"48px 20px", color:"#bbb" }}>
                  <p style={{ fontSize:36 }}>🎵</p>
                  <p style={{ fontWeight:600, color:"#aaa" }}>{students.length===0 ? "Henüz öğrenci yok" : "Bu filtrede öğrenci yok"}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {actionModal ? <ActionSheet student={students.find(s=>s.id===actionModal.student.id)} lessonId={actionModal.lessonId} onClose={()=>setActionModal(null)} onAction={(a,n,l)=>handleAction(actionModal.student.id,a,n,l)} onUndoLesson={handleUndoLesson} /> : null}
      {detailSt ? <DetailSheet student={students.find(s=>s.id===detailSt.id)} onClose={()=>setDetailSt(null)} onRecharge={handleRecharge} onLessonClick={(st,lid)=>{ setDetailSt(null); setTimeout(()=>setActionModal({student:st,lessonId:lid}),100); }} onShift={handleShift} onTelafiDone={handleTelafiDone} onMesaj={(st)=>setMesajSt(st)} onÖdeme={(st)=>setÖdemeSt(st)} onDelete={handleDelete} onEkDersEkle={handleEkDersEkle} onDuzenle={handleDuzenle} onUndoLesson={handleUndoLesson} onUnrecharge={handleUnrecharge} /> : null}
      {showAdd ? <AddSheet onClose={()=>setShowAdd(false)} onAdd={handleAdd} /> : null}
      {mesajSt ? <MesajSheet student={mesajSt} onClose={()=>setMesajSt(null)} /> : null}
      {odemeSt ? <ÖdemeSheet student={odemeSt} onClose={()=>setÖdemeSt(null)} onÖdemeAl={handleÖdemeKaydet} onMesajGonder={(st)=>setMesajSt(st)} /> : null}

      {odemeKaydetModal ? (
        <Sheet title="Ödeme Alındı" subtitle={odemeKaydetModal.name} onClose={() => setÖdemeKaydetModal(null)}>
          <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Hangi dönem için?</p>
          {getPaketDonemler(odemeKaydetModal).length > 0 ? (
            <select style={{ ...INP, marginBottom:12 }} value={odemeKaydetDonem} onChange={e=>setÖdemeKaydetDonem(e.target.value)}>
              <option value="">Dönem seçin...</option>
              {getPaketDonemler(odemeKaydetModal).map((d,i) => <option key={i} value={d.label}>{d.label}</option>)}
            </select>
          ) : (
            <input style={{ ...INP, marginBottom:12 }} value={odemeKaydetDonem} onChange={e=>setÖdemeKaydetDonem(e.target.value)} placeholder="Örn: 20 May - 10 Haz" />
          )}
          <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Ödeme tarihi:</p>
          <input style={INP} type="date" value={odemeKaydetDate} onChange={e=>setÖdemeKaydetDate(e.target.value)} />
          <div style={{ marginTop:16 }}>
            <Btn bg="#10b981" onClick={() => { handleÖdemeKaydet(odemeKaydetModal.id, odemeKaydetDate, odemeKaydetDonem); setÖdemeKaydetModal(null); }}>Kaydet</Btn>
            <Btn bg="#111" outline onClick={() => setÖdemeKaydetModal(null)}>İptal</Btn>
          </div>
        </Sheet>
      ) : null}

      {toast ? (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#111", color:"#fff", padding:"12px 20px", borderRadius:14, fontSize:14, fontWeight:600, zIndex:100, boxShadow:"0 4px 20px rgba(0,0,0,.3)", maxWidth:"90vw", textAlign:"center" }}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}
