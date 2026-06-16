function studentScheduleLabel(student) {
  return slotLabel(getStudentSlots(student));
}

function buildScheduleSlots(slots, count, from) {
  const cleanSlots = normalizeSlots(slots);
  const cursor = new Date(from);
  const dates = [];
  const lessonCount = Math.max(1, parseInt(count)||1);
  const nextOccurrences = cleanSlots.map((slot, slotIndex) => ({
    slot,
    slotIndex,
    date: setTimeOnDate(nextWeekday(slot.day, cursor), slot.time),
  }));

  for (let i = 0; i < lessonCount; i++) {
    nextOccurrences.sort((a,b) => a.date - b.date || a.slotIndex - b.slotIndex);
    const next = nextOccurrences[0];
    dates.push({
      id: uid(),
      date: new Date(next.date).toISOString(),
      day: next.slot.day,
      time: next.slot.time,
      status: "upcoming",
      note: "",
    });
    next.date.setDate(next.date.getDate() + 7);
  }
  return dates;
}

function buildSchedule(day, count, from, time = "10:00") {
  return buildScheduleSlots([{ day, time }], count, from);
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
      {willWarn && <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#92400e", fontWeight:600 }}>Uyari: Bu telafi ile 5. hakka ulasilacak.</div>}
      {willFreeze && <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#991b1b", fontWeight:600 }}>Uyari: 6. telafi limiti — program dondurulacak.</div>}
    </>
  );

  return (
    <Sheet title={student.name} subtitle={lesson ? fmtDate(lesson.date)+" - "+lessonTime(student, lesson) : ""} onClose={onClose}>
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
    <Sheet title="Ders Tarihi Kaydır" subtitle={fmtDate(lesson.date)+" - "+lessonTime(student, lesson)} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>Bu dersten itibaren tüm planlanmış dersler ileri alınır.</p>
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
    veli_adi: student.veli_adi || "",
    dogum_tarihi: student.dogum_tarihi || "",
    ucret: student.ucret || "",
    instrument: student.instrument,
    day: student.day,
    time: student.time,
    lessonSlots: getStudentSlots(student),
  });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const setSlot = (i,k,v) => setF(p=>({
    ...p,
    lessonSlots: p.lessonSlots.map((slot,idx)=>idx===i ? {...slot,[k]:v} : slot),
  }));
  const addSlot = () => setF(p=>({...p, lessonSlots:[...p.lessonSlots, { day:"Pazartesi", time:"15:00" }]}));
  const removeSlot = (i) => setF(p=>({...p, lessonSlots:p.lessonSlots.filter((_,idx)=>idx!==i)}));
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
      <label style={LBL}>Ders Günleri</label>
      {f.lessonSlots.map((slot,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:f.lessonSlots.length>1?"1fr 1fr 40px":"1fr 1fr", gap:10, alignItems:"end", marginBottom:8 }}>
