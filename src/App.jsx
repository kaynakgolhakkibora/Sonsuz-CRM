import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DAY_IDX = { Pazartesi:1, Salı:2, Çarşamba:3, Perşembe:4, Cuma:5, Cumartesi:6, Pazar:0 };

function nextWeekday(day, from = new Date()) {
  const target = DAY_IDX[day];
  const d = new Date(from);
  while (d.getDay() !== target) d.setDate(d.getDate() + 1);
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

function uid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }); }

function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function expiry30() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

function daysLeft(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", { weekday:"short", day:"numeric", month:"long" });
}

function fmtMed(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"long" });
}

function fmtShort(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"short" });
}

function calcBalance(schedule) {
  return schedule.filter(l => l.status === "upcoming").length;
}

function calcNextPayment(schedule) {
  const up = schedule.filter(l => l.status === "upcoming");
  if (!up.length) return null;
  const d = new Date(up[up.length - 1].date);
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

function midday(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}

function isToday(iso) {
  return midday(new Date(iso)).getTime() === midday().getTime();
}

function paymentOverdueDays(iso) {
  if (!iso) return 0;
  const diff = Math.floor((midday() - midday(new Date(iso))) / 86400000);
  return diff > 0 ? diff : 0;
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
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, color:"#aaa", cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:"16px 20px 28px", maxHeight:"74vh", overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}

const INP = { width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", background:"#fafafa", color:"#111" };
const LBL = { display:"block", fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:4, marginTop:14 };

function ActionSheet({ student, lessonId, onClose, onAction }) {
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
      {willWarn && <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#92400e", fontWeight:600 }}>⚠️ Bu telafi ile <strong>5/6'ya</strong> ulaşacak. Bir sonrakinde program dondurulur.</div>}
      {willFreeze && <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#991b1b", fontWeight:600 }}>🚨 Bu telafi ile <strong>6. limite</strong> ulaşacak — program otomatik dondurulacak.</div>}
    </>
  );

  return (
    <Sheet title={student.name} subtitle={lesson ? fmtDate(lesson.date)+" · "+student.time : ""} onClose={onClose}>
      {step === "main" && <>
        <Btn bg="#10b981" onClick={() => act("attended")}>✅ Katıldı</Btn>
        <Btn bg="#1f2937" onClick={() => reset("yapildi")}>📋 Yapıldı Say</Btn>
        <Btn bg="#3b82f6" onClick={() => reset("telafi")}>🔄 Telafi Hakkı Oluştur</Btn>
        <Btn bg="#f59e0b" onClick={() => act("freeze")}>❄️ Programı Dondur</Btn>
      </>}
      {step === "telafi" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>24 saat önceden iptal — telafi hakkı oluşturuluyor</p>
        <TelafiWarn />
        <NoteArea value={note} onChange={setNote} placeholder="Neden iptal edildi?" />
        <Btn bg="#3b82f6" onClick={() => act("telafi")}>🔄 Telafi Hakkı Oluştur</Btn>
        <Btn bg="#111" outline onClick={() => reset("main")}>← Geri</Btn>
      </>}
      {step === "yapildi" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Neden yapıldı sayılıyor?</p>
        <Btn bg="#f97316" onClick={() => reset("sondakika")}>⏱ Son Dakika İptali</Btn>
        <Btn bg="#ef4444" onClick={() => reset("noshow")}>🚫 Habersiz Gelmedi</Btn>
        <Btn bg="#111" outline onClick={() => reset("main")}>← Geri</Btn>
      </>}
      {step === "sondakika" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Son dakika iptali — telafi verilsin mi?</p>
        <TelafiWarn />
        <NoteArea value={note} onChange={setNote} />
        <Btn bg="#3b82f6" onClick={() => act("lm-telafi")}>✔️ Telafiye Al</Btn>
        <Btn bg="#374151" onClick={() => act("lm-notelafi")}>✖️ Telafi Verme</Btn>
        <Btn bg="#111" outline onClick={() => reset("yapildi")}>← Geri</Btn>
      </>}
      {step === "noshow" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Habersiz gelmedi — açıklama ekle</p>
        <NoteArea value={note} onChange={setNote} />
        <Btn bg="#ef4444" onClick={() => act("noshow")}>🚫 Kaydet</Btn>
        <Btn bg="#111" outline onClick={() => reset("yapildi")}>← Geri</Btn>
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
        {record.note && <p style={{ margin:"4px 0 0", fontSize:13, color:"#475569", fontStyle:"italic" }}>📝 {record.note}</p>}
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
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>✅ Telafi Yapıldı</p>
            {record.doneAt && <p style={{ margin:"4px 0 0", fontSize:13, color:"#4ade80" }}>{record.doneAt}</p>}
          </div>
        : step === "main"
          ? <Btn bg="#10b981" onClick={() => setStep("done")}>✅ Telafi Yapıldı İşaretle</Btn>
          : <>
              <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Tarih ve saati yaz:</p>
              <NoteArea value={note} onChange={setNote} placeholder="Örn: 22 Mayıs Perşembe 15:30'da yapıldı" />
              <Btn bg="#10b981" onClick={() => { onDone(record.id, note || fmtDate(new Date().toISOString())); onClose(); }}>✅ Kaydet</Btn>
              <Btn bg="#111" outline onClick={() => setStep("main")}>← Geri</Btn>
            </>
      }
    </Sheet>
  );
}

function ShiftSheet({ lesson, student, onClose, onShift }) {
  return (
    <Sheet title="Ders Tarihi Kaydır" subtitle={fmtDate(lesson.date)+" · "+student.time} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>Bu dersten itibaren tüm planlanmış dersler ve ödeme tarihi ileri alınır.</p>
      <Btn bg="#6366f1" onClick={() => { onShift(lesson.id, 7); onClose(); }}>1 Hafta İleri Al</Btn>
      <Btn bg="#8b5cf6" onClick={() => { onShift(lesson.id, 14); onClose(); }}>2 Hafta İleri Al</Btn>
      <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
    </Sheet>
  );
}

function DuzenleSheet({ student, onClose, onDuzenle }) {
  const [f, setF] = useState({
    name: student.name,
    phone: student.phone || "",
    instrument: student.instrument,
    day: student.day,
    time: student.time,
  });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <Sheet title="Öğrenciyi Düzenle" subtitle={student.name} onClose={onClose}>
      <label style={LBL}>Ad Soyad</label>
      <input style={INP} value={f.name} onChange={e=>s("name",e.target.value)} />
      <label style={LBL}>Telefon (WhatsApp)</label>
      <input style={INP} value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="905xxxxxxxxx" type="tel" />
      <label style={LBL}>Enstrüman</label>
      <select style={INP} value={f.instrument} onChange={e=>s("instrument",e.target.value)}>
        {INSTRUMENTS.map(i=><option key={i}>{i}</option>)}
      </select>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={LBL}>Gün</label><select style={INP} value={f.day} onChange={e=>s("day",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div><label style={LBL}>Saat</label><select style={INP} value={f.time} onChange={e=>s("time",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div style={{ marginTop:16 }}>
        <Btn bg="#111" onClick={() => { if(f.name.trim()){ onDuzenle(student.id, f); onClose(); } }}>💾 Kaydet</Btn>
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
  return (
    <Sheet title="Ek Ders Ekle" subtitle={student.name} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Bu ders pakete dahil değil, ayrıca ücretlendirilecek.</p>
      <label style={LBL}>Tarih</label>
      <input style={INP} type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <label style={LBL}>Saat</label>
      <select style={INP} value={time} onChange={e=>setTime(e.target.value)}>
        {TIMES.map(t=><option key={t}>{t}</option>)}
      </select>
      <label style={LBL}>Not (opsiyonel)</label>
      <input style={INP} value={note} onChange={e=>setNote(e.target.value)} placeholder="Konu, enstrüman vb." />
      <div style={{ marginTop:16 }}>
        <Btn bg="#6366f1" onClick={() => { onEkDersEkle(student.id, { id:uid(), date: date+"T"+time+":00", note, createdAt: new Date().toISOString() }); onClose(); }}>➕ Ek Ders Kaydet</Btn>
        <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function DetailSheet({ student, onClose, onRecharge, onLessonClick, onShift, onTelafiDone, onMesaj, onOdeme, onDelete, onEkDersEkle, onDuzenle }) {
  const [tab, setTab] = useState("takvim");
  const [telafiSel, setTelafiSel] = useState(null);
  const [shiftSel, setShiftSel] = useState(null);
  const [showEkDers, setShowEkDers] = useState(false);
  const [showDuzenle, setShowDuzenle] = useState(false);
  const bal = calcBalance(student.schedule);
  const np = calcNextPayment(student.schedule);
  const active = student.telafi_records.filter(r=>!r.done);
  const done = student.telafi_records.filter(r=>r.done);
  const ekDersler = student.ek_dersler || [];

  return (
    <>
      <Sheet title={student.name} onClose={onClose}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          <Pill label={student.instrument} bg="#f3f4f6" color="#374151" />
          <Pill label={`${student.day} ${student.time}`} bg="#f3f4f6" color="#374151" />
          {student.frozen && <Pill label="❄️ Dondurulmuş" bg="#dbeafe" color="#1d4ed8" />}
          {ekDersler.length > 0 && <Pill label={`+${ekDersler.length} ek ders`} bg="#ede9fe" color="#5b21b6" />}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
          {[
            { label:"Kalan Ders", val:bal, bg:"#f9fafb", color:"#111" },
            { label:"Aktif Telafi", val:active.length, bg: active.length>=5?"#fee2e2":active.length===4?"#fffbeb":"#eff6ff", color: active.length>=5?"#dc2626":active.length===4?"#d97706":"#2563eb" },
            { label:"No-Show", val:student.no_show, bg:"#fff1f2", color:"#e11d48" },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
              <p style={{ fontSize:24, fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
              <p style={{ fontSize:10, color:"#888", margin:"2px 0 0", fontWeight:600 }}>{s.label}</p>
            </div>
          ))}
        </div>
        {np && (
          <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Tahmini Sonraki Ödeme</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:700, color:"#111" }}>{fmtMed(np)}</p>
              </div>
              <span style={{ fontSize:22 }}>💳</span>
            </div>
            {student.odemeler && student.odemeler.length > 0 && (
              <div style={{ marginTop:10, borderTop:"1px solid #f0f0f0", paddingTop:8 }}>
                <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Ödeme Geçmişi</p>
                {[...student.odemeler].reverse().map((o,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#444", marginBottom:3 }}>
                    <span>✅ {fmtMed(o.tarih)}</span>
                    <span style={{ color:"#888" }}>{o.tutar}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
          {[
            { key:"takvim", label:"📅 Dersler" },
            { key:"telafi", label:`🔄 Telafi${active.length>0?" ("+active.length+")":""}` },
            { key:"ekders", label:`➕ Ek Ders${ekDersler.length>0?" ("+ekDersler.length+")":""}` }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex:1, background:tab===t.key?"#111":"#f3f4f6", color:tab===t.key?"#fff":"#555", border:"none", borderRadius:10, padding:"9px 8px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "takvim" && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {student.schedule.map(l => {
              const clickable = l.status === "upcoming";
              return (
                <div key={l.id} style={{ background:clickable?"#f9fafb":"#fff", border:clickable?"1.5px solid #d1d5db":"1px solid #f3f4f6", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ cursor:clickable?"pointer":"default", flex:1 }} onClick={() => clickable && onLessonClick(student, l.id)}>
                      <p style={{ margin:0, fontWeight:600, fontSize:14, color:"#111" }}>{fmtDate(l.date)}</p>
                      <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{student.time}{clickable && <span style={{ marginLeft:6, fontSize:11, color:"#93c5fd", fontWeight:600 }}>· işlem yap →</span>}</p>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <StatusPill status={l.status} />
                      {clickable && <button onClick={() => setShiftSel(l)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"4px 8px", cursor:"pointer", fontSize:14, color:"#6366f1" }}>↦</button>}
                    </div>
                  </div>
                  {l.note && <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", marginTop:6 }}><p style={{ margin:0, fontSize:12, color:"#475569", fontStyle:"italic" }}>📝 {l.note}</p></div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "telafi" && (
          <div>
            {student.telafi_records.length === 0 && <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Aktif telafi hakkı yok</p>}
            {active.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Bekleyen</p>
                {active.map(r => {
                  const d = daysLeft(r.expiry);
                  const exp = d !== null && d < 0;
                  const urg = !exp && d !== null && d <= 7;
                  return (
                    <div key={r.id} onClick={() => setTelafiSel(r)} style={{ background:exp?"#fff1f2":urg?"#fffbeb":"#f0f9ff", border:`1.5px solid ${exp?"#fca5a5":urg?"#fcd34d":"#bae6fd"}`, borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#111" }}>{fmtDate(r.lessonDate)} dersi</p>
                          {r.note && <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b", fontStyle:"italic" }}>📝 {r.note}</p>}
                          <p style={{ margin:"4px 0 0", fontSize:12, color:"#888" }}>Son geçerlilik: <strong style={{ color: exp?"#dc2626":urg?"#d97706":"#0369a1" }}>{fmtMed(r.expiry)}</strong></p>
                        </div>
                        <div style={{ background:exp?"#dc2626":urg?"#d97706":"#0ea5e9", color:"#fff", borderRadius:20, padding:"4px 10px", fontSize:12, fontWeight:800, flexShrink:0, marginLeft:8 }}>
                          {exp?"Doldu":`${d}g`}
                        </div>
                      </div>
                      <p style={{ margin:"8px 0 0", fontSize:11, color:"#0369a1", fontWeight:600 }}>Detay ve işlem için tıkla →</p>
                    </div>
                  );
                })}
              </div>
            )}
            {done.length > 0 && (
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Yapılmış</p>
                {done.map(r => (
                  <div key={r.id} style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>✅ {fmtDate(r.lessonDate)} dersi telafiyle yapıldı</p>
                    {r.doneAt && <p style={{ margin:"3px 0 0", fontSize:12, color:"#4ade80" }}>{r.doneAt}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "ekders" && (
          <div>
            <Btn bg="#6366f1" mb={12} onClick={() => setShowEkDers(true)}>➕ Ek Ders Ekle</Btn>
            {ekDersler.length === 0
              ? <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Henüz ek ders yok</p>
              : [...ekDersler].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e => (
                  <div key={e.id} style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#5b21b6" }}>{fmtDate(e.date)}</p>
                    <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{new Date(e.date).toLocaleTimeString("tr-TR", {hour:"2-digit",minute:"2-digit"})}</p>
                    {e.note && <p style={{ margin:"4px 0 0", fontSize:12, color:"#475569", fontStyle:"italic" }}>📝 {e.note}</p>}
                  </div>
                ))
            }
          </div>
        )}

        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8 }}>
          <Btn bg="#6366f1" onClick={() => setShowDuzenle(true)}>✏️ Öğrenciyi Düzenle</Btn>
          <Btn bg="#111" onClick={() => { onOdeme(student); onClose(); }}>+ Paket Yükle (4 Ders)</Btn>
          <Btn bg="#25D366" onClick={() => { onMesaj(student); onClose(); }}>💬 Mesaj Şablonları</Btn>
          <Btn bg="#ef4444" onClick={() => { if(window.confirm(student.name + " silinsin mi?")){ onDelete(student.id); onClose(); } }}>🗑 Öğrenciyi Sil</Btn>
        </div>
      </Sheet>
      {telafiSel && <TelafiSheet record={telafiSel} studentName={student.name} onClose={() => setTelafiSel(null)} onDone={(id, note) => { onTelafiDone(student.id, id, note); setTelafiSel(null); }} />}
      {shiftSel && <ShiftSheet lesson={shiftSel} student={student} onClose={() => setShiftSel(null)} onShift={(lid, days) => { onShift(student.id, lid, days); setShiftSel(null); }} />}
      {showEkDers && <EkDersSheet student={student} onClose={() => setShowEkDers(false)} onEkDersEkle={(sid, ders) => { onEkDersEkle(sid, ders); setShowEkDers(false); }} />}
      {showDuzenle && <DuzenleSheet student={student} onClose={() => setShowDuzenle(false)} onDuzenle={onDuzenle} />}
    </>
  );
}

function AddSheet({ onClose, onAdd }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({ name:"", phone:"", instrument:"Davul", day:"Pazartesi", time:"15:00", count:4, firstDate:todayISO });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const previewDates = () => {
    if (!f.name) return "";
    const from = new Date(f.firstDate + "T12:00:00");
    return buildSchedule(f.day, f.count, from).map(l=>fmtShort(l.date)).join(" · ");
  };
  return (
    <Sheet title="Yeni Öğrenci" onClose={onClose}>
      <label style={LBL}>Ad Soyad</label>
      <input style={INP} value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Öğrenci adı" />
      <label style={LBL}>Telefon (WhatsApp)</label>
      <input style={INP} value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="905xxxxxxxxx" type="tel" />
      <label style={LBL}>Enstrüman</label>
      <select style={INP} value={f.instrument} onChange={e=>s("instrument",e.target.value)}>
        {INSTRUMENTS.map(i=><option key={i}>{i}</option>)}
      </select>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={LBL}>Gün</label><select style={INP} value={f.day} onChange={e=>s("day",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div><label style={LBL}>Saat</label><select style={INP} value={f.time} onChange={e=>s("time",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <label style={LBL}>Paket (ders sayısı)</label>
      <input style={INP} type="number" value={f.count} onChange={e=>s("count",Math.max(1,parseInt(e.target.value)||1))} min={1} max={12} />
      <label style={LBL}>İlk Ders Tarihi</label>
      <input style={INP} type="date" value={f.firstDate} onChange={e=>s("firstDate",e.target.value)} />
      {f.name && <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginTop:12, fontSize:12, color:"#166534" }}><strong>Planlanacak dersler:</strong><br />{previewDates()}</div>}
      <div style={{ marginTop:16 }}><Btn bg="#111" onClick={() => { if(f.name.trim()){ onAdd(f); onClose(); } }}>Kaydet</Btn></div>
    </Sheet>
  );
}

function msgDersHatirlatma(student) {
  return `Günaydın 🎵 ${student.name}'nın bugün saat ${student.time}'de Sonsuz Sanat'ta dersi bulunmaktadır. Lütfen 5 dakika önce hazır olunuz. Görüşürüz!`;
}

function msgOdemeHatirlatma(student) {
  return `Merhaba, ders ödemesini henüz alamadık. Ödemenizi en kısa sürede yapmanızı rica ederiz. Teşekkürler 🙏`;
}

function msgOdemeHatirlatma2(student) {
  return `Merhaba, ders ödemesi hâlâ beklenmektedir. Eğitime kesintisiz devam edebilmek için ödemenizi bu hafta içinde yapmanızı önemle rica ederiz 🙏`;
}

function msgOdemeHatirlatma3(student) {
  return `Merhaba, ders ödemesi geciktiği için programınızı askıya almak durumunda kalabiliriz. Lütfen en kısa sürede ödemenizi yapınız.`;
}

function msgDondurmaUyarisi(student) {
  return `Merhaba,\n\n${student.name}'nın ödeme durumu hakkında bugüne kadar bilgi vermiş olmamıza rağmen henüz ödeme alınamamıştır.\n\n*Bu nedenle programı donduruyoruz.* Ayrılan gün ve saat başka bir öğrenciye aktarılacaktır.\n\nProgramına devam etmek istediğinde uygunluk durumuna göre yeni bir slot belirleyebiliriz. İyi günler dileriz.`;
}

function MesajSheet({ student, onClose }) {
  const msgs = [
    { key:"ders", icon:"📅", label:"Ders Hatırlatma", text:msgDersHatirlatma(student) },
    { key:"odeme1", icon:"💳", label:"Ödeme Hatırlatma (1.)", text:msgOdemeHatirlatma(student) },
    { key:"odeme2", icon:"⚠️", label:"Ödeme Hatırlatma (2.)", text:msgOdemeHatirlatma2(student) },
    { key:"odeme3", icon:"🚨", label:"Ödeme Hatırlatma (3.)", text:msgOdemeHatirlatma3(student) },
    { key:"dondur", icon:"❄️", label:"Dondurma Uyarısı", text:msgDondurmaUyarisi(student) },
  ];
  const send = (text) => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    const encoded = encodeURIComponent(text);
    if (phone) window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    else navigator.clipboard.writeText(text);
  };
  return (
    <Sheet title="Mesaj Şablonları" subtitle={student.name} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.map(m => (
          <div key={m.key} style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #f0f0f0" }}>
              <span style={{ fontWeight:700, fontSize:14, color:"#111" }}>{m.icon} {m.label}</span>
              <button onClick={() => send(m.text)} style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {student.phone ? "WhatsApp'ta Aç" : "Kopyala"}
              </button>
            </div>
            <div style={{ padding:"10px 14px" }}><p style={{ margin:0, fontSize:12, color:"#555", lineHeight:1.6, whiteSpace:"pre-line" }}>{m.text}</p></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function OdemeSheet({ student, onClose, onOdemeAl, onMesajGonder }) {
  const [odemeDate, setOdemeDate] = useState(new Date().toISOString().split("T")[0]);
  const ekDersler = student.ek_dersler || [];
  return (
    <Sheet title="Paket Yükle" subtitle={student.name} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>Ödeme alındı mı?</p>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:13, color:"#166534" }}>4 yeni ders eklenecek ve program devam edecek.</p>
        {ekDersler.length > 0 && <p style={{ margin:"6px 0 0", fontSize:13, color:"#5b21b6", fontWeight:700 }}>⚠️ {ekDersler.length} ek ders var — ek ücret alınacak.</p>}
      </div>
      <label style={LBL}>Ödeme Tarihi</label>
      <input style={{ ...INP, marginBottom:12 }} type="date" value={odemeDate} onChange={e=>setOdemeDate(e.target.value)} />
      <Btn bg="#10b981" onClick={() => { onOdemeAl(student.id, odemeDate); onClose(); }}>✅ Ödeme Alındı — Paketi Yükle</Btn>
      <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:"12px 14px", marginBottom:12, marginTop:4 }}>
        <p style={{ margin:0, fontSize:13, color:"#9a3412" }}>Ödeme gelmezse hatırlatma mesajı gönder veya programı dondur.</p>
      </div>
      <Btn bg="#f97316" onClick={() => { onMesajGonder(student); onClose(); }}>📨 Ödeme Hatırlatması Gönder</Btn>
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
  const label = fmtMed(days[0].toISOString()) + " – " + fmtMed(days[6].toISOString());
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
          {offset!==0 && <button onClick={()=>setOffset(0)} style={{ background:"none", border:"none", fontSize:11, color:"#3b82f6", fontWeight:600, cursor:"pointer", padding:0, marginTop:2 }}>Bugüne dön</button>}
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

// ─── Bugünün Dersleri ─────────────────────────────────────────
function BugunDersleri({ students, onWA }) {
  const todayLessons = [];
  students.forEach(s => {
    s.schedule.forEach(l => {
      if (isToday(l.date) && l.status === "upcoming") {
        todayLessons.push({ student: s, lesson: l });
      }
    });
  });
  todayLessons.sort((a,b) => a.student.time.localeCompare(b.student.time));

  if (todayLessons.length === 0) return null;

  return (
    <div style={{ background:"#f0f9ff", border:"1.5px solid #bae6fd", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#0369a1" }}>🎵 Bugünün Dersleri ({todayLessons.length})</p>
      {todayLessons.map(({student, lesson}) => (
        <div key={lesson.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #e0f2fe" }}>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{student.name}</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#0369a1" }}>{student.time} · {student.instrument}</p>
          </div>
          {student.phone && (
            <button onClick={() => onWA(student)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              💬 WA
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Bugünün Ödemeleri ────────────────────────────────────────
function BugunOdemeleri({ students, onOdemeAl, onMesaj }) {
  const todayMid = midday();
  const [odemeModal, setOdemeModal] = useState(null);
  const [odemeDate, setOdemeDate] = useState(new Date().toISOString().split("T")[0]);

  // Bugün ödemesi olanlar (ilk upcoming dersi bugün olan ve yeni paket başlangıcı)
  const bugunOdeme = students.filter(s => {
    if (s.frozen) return false;
    const upcomingLessons = s.schedule.filter(l => l.status === "upcoming");
    if (upcomingLessons.length === 0) return false;
    const firstUpcoming = upcomingLessons[0];
    const completedCount = s.schedule.filter(l => l.status === "completed" || l.status === "noshow" || l.status === "lastminute").length;
    const isFirstOfPacket = completedCount % 4 === 0;
    // Bugün ödeme günü ve henüz bugün ödeme yapılmamış
    const bugunOdendi = (s.odemeler||[]).some(o => o.tarih === new Date().toISOString().split("T")[0]);
    return isToday(firstUpcoming.date) && isFirstOfPacket && !bugunOdendi;
  });

  // Gecikenler - bugünün ödeme listesinde olmayan ama ödemesi geçmiş olanlar
  const gecikenler = students.filter(s => {
    if (s.frozen) return false;
    // Paketin ilk upcoming dersi geçmişte kalmış ama ödeme kaydı yok
    const upcomingLessons = s.schedule.filter(l => l.status === "upcoming");
    if (upcomingLessons.length === 0) return false;
    const firstUpcoming = upcomingLessons[0];
    const completedCount = s.schedule.filter(l => l.status === "completed" || l.status === "noshow" || l.status === "lastminute").length;
    const isFirstOfPacket = completedCount % 4 === 0;
    const lessonDate = midday(new Date(firstUpcoming.date));
    // İlk ders günü geçmiş ve bugün değil
    return isFirstOfPacket && lessonDate < todayMid && !isToday(firstUpcoming.date);
  });

  if (bugunOdeme.length === 0 && gecikenler.length === 0) return null;

  return (
    <>
    <div style={{ marginBottom:14 }}>
      {bugunOdeme.length > 0 && (
        <div style={{ background:"#fff7ed", border:"1.5px solid #fb923c", borderRadius:14, padding:"12px 16px", marginBottom:10 }}>
          <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#c2410c" }}>💳 Bugün Ödemesi Gelenler ({bugunOdeme.length})</p>
          {bugunOdeme.map(s => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fed7aa" }}>
              <div>
                <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#9a3412" }}>{s.instrument} · {s.day} {s.time}</p>
                {(s.ek_dersler||[]).length > 0 && <p style={{ margin:"2px 0 0", fontSize:11, color:"#5b21b6", fontWeight:700 }}>+{(s.ek_dersler||[]).length} ek ders</p>}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => onMesaj(s)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>💬</button>
                <button onClick={() => onOdemeAl(s)} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>✅ Ödeme Yapıldı</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {gecikenler.length > 0 && (
        <div style={{ background:"#fff1f2", border:"1.5px solid #fca5a5", borderRadius:14, padding:"12px 16px" }}>
          <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#be123c" }}>🚨 Geciken Ödemeler ({gecikenler.length})</p>
          {gecikenler.map(s => {
            const np = calcNextPayment(s.schedule);
            const geciken = paymentOverdueDays(np);
            return (
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fecdd3" }}>
                <div>
                  <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#be123c" }}>{fmtMed(np)} · <strong style={{ color:"#dc2626" }}>{geciken} gün gecikti</strong></p>
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; const t=encodeURIComponent(`Merhaba, ders ödemesini henüz alamadık. Ödemenizi en kısa sürede yapmanızı rica ederiz. Teşekkürler 🙏`); if(p) window.open(`https://wa.me/${p}?text=${t}`,"_blank"); }} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>💬 1</button>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; const t=encodeURIComponent(`Merhaba, ders ödemesi hâlâ beklenmektedir. Eğitime kesintisiz devam edebilmek için ödemenizi bu hafta içinde yapmanızı önemle rica ederiz 🙏`); if(p) window.open(`https://wa.me/${p}?text=${t}`,"_blank"); }} style={{ background:"#fef9c3", color:"#854d0e", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>💬 2</button>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; const t=encodeURIComponent(`Merhaba, ders ödemesi geciktiği için programınızı askıya almak durumunda kalabiliriz. Lütfen en kısa sürede ödemenizi yapınız.`); if(p) window.open(`https://wa.me/${p}?text=${t}`,"_blank"); }} style={{ background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>💬 3</button>
                  <button onClick={() => { setOdemeDate(new Date().toISOString().split("T")[0]); setOdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>✅ Yapıldı</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {odemeModal && (
      <Sheet title="Ödeme Alındı" subtitle={odemeModal.name} onClose={() => setOdemeModal(null)}>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Ödeme tarihi:</p>
        <input style={INP} type="date" value={odemeDate} onChange={e=>setOdemeDate(e.target.value)} />
        <div style={{ marginTop:16 }}>
          <Btn bg="#10b981" onClick={() => { onOdemeAl(odemeModal.id, odemeDate); setOdemeModal(null); }}>✅ Kaydet</Btn>
          <Btn bg="#111" outline onClick={() => setOdemeModal(null)}>İptal</Btn>
        </div>
      </Sheet>
    )}
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [detailSt, setDetailSt] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("all");
  const [mainTab, setMainTab] = useState("bugun");
  const [weekOffset, setWeekOffset] = useState(0);
  const [toast, setToast] = useState(null);
  const [mesajSt, setMesajSt] = useState(null);
  const [odemeSt, setOdemeSt] = useState(null);

  const pop = (msg, ms=3000) => { setToast(msg); setTimeout(()=>setToast(null), ms); };

  const loadStudents = async () => {
    const { data, error } = await supabase.from("students").select("*").order("created_at");
    if (!error && data) setStudents(data);
    setLoading(false);
  };

  useEffect(() => { loadStudents(); }, []);

  const saveStudent = async (student) => {
    const { error } = await supabase.from("students").upsert({
      id: student.id,
      name: student.name,
      phone: student.phone || "",
      instrument: student.instrument,
      day: student.day,
      time: student.time,
      no_show: student.no_show,
      frozen: student.frozen,
      odemeler: student.odemeler || [],
      telafi_records: student.telafi_records || [],
      schedule: student.schedule || [],
      ek_dersler: student.ek_dersler || [],
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
        case "attended":
          msg = "✅ Katılım kaydedildi";
          return {...s, schedule: updLesson(s.schedule, lid, "completed")};
        case "telafi": {
          const rec = mkTelafi(s, lid, note||"24 saat öncesi iptal");
          const recs = [...s.telafi_records, rec];
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "🚨 6. telafi — program otomatik donduruldu!" : ac===5 ? "⚠️ 5. telafi! Bir sonrakinde dondurulacak." : "🔄 Telafi hakkı oluşturuldu";
          return {...s, frozen, telafi_records:recs, schedule: updLesson(s.schedule, lid, "telafi", note)};
        }
        case "lm-telafi": {
          const rec = mkTelafi(s, lid, note||"Son dakika iptali");
          const recs = [...s.telafi_records, rec];
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "🚨 6. telafi — program otomatik donduruldu!" : ac===5 ? "⚠️ 5. telafi! Bir sonrakinde dondurulacak." : "⏱ Son dakika + Telafi kaydedildi";
          return {...s, frozen, telafi_records:recs, schedule: updLesson(s.schedule, lid, "lastminute", note||"Son dakika iptali")};
        }
        case "lm-notelafi":
          msg = "⏱ Son dakika iptali — ders sayıldı";
          return {...s, schedule: updLesson(s.schedule, lid, "lastminute", note||"Son dakika iptali")};
        case "noshow":
          msg = "🚫 Habersiz gelmedi — ders sayıldı";
          return {...s, no_show:s.no_show+1, schedule: updLesson(s.schedule, lid, "noshow", note||"Habersiz gelmedi")};
        case "freeze":
          msg = s.frozen ? "✅ Program aktif edildi" : "❄️ Program donduruldu";
          return {...s, frozen:!s.frozen};
        default: return s;
      }
    });
    setStudents(updated);
    const changedStudent = updated.find(s => s.id === sid);
    await saveStudent(changedStudent);
    pop(msg, msg.startsWith("🚨")||msg.startsWith("⚠️") ? 4500 : 3000);
    setActionModal(null);
  };

  const handleTelafiDone = async (sid, tid, note) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s, telafi_records: s.telafi_records.map(r => r.id!==tid ? r : {...r, done:true, doneAt:note||fmtDate(new Date().toISOString())})
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("✅ Telafi yapıldı olarak işaretlendi");
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
    pop(`↦ ${days/7} hafta ileri alındı`);
  };

  const handleDelete = async (sid) => {
    await supabase.from("students").delete().eq("id", sid);
    setStudents(p => p.filter(s => s.id !== sid));
    pop("🗑 Öğrenci silindi");
  };

  const handleRecharge = async (sid, odemeDate) => {
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const last = [...s.schedule].reverse().find(l=>l.status!=="upcoming");
      const from = last ? new Date(new Date(last.date).getTime()+7*86400000) : new Date();
      const odemeler = [...(s.odemeler||[]), { tarih: odemeDate || new Date().toISOString().split("T")[0], tutar: "4 ders" }];
      return {...s, schedule:[...s.schedule, ...buildSchedule(s.day, 4, from)], odemeler};
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("✅ Ödeme alındı, 4 ders yüklendi");
  };

  const handleAdd = async (f) => {
    const from = new Date((f.firstDate || new Date().toISOString().split("T")[0]) + "T12:00:00");
    const newStudent = {
      id: uid(),
      name: f.name,
      phone: f.phone || "",
      instrument: f.instrument,
      day: f.day,
      time: f.time,
      no_show: 0,
      frozen: false,
      odemeler: [],
      telafi_records: [],
      schedule: buildSchedule(f.day, f.count, from),
      ek_dersler: [],
    };
    setStudents(p=>[...p, newStudent]);
    await saveStudent(newStudent);
    pop("✅ Öğrenci eklendi");
  };

  const handleOdemeKaydet = async (sid, tarih) => {
    const odemeDate = tarih || new Date().toISOString().split("T")[0];
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const odemeler = [...(s.odemeler||[]), { tarih: odemeDate, tutar: "4 ders", odendi: true }];
      return {...s, odemeler};
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("✅ Ödeme kaydedildi");
  };

  const handleDuzenle = async (sid, f) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s, name: f.name, phone: f.phone, instrument: f.instrument, day: f.day, time: f.time
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("✅ Bilgiler güncellendi");
  };

  const handleEkDersEkle = async (sid, ders) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s, ek_dersler: [...(s.ek_dersler||[]), ders]
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("➕ Ek ders eklendi");
  };

  const handleWADers = (student) => {
    const text = msgDersHatirlatma(student);
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
    else { navigator.clipboard.writeText(text); pop("📋 Mesaj kopyalandı"); }
  };

  const isOdemeBekleyen = (s) => {
    if (s.frozen) return false;
    const bal = calcBalance(s.schedule);
    if (bal === 0) return true;
    const np = calcNextPayment(s.schedule);
    if (!np) return false;
    return midday(new Date(np)).getTime() <= midday().getTime();
  };

  const todayPayments = students.filter(isOdemeBekleyen);
  const filtered = students.filter(s => {
    if (filter==="active") return !s.frozen;
    if (filter==="frozen") return s.frozen;
    if (filter==="telafi") return s.telafi_records.some(r=>!r.done);
    if (filter==="odeme") return isOdemeBekleyen(s);
    return true;
  });

  const stats = {
    total: students.length,
    active: students.filter(s=>!s.frozen).length,
    frozen: students.filter(s=>s.frozen).length,
    odeme: todayPayments.length,
  };

  const telafiWarnList = students.filter(s => s.telafi_records.filter(r=>!r.done).length===5 && !s.frozen);

  if (loading) {
    return (
      <div style={{ fontFamily:"'DM Sans',sans-serif", background:"#f4f4f0", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <p style={{ fontSize:32 }}>🎵</p>
          <p style={{ fontWeight:700, color:"#666" }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:"#f4f4f0", minHeight:"100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap" rel="stylesheet" />

      <div style={{ background:"#111", color:"#fff", padding:"16px 20px 0" }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12 }}>
          <div>
            <p style={{ fontSize:10, letterSpacing:3, color:"#666", textTransform:"uppercase", margin:0 }}>Sonsuz Sanat</p>
            <h1 style={{ fontSize:20, fontWeight:800, margin:"2px 0 0", letterSpacing:-0.5 }}>Öğrenci Yönetimi</h1>
          </div>
          <button onClick={()=>setShowAdd(true)} style={{ background:"#fff", color:"#111", border:"none", borderRadius:12, padding:"9px 18px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>+ Ekle</button>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", gap:4 }}>
          {[{key:"bugun",label:"☀️ Bugün"},{key:"liste",label:"📋 Liste"},{key:"takvim",label:"📅 Takvim"}].map(t=>(
            <button key={t.key} onClick={()=>setMainTab(t.key)} style={{ flex:1, background:mainTab===t.key?"#fff":"transparent", color:mainTab===t.key?"#111":"#888", border:"none", borderRadius:"10px 10px 0 0", padding:"10px 0", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"14px 14px 80px" }}>

        {mainTab === "bugun" && (
          <div>
            <BugunDersleri students={students} onWA={handleWADers} />
            <BugunOdemeleri students={students} onOdemeAl={handleOdemeKaydet} onMesaj={(s)=>setMesajSt(s)} />
            {students.filter(s=>s.telafi_records.filter(r=>!r.done&&isToday(r.lessonDate||"")).length>0).length===0 &&
             students.filter(s=>{ const l=s.schedule.find(x=>x.status==="upcoming"); return l&&isToday(l.date); }).length===0 &&
             !students.some(s=>isOdemeBekleyen(s)) && (
              <div style={{ textAlign:"center", padding:"48px 20px" }}>
                <p style={{ fontSize:36 }}>☀️</p>
                <p style={{ fontWeight:600, color:"#aaa" }}>Bugün için bir şey yok</p>
              </div>
            )}
          </div>
        )}

        {mainTab === "takvim" && <WeekCal students={students} offset={weekOffset} setOffset={setWeekOffset} onStudentClick={setDetailSt} />}

        {mainTab === "liste" && (
          <div>
            {telafiWarnList.length > 0 && (
              <div style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#92400e" }}>⚠️ Telafi limitine yaklaşan öğrenci{telafiWarnList.length>1?"ler":""}:</p>
                {telafiWarnList.map(s=>(<p key={s.id} style={{ margin:"4px 0 0", fontSize:13, color:"#78350f" }}>· {s.name} — <strong>5/6 telafi</strong></p>))}
              </div>
            )}
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
            <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
              {[{key:"all",label:"Tümü"},{key:"active",label:"Aktif"},{key:"frozen",label:"Dondurulmuş"},{key:"telafi",label:"Telafililer"},{key:"odeme",label:"💳 Ödeme"}].map(f=>(
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
                const payDue = isOdemeBekleyen(s);
                const ekCount = (s.ek_dersler||[]).length;
                return (
                  <div key={s.id} style={{ background:s.frozen?"#f0f9ff":"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.07)", border:warn?"1.5px solid #fcd34d":payDue?"1.5px solid #fb923c":s.frozen?"1.5px solid #bfdbfe":"1.5px solid transparent" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setDetailSt(s)}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <p style={{ fontWeight:700, fontSize:15, margin:0, color:"#111" }}>{s.name}</p>
                          {s.frozen && <Pill label="❄️ Donuk" bg="#dbeafe" color="#1d4ed8" />}
                          {warn && <Pill label="⚠️ 5/6 Telafi" bg="#fef3c7" color="#92400e" />}
                          {payDue && <Pill label="💳 Ödeme" bg="#ffedd5" color="#c2410c" />}
                          {ekCount>0 && <Pill label={`+${ekCount} ek`} bg="#ede9fe" color="#5b21b6" />}
                        </div>
                        <p style={{ fontSize:12, color:"#999", margin:"3px 0 6px", fontWeight:500 }}>{s.instrument} · {s.day} {s.time}</p>
                        {nextL && <p style={{ fontSize:12, color:"#0369a1", fontWeight:600, margin:"0 0 6px", background:"#f0f9ff", display:"inline-block", borderRadius:6, padding:"2px 8px" }}>📅 {fmtDate(nextL.date)}</p>}
                        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                          <span style={{ fontSize:12, color:"#444" }}>📚 <strong>{bal}</strong> ders kaldı</span>
                          {np && <span style={{ fontSize:12, color:"#6b7280" }}>💳 <strong>{fmtShort(np)}</strong>'de ödeme</span>}
                        </div>
                        {ac>0 && <div style={{ marginTop:4 }}><span style={{ fontSize:12, color:ac>=5?"#d97706":"#2563eb" }}>🔄 <strong>{ac}/6</strong> aktif telafi</span></div>}
                        {s.no_show>0 && <div><span style={{ fontSize:12, color:"#dc2626" }}>🚫 <strong>{s.no_show}</strong> no-show</span></div>}
                      </div>
                      <button onClick={()=>setActionModal({student:s,lessonId:null})} style={{ background:s.frozen?"#e0f2fe":"#111", color:s.frozen?"#0369a1":"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", marginLeft:10, flexShrink:0, fontFamily:"inherit" }}>İşlem</button>
                      <button onClick={()=>setMesajSt(s)} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:10, padding:"8px 10px", fontSize:16, cursor:"pointer", marginLeft:6, flexShrink:0 }}>💬</button>
                    </div>
                  </div>
                );
              })}
              {filtered.length===0 && (
                <div style={{ textAlign:"center", padding:"48px 20px", color:"#bbb" }}>
                  <p style={{ fontSize:36 }}>🎵</p>
                  <p style={{ fontWeight:600, color:"#aaa" }}>{students.length===0 ? "Henüz öğrenci yok — + Ekle ile başla" : "Bu filtrede öğrenci yok"}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {actionModal && <ActionSheet student={students.find(s=>s.id===actionModal.student.id)} lessonId={actionModal.lessonId} onClose={()=>setActionModal(null)} onAction={(a,n,l)=>handleAction(actionModal.student.id,a,n,l)} />}
      {detailSt && <DetailSheet student={students.find(s=>s.id===detailSt.id)} onClose={()=>setDetailSt(null)} onRecharge={handleRecharge} onLessonClick={(st,lid)=>{ setDetailSt(null); setTimeout(()=>setActionModal({student:st,lessonId:lid}),100); }} onShift={handleShift} onTelafiDone={handleTelafiDone} onMesaj={(st)=>setMesajSt(st)} onOdeme={(st)=>setOdemeSt(st)} onDelete={handleDelete} onEkDersEkle={handleEkDersEkle} onDuzenle={handleDuzenle} />}
      {showAdd && <AddSheet onClose={()=>setShowAdd(false)} onAdd={handleAdd} />}
      {mesajSt && <MesajSheet student={mesajSt} onClose={()=>setMesajSt(null)} />}
      {odemeSt && <OdemeSheet student={odemeSt} onClose={()=>setOdemeSt(null)} onOdemeAl={handleRecharge} onMesajGonder={(st)=>setMesajSt(st)} />}

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:toast.startsWith("🚨")?"#dc2626":toast.startsWith("⚠️")?"#d97706":"#111", color:"#fff", padding:"12px 20px", borderRadius:14, fontSize:14, fontWeight:600, zIndex:100, boxShadow:"0 4px 20px rgba(0,0,0,.3)", maxWidth:"90vw", textAlign:"center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
