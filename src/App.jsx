import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";
const CRM_AUTH_KEY = "crm_auth";
const CRM_AUTH_METHOD_KEY = "crm_auth_method";
const CRM_PASSWORD_SETUP_PENDING_KEY = "crm_password_setup_pending";
const INITIAL_AUTH_LINK_TYPE = typeof window === "undefined"
  ? ""
  : new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") || "";
if (typeof window !== "undefined" && ["invite", "recovery"].includes(INITIAL_AUTH_LINK_TYPE)) {
  sessionStorage.setItem(CRM_PASSWORD_SETUP_PENDING_KEY, "ok");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const FAILED_OPS_KEY = "sonsuz_crm_failed_operations_v1";
const MAX_SAVE_RETRIES = 3;
const DEFAULT_TEACHER_NAME = "Bora Kaynakgöl";
const LIFECYCLE_TRACKING_START = "2026-08-01";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/H30hg6FbqWzGN5rYfKA0Ks";
const NEWSLETTER_URL = "https://bodrumsonsuzsanat.com/#bulten";
const GOOGLE_REVIEW_URL = "https://g.page/r/CSo8oia25vGSEBI/review";
const CURRENT_BRANCH_CODE = "bodrum";
const MONTHLY_REPORT_START = "2026-08-01";

function authHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function isPasswordSetupLink() {
  const type = authHashParams().get("type") || INITIAL_AUTH_LINK_TYPE;
  if (type === "invite" || type === "recovery") return true;
  return typeof window !== "undefined" && sessionStorage.getItem(CRM_PASSWORD_SETUP_PENDING_KEY) === "ok";
}

function authErrorMessage(error) {
  const message = String(error?.message || error || "").toLocaleLowerCase("tr-TR");
  if (message.includes("invalid login credentials")) return "E-posta veya parola hatalı.";
  if (message.includes("email not confirmed")) return "Önce e-posta davetini onaylayın.";
  if (message.includes("expired") || message.includes("otp")) return "Davet bağlantısının süresi dolmuş. Yeni davet gönderilmesi gerekiyor.";
  return "Giriş doğrulanamadı. Lütfen tekrar deneyin.";
}

async function activeStaffProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("app_profiles")
    .select("role,active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.active || !["admin", "teacher"].includes(data.role)) return null;
  return data;
}

const DAY_IDX = { "Pazartesi":1, "Sali":2, "Carsamba":3, "Persembe":4, "Cuma":5, "Cumartesi":6, "Pazar":0 };
const TR_DAYS_MAP = { "Pazartesi":"Pazartesi", "Salı":"Sali", "Çarşamba":"Carsamba", "Perşembe":"Persembe", "Cuma":"Cuma", "Cumartesi":"Cumartesi", "Pazar":"Pazar" };

function nextWeekday(day, from = new Date()) {
  const key = TR_DAYS_MAP[day] || day;
  const target = DAY_IDX[key] !== undefined ? DAY_IDX[key] : DAY_IDX[day];
  if (target === undefined) return new Date(from);
  const d = new Date(from);
  if (isNaN(d.getTime())) return new Date();
  let safety = 0;
  while (d.getDay() !== target) {
    d.setDate(d.getDate() + 1);
    if (++safety > 14) break;
  }
  return d;
}

function setTimeOnDate(date, time = "10:00") {
  const d = new Date(date);
  const [h, m] = String(time || "10:00").split(":").map(Number);
  d.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function normalizeSlots(slots, fallbackDay = "Pazartesi", fallbackTime = "15:00") {
  const raw = Array.isArray(slots) && slots.length ? slots : [{ day:fallbackDay, time:fallbackTime }];
  return raw
    .filter(s => s && s.day && s.time)
    .map(s => ({ day:s.day, time:s.time }));
}

function getStudentSlots(student) {
  return normalizeSlots(student.lessonSlots || student.lesson_slots, student.day, student.time);
}

function sameSlots(a, b) {
  const left = normalizeSlots(a);
  const right = normalizeSlots(b);
  return left.length === right.length && left.every((slot, i) => slot.day === right[i].day && slot.time === right[i].time);
}

function sameSlotDays(a, b) {
  const left = normalizeSlots(a);
  const right = normalizeSlots(b);
  return left.length === right.length && left.every((slot, i) => slot.day === right[i].day);
}

function slotDayIndex(day) {
  const key = TR_DAYS_MAP[day] || day;
  return DAY_IDX[key] !== undefined ? DAY_IDX[key] : DAY_IDX[day];
}

function timeFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function upcomingScheduleMatchesSlots(lessons, slots) {
  const cleanSlots = normalizeSlots(slots);
  if (!lessons.length) return true;
  return lessons.every(lesson => cleanSlots.some(slot => {
    const lessonDay = lesson.day ? slotDayIndex(lesson.day) : new Date(lesson.date).getDay();
    const lessonTimeValue = lesson.time || timeFromISO(lesson.date);
    return lessonDay === slotDayIndex(slot.day) && lessonTimeValue === slot.time;
  }));
}

function slotLabel(slots) {
  return normalizeSlots(slots).map(s => s.day+" "+s.time).join(" · ");
}

function lessonTime(student, lesson) {
  return lesson?.time || timeFromISO(lesson?.date) || student?.time || "";
}

function studentScheduleLabel(student) {
  return slotLabel(getStudentSlots(student));
}

function paymentProgramSnapshot(payment) {
  if (!payment || payment.programSnapshotVersion !== 1) return "";
  return payment.programSnapshot || "";
}

function getLessonDuration(student, item) {
  const scheduleDuration = (student?.schedule || []).find(l => l.durationMinutes || l.duration_minutes);
  const n = parseInt(item?.durationMinutes || item?.duration_minutes || student?.lessonDuration || student?.lesson_duration || scheduleDuration?.durationMinutes || scheduleDuration?.duration_minutes || 45);
  return Number.isFinite(n) && n > 0 ? n : 45;
}

function lessonDurationLabel(student) {
  return getLessonDuration(student) + " dk";
}

function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function lessonStartDate(student, lesson) {
  const base = new Date(lesson?.date);
  const time = lesson?.time || timeFromISO(lesson?.date) || student?.time;
  return time ? setTimeOnDate(base, time) : base;
}

function buildScheduleSlots(slots, count, from, durationMinutes = 45) {
  const cleanSlots = normalizeSlots(slots);
  const cursor = new Date(from);
  const dates = [];
  const lessonCount = Math.max(1, parseInt(count)||1);
  const duration = getLessonDuration(null, { durationMinutes });
  const packageId = uid();
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
      packageId,
      packageLessonCount: lessonCount,
      date: new Date(next.date).toISOString(),
      day: next.slot.day,
      time: next.slot.time,
      durationMinutes: duration,
      status: "upcoming",
      note: "",
    });
    next.date.setDate(next.date.getDate() + 7);
  }
  return dates;
}

function buildSchedule(day, count, from, time = "10:00") {
  return buildScheduleSlots([{ day, time }], count, from, 45);
}

function uid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }); }

function addDays(iso, n) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString(); }
function expiry30() { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; }
function daysLeft(iso) { if (!iso) return null; return Math.ceil((new Date(iso) - new Date()) / 86400000); }
function isCurrentTelafi(record) {
  if (!record || record.done) return false;
  if (!record.expiry) return true;
  const expiryDate = /^\d{4}-\d{2}-\d{2}$/.test(record.expiry) ? new Date(record.expiry+"T00:00:00") : new Date(record.expiry);
  if (isNaN(expiryDate.getTime())) return true;
  return midday(expiryDate).getTime() >= midday().getTime();
}
function fmtDate(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { weekday:"short", day:"numeric", month:"long" }); }
function fmtMed(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"long" }); }
function fmtShort(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"short" }); }
function calcBalance(schedule) { return schedule.filter(l => l.status === "upcoming").length; }
function calcNextPayment(schedule) { const up = schedule.filter(l => l.status === "upcoming"); if (!up.length) return null; const d = new Date(up[up.length-1].date); d.setDate(d.getDate()+7); return d.toISOString(); }

const HOMEWORK_STATUS_LABELS = {
  done:"Yaptı",
  partial:"Kısmen Yaptı",
  not_done:"Yapmadı",
  unchecked:"Kontrol Edilmedi",
  pending:"Kontrol Bekliyor",
};

function homeworkStatusLabel(status) {
  return HOMEWORK_STATUS_LABELS[status] || "Kontrol Bekliyor";
}

function homeworkCheckRef(type, id) {
  return id ? `${type}:${id}` : "";
}

function homeworkAssignments(student) {
  const normal = (student?.schedule || []).filter(item=>item?.homework).map(item=>({ ...item, homeworkSource:"schedule", homeworkSourceId:item.id, homeworkDate:item.date }));
  const telafi = (student?.telafi_records || []).filter(item=>item?.homework).map(item=>({ ...item, homeworkSource:"telafi", homeworkSourceId:item.id, homeworkDate:telafiDoneAt(item) || telafiPlannedAt(item) || item.lessonDate }));
  return [...normal, ...telafi];
}

function homeworkHabitStats(student) {
  const statusScores = { done:10, partial:5, not_done:0 };
  const checked = homeworkAssignments(student)
    .filter(item => statusScores[item.homeworkStatus] !== undefined && (item.homeworkCheckedAt || item.homeworkCheckedInRef))
    .sort((a,b) => new Date(b.homeworkCheckedAt || b.homeworkDate).getTime() - new Date(a.homeworkCheckedAt || a.homeworkDate).getTime())
    .slice(0,12);
  if (!checked.length) return null;
  const scores = checked.map(item => statusScores[item.homeworkStatus]);
  return {
    score:scores.reduce((sum,value)=>sum+value,0) / scores.length,
    total:checked.length,
  };
}

function homeworkForCheck(student, occurrenceDate, checkRef, excludedSourceRef="") {
  const occurrenceTime = new Date(occurrenceDate).getTime();
  if (!Number.isFinite(occurrenceTime) || !checkRef) return null;
  return homeworkAssignments(student)
    .filter(item => {
      const sourceRef = homeworkCheckRef(item.homeworkSource, item.homeworkSourceId);
      if (sourceRef === excludedSourceRef) return false;
      const itemTime = new Date(item.homeworkDate).getTime();
      if (!Number.isFinite(itemTime) || itemTime >= occurrenceTime) return false;
      const pending = !item.homeworkStatus || item.homeworkStatus === "pending";
      return pending || item.homeworkCheckedInRef === checkRef;
    })
    .sort((a,b) => new Date(b.homeworkDate) - new Date(a.homeworkDate))[0] || null;
}

function homeworkForLessonCheck(student, lesson) {
  return lesson?.id ? homeworkForCheck(student, lesson.date, homeworkCheckRef("lesson", lesson.id), homeworkCheckRef("schedule", lesson.id)) : null;
}

function homeworkForTelafiCheck(student, record) {
  const occurrenceDate = telafiPlannedAt(record) || telafiDoneAt(record);
  return record?.id && occurrenceDate ? homeworkForCheck(student, occurrenceDate, homeworkCheckRef("telafi", record.id), homeworkCheckRef("telafi", record.id)) : null;
}

function pendingHomeworkBefore(student, occurrenceDate, excludedSourceRef="") {
  const occurrenceTime = new Date(occurrenceDate).getTime();
  if (!Number.isFinite(occurrenceTime)) return null;
  return homeworkAssignments(student)
    .filter(item => homeworkCheckRef(item.homeworkSource, item.homeworkSourceId) !== excludedSourceRef && new Date(item.homeworkDate).getTime() < occurrenceTime && (!item.homeworkStatus || item.homeworkStatus === "pending"))
    .sort((a,b) => new Date(b.homeworkDate) - new Date(a.homeworkDate))[0] || null;
}

function homeworkCheckedInOccurrence(student, checkRef) {
  if (!checkRef) return null;
  return homeworkAssignments(student).find(item => item.homeworkCheckedInRef === checkRef) || null;
}
function midday(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function isToday(iso) { return midday(new Date(iso)).getTime() === midday().getTime(); }
function paymentOverdueDays(iso) { if (!iso) return 0; const diff = Math.floor((midday() - midday(new Date(iso))) / 86400000); return diff > 0 ? diff : 0; }
function daysBetweenDates(from, to) {
  if (!from || !to) return 0;
  const diff = Math.floor((midday(new Date(to)) - midday(new Date(from))) / 86400000);
  return diff > 0 ? diff : 0;
}
function dateKey(iso) { if (!iso) return ""; return new Date(iso).toISOString().split("T")[0]; }
function localDateKey(value = new Date()) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function expenseAppliesToMonth(expense, targetMonth) {
  if (!expense || expense.deleted_at || !expense.expense_date) return false;
  const start = new Date(expense.expense_date+"T00:00:00");
  if (isNaN(start.getTime())) return false;
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth()+1, 0, 23, 59, 59, 999);
  if (!expense.is_recurring) return start >= monthStart && start <= monthEnd;
  if (start > monthEnd) return false;
  if (!expense.recurring_until) return true;
  const until = new Date(expense.recurring_until+"T23:59:59");
  return !isNaN(until.getTime()) && until >= monthStart;
}
function addMonths(iso, n) { const d = iso ? new Date(iso) : new Date(); d.setMonth(d.getMonth() + n); return d.toISOString(); }
function studentTeacherName(student) { return student?.teacher_name || student?.teacherName || DEFAULT_TEACHER_NAME; }
function isStudentLeft(student) { return !!(student?.left_at || student?.leftAt); }
function isStudentDeleted(student) { return (student?.status_history || []).some(event=>event?.type==="deleted"); }
function teacherForDate(student, iso, item = null) {
  const direct = item?.teacherName || item?.teacher_name;
  if (direct) return direct;
  const target = dateKey(iso);
  const history = [...(student?.teacher_history || [])]
    .filter(entry => entry?.teacherName && entry?.from && dateKey(entry.from) <= target)
    .sort((a,b) => dateKey(a.from).localeCompare(dateKey(b.from)));
  return history.length ? history[history.length-1].teacherName : studentTeacherName(student);
}
function withStatusEvent(student, type, at = new Date().toISOString()) {
  return {
    ...student,
    status_history: [
      ...(student.status_history || []),
      { id:uid(), type, at }
    ]
  };
}
function latestCommunicationEvent(student, key) {
  return [...(student?.status_history || [])]
    .filter(event=>event?.type==="communication_"+key && event?.at)
    .sort((a,b)=>new Date(b.at)-new Date(a.at))[0] || null;
}
function communicationFlag(student, key) { return latestCommunicationEvent(student,key)?.value === true; }
function firstCompletedLessonAt(student) {
  const completed = (student?.schedule || []).filter(lesson=>lesson.status==="completed" && lesson.date).sort((a,b)=>new Date(a.date)-new Date(b.date));
  return completed[0]?.date || null;
}
function googleReviewDueAt(student) {
  const firstLesson = firstCompletedLessonAt(student);
  if (!firstLesson) return null;
  return addMonths(firstLesson,1);
}
function instrumentLessonPhrase(student) {
  const instrument = String(student?.instrument || "müzik").trim().toLocaleLowerCase("tr-TR");
  return instrument.endsWith(" dersi") ? instrument : instrument+" dersi";
}
function googleReviewState(student) {
  const event = latestCommunicationEvent(student,"google_review");
  if (event?.value==="completed") return { key:"completed", label:"Yaptı", event };
  if (event?.value==="closed") return { key:"closed", label:"Takip kapatıldı", event };
  if (event?.value==="requested" || event?.value==="waiting") {
    const checkAt = event.remindAt || addDays(event.at,7);
    const due = midday(new Date(checkAt)).getTime() <= midday().getTime();
    return { key:due?"check":"requested", label:due?"Yaptı mı?":"İstendi · bekleniyor", event, checkAt };
  }
  const dueAt = googleReviewDueAt(student);
  if (!dueAt) return { key:"no-lesson", label:"İlk ders bekleniyor", dueAt:null };
  const due = midday(new Date(dueAt)).getTime() <= midday().getTime();
  return { key:due?"due":"scheduled", label:due?"İstenmedi":fmtShort(dueAt)+" tarihinde", dueAt };
}
function inMonth(iso, monthDate) {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
}
const PAYMENT_PACK_SIZE = 4;
const PACKAGE_LOAD_OPTIONS = [4, 8, 12, 16];
const PAID_LESSON_STATUSES = ["completed", "noshow", "lastminute"];
const SCORE_STATUSES = ["completed", "telafi", "lastminute", "noshow"];
const LESSON_FOCUS_OPTIONS = ["Parça Tekrarı","Yeni Parça Çalışması","Teknik Çalışma","Ritim Çalışması","Teorik Çalışma"];
const PIECE_RESULT_OPTIONS = [
  { value:"complete", label:"Tam ve akıcı parça çıktı", score:100 },
  { value:"partial", label:"Kısmen çıktı", score:50 },
  { value:"none", label:"Çıkmadı", score:0 },
];
const PROGRESS_CHART_START_AT = new Date("2026-08-17T00:00:00+03:00").getTime();

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtNumber(n, digits = 1) {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function scoreLabel(score) {
  return Number.isFinite(score) ? fmtNumber(score, 1) + "/10" : "-";
}

function roundedScore(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function homeworkLessonPoints(status) {
  return status === "done" ? 40 : status === "partial" ? 20 : 0;
}

function activeLessonPoints(minutes) {
  const value = Math.max(0, parseInt(minutes) || 0);
  if (value >= 35) return 10;
  if (value >= 20) return 8;
  if (value >= 10) return 5;
  return 0;
}

function taskFocusLessonPoints(minutes) {
  const value = Math.max(0, parseInt(minutes) || 0);
  if (value >= 30) return 20;
  if (value >= 20) return 16;
  if (value >= 10) return 12;
  if (value >= 5) return 8;
  return 4;
}

function redirectionLessonPoints(count) {
  return Math.max(0, 30 - (Math.max(0, parseInt(count) || 0) * 3));
}

function calculateLessonScore({ homeworkStatus, homeworkApplicable=true, activeMinutes, taskFocusMinutes, redirectionCount }) {
  const homework = homeworkApplicable ? homeworkLessonPoints(homeworkStatus) : 0;
  const active = activeLessonPoints(activeMinutes);
  const taskFocus = taskFocusLessonPoints(taskFocusMinutes);
  const redirection = redirectionLessonPoints(redirectionCount);
  const earned = homework + active + taskFocus + redirection;
  const maximum = homeworkApplicable ? 100 : 60;
  return {
    homework,
    homeworkMaximum:homeworkApplicable ? 40 : 0,
    active,
    activeMaximum:10,
    taskFocus,
    taskFocusMaximum:20,
    redirection,
    redirectionMaximum:30,
    earned,
    maximum,
    total:maximum ? roundedScore((earned / maximum) * 100) : 0,
    homeworkApplicable,
  };
}

function storedLessonScore(record) {
  const score = Number(record?.lessonScore ?? record?.lesson_score);
  return Number.isFinite(score) ? score : null;
}

function pieceResultOption(value) {
  return PIECE_RESULT_OPTIONS.find(option => option.value === value) || null;
}

function readFailedOps() {
  try {
    const raw = localStorage.getItem(FAILED_OPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFailedOps(items) {
  localStorage.setItem(FAILED_OPS_KEY, JSON.stringify(items || []));
}

function failedOperationLabel(op) {
  if (!op) return "Kaydedilemeyen işlem";
  const names = {
    lessonAction:"Ders işlemi",
    payment:"Ödeme kaydı",
    editStudent:"Öğrenci düzenleme",
  };
  return names[op.type] || "Kaydedilemeyen işlem";
}

function icsDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsLocalDate(date) {
  const d = new Date(date);
  return (
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    "T" +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0") +
    String(d.getSeconds()).padStart(2, "0")
  );
}

function icsText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function lessonStatusText(status) {
  const m = {
    upcoming: "Planlandı",
    completed: "Yapıldı",
    telafi: "Telafi",
    lastminute: "Son dakika iptal",
    noshow: "No-show",
  };
  return m[status] || status || "Planlandı";
}

function shouldShowLessonOnCalendar(lesson) {
  return ["upcoming", "completed"].includes(lesson?.status || "upcoming");
}

function shouldShowExtraLessonOnCalendar(extra) {
  return (extra?.status || "planned") !== "cancelled";
}

function telafiPlannedAt(record) {
  return record?.plannedAt || record?.planned_at || "";
}

function telafiDoneAt(record) {
  return record?.doneAt || record?.done_at || telafiPlannedAt(record) || "";
}

function isValidDateValue(value) {
  if (!value) return false;
  return !isNaN(new Date(value).getTime());
}

function telafiDoneDateText(record) {
  const value = telafiDoneAt(record);
  if (!value) return "yapıldı";
  if (!isValidDateValue(value)) return value;
  return fmtDate(value) + (timeFromISO(value) ? " " + timeFromISO(value) : "");
}

function telafiDoneShortText(record) {
  const value = telafiDoneAt(record);
  if (!value) return "yapıldı";
  return isValidDateValue(value) ? fmtShort(value) : value;
}

function telafiStatusLabel(record) {
  if (record?.done) {
    if (record?.doneStatus === "counted") return "Yapıldı sayıldı";
    if (record?.doneStatus === "attended") return "Katıldı";
    return "Yapıldı";
  }
  return telafiPlannedAt(record) ? "Planlandı" : "Bekliyor";
}

function telafiMetricText(record) {
  const parts = [];
  if (record?.activeMinutes) parts.push(record.activeMinutes + " dk aktif");
  if (record?.taskFocusMinutes !== undefined || record?.task_focus_minutes !== undefined) parts.push((record.taskFocusMinutes ?? record.task_focus_minutes) + " dk görev odağı");
  else if (record?.focusMinutes) parts.push(record.focusMinutes + " dk odak");
  if (record?.redirectionCount !== undefined || record?.redirection_count !== undefined) parts.push((record.redirectionCount ?? record.redirection_count) + " yönlendirme");
  if (record?.productiveWindow) parts.push(record.productiveWindow + " en verimli bölüm");
  return parts.join(", ");
}

function calendarEventsFromStudents(students) {
  const events = [];
  students.forEach(student => {
    if (student.frozen) return;
    (student.schedule || []).forEach(lesson => {
      if (!lesson.date) return;
      if (!shouldShowLessonOnCalendar(lesson)) return;
      const start = lessonStartDate(student, lesson);
      const end = addMinutes(start, getLessonDuration(student, lesson));
      events.push({
        uid: "ders-" + student.id + "-" + (lesson.id || dateKey(lesson.date)) + "@sonsuz-sanat-crm",
        start,
        end,
        summary: "Ders - " + student.name,
        description: [
          "Öğrenci: " + student.name,
          student.instrument ? "Branş: " + student.instrument : "",
          student.veli_adi ? "Veli: " + student.veli_adi : "",
          student.phone ? "Telefon: " + student.phone : "",
          "Durum: " + lessonStatusText(lesson.status),
          lesson.note ? "Not: " + lesson.note : "",
        ].filter(Boolean).join("\n"),
      });
    });

    (student.ek_dersler || []).forEach(extra => {
      if (!extra.date) return;
      if (!shouldShowExtraLessonOnCalendar(extra)) return;
      const start = new Date(extra.date);
      const end = addMinutes(start, getLessonDuration(student, extra));
      events.push({
        uid: "ek-ders-" + student.id + "-" + (extra.id || dateKey(extra.date)) + "@sonsuz-sanat-crm",
        start,
        end,
        summary: "Ek Ders - " + student.name,
        description: [
          "Öğrenci: " + student.name,
          student.instrument ? "Branş: " + student.instrument : "",
          "Ek ders durumu: " + ekDersStatusLabel(extra.status),
          "Ders tipi: " + ekDersTypeLabel(extra.type),
          extra.odendi ? "Ödeme: Alındı" : "Ödeme: Bekliyor",
          extra.note ? "Not: " + extra.note : "",
        ].filter(Boolean).join("\n"),
      });
    });

    (student.telafi_records || []).forEach(record => {
      const plannedAt = telafiPlannedAt(record);
      if (!plannedAt) return;
      const start = new Date(plannedAt);
      if (isNaN(start.getTime())) return;
      const end = addMinutes(start, getLessonDuration(student, { durationMinutes: record.plannedDurationMinutes || record.planned_duration_minutes }));
      events.push({
        uid: "telafi-ders-" + student.id + "-" + (record.id || dateKey(plannedAt)) + "@sonsuz-sanat-crm",
        start,
        end,
        summary: "Telafi Ders - " + student.name,
        description: [
          "Öğrenci: " + student.name,
          student.instrument ? "Branş: " + student.instrument : "",
          student.veli_adi ? "Veli: " + student.veli_adi : "",
          student.phone ? "Telefon: " + student.phone : "",
          "Durum: " + telafiStatusLabel(record),
          record.lessonDate ? "Hangi dersin telafisi: " + fmtShort(record.lessonDate) : "",
          record.note ? "İptal notu: " + record.note : "",
          record.plannedNote ? "Plan notu: " + record.plannedNote : "",
          record.doneNote ? "Yapıldı notu: " + record.doneNote : "",
        ].filter(Boolean).join("\n"),
      });
    });
  });
  return events.sort((a,b) => a.start - b.start);
}

function buildGoogleCalendarICS(students) {
  const events = calendarEventsFromStudents(students);
  const now = icsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sonsuz Sanat CRM//Ders Takvimi//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Sonsuz Sanat Dersleri",
    "X-WR-TIMEZONE:Europe/Istanbul",
  ];

  events.forEach(event => {
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + icsText(event.uid),
      "DTSTAMP:" + now,
      "DTSTART;TZID=Europe/Istanbul:" + icsLocalDate(event.start),
      "DTEND;TZID=Europe/Istanbul:" + icsLocalDate(event.end),
      "SUMMARY:" + icsText(event.summary),
      "DESCRIPTION:" + icsText(event.description),
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return { content: lines.join("\r\n"), count: events.length };
}

const CALENDAR_FEED_VERSION = "2026-06-18-v17";

function downloadGoogleCalendarICS(students) {
  const { content, count } = buildGoogleCalendarICS(students);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sonsuz-sanat-dersleri-google-takvim.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return count;
}

function getPackageLessonCount(student) {
  const firstWithCount = (student.schedule||[]).find(l=>l.packageLessonCount);
  const n = parseInt(student.packageLessonCount || student.package_lesson_count || firstWithCount?.packageLessonCount || PAYMENT_PACK_SIZE);
  return Number.isFinite(n) && n > 0 ? n : PAYMENT_PACK_SIZE;
}

function getPreferredPackageLessonCount(student) {
  const n = parseInt(student.preferredPackageLessonCount || student.preferred_package_lesson_count);
  return PACKAGE_LOAD_OPTIONS.includes(n) ? n : getPackageLessonCount(student);
}

function customPackageInfos(student) {
  const sortedSchedule = [...(student.schedule||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const seen = new Set();
  const infos = [];
  for (const lesson of sortedSchedule) {
    if (!lesson.packageId || seen.has(lesson.packageId)) continue;
    const expected = parseInt(lesson.packageLessonCount);
    if (!PACKAGE_LOAD_OPTIONS.includes(expected) || expected <= PAYMENT_PACK_SIZE) continue;
    const lessons = sortedSchedule.filter(l => l.packageId === lesson.packageId);
    if (!lessons.length) continue;
    seen.add(lesson.packageId);
    const first = lessons[0];
    const last = lessons[lessons.length-1];
    infos.push({
      packageIndex: null,
      packageId: lesson.packageId,
      packageSize: lessons.length,
      expectedPackageSize: expected,
      complete: lessons.length >= expected,
      lessonIds: lessons.map(l=>l.id).filter(Boolean),
      start: first.date,
      end: last.date,
      startKey: dateKey(first.date),
      endKey: dateKey(last.date),
      donem: fmtShort(first.date)+" - "+fmtShort(last.date),
    });
  }
  return infos;
}

function regularPackageInfos(student) {
  const customIds = new Set(customPackageInfos(student).flatMap(info => info.lessonIds || []));
  return packageInfos(student).filter(info => !(info.lessonIds || []).some(id => customIds.has(id)));
}

function paymentPackageInfo(student) {
  const sortedSchedule = [...(student.schedule||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const completed = (student.schedule||[])
    .filter(l => PAID_LESSON_STATUSES.includes(l.status))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  if (completed.length === 0) return null;
  const currentLesson = completed[completed.length-1];
  if (currentLesson.packageId) {
    const packageLessons = sortedSchedule.filter(l=>l.packageId===currentLesson.packageId);
    const packageStartLesson = packageLessons[0] || currentLesson;
    const packageEndLesson = packageLessons[packageLessons.length-1] || currentLesson;
    const packageIds = [];
    sortedSchedule.forEach(l => {
      if (l.packageId && !packageIds.includes(l.packageId)) packageIds.push(l.packageId);
    });
    return {
      packageIndex: Math.max(0, packageIds.indexOf(currentLesson.packageId)),
      packageId: currentLesson.packageId,
      packageSize: parseInt(currentLesson.packageLessonCount || packageLessons.length || PAYMENT_PACK_SIZE) || PAYMENT_PACK_SIZE,
      lessonIds: packageLessons.map(l=>l.id).filter(Boolean),
      start: packageStartLesson.date,
      end: packageEndLesson.date,
      startKey: dateKey(packageStartLesson.date),
      endKey: dateKey(packageEndLesson.date),
      donem: fmtShort(packageStartLesson.date)+" - "+fmtShort(packageEndLesson.date),
    };
  }
  const packageSize = getPackageLessonCount(student);
  const packageIndex = Math.floor((completed.length - 1) / packageSize);
  const packageStartLesson = completed[packageIndex * packageSize];
  if (!packageStartLesson) return null;
  const startIndex = sortedSchedule.findIndex(l=>l.id===packageStartLesson.id);
  const packageLessons = startIndex >= 0 ? sortedSchedule.slice(startIndex, startIndex + packageSize) : [packageStartLesson];
  const packageEndLesson = packageLessons[packageLessons.length-1] || packageStartLesson;
  return {
    packageIndex,
    packageSize,
    lessonIds: packageLessons.map(l=>l.id).filter(Boolean),
    start: packageStartLesson.date,
    end: packageEndLesson.date,
    startKey: dateKey(packageStartLesson.date),
    endKey: dateKey(packageEndLesson.date),
    donem: fmtShort(packageStartLesson.date)+" - "+fmtShort(packageEndLesson.date),
  };
}

function packageInfos(student) {
  const sortedSchedule = [...(student.schedule||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const packageSize = getPackageLessonCount(student);
  const infos = [];
  for (let i = 0; i < sortedSchedule.length; i += packageSize) {
    const lessons = sortedSchedule.slice(i, i + packageSize);
    if (!lessons.length) continue;
    const first = lessons[0];
    const last = lessons[lessons.length-1];
    const packageIds = [...new Set(lessons.map(l=>l.packageId).filter(Boolean))];
    infos.push({
      packageIndex: infos.length,
      packageId: packageIds.length === 1 ? packageIds[0] : undefined,
      packageSize: lessons.length || packageSize,
      expectedPackageSize: packageSize,
      complete: lessons.length >= packageSize,
      lessonIds: lessons.map(l=>l.id).filter(Boolean),
      start: first.date,
      end: last.date,
      startKey: dateKey(first.date),
      endKey: dateKey(last.date),
      donem: fmtShort(first.date)+" - "+fmtShort(last.date),
    });
  }
  return infos;
}

function currentPaymentDueInfo(student) {
  if (student.frozen) return null;
  const today = midday();
  return [...customPackageInfos(student), ...regularPackageInfos(student)].find(info =>
    info.complete && midday(new Date(info.start)) <= today && !hasPaymentForPackage(student, info)
  ) || null;
}

function nonExtraPaymentIndex(student, originalIndex) {
  let n = -1;
  for (let i = 0; i <= originalIndex; i++) {
    const payment = (student.odemeler || [])[i];
    if (payment && !payment.sadeceEkDers) n += 1;
  }
  return n;
}

function paymentPackageLessons(student, payment, index) {
  const schedule = [...(student.schedule||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const packages = packageInfos(student);
  const inferredStudentCount = getPackageLessonCount(student);
  const storedPaymentCount = parseInt(payment.packageLessonCount);
  const effectiveCount = storedPaymentCount && !(storedPaymentCount === PAYMENT_PACK_SIZE && inferredStudentCount > PAYMENT_PACK_SIZE)
    ? storedPaymentCount
    : inferredStudentCount;
  const lessonIds = Array.isArray(payment.packageLessonIds) ? payment.packageLessonIds : [];
  let lessons = lessonIds.map(id => schedule.find(l=>l.id===id)).filter(Boolean);

  if (!lessons.length && payment.packageId) lessons = schedule.filter(l=>l.packageId===payment.packageId);

  if (!lessons.length && payment.packageStart && payment.packageEnd) {
    const startIdx = schedule.findIndex(l=>dateKey(l.date)===payment.packageStart);
    const count = effectiveCount || PAYMENT_PACK_SIZE;
    if (startIdx >= 0) lessons = schedule.slice(startIdx, startIdx + count);
  }

  if (!lessons.length && typeof payment.packageIndex === "number" && packages[payment.packageIndex]) {
    const ids = new Set(packages[payment.packageIndex].lessonIds || []);
    lessons = schedule.filter(l=>ids.has(l.id));
  }

  if (!lessons.length && typeof payment.package_index === "number" && packages[payment.package_index]) {
    const ids = new Set(packages[payment.package_index].lessonIds || []);
    lessons = schedule.filter(l=>ids.has(l.id));
  }

  if (!lessons.length && payment.tarih) {
    const paidKey = dateKey(payment.tarih);
    const byDate = packages.find(info => info.startKey <= paidKey && paidKey <= info.endKey)
      || packages.find(info => paidKey <= info.startKey);
    if (byDate) {
      const ids = new Set(byDate.lessonIds || []);
      lessons = schedule.filter(l=>ids.has(l.id));
    }
  }

  if (!lessons.length) {
    const idx = nonExtraPaymentIndex(student, index);
    const info = packages[idx];
    if (info) {
      const ids = new Set(info.lessonIds || []);
      lessons = schedule.filter(l=>ids.has(l.id));
    }
  }

  const first = lessons[0];
  const last = lessons[lessons.length-1];
  return {
    lessons,
    effectiveCount,
    startKey:first ? dateKey(first.date) : (payment.packageStart || ""),
    endKey:last ? dateKey(last.date) : (payment.packageEnd || payment.packageStart || ""),
  };
}

function paymentDisplayInfo(student, payment, index) {
  const { lessons, effectiveCount, startKey, endKey } = paymentPackageLessons(student, payment, index);
  const first = lessons[0];
  const last = lessons[lessons.length-1];
  const storedPeriod = startKey && endKey
    ? fmtShort(startKey)+" - "+fmtShort(endKey)
    : (payment.donem || "");
  const storedPeriodLong = startKey && endKey
    ? fmtDate(startKey)+" - "+fmtDate(endKey)
    : (payment.donem || "");
  const periodShort = first && last ? fmtShort(first.date)+" - "+fmtShort(last.date) : storedPeriod;
  const periodLong = first && last ? fmtDate(first.date)+" - "+fmtDate(last.date) : storedPeriodLong;
  const lessonCount = lessons.length || effectiveCount || PAYMENT_PACK_SIZE;
  const program = paymentProgramSnapshot(payment);
  const expectedPackageAmount = (student.ucret || 0) * (lessonCount / PAYMENT_PACK_SIZE);
  const numericAmount = typeof payment.tutar === "number" ? payment.tutar : null;
  const amountToShow = numericAmount;
  return {
    periodShort: payment.sadeceEkDers ? "Ek ders ödemesi" : periodShort,
    periodLong: payment.sadeceEkDers ? "Paket dışı ek ders" : periodLong,
    lessonCount: payment.sadeceEkDers ? 0 : lessonCount,
    program,
    amount: typeof amountToShow === "number" ? amountToShow.toLocaleString("tr-TR")+" TL" : (student.ucret ? expectedPackageAmount.toLocaleString("tr-TR")+" TL" : payment.tutar),
    paidAt: fmtMed(payment.tarih),
    delayText: typeof payment.gecikmeGunu === "number" ? (payment.gecikmeGunu > 0 ? payment.gecikmeGunu+" gün gecikti" : "Zamanında") : "",
    extra: payment.ekDersSayisi > 0 ? "+"+payment.ekDersSayisi+" ek ders" : "",
    extraOnly: !!payment.sadeceEkDers,
    startKey,
    endKey,
    inferredPackage: !payment.packageStart || !payment.packageEnd || !Array.isArray(payment.packageLessonIds) || payment.packageLessonIds.length === 0,
  };
}

function dataQualityIssues(students) {
  const issues = [];
  students.forEach(student => {
    (student.odemeler || []).forEach((payment, index) => {
      if (payment.sadeceEkDers) return;
      const info = paymentDisplayInfo(student, payment, index);
      if (info.inferredPackage) {
        issues.push({
          type:"Ödeme",
          level:"warning",
          student,
          text:"Ödeme dönemi tahminle gösteriliyor. Düzelt ekranından Kaydet yapınca kalıcılaşır.",
          detail:(info.periodShort || payment.donem || "Dönem bulunamadı")+" · "+fmtMed(payment.tarih),
        });
      }
      if (!info.startKey || !info.endKey) {
        issues.push({
          type:"Ödeme",
          level:"danger",
          student,
          text:"Ödemenin kapsadığı dersler bulunamadı.",
          detail:fmtMed(payment.tarih)+" · "+(payment.tutar || ""),
        });
      }
    });

    (student.schedule || []).forEach(lesson => {
      if (!lesson.date) {
        issues.push({ type:"Ders", level:"danger", student, text:"Ders tarihinde eksik kayıt var.", detail:lesson.id || "" });
      }
      if (lesson.status === "upcoming" && !lesson.time && !timeFromISO(lesson.date)) {
        issues.push({ type:"Ders", level:"warning", student, text:"Planlı derste saat bilgisi eksik.", detail:fmtShort(lesson.date) });
      }
    });
  });
  return issues;
}

function paymentHabitStats(student) {
  const payments = (student.odemeler || []).filter(o => !o.sadeceEkDers);
  const withDelay = payments
    .filter(o => typeof o.gecikmeGunu === "number")
    .sort((a,b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime())
    .slice(-3);
  if (!withDelay.length) return null;
  const onTime = withDelay.filter(o => o.gecikmeGunu === 0).length;
  const totalDelay = withDelay.reduce((sum,o)=>sum+(o.gecikmeGunu||0),0);
  const avgDelay = totalDelay / withDelay.length;
  const onTimeRate = Math.round((onTime / withDelay.length) * 100);
  const scores = withDelay.map(o => paymentDelayScore(o.gecikmeGunu || 0));
  const score = scores.reduce((sum,n)=>sum+n,0) / scores.length;
  return {
    total: withDelay.length,
    onTime,
    onTimeRate,
    avgDelay,
    lastDelay: withDelay[withDelay.length - 1]?.gecikmeGunu || 0,
    score,
  };
}

function paymentHabitLabel(stats) {
  if (!stats) return "";
  if (stats.onTimeRate >= 80 && stats.avgDelay <= 1) return "Düzenli";
  if (stats.onTimeRate >= 50 && stats.avgDelay <= 4) return "Ara sıra gecikir";
  return "Sık gecikir";
}

function paymentDelayScore(days) {
  if (days <= 0) return 10;
  if (days <= 3) return 8;
  if (days <= 7) return 6;
  if (days <= 14) return 4;
  return 2;
}

function attendanceScoreForStatus(status) {
  const scores = { completed:10, telafi:4, lastminute:1, noshow:0 };
  return scores[status] ?? null;
}

function attendanceStats(student) {
  const lessons = (student.schedule || [])
    .filter(l => SCORE_STATUSES.includes(l.status))
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0,12);
  if (!lessons.length) return null;
  const scores = lessons.map(l => attendanceScoreForStatus(l.status)).filter(n => n !== null);
  if (!scores.length) return null;
  const score = scores.reduce((sum,n)=>sum+n,0) / scores.length;
  const attended = lessons.filter(l => l.status === "completed").length;
  return {
    score,
    total: lessons.length,
    attended,
    attendedRate: Math.round((attended / lessons.length) * 100),
  };
}

function ekDersFee(student) {
  return (student.ucret || 0) / PAYMENT_PACK_SIZE;
}

function unpaidEkDersler(student) {
  return (student.ek_dersler || []).filter(e => !e.odendi && e.status !== "cancelled");
}

function nextRaiseDate(student) {
  if (!student.last_raise_date) return null;
  return addMonths(student.last_raise_date, 6);
}

function isRaiseDue(student) {
  if (student.frozen || isStudentLeft(student) || !student.last_raise_date) return false;
  const next = nextRaiseDate(student);
  return next ? midday(new Date(next)) <= midday() : false;
}

function ekDersStatusLabel(status) {
  const m = { planned:"Planlandı", done:"Yapıldı", cancelled:"İptal" };
  return m[status] || "Planlandı";
}

function ekDersTypeLabel(type) {
  const m = { online:"Online", physical:"Fiziki" };
  return m[type] || "Fiziki";
}

function hasPaymentForPackage(student, info) {
  if (!info) return false;
  const payments = (student.odemeler || []).filter(o => !o.sadeceEkDers);
  return payments.some((o, i) => {
    if (info.packageId) {
      return (
        o.packageId === info.packageId ||
        o.packageStart === info.startKey ||
        o.package_index === info.packageIndex ||
        o.packageIndex === info.packageIndex ||
        i === info.packageIndex
      );
    }
    return (
      o.packageStart === info.startKey ||
      o.package_index === info.packageIndex ||
      o.packageIndex === info.packageIndex ||
      i === info.packageIndex
    );
  });
}

function nextPayablePackageInfo(student) {
  if (student.frozen) return null;
  return [...customPackageInfos(student), ...regularPackageInfos(student)].find(info => info.complete && !hasPaymentForPackage(student, info)) || null;
}

function lastUndoablePackageInfo(student) {
  const sortedSchedule = [...(student.schedule || [])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const lastLesson = sortedSchedule[sortedSchedule.length - 1];
  if (lastLesson?.packageId) {
    const lessons = sortedSchedule.filter(l => l.packageId === lastLesson.packageId);
    if (lessons.length && lessons.every(l => l.status === "upcoming")) {
      const first = lessons[0];
      const last = lessons[lessons.length - 1];
      return {
        packageId: lastLesson.packageId,
        packageSize: lessons.length,
        expectedPackageSize: parseInt(lastLesson.packageLessonCount || lessons.length || PAYMENT_PACK_SIZE) || PAYMENT_PACK_SIZE,
        complete: true,
        lessonIds: lessons.map(l=>l.id).filter(Boolean),
        start: first.date,
        end: last.date,
        startKey: dateKey(first.date),
        endKey: dateKey(last.date),
        donem: fmtShort(first.date)+" - "+fmtShort(last.date),
      };
    }
  }
  const infos = packageInfos(student);
  const last = infos[infos.length - 1];
  if (!last) return null;
  const ids = new Set(last.lessonIds || []);
  const lessons = (student.schedule || []).filter(l => ids.has(l.id));
  if (!lessons.length) return null;
  return lessons.every(l => l.status === "upcoming") ? last : null;
}

function undoablePackagePreview(student, info) {
  if (!info) return "";
  const ids = new Set(info.lessonIds || []);
  return (student.schedule || [])
    .filter(l => ids.has(l.id))
    .sort((a,b)=>new Date(a.date)-new Date(b.date))
    .map(l => fmtShort(l.date)+" "+lessonTime(student, l))
    .join(" · ");
}

function packageSummaryKey(info) {
  if (!info) return "";
  return [info.startKey, info.endKey, info.packageSize].filter(Boolean).join("|");
}

function reminderKey(info) {
  if (!info) return "";
  return "ders|" + info;
}

function lastCompletedPackageInfo(student) {
  const schedule = student.schedule || [];
  const infos = [...customPackageInfos(student), ...regularPackageInfos(student)].sort((a,b)=>new Date(a.start)-new Date(b.start));
  return [...infos].reverse().find(info => {
    const ids = new Set(info.lessonIds || []);
    const lessons = schedule.filter(l => ids.has(l.id));
    return lessons.length > 0 && lessons.every(l => l.status !== "upcoming");
  }) || null;
}

function summarySentInfo(student, info) {
  const key = packageSummaryKey(info);
  if (!key) return null;
  return (student.package_summary_logs || []).find(log => log.packageKey === key) || null;
}

function packageEvaluationLessons(student, info) {
  const ids = new Set(info?.lessonIds || []);
  return (student.schedule || [])
    .filter(lesson => ids.has(lesson.id))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function packageEvaluationStats(student, info) {
  if (!info) return null;
  const lessons = packageEvaluationLessons(student, info);
  if (!lessons.length) return null;
  const expectedLessonCount = Math.max(1, parseInt(info.expectedPackageSize || info.packageSize || lessons.length) || lessons.length);
  const attendedLessons = lessons.filter(lesson => lesson.status === "completed");
  const scoredLessons = attendedLessons.filter(lesson => storedLessonScore(lesson) !== null);
  const attendanceScore = roundedScore((attendedLessons.length / expectedLessonCount) * 100);
  const lessonAverage = scoredLessons.length
    ? roundedScore(scoredLessons.reduce((sum,lesson)=>sum+storedLessonScore(lesson),0) / scoredLessons.length)
    : 0;
  const missingScoreCount = attendedLessons.length - scoredLessons.length;
  return {
    lessons,
    expectedLessonCount,
    attendedLessons,
    scoredLessons,
    attendanceScore,
    lessonAverage,
    missingScoreCount,
    newEvaluationEligible:scoredLessons.length > 0 && missingScoreCount === 0,
  };
}

function periodEvaluationInfo(student, info) {
  const log = summarySentInfo(student, info);
  return log?.evaluation ? log : null;
}

function periodEvaluationScore(attendanceScore, lessonAverage, pieceScore) {
  return roundedScore(((Number(attendanceScore)||0) + (Number(lessonAverage)||0) + (Number(pieceScore)||0)) / 3);
}

function studentPieceHistory(student) {
  return (student.package_summary_logs || [])
    .map(log => {
      const name = String(log?.evaluation?.pieceName || "").trim();
      if (!name) return null;
      return {
        name,
        result:log.evaluation.pieceLabel || "Sonuç belirtilmedi",
        score:Number(log.evaluation.pieceScore),
        period:log.packageStart && log.packageEnd ? fmtShort(log.packageStart)+" - "+fmtShort(log.packageEnd) : "",
        date:new Date(log.packageEnd ? log.packageEnd+"T12:00:00" : (log.evaluatedAt || 0)),
      };
    })
    .filter(Boolean)
    .sort((a,b)=>b.date-a.date);
}

function invalidatePeriodEvaluationForLesson(student, lessonId) {
  if (!student || !lessonId) return student;
  const info = [...customPackageInfos(student), ...regularPackageInfos(student)].find(item => (item.lessonIds || []).includes(lessonId));
  const key = packageSummaryKey(info);
  if (!key) return student;
  const logs = student.package_summary_logs || [];
  if (!logs.some(log => log.packageKey === key && log.evaluation)) return student;
  return { ...student, package_summary_logs:logs.filter(log => log.packageKey !== key) };
}

function lessonEngagementStats(student, info) {
  const ids = new Set(info?.lessonIds || []);
  const lessons = (student.schedule || []).filter(l => ids.has(l.id) && l.status === "completed");
  const withStats = lessons.filter(l => l.activeMinutes || l.taskFocusMinutes || l.focusMinutes || l.productiveWindow || l.lessonFocus || l.focusSection);
  if (!withStats.length) return null;
  const totalActive = withStats.reduce((sum,l)=>sum+(parseInt(l.activeMinutes)||0),0);
  const totalDuration = withStats.reduce((sum,l)=>sum+getLessonDuration(student, l),0);
  const avgActiveRate = totalDuration ? Math.round((totalActive / totalDuration) * 100) : 0;
  const focusValues = withStats.map(l=>parseInt(l.taskFocusMinutes ?? l.task_focus_minutes ?? l.focusMinutes)||0).filter(Boolean);
  const avgFocus = focusValues.length ? focusValues.reduce((a,b)=>a+b,0) / focusValues.length : 0;
  const windowCounts = {};
  withStats.forEach(l => {
    const window = l.productiveWindow || l.productive_window || "";
    if (window) windowCounts[window] = (windowCounts[window] || 0) + 1;
  });
  const topWindow = Object.entries(windowCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "";
  return {
    lessonCount: withStats.length,
    totalActive,
    avgActiveRate,
    avgActive: totalActive / withStats.length,
    avgFocus,
    topWindow,
  };
}

function performanceSeries(student) {
  const monthly = new Map();
  (student.package_summary_logs || []).forEach(log => {
    const evaluatedAt = new Date(log?.evaluatedAt || "");
    const score = Number(log?.evaluation?.periodScore);
    if (!Number.isFinite(score) || isNaN(evaluatedAt.getTime()) || evaluatedAt.getTime() < PROGRESS_CHART_START_AT) return;
    const periodDate = log.packageEnd ? new Date(log.packageEnd+"T12:00:00") : evaluatedAt;
    if (isNaN(periodDate.getTime())) return;
    const key = periodDate.getFullYear()+"-"+String(periodDate.getMonth()+1).padStart(2,"0");
    const current = monthly.get(key) || { key, date:periodDate, scores:[] };
    current.scores.push(clamp(score, 0, 100));
    monthly.set(key, current);
  });
  return [...monthly.values()]
    .sort((a,b)=>a.date-b.date)
    .map(item => ({ ...item, score:roundedScore(item.scores.reduce((sum,value)=>sum+value,0) / item.scores.length) }))
    .slice(-12);
}

function monthShort(date) {
  return new Date(date).toLocaleDateString("tr-TR", { month:"short" }).replace(".", "");
}

function monthsCoveredText(points) {
  if (!points.length) return "mevcut";
  const first = new Date(points[0].date);
  const last = new Date(points[points.length - 1].date);
  const months = Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1);
  return months >= 6 ? "son 6 ayda" : "son " + months + " ayda";
}

function lessonStartInfo(student) {
  const raw = student.lesson_start_date || student.lessonStartDate;
  if (!raw) return "";
  const start = new Date(raw + "T12:00:00");
  if (isNaN(start.getTime())) return "";
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(years + " yıl");
  if (rest) parts.push(rest + " ay");
  return (parts.length ? parts.join(" ") : "1 aydan az") + " · Başlangıç: " + start.toLocaleDateString("tr-TR", { month:"long", year:"numeric" });
}

function asciiBar(value, max) {
  const safeMax = max > 0 ? max : 1;
  const total = clamp(Math.round(safeMax / 5), 1, 20);
  const filled = clamp(Math.round((parseInt(value) || 0) / 5), 0, total);
  return "█".repeat(filled) + "░".repeat(total - filled);
}

function trendText(values, label) {
  const clean = values.filter(n => Number.isFinite(n));
  if (clean.length < 2) return "";
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (last > first) return label + " " + fmtNumber(first, 1) + " dk'dan " + fmtNumber(last, 1) + " dk'ya çıkmış.";
  if (last < first) return label + " " + fmtNumber(first, 1) + " dk'dan " + fmtNumber(last, 1) + " dk'ya düşmüş.";
  return label + " " + fmtNumber(last, 1) + " dk seviyesinde dengeli ilerlemiş.";
}

function productiveWindowSummaryText(window) {
  if (!window) return "";
  return String(window).toLocaleLowerCase("tr-TR").includes("ders geneli")
    ? "En verimli zaman çoğunlukla dersin genelinde dengeli görülmüş."
    : "En verimli zaman çoğunlukla dersin " + window + " bölümünde görülmüş.";
}

function currentPackageInfoForLesson(student, lesson) {
  if (!lesson) return currentPaymentDueInfo(student) || nextPayablePackageInfo(student) || lastCompletedPackageInfo(student);
  return [...customPackageInfos(student), ...regularPackageInfos(student)].find(info => (info.lessonIds || []).includes(lesson.id)) || currentPaymentDueInfo(student) || nextPayablePackageInfo(student);
}

function packageLessonStatusText(lesson) {
  if (isToday(lesson.date) && lesson.status === "upcoming") return "Bugünkü ders";
  const m = {
    upcoming: "Planlandı",
    completed: "Katıldı",
    telafi: "Telafi",
    lastminute: "Katılmadı",
    noshow: "Katılmadı",
  };
  return m[lesson.status] || "Planlandı";
}

function packageStatusText(student, info) {
  if (!info) return "";
  const ids = new Set(info.lessonIds || []);
  const lessons = (student.schedule || [])
    .filter(l => ids.has(l.id))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  if (!lessons.length) return "";
  return lessons.map((l,i) => {
    const statusAndDate = packageLessonStatusText(l)+" - "+fmtShort(l.date);
    return (i+1)+". Ders: "+(isToday(l.date) && l.status === "upcoming" ? "*"+statusAndDate+"*" : statusAndDate);
  }).join("\n");
}

function lessonReminderSentInfo(student, lesson) {
  const key = reminderKey(lesson?.id || dateKey(lesson?.date));
  return (student.lesson_reminder_logs || []).find(log => log.lessonKey === key) || null;
}

function telafiReminderRef(record) {
  return "telafi-"+(record?.id || dateKey(telafiPlannedAt(record)));
}

function isPaymentDue(student) {
  return !!currentPaymentDueInfo(student);
}

const INSTRUMENTS = ["Davul","Piyano","Gitar"];
const DAYS = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const FOCUS_SECTIONS = ["Teknik çalışma","Ritim","Nota okuma","Parça çalışması","Doğaçlama","Teori","Tekrar"];
const EXPENSE_CATEGORIES = ["Kira","Elektrik","Su","İnternet","Öğretmen/Personel","Muhasebe/Vergi","Malzeme","Reklam","Diğer"];
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

function AçılırBugünBölümü({ title, color, children, style }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={style}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, margin:0, padding:0, background:"transparent", border:"none", color, fontWeight:700, fontSize:13, textAlign:"left", cursor:"pointer", fontFamily:"inherit" }}
      >
        <span>{title}</span>
        <span aria-hidden="true" style={{ fontSize:12, lineHeight:1 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div style={{ marginTop:10 }}>{children}</div> : null}
    </div>
  );
}

const CARD = { background:"#fff", border:"1px solid #e8e4de", borderRadius:18, boxShadow:"0 8px 28px rgba(38,30,48,.055)" };
const SECTION = { ...CARD, padding:"16px 18px", marginBottom:14 };

const MIZAN_UI_CSS = `
  :root{--crm-ink:#211e28;--crm-muted:#77717d;--crm-purple:#5b42d6;--crm-purple-dark:#4933ba;--crm-paper:#f6f4ef;--crm-card:#fff;--crm-border:#e8e4de;--crm-green:#1c9b70;--crm-red:#dc5d51}
  *{box-sizing:border-box}html,body,#root{margin:0;min-height:100%}html,body{background:#fff}#root{background:#fff;border:0!important;border-right:0!important;outline:0!important;box-shadow:none!important}
  body{color:var(--crm-ink);font-family:Inter,"Avenir Next",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  button,input,select,textarea{font:inherit}button{color:inherit}
  .crm-app{min-height:100vh;background:#fff;color:var(--crm-ink)}
  .crm-sidebar{position:fixed;inset:0 auto 0 0;width:245px;padding:30px 20px 22px;background:#fff;border-right:1px solid var(--crm-border);display:flex;flex-direction:column;z-index:30}
  .crm-brand{display:flex;align-items:center;gap:11px;padding:0 10px 32px}
  .crm-brand-mark{width:38px;height:38px;display:grid;place-items:center;background:var(--crm-purple);color:#fff;border-radius:13px 13px 13px 4px;font-size:19px;font-weight:900;box-shadow:0 8px 20px rgba(91,66,214,.22)}
  .crm-brand-copy strong{display:block;font-size:19px;letter-spacing:-.04em}.crm-brand-copy span{display:block;margin-top:2px;color:#9d96a4;font-size:9px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
  .crm-nav-label{margin:3px 13px 12px;color:#aaa4af;font-size:10px;font-weight:800;letter-spacing:.13em}
  .crm-nav{display:flex;flex-direction:column;gap:4px}
  .crm-nav-btn{width:100%;border:0;background:transparent;display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;color:#6e6975;font-weight:700;text-align:left;cursor:pointer;transition:.2s}
  .crm-nav-btn:hover,.crm-nav-btn.active{background:#eeeafd;color:var(--crm-purple)}
  .crm-nav-icon{width:22px;text-align:center;font-size:18px}.crm-nav-badge{margin-left:auto;min-width:20px;padding:3px 6px;border-radius:20px;background:#f2effb;color:var(--crm-purple);font-size:10px;text-align:center}
  .crm-sidebar-bottom{margin-top:auto}.crm-tip{margin:0 3px 18px;padding:15px;background:#f6f2e7;border-radius:14px;color:#7b7466;font-size:11px;line-height:1.5}.crm-tip strong{display:block;margin-bottom:4px;color:#5d5547;font-size:12px}
  .crm-side-action{width:100%;border:1px solid var(--crm-border);background:#fff;border-radius:11px;padding:10px 12px;margin-top:7px;text-align:left;font-size:11px;font-weight:750;cursor:pointer}.crm-side-action:hover{border-color:#c7bfd6;color:var(--crm-purple)}
  .crm-content{min-height:100vh;margin-left:245px;padding:38px clamp(28px,5vw,76px) 76px;max-width:1530px;background:var(--crm-paper)}
  .crm-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:28px}
  .crm-eyebrow{margin:0 0 8px;color:#9d96a4;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
  .crm-title{margin:0;font-size:clamp(29px,3vw,39px);font-weight:780;letter-spacing:-.045em}.crm-subtitle{margin:7px 0 0;color:var(--crm-muted);font-size:14px}
  .crm-header-actions{display:flex;gap:10px;padding-top:10px}.crm-primary,.crm-secondary{border:0;border-radius:12px;padding:12px 17px;font-weight:800;cursor:pointer;transition:.2s;white-space:nowrap}.crm-primary{background:var(--crm-purple);color:#fff;box-shadow:0 7px 20px rgba(91,66,214,.18)}.crm-primary:hover{background:var(--crm-purple-dark);transform:translateY(-1px)}.crm-secondary{background:#fff;border:1px solid var(--crm-border)}.crm-secondary:hover{border-color:#c7bfd6;color:var(--crm-purple)}
  .crm-page{max-width:1120px}.crm-page>div>div,.crm-page>div>div>div{transition:border-color .2s,box-shadow .2s}
  .crm-mobile-nav{display:none}
  .crm-login{min-height:100vh;display:grid;grid-template-columns:.82fr 1.18fr;background:#fbfaf7}.crm-login-brand{padding:clamp(42px,8vw,120px);display:flex;flex-direction:column;justify-content:center;background:var(--crm-purple);color:#fff;position:relative;overflow:hidden}.crm-login-brand:after{content:"";position:absolute;width:420px;height:420px;border:82px solid rgba(255,255,255,.045);border-radius:50%;right:-220px;bottom:-190px}.crm-login-brand .crm-brand-mark{background:#fff;color:var(--crm-purple);width:52px;height:52px;font-size:25px}.crm-login-brand h1{margin:20px 0 8px;font-size:42px;letter-spacing:-.05em}.crm-login-brand p{max-width:330px;color:rgba(255,255,255,.72);line-height:1.6}.crm-login-panel{display:grid;place-items:center;padding:28px}.crm-login-card{width:min(100%,430px)}.crm-login-card .crm-eyebrow{color:var(--crm-purple)}.crm-login-card h2{margin:0 0 8px;font-size:31px;letter-spacing:-.04em}.crm-login-card>p{margin:0 0 28px;color:var(--crm-muted);font-size:13px}.crm-login-card label{display:block;margin:0 0 7px;color:#756f7a;font-size:11px;font-weight:800}.crm-login-card input{width:100%;border:1px solid #ded9d3;background:#fff;border-radius:11px;padding:13px 14px;outline:none;color:var(--crm-ink)}.crm-login-card input:focus{border-color:var(--crm-purple);box-shadow:0 0 0 3px #eeeafd}.crm-login-card button{width:100%;margin-top:15px;border:0;border-radius:12px;padding:13px;background:var(--crm-purple);color:#fff;font-weight:800;cursor:pointer}
  .crm-login-card h2{color:var(--crm-ink)}
  .crm-loading{min-height:100vh;display:grid;place-items:center;background:var(--crm-paper);text-align:center}.crm-loading-mark{width:50px;height:50px;margin:0 auto 14px;display:grid;place-items:center;border-radius:17px 17px 17px 5px;background:var(--crm-purple);color:#fff;font-size:24px;box-shadow:0 10px 28px rgba(91,66,214,.22)}
  .crm-sheet-backdrop{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:20px;background:rgba(29,27,36,.52);backdrop-filter:blur(6px)}.crm-sheet{width:min(100%,560px);max-height:calc(100vh - 40px);overflow:hidden;background:#fff;border-radius:22px;box-shadow:0 25px 90px rgba(0,0,0,.22)}.crm-sheet-head{display:flex;justify-content:space-between;align-items:center;padding:20px 23px;border-bottom:1px solid var(--crm-border);background:#fff}.crm-sheet-head strong{display:block;font-size:18px;letter-spacing:-.025em}.crm-sheet-head span{display:block;margin-top:3px;color:#96909b;font-size:12px}.crm-sheet-close{width:34px;height:34px;border:0;border-radius:50%;background:#f4f1ee;color:#746e78;font-size:20px;cursor:pointer}.crm-sheet-body{padding:20px 23px 28px;max-height:calc(100vh - 124px);overflow-y:auto}
  @media(max-width:980px){.crm-content{padding-left:26px;padding-right:26px}.crm-sidebar{width:220px}.crm-content{margin-left:220px}}
  .crm-student-metrics{grid-template-columns:repeat(4,1fr)}
  .crm-student-info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
  .crm-student-info-item{min-width:0;padding:8px 13px;border-left:1px solid #ece8e4;font-size:12px;line-height:1.4}
  .crm-student-info-item:nth-child(3n+1){border-left:0;padding-left:0}.crm-student-info-item:nth-child(n+4){border-top:1px solid #ece8e4;padding-top:12px;margin-top:4px}
  .crm-student-info-label{display:block;margin-bottom:3px;color:#7b7680;font-size:10px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}.crm-student-info-value{display:block;color:#1c1921;font-weight:750;overflow-wrap:anywhere}
  @media(max-width:760px){.crm-sidebar{display:none}.crm-content{margin-left:0;padding:24px 17px 108px}.crm-topbar{align-items:center;margin-bottom:22px}.crm-title{font-size:27px}.crm-subtitle{max-width:235px;font-size:12px}.crm-header-actions .crm-secondary{display:none}.crm-primary{width:44px;height:44px;padding:0;font-size:0}.crm-primary:after{content:"+";font-size:25px;font-weight:500}.crm-mobile-nav{position:fixed;display:grid;grid-template-columns:repeat(8,1fr);left:8px;right:8px;bottom:8px;z-index:40;background:rgba(255,255,255,.95);backdrop-filter:blur(14px);border:1px solid var(--crm-border);border-radius:17px;padding:6px 3px;box-shadow:0 8px 30px rgba(38,30,48,.13)}.crm-mobile-nav button{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:transparent;color:#8d8691;font-size:7px;font-weight:700;padding:5px 1px;min-width:0}.crm-mobile-nav button span{font-size:18px}.crm-mobile-nav button.active{color:var(--crm-purple)}.crm-login{grid-template-columns:1fr}.crm-login-brand{display:none}.crm-login-panel{min-height:100vh;padding:24px}.crm-sheet-backdrop{place-items:end center;padding:0}.crm-sheet{max-height:92vh;border-radius:22px 22px 0 0}.crm-sheet-body{max-height:calc(92vh - 76px);padding:17px 18px 28px}.crm-student-metrics{grid-template-columns:repeat(2,1fr)}.crm-student-info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.crm-student-info-item:nth-child(3n+1){border-left:1px solid #ece8e4;padding-left:13px}.crm-student-info-item:nth-child(2n+1){border-left:0;padding-left:0}.crm-student-info-item:nth-child(n+3){border-top:1px solid #ece8e4;padding-top:12px;margin-top:4px}.crm-page [style*="grid-template-columns: repeat(6"],.crm-page [style*="grid-template-columns: repeat(7"]{grid-template-columns:repeat(2,1fr)!important}.crm-page [style*="gridTemplateColumns:\"repeat(6"],.crm-page [style*="gridTemplateColumns:\"repeat(7"]{grid-template-columns:repeat(2,1fr)!important}}
  @media(max-width:430px){.crm-content{padding-left:13px;padding-right:13px}.crm-title{font-size:24px}.crm-topbar{gap:10px}.crm-login-card h2{font-size:27px}}
`;

function StudentsNavIcon() {
  return <svg viewBox="0 0 28 28" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10" cy="8" r="3"/><circle cx="19" cy="10" r="2.5"/><path d="M3.5 23c.3-5.2 2.6-8 6.5-8s6.2 2.8 6.5 8"/><path d="M16.5 16.5c3.9-.8 6.6 1.2 7.5 5.5"/></svg>;
}

function TeachersNavIcon() {
  return <svg viewBox="0 0 28 28" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="16" height="12" rx="1.5"/><path d="M13 11l3-3 3 2 3-4"/><circle cx="5.5" cy="11" r="3"/><path d="M1.5 24v-4.5c0-3.2 1.5-5 4-5 2.6 0 4 1.8 4 5V24"/><path d="M8 15l5-4"/></svg>;
}

function CommunicationNavIcon() {
  return <svg viewBox="0 0 28 28" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M4 5.5h20v14H11l-5.5 4v-4H4z"/><path d="M8 10h12M8 14h8"/></svg>;
}

function TonePill({ children, tone="neutral" }) {
  const map = {
    neutral:{ bg:"#f3f4f6", color:"#374151" },
    good:{ bg:"#dcfce7", color:"#166534" },
    info:{ bg:"#dbeafe", color:"#1d4ed8" },
    warn:{ bg:"#ffedd5", color:"#c2410c" },
    danger:{ bg:"#fee2e2", color:"#991b1b" },
    special:{ bg:"#ede9fe", color:"#5b21b6" },
  };
  const s = map[tone] || map.neutral;
  return <span style={{ display:"inline-flex", alignItems:"center", minHeight:22, padding:"3px 8px", borderRadius:999, background:s.bg, color:s.color, fontSize:11, fontWeight:800, lineHeight:1, whiteSpace:"nowrap" }}>{children}</span>;
}

function MiniMetric({ label, value, tone="neutral" }) {
  const colorMap = { neutral:"#111827", good:"#047857", info:"#1d4ed8", warn:"#d97706", danger:"#dc2626", special:"#6d28d9" };
  return (
    <div style={{ background:"#f8fafc", border:"1px solid #eef2f7", borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
      <p style={{ margin:0, fontSize:21, lineHeight:1, fontWeight:900, color:colorMap[tone] || colorMap.neutral }}>{value}</p>
      <p style={{ margin:"5px 0 0", fontSize:10, color:"#64748b", fontWeight:800 }}>{label}</p>
    </div>
  );
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
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:6 }}>Açıklama (opsiyonel)</label>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 12px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", outline:"none", resize:"none", background:"#fafafa", color:"#111" }} />
    </div>
  );
}

function Sheet({ title, subtitle, onClose, onBack, children }) {
  return (
    <div className="crm-sheet-backdrop">
      <div className="crm-sheet">
        <div className="crm-sheet-head">
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {onBack ? <button onClick={onBack} aria-label="Geri" style={{ width:34, height:34, border:"none", borderRadius:"50%", background:"#f4f1ee", color:"#746e78", fontSize:20, lineHeight:1, cursor:"pointer", flexShrink:0 }}>←</button> : null}
            <div>
              <strong>{title}</strong>
              {subtitle && <span>{subtitle}</span>}
            </div>
          </div>
          <button className="crm-sheet-close" onClick={onClose} aria-label="Kapat">×</button>
        </div>
        <div className="crm-sheet-body">{children}</div>
      </div>
    </div>
  );
}

function ProgressChart({ student }) {
  const points = performanceSeries(student);
  if (!points.length) {
    return (
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"14px", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Gelişim Grafiği</p>
        <p style={{ margin:"8px 0 0", fontSize:13, color:"#94a3b8", fontWeight:700 }}>Grafik verileri 17 Ağustos 2026 tarihinden itibaren oluşacaktır. İlk yeni dönem değerlendirmesi henüz tamamlanmadı.</p>
      </div>
    );
  }
  const width = 640;
  const height = 360;
  const padL = 64;
  const padR = 22;
  const padT = 58;
  const padB = 62;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const slotW = innerW / points.length;
  const barW = Math.min(62, Math.max(20, slotW * .5));
  const xFor = (index) => padL + (slotW * index) + ((slotW - barW) / 2);
  const yFor = (score) => padT + (1 - clamp(score, 0, 100) / 100) * innerH;
  const last = points[points.length - 1].score;
  const chartId = "progress-chart-" + student.id;
  const filename = (student.name || "ogrenci").replace(/\s+/g, "-").toLowerCase()+"-gelisim-grafigi.png";
  const downloadPng = () => downloadSvgAsPng(chartId, filename, 4);
  const sendProgressPng = () => shareSvgAsPng(chartId, filename, student);

  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:8 }}>
        <div>
          <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Gelişim Grafiği</p>
          <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b", fontWeight:700 }}>Aylık dönem değerlendirme puanı</p>
        </div>
        <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#6d28d9" }}>Son puan: {fmtNumber(last)}/100</p>
      </div>
      <svg id={chartId} viewBox={`0 0 ${width} ${height}`} style={{ width:"100%", height:"auto", display:"block", background:"#fff" }} role="img" aria-label="Öğrenci gelişim grafiği" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        <text x={padL} y="24" fontSize="18" fontWeight="800" fill="#20202a" fontFamily="Arial, sans-serif">{student.name}</text>
        <text x={width-padR} y="24" textAnchor="end" fontSize="13" fontWeight="700" fill="#6d28d9" fontFamily="Arial, sans-serif">Son puan: {fmtNumber(last)}/100</text>
        {[0,20,40,60,80,100].map(tick => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={width-padR} y1={y} y2={y} stroke={tick===0?"#bdb5c8":"#eeeaf2"} strokeWidth={tick===0?"1.5":"1"} />
              <text x={padL-10} y={y+4} textAnchor="end" fontSize="12" fill="#716a7d" fontFamily="Arial, sans-serif">{tick}</text>
            </g>
          );
        })}
        <line x1={padL} x2={padL} y1={padT} y2={height-padB} stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1={padL} x2={width-padR} y1={height-padB} y2={height-padB} stroke="#cbd5e1" strokeWidth="1.5" />
        {points.map((p,i) => (
          <g key={p.key}>
            <rect x={xFor(i)} y={yFor(p.score)} width={barW} height={Math.max(0, height-padB-yFor(p.score))} rx="7" fill="#7c3aed" />
            <text x={xFor(i)+(barW/2)} y={yFor(p.score)-10} textAnchor="middle" fontSize="12" fontWeight="800" fill="#4c1d95" fontFamily="Arial, sans-serif">{fmtNumber(p.score)}</text>
            <text x={xFor(i)+(barW/2)} y={height-padB+22} textAnchor="middle" fontSize="12" fontWeight="700" fill="#554e61" fontFamily="Arial, sans-serif">{monthShort(p.date)}</text>
          </g>
        ))}
        <text x="17" y={padT+(innerH/2)} transform={`rotate(-90 17 ${padT+(innerH/2)})`} textAnchor="middle" fontSize="12" fontWeight="700" fill="#554e61" fontFamily="Arial, sans-serif">Puan (0–100)</text>
        <text x={padL+(innerW/2)} y={height-9} textAnchor="middle" fontSize="12" fontWeight="700" fill="#554e61" fontFamily="Arial, sans-serif">Aylar</text>
      </svg>
      <p style={{ margin:"4px 0 10px", fontSize:11, color:"#64748b", fontWeight:700, textAlign:"center" }}>Her sütun, o ay tamamlanan dönem değerlendirmesini gösterir.</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <button onClick={downloadPng} style={{ background:"#eff6ff", color:"#1d4ed8", border:"none", borderRadius:10, padding:"9px 10px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Yüksek Kalite PNG İndir</button>
        <button onClick={sendProgressPng} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:10, padding:"9px 10px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>WhatsApp'tan Gönder</button>
      </div>
    </div>
  );
}

function svgAsPngBlob(svgId, scale=4) {
  const svg = document.getElementById(svgId);
  if (!svg) return Promise.resolve(null);
  const clone = svg.cloneNode(true);
  const viewBox = svg.viewBox?.baseVal;
  const width = viewBox?.width || 640;
  const height = viewBox?.height || 360;
  clone.setAttribute("width", String(width * scale));
  clone.setAttribute("height", String(height * scale));
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type:"image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob), "image/png", 1);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function savePngBlob(blob, filename) {
  if (!blob) return;
  const pngUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = pngUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(pngUrl), 1000);
}

async function downloadSvgAsPng(svgId, filename, scale=4) {
  savePngBlob(await svgAsPngBlob(svgId, scale), filename);
}

async function shareSvgAsPng(svgId, filename, student) {
  const blob = await svgAsPngBlob(svgId, 4);
  if (!blob) return;
  const text = "Merhaba,\n\n"+student.name+" için gelişim grafiğini sizinle paylaşıyorum.\n\nBodrum Sonsuz Sanat";
  const file = new File([blob], filename, { type:"image/png" });
  if (navigator.share && navigator.canShare?.({ files:[file] })) {
    try { await navigator.share({ files:[file], text, title:student.name+" Gelişim Grafiği" }); } catch {}
    return;
  }
  savePngBlob(blob, filename);
  const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
  if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text+"\n\nYüksek kaliteli grafik görselini bu mesaja ekleyebilirsiniz."), "_blank");
  else alert("Görsel indirildi. Öğrencinin WhatsApp telefon numarası kayıtlı değil.");
}

const INP = { width:"100%", border:"1px solid #ded9d3", borderRadius:11, padding:"12px 13px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", background:"#fff", color:"#211e28" };
const LBL = { display:"block", fontSize:11, fontWeight:750, color:"#756f7a", letterSpacing:.3, marginBottom:6, marginTop:15 };

function ActionSheet({ student, lessonId, onClose, onBack, onAction, onEvaluationMessage }) {
  const lesson = lessonId ? student.schedule.find(l=>l.id===lessonId) : student.schedule.find(l=>l.status==="upcoming");
  const previousHomework = homeworkForLessonCheck(student, lesson);
  const lessonCheckRef = homeworkCheckRef("lesson", lesson?.id);
  const checkedHomework = homeworkCheckedInOccurrence(student, lessonCheckRef);
  const homeworkToEvaluate = previousHomework || checkedHomework;
  const [step, setStep] = useState("main");
  const [note, setNote] = useState(lesson?.note || "");
  const [activeMinutes, setActiveMinutes] = useState(lesson?.activeMinutes ?? lesson?.active_minutes ?? "");
  const [taskFocusMinutes, setTaskFocusMinutes] = useState(lesson?.taskFocusMinutes ?? lesson?.task_focus_minutes ?? lesson?.focusMinutes ?? lesson?.focus_minutes ?? "");
  const [redirectionCount, setRedirectionCount] = useState(lesson?.redirectionCount ?? lesson?.redirection_count ?? "");
  const [lessonFocus, setLessonFocus] = useState(lesson?.lessonFocus || lesson?.lesson_focus || "");
  const [homework, setHomework] = useState(lesson?.homework || "");
  const [homeworkStatus, setHomeworkStatus] = useState(homeworkToEvaluate?.homeworkCheckedInRef === lessonCheckRef ? (homeworkToEvaluate.homeworkStatus || "") : "");
  const [formError, setFormError] = useState("");
  const activeTelafi = student.telafi_records.filter(r=>!r.done).length;
  const willWarn = activeTelafi === 4;
  const willFreeze = activeTelafi === 5;
  const reset = (s) => { setNote(s === "attended" ? (lesson?.note || "") : ""); setStep(s); };
  const act = (a) => onAction(a, note, lessonId || lesson?.id);

  const TelafiWarn = () => (
    <>
      {willWarn && <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#92400e", fontWeight:600 }}>Uyarı: Bu telafi ile 5. hakka ulaşılacak.</div>}
      {willFreeze && <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#991b1b", fontWeight:600 }}>Uyarı: 6. telafi limiti - program dondurulacak.</div>}
    </>
  );

  return (
    <Sheet title={student.name} subtitle={lesson ? fmtDate(lesson.date)+" - "+lessonTime(student, lesson) : ""} onClose={onClose} onBack={onBack}>
      {step === "main" && <>
        {lesson && lesson.status !== "upcoming" ? (
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:"10px 12px", marginBottom:12 }}>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Mevcut durum</p>
            <StatusPill status={lesson.status} />
            <div style={{ marginTop:10, borderTop:"1px solid #e2e8f0", paddingTop:9 }}>
              <p style={{ margin:"0 0 7px", fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Ders Verileri</p>
              {[
                ["Ders süresi", getLessonDuration(student, lesson)+" dk"],
                ["Aktif ders süresi", lesson.activeMinutes ?? lesson.active_minutes, " dk"],
                [lesson.taskFocusMinutes !== undefined || lesson.task_focus_minutes !== undefined ? "Görev odağını sürdürme" : "En uzun odaklanma", lesson.taskFocusMinutes ?? lesson.task_focus_minutes ?? lesson.focusMinutes ?? lesson.focus_minutes, " dk"],
                ["Yeniden yönlendirme", lesson.redirectionCount ?? lesson.redirection_count, " kez"],
                [lesson.lessonFocus || lesson.lesson_focus ? "Dersin temel odağı" : "Dersin güçlü bölümü", lesson.lessonFocus || lesson.lesson_focus || lesson.focusSection || lesson.focus_section],
                ["En verimli zaman", lesson.productiveWindow || lesson.productive_window],
              ].filter(([,value])=>value !== undefined && value !== null && value !== "").map(([label,value,suffix=""]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:5, fontSize:12 }}>
                  <span style={{ color:"#64748b" }}>{label}</span>
                  <span style={{ color:"#0f172a", fontWeight:700, textAlign:"right" }}>{value}{suffix}</span>
                </div>
              ))}
              {storedLessonScore(lesson) !== null ? <div style={{ margin:"9px 0 0", background:"#ecfdf5", border:"1px solid #a7f3d0", borderRadius:10, padding:"10px 11px" }}>
                <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#047857", letterSpacing:.5 }}>DERS VERİM PUANI</p>
                <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:900, color:"#065f46" }}>{fmtNumber(storedLessonScore(lesson))}/100</p>
                {lesson.lessonScoreBreakdown ? <p style={{ margin:"5px 0 0", fontSize:11, color:"#047857" }}>{lesson.lessonScoreBreakdown.homeworkApplicable === false ? "Ödev değerlendirilmedi" : "Ödev "+lesson.lessonScoreBreakdown.homework+"/40"} · Aktif süre {lesson.lessonScoreBreakdown.active}/10 · Görev odağı {lesson.lessonScoreBreakdown.taskFocus}/20 · Yönlendirme {lesson.lessonScoreBreakdown.redirection}/30</p> : null}
              </div> : null}
              <div style={{ marginTop:7, background:"#fff", border:"1px solid #e2e8f0", borderRadius:9, padding:"8px 9px" }}>
                <p style={{ margin:0, fontSize:10, fontWeight:800, color:"#94a3b8", letterSpacing:.5 }}>ÖĞRETMEN NOTU</p>
                <p style={{ margin:"4px 0 0", fontSize:12, color:lesson.note?"#334155":"#94a3b8", whiteSpace:"pre-wrap" }}>{lesson.note || "Bu ders için not girilmemiş."}</p>
              </div>
              {checkedHomework ? <div style={{ marginTop:7, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:9, padding:"8px 9px" }}>
                <p style={{ margin:0, fontSize:10, fontWeight:800, color:"#92400e", letterSpacing:.5 }}>BU DERSTE KONTROL EDİLEN ÖDEV</p>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"#78350f", whiteSpace:"pre-wrap" }}>{checkedHomework.homework}</p>
                <p style={{ margin:"5px 0 0", fontSize:11, color:"#92400e", fontWeight:800 }}>{homeworkStatusLabel(checkedHomework.homeworkStatus)}</p>
                {checkedHomework.homeworkCheckNote ? <p style={{ margin:"4px 0 0", fontSize:11, color:"#78350f", whiteSpace:"pre-wrap" }}>{checkedHomework.homeworkCheckNote}</p> : null}
              </div> : null}
              {lesson.homework ? <div style={{ marginTop:7, background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:9, padding:"8px 9px" }}>
                <p style={{ margin:0, fontSize:10, fontWeight:800, color:"#6d28d9", letterSpacing:.5 }}>BU DERSTE VERİLEN ÖDEV</p>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"#4c1d95", whiteSpace:"pre-wrap" }}>{lesson.homework}</p>
                <p style={{ margin:"5px 0 0", fontSize:11, color:"#6d28d9", fontWeight:800 }}>{homeworkStatusLabel(lesson.homeworkStatus)}</p>
                {lesson.homeworkCheckNote ? <p style={{ margin:"4px 0 0", fontSize:11, color:"#4c1d95", whiteSpace:"pre-wrap" }}>{lesson.homeworkCheckNote}</p> : null}
              </div> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:12, color:"#64748b" }}>Yanlış işaretlendiyse aşağıdan düzeltebilirsin.</p>
          </div>
        ) : null}
        {lesson?.status === "completed" && storedLessonScore(lesson) !== null ? <>
          <Btn bg="#10b981" onClick={() => reset("attended")}>Ders Verilerini Düzenle</Btn>
          <Btn bg="#25D366" onClick={() => onEvaluationMessage(lesson)}>WhatsApp Değerlendirmesini Tekrar Aç</Btn>
        </> : <Btn bg="#10b981" onClick={() => reset("attended")}>Katıldı</Btn>}
        {lesson?.status === "completed" && storedLessonScore(lesson) !== null ? null : <>
          <Btn bg="#1f2937" onClick={() => reset("yapildi")}>Yapıldı Say</Btn>
          <Btn bg="#3b82f6" onClick={() => reset("telafi")}>Telafi Hakkı Oluştur</Btn>
        </>}
        {lesson && lesson.status !== "upcoming" ? <Btn bg="#6b7280" onClick={() => act("reset-upcoming")}>Planlandıya Geri Al</Btn> : null}
      </>}
      {step === "telafi" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>24 saat önceden iptal</p>
        <TelafiWarn />
        <NoteArea value={note} onChange={setNote} placeholder="Neden iptal edildi?" />
        <Btn bg="#3b82f6" onClick={() => act("telafi")}>Telafi Hakkı Oluştur</Btn>
        <Btn bg="#111" outline onClick={() => reset("main")}>Geri</Btn>
      </>}
      {step === "attended" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Ders verim bilgilerini gir.</p>
        {homeworkToEvaluate ? <div style={{ background:"#fffbeb", border:`1px solid ${formError && !homeworkStatus?"#ef4444":"#fde68a"}`, borderRadius:12, padding:"11px 12px", marginBottom:14 }}>
          <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#92400e", letterSpacing:.5 }}>ÖNCEKİ ÖDEV KONTROLÜ</p>
          <p style={{ margin:"5px 0 10px", fontSize:13, color:"#78350f", whiteSpace:"pre-wrap" }}>{homeworkToEvaluate.homework}</p>
          <select style={{ ...INP, borderColor:formError && !homeworkStatus?"#ef4444":"#ded9d3" }} value={homeworkStatus} onChange={event=>{ setHomeworkStatus(event.target.value); setFormError(""); }}>
            <option value="">Durumu seçin</option>
            <option value="done">Yaptı</option>
            <option value="partial">Kısmen Yaptı</option>
            <option value="not_done">Yapmadı</option>
          </select>
        </div> : null}
        <label style={{ ...LBL, marginTop:0 }}>Aktif Ders Süresi (dk)</label>
        <input style={INP} type="number" min={0} max={getLessonDuration(student, lesson)} value={activeMinutes} onChange={e=>{ setActiveMinutes(e.target.value); setFormError(""); }} placeholder="Örn. 35" />
        <label style={LBL}>Görev Odağını Sürdürme (en uzun / yaklaşık dk)</label>
        <input style={INP} type="number" min={0} max={getLessonDuration(student, lesson)} value={taskFocusMinutes} onChange={e=>{ setTaskFocusMinutes(e.target.value); setFormError(""); }} placeholder="Örn. 17" />
        <label style={LBL}>Yeniden Yönlendirme Sayısı</label>
        <input style={INP} type="number" min={0} step={1} value={redirectionCount} onChange={e=>{ setRedirectionCount(e.target.value); setFormError(""); }} placeholder="Örn. 2" />
        <label style={LBL}>Dersin Temel Odağı</label>
        <select style={INP} value={lessonFocus} onChange={e=>{ setLessonFocus(e.target.value); setFormError(""); }}>
          <option value="">Seçin</option>
          {LESSON_FOCUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={LBL}>Öğretmen Notu</label>
        <NoteArea value={note} onChange={value=>{ setNote(value); setFormError(""); }} placeholder="Kısa not" />
        <label style={LBL}>Gelecek Ders İçin Ödev</label>
        <NoteArea value={homework} onChange={value=>{ setHomework(value); setFormError(""); }} placeholder="Örn. Beyer 1, sayfa 24–25; sağ el çalışılacak." />
        {formError ? <p style={{ margin:"8px 0 0", fontSize:12, color:"#dc2626", fontWeight:800 }}>{formError}</p> : null}
        <Btn bg="#10b981" onClick={() => {
          const duration = getLessonDuration(student, lesson);
          if (homeworkToEvaluate && !homeworkStatus) { setFormError("Ödev durumunu seçin."); return; }
          if (activeMinutes === "" || parseInt(activeMinutes) < 0 || parseInt(activeMinutes) > duration) { setFormError("Geçerli aktif ders süresi girin."); return; }
          if (taskFocusMinutes === "" || parseInt(taskFocusMinutes) < 0 || parseInt(taskFocusMinutes) > duration) { setFormError("Geçerli görev odağı süresi girin."); return; }
          if (redirectionCount === "" || parseInt(redirectionCount) < 0) { setFormError("Yeniden yönlendirme sayısını girin; gerekmediyse 0 yazın."); return; }
          if (!lessonFocus) { setFormError("Dersin temel odağını seçin."); return; }
          if (!note.trim()) { setFormError("Öğretmen notunu girin."); return; }
          if (!homework.trim()) { setFormError("Gelecek ders ödevini girin."); return; }
          const scoreBreakdown = calculateLessonScore({
            homeworkStatus,
            homeworkApplicable:!!homeworkToEvaluate,
            activeMinutes,
            taskFocusMinutes,
            redirectionCount,
          });
          onAction("attended", {
            note:note.trim(),
            activeMinutes:parseInt(activeMinutes)||0,
            taskFocusMinutes:parseInt(taskFocusMinutes)||0,
            redirectionCount:parseInt(redirectionCount)||0,
            lessonFocus,
            lessonScore:scoreBreakdown.total,
            lessonScoreBreakdown:scoreBreakdown,
            homework:homework.trim(),
            previousHomeworkSource:homeworkToEvaluate?.homeworkSource || null,
            previousHomeworkSourceId:homeworkToEvaluate?.homeworkSourceId || null,
            homeworkStatus:homeworkToEvaluate ? homeworkStatus : "",
            evaluatedHomework:homeworkToEvaluate?.homework || "",
          }, lessonId || lesson?.id);
        }}>Katılımı Kaydet</Btn>
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
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Habersiz gelmedi - açıklama ekle</p>
        <NoteArea value={note} onChange={setNote} />
        <Btn bg="#ef4444" onClick={() => act("noshow")}>Kaydet</Btn>
        <Btn bg="#111" outline onClick={() => reset("yapildi")}>Geri</Btn>
      </>}
    </Sheet>
  );
}

function ResumeProgramSheet({ student, onClose, onResume }) {
  const today = localDateKey();
  const [startDate, setStartDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const upcomingCount = (student.schedule || []).filter(lesson => lesson.status === "upcoming").length;
  const preview = startDate && upcomingCount
    ? buildScheduleSlots(getStudentSlots(student), upcomingCount, new Date(startDate+"T12:00:00"), getLessonDuration(student))
    : [];
  const firstLesson = preview[0];
  const submit = async () => {
    if (!startDate || saving) return;
    setSaving(true);
    try {
      const saved = await onResume(startDate);
      if (saved !== false) onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title="Programı Devam Ettir" subtitle={student.name} onClose={onClose}>
      <p style={{ margin:"0 0 14px", fontSize:13, color:"#475569", lineHeight:1.55 }}>Öğrencinin yeniden derse başlayabileceği tarihi seçin. Bekleyen dersler sabit programındaki ilk uygun gün ve saatten itibaren yeniden sıralanır.</p>
      <label style={{ ...LBL, marginTop:0 }}>Derse Başlayabileceği Tarih</label>
      <input style={INP} type="date" min={today} value={startDate} onChange={event=>setStartDate(event.target.value)} />
      <div style={{ margin:"12px 0 16px", padding:"11px 12px", borderRadius:11, background:"#eff6ff", border:"1px solid #bfdbfe" }}>
        {firstLesson ? <>
          <p style={{ margin:0, fontSize:12, color:"#1e3a8a", fontWeight:800 }}>İlk ders: {fmtDate(firstLesson.date)} · {firstLesson.time}</p>
          <p style={{ margin:"4px 0 0", fontSize:11, color:"#475569" }}>{upcomingCount} bekleyen ders yeni tarihlere taşınacak. Geçmiş dersler değişmeyecek.</p>
        </> : <p style={{ margin:0, fontSize:12, color:"#475569" }}>Bekleyen ders bulunmuyor; öğrenci yalnızca aktif duruma alınacak.</p>}
      </div>
      <button disabled={saving || !startDate} onClick={submit} style={{ width:"100%", display:"block", marginBottom:8, border:"none", borderRadius:14, padding:"13px 16px", background:"#2563eb", color:"#fff", fontWeight:700, fontSize:14, cursor:saving?"wait":"pointer", opacity:saving?.7:1, fontFamily:"inherit" }}>{saving ? "Kaydediliyor..." : "Programı Devam Ettir"}</button>
      <Btn bg="#111" outline onClick={onClose}>Vazgeç</Btn>
    </Sheet>
  );
}

function TelafiSheet({ record, student, onClose, onSave, onPlanMessage, onEvaluationMessage }) {
  const plannedAt = telafiPlannedAt(record);
  const telafiCheckRef = homeworkCheckRef("telafi", record?.id);
  const previousHomework = homeworkForTelafiCheck(student, record);
  const checkedHomework = homeworkCheckedInOccurrence(student, telafiCheckRef);
  const homeworkToEvaluate = previousHomework || checkedHomework;
  const plannedDate = plannedAt ? dateKey(plannedAt) : new Date().toISOString().split("T")[0];
  const plannedTime = plannedAt ? timeFromISO(plannedAt) : (student?.time || "10:00");
  const [step, setStep] = useState(plannedAt || record.done ? "main" : "plan");
  const [date, setDate] = useState(plannedDate);
  const [time, setTime] = useState(plannedTime);
  const [duration, setDuration] = useState(record.plannedDurationMinutes || getLessonDuration(student));
  const [note, setNote] = useState(record.plannedNote || "");
  const [doneNote, setDoneNote] = useState(record?.doneNote || "");
  const [activeMinutes, setActiveMinutes] = useState(record?.activeMinutes ?? "");
  const [taskFocusMinutes, setTaskFocusMinutes] = useState(record?.taskFocusMinutes ?? record?.task_focus_minutes ?? record?.focusMinutes ?? "");
  const [redirectionCount, setRedirectionCount] = useState(record?.redirectionCount ?? record?.redirection_count ?? "");
  const [lessonFocus, setLessonFocus] = useState(record?.lessonFocus || record?.lesson_focus || "");
  const [homework, setHomework] = useState(record?.homework || "");
  const [homeworkStatus, setHomeworkStatus] = useState(homeworkToEvaluate?.homeworkCheckedInRef === telafiCheckRef ? (homeworkToEvaluate.homeworkStatus || "") : "");
  const [formError, setFormError] = useState("");
  const days = daysLeft(record.expiry);
  const expired = days !== null && days < 0;
  const urgent = !expired && days !== null && days <= 7;
  const savePlan = () => {
    onSave(record.id, {
      action: "plan",
      plannedAt: `${date}T${time}:00`,
      plannedDurationMinutes: parseInt(duration) || getLessonDuration(student),
      plannedNote: note,
    });
    onClose();
  };

  return (
    <Sheet title="Telafi Dersi" subtitle={student?.name} onClose={onClose}>
      <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#0369a1", letterSpacing:1 }}>İptal Edilen Ders</p>
        <p style={{ margin:"4px 0 0", fontSize:15, fontWeight:700, color:"#111" }}>{fmtDate(record.lessonDate)}</p>
        {record.note && <p style={{ margin:"4px 0 0", fontSize:13, color:"#475569", fontStyle:"italic" }}>{record.note}</p>}
      </div>
      <div style={{ background: expired?"#fee2e2":urgent?"#fffbeb":"#f0fdf4", border:`1px solid ${expired?"#fca5a5":urgent?"#fcd34d":"#bbf7d0"}`, borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#888", letterSpacing:1 }}>Son Geçerlilik</p>
            <p style={{ margin:"4px 0 0", fontSize:15, fontWeight:700, color: expired?"#dc2626":urgent?"#d97706":"#166534" }}>{fmtMed(record.expiry)}</p>
          </div>
          <div style={{ background: expired?"#dc2626":urgent?"#d97706":"#16a34a", color:"#fff", borderRadius:20, padding:"6px 14px", fontWeight:800, fontSize:14 }}>
            {expired ? "Süresi Doldu" : `${days} gün`}
          </div>
        </div>
      </div>
      {plannedAt ? (
        <div style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
          <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#7e22ce", letterSpacing:1 }}>Planlanan Telafi</p>
          <p style={{ margin:"4px 0 0", fontSize:15, fontWeight:800, color:"#111" }}>{fmtDate(plannedAt)} · {timeFromISO(plannedAt)}</p>
          <p style={{ margin:"4px 0 0", fontSize:12, color:"#64748b" }}>{record.plannedDurationMinutes || getLessonDuration(student)} dk</p>
          {record.plannedNote ? <p style={{ margin:"4px 0 0", fontSize:12, color:"#475569", fontStyle:"italic" }}>{record.plannedNote}</p> : null}
        </div>
      ) : null}
      {record.done && step === "main"
        ? <>
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>Telafi Yapıldı</p>
            {telafiDoneAt(record) && <p style={{ margin:"4px 0 0", fontSize:13, color:"#16a34a" }}>{telafiDoneDateText(record)}</p>}
            {telafiMetricText(record) ? <p style={{ margin:"4px 0 0", fontSize:13, color:"#166534" }}>{telafiMetricText(record)}</p> : null}
            {storedLessonScore(record) !== null ? <p style={{ margin:"6px 0 0", fontSize:15, color:"#065f46", fontWeight:900 }}>Ders Verim Puanı: {fmtNumber(storedLessonScore(record))}/100</p> : null}
            {record.doneNote ? <p style={{ margin:"4px 0 0", fontSize:12, color:"#475569", fontStyle:"italic" }}>{record.doneNote}</p> : null}
            {checkedHomework ? <div style={{ marginTop:9, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:9, padding:"8px 9px" }}>
              <p style={{ margin:0, fontSize:10, fontWeight:800, color:"#92400e", letterSpacing:.5 }}>BU TELAFİDE KONTROL EDİLEN ÖDEV</p>
              <p style={{ margin:"4px 0 0", fontSize:12, color:"#78350f", whiteSpace:"pre-wrap" }}>{checkedHomework.homework}</p>
              <p style={{ margin:"5px 0 0", fontSize:11, color:"#92400e", fontWeight:800 }}>{homeworkStatusLabel(checkedHomework.homeworkStatus)}</p>
              {checkedHomework.homeworkCheckNote ? <p style={{ margin:"4px 0 0", fontSize:11, color:"#78350f", whiteSpace:"pre-wrap" }}>{checkedHomework.homeworkCheckNote}</p> : null}
            </div> : null}
            {record.homework ? <div style={{ marginTop:9, background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:9, padding:"8px 9px" }}>
              <p style={{ margin:0, fontSize:10, fontWeight:800, color:"#6d28d9", letterSpacing:.5 }}>BU TELAFİDE VERİLEN ÖDEV</p>
              <p style={{ margin:"4px 0 0", fontSize:12, color:"#4c1d95", whiteSpace:"pre-wrap" }}>{record.homework}</p>
              <p style={{ margin:"5px 0 0", fontSize:11, color:"#6d28d9", fontWeight:800 }}>{homeworkStatusLabel(record.homeworkStatus)}</p>
            </div> : null}
          </div>
          {storedLessonScore(record) !== null ? <>
            <Btn bg="#10b981" onClick={() => setStep("attended")}>Telafi Verilerini Düzenle</Btn>
            <Btn bg="#25D366" onClick={() => onEvaluationMessage(record)}>WhatsApp Değerlendirmesini Tekrar Aç</Btn>
          </> : null}
          </>
        : step === "plan"
          ? <>
              <label style={{ ...LBL, marginTop:0 }}>Telafi Tarihi</label>
              <input style={INP} type="date" value={date} onChange={e=>setDate(e.target.value)} />
              <label style={LBL}>Telafi Saati</label>
              <select style={INP} value={time} onChange={e=>setTime(e.target.value)}>
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={LBL}>Ders Süresi</label>
              <input style={INP} type="number" min={15} step={5} value={duration} onChange={e=>setDuration(e.target.value)} />
              <label style={LBL}>Plan Notu</label>
              <NoteArea value={note} onChange={setNote} placeholder="Örn: Bu hafta uygunluk oluştu" />
              <Btn bg="#10b981" onClick={savePlan}>Telafiyi Planla</Btn>
              {plannedAt ? <Btn bg="#111" outline onClick={() => setStep("main")}>Geri</Btn> : null}
            </>
          : step === "attended"
            ? <>
                <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Telafi dersinin verim bilgilerini gir.</p>
                {homeworkToEvaluate ? <div style={{ background:"#fffbeb", border:`1px solid ${formError && !homeworkStatus?"#ef4444":"#fde68a"}`, borderRadius:12, padding:"11px 12px", marginBottom:14 }}>
                  <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#92400e", letterSpacing:.5 }}>ÖNCEKİ ÖDEV KONTROLÜ</p>
                  <p style={{ margin:"5px 0 10px", fontSize:13, color:"#78350f", whiteSpace:"pre-wrap" }}>{homeworkToEvaluate.homework}</p>
                  <select style={{ ...INP, borderColor:formError && !homeworkStatus?"#ef4444":"#ded9d3" }} value={homeworkStatus} onChange={event=>{ setHomeworkStatus(event.target.value); setFormError(""); }}>
                    <option value="">Durumu seçin</option>
                    <option value="done">Yaptı</option>
                    <option value="partial">Kısmen Yaptı</option>
                    <option value="not_done">Yapmadı</option>
                  </select>
                </div> : null}
                <label style={{ ...LBL, marginTop:0 }}>Aktif Ders Süresi (dk)</label>
                <input style={INP} type="number" min={0} max={duration} value={activeMinutes} onChange={e=>{ setActiveMinutes(e.target.value); setFormError(""); }} placeholder="Örn. 35" />
                <label style={LBL}>Görev Odağını Sürdürme (en uzun / yaklaşık dk)</label>
                <input style={INP} type="number" min={0} max={duration} value={taskFocusMinutes} onChange={e=>{ setTaskFocusMinutes(e.target.value); setFormError(""); }} placeholder="Örn. 17" />
                <label style={LBL}>Yeniden Yönlendirme Sayısı</label>
                <input style={INP} type="number" min={0} step={1} value={redirectionCount} onChange={e=>{ setRedirectionCount(e.target.value); setFormError(""); }} placeholder="Örn. 2" />
                <label style={LBL}>Dersin Temel Odağı</label>
                <select style={INP} value={lessonFocus} onChange={e=>{ setLessonFocus(e.target.value); setFormError(""); }}>
                  <option value="">Seçin</option>
                  {LESSON_FOCUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label style={LBL}>Öğretmen Notu</label>
                <NoteArea value={doneNote} onChange={value=>{ setDoneNote(value); setFormError(""); }} placeholder="Kısa not" />
                <label style={LBL}>Gelecek Ders İçin Ödev</label>
                <NoteArea value={homework} onChange={value=>{ setHomework(value); setFormError(""); }} placeholder="Örn. Beyer 1, sayfa 24–25; sağ el çalışılacak." />
                {formError ? <p style={{ margin:"8px 0 0", fontSize:12, color:"#dc2626", fontWeight:800 }}>{formError}</p> : null}
                <Btn bg="#10b981" onClick={() => {
                  const lessonDuration = parseInt(duration) || getLessonDuration(student);
                  if (homeworkToEvaluate && !homeworkStatus) { setFormError("Ödev durumunu seçin."); return; }
                  if (activeMinutes === "" || parseInt(activeMinutes) < 0 || parseInt(activeMinutes) > lessonDuration) { setFormError("Geçerli aktif ders süresi girin."); return; }
                  if (taskFocusMinutes === "" || parseInt(taskFocusMinutes) < 0 || parseInt(taskFocusMinutes) > lessonDuration) { setFormError("Geçerli görev odağı süresi girin."); return; }
                  if (redirectionCount === "" || parseInt(redirectionCount) < 0) { setFormError("Yeniden yönlendirme sayısını girin; gerekmediyse 0 yazın."); return; }
                  if (!lessonFocus) { setFormError("Dersin temel odağını seçin."); return; }
                  if (!doneNote.trim()) { setFormError("Öğretmen notunu girin."); return; }
                  if (!homework.trim()) { setFormError("Gelecek ders ödevini girin."); return; }
                  const scoreBreakdown = calculateLessonScore({ homeworkStatus, homeworkApplicable:!!homeworkToEvaluate, activeMinutes, taskFocusMinutes, redirectionCount });
                  onSave(record.id, {
                    action: "attended",
                    doneAt: plannedAt || `${date}T${time}:00`,
                    doneNote:doneNote.trim(),
                    activeMinutes: parseInt(activeMinutes) || 0,
                    taskFocusMinutes: parseInt(taskFocusMinutes) || 0,
                    redirectionCount: parseInt(redirectionCount) || 0,
                    lessonFocus,
                    lessonScore:scoreBreakdown.total,
                    lessonScoreBreakdown:scoreBreakdown,
                    homework:homework.trim(),
                    previousHomeworkSource:homeworkToEvaluate?.homeworkSource || null,
                    previousHomeworkSourceId:homeworkToEvaluate?.homeworkSourceId || null,
                    homeworkStatus:homeworkToEvaluate ? homeworkStatus : "",
                    evaluatedHomework:homeworkToEvaluate?.homework || "",
                  });
                  onClose();
                }}>Katılımı Kaydet</Btn>
                <Btn bg="#111" outline onClick={() => setStep("main")}>Geri</Btn>
              </>
            : step === "counted"
              ? <>
                  <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Neden yapıldı sayılıyor?</p>
                  <NoteArea value={doneNote} onChange={setDoneNote} placeholder="Açıklama" />
                  <Btn bg="#f97316" onClick={() => {
                    onSave(record.id, { action: "counted", doneAt: plannedAt || `${date}T${time}:00`, doneNote });
                    onClose();
                  }}>Kaydet</Btn>
                  <Btn bg="#111" outline onClick={() => setStep("main")}>Geri</Btn>
                </>
              : <>
                  <Btn bg="#25D366" onClick={() => onPlanMessage(record)}>Plan Mesajını Gönder</Btn>
                  <Btn bg="#10b981" onClick={() => setStep("attended")}>Katıldı</Btn>
                  <Btn bg="#f97316" onClick={() => setStep("counted")}>Yapıldı Say</Btn>
                  <Btn bg="#6366f1" onClick={() => setStep("plan")}>Planı Düzenle</Btn>
                </>
      }
    </Sheet>
  );
}

function ShiftSheet({ lesson, student, onClose, onShift, onMoveOne }) {
  const [moveDate, setMoveDate] = useState(dateKey(lesson.date) || new Date().toISOString().split("T")[0]);
  const [moveTime, setMoveTime] = useState(lessonTime(student, lesson) || student.time || "10:00");
  return (
    <Sheet title="Ders Tarihi Kaydır" subtitle={fmtDate(lesson.date)+" - "+lessonTime(student, lesson)} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>1/2 hafta ileri alırsan bu dersten sonraki planlı dersler de aynı şekilde kayar.</p>
      <Btn bg="#6366f1" onClick={() => { onShift(lesson.id, 7); onClose(); }}>1 Hafta İleri Al</Btn>
      <Btn bg="#8b5cf6" onClick={() => { onShift(lesson.id, 14); onClose(); }}>2 Hafta İleri Al</Btn>
      <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, padding:12, margin:"12px 0" }}>
        <p style={{ margin:"0 0 8px", fontSize:13, color:"#666" }}>Sadece bu dersi başka bir tarih ve saate taşı.</p>
        <input style={INP} type="date" value={moveDate} onChange={e=>setMoveDate(e.target.value)} />
        <div style={{ height:8 }} />
        <select style={INP} value={moveTime} onChange={e=>setMoveTime(e.target.value)}>
          {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ marginTop:10 }}>
          <Btn bg="#0ea5e9" onClick={() => { onMoveOne(lesson.id, moveDate, moveTime); onClose(); }}>Tarihe Taşı</Btn>
        </div>
      </div>
      <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
    </Sheet>
  );
}

function DuzenleSheet({ student, teachers, onClose, onDuzenle }) {
  const currentTeacherId = student.teacher_id || teachers.find(t => t.name === studentTeacherName(student))?.id || "";
  const [f, setF] = useState({
    name: student.name,
    teacher_id: currentTeacherId,
    teacher_change_date: new Date().toISOString().split("T")[0],
    phone: student.phone || "",
    veli_adi: student.veli_adi || "",
    dogum_tarihi: student.dogum_tarihi || "",
    lesson_start_date: student.lesson_start_date || student.lessonStartDate || "",
    ucret: student.ucret || "",
    last_raise_date: student.last_raise_date || "",
    instrument: student.instrument,
    day: student.day,
    time: student.time,
    lessonDuration: getLessonDuration(student),
    preferredPackageLessonCount: getPreferredPackageLessonCount(student),
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
      <label style={LBL}>Öğretmen</label>
      <select style={INP} value={f.teacher_id} onChange={e=>s("teacher_id",e.target.value)}>
        <option value="">Öğretmen seçin</option>
        {teachers.filter(t => t.active || t.id === currentTeacherId).map(t=><option key={t.id} value={t.id}>{t.name}{t.active ? "" : " (pasif)"}</option>)}
      </select>
      {f.teacher_id !== currentTeacherId ? <>
        <label style={LBL}>Öğretmen Değişiklik Tarihi</label>
        <input style={INP} type="date" value={f.teacher_change_date} onChange={e=>s("teacher_change_date",e.target.value)} />
      </> : null}
      <label style={LBL}>Veli Adı</label>
      <input style={INP} value={f.veli_adi} onChange={e=>s("veli_adi",e.target.value)} placeholder="Veli adı soyadı" />
      <label style={LBL}>Doğum Tarihi (opsiyonel)</label>
      <input style={INP} type="date" value={f.dogum_tarihi||""} onChange={e=>s("dogum_tarihi",e.target.value)} />
      <label style={LBL}>Derse Başlama Tarihi</label>
      <input style={INP} type="date" value={f.lesson_start_date||""} onChange={e=>s("lesson_start_date",e.target.value)} />
      <label style={LBL}>Telefon (WhatsApp)</label>
      <input style={INP} value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="905xxxxxxxxx" type="tel" />
      <label style={LBL}>4 Ders Ücreti (TL)</label>
      <input style={INP} value={f.ucret} onChange={e=>s("ucret",e.target.value)} placeholder="5600" type="number" />
      <label style={LBL}>Son Zam Tarihi</label>
      <input style={INP} type="date" value={f.last_raise_date||""} onChange={e=>s("last_raise_date",e.target.value)} />
      <label style={LBL}>Enstrüman</label>
      <select style={INP} value={f.instrument} onChange={e=>s("instrument",e.target.value)}>
        {INSTRUMENTS.map(i=><option key={i}>{i}</option>)}
      </select>
      <label style={LBL}>Ders Süresi</label>
      <select style={INP} value={f.lessonDuration} onChange={e=>s("lessonDuration",parseInt(e.target.value)||45)}>
        <option value={45}>45 dakika</option>
        <option value={30}>30 dakika</option>
      </select>
      <label style={LBL}>Varsayılan Paket Ders Sayısı</label>
      <select style={INP} value={f.preferredPackageLessonCount} onChange={e=>s("preferredPackageLessonCount",parseInt(e.target.value)||PAYMENT_PACK_SIZE)}>
        {PACKAGE_LOAD_OPTIONS.map(count => <option key={count} value={count}>{count} ders</option>)}
      </select>
      <label style={LBL}>Ders Günleri</label>
      {f.lessonSlots.map((slot,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:f.lessonSlots.length>1?"1fr 1fr 40px":"1fr 1fr", gap:10, alignItems:"end", marginBottom:8 }}>
          <div><select style={INP} value={slot.day} onChange={e=>setSlot(i,"day",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><select style={INP} value={slot.time} onChange={e=>setSlot(i,"time",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
          {f.lessonSlots.length>1 ? <button onClick={()=>removeSlot(i)} style={{ height:40, border:"none", borderRadius:10, background:"#fee2e2", color:"#991b1b", fontWeight:800, cursor:"pointer" }}>x</button> : null}
        </div>
      ))}
      <button onClick={addSlot} style={{ width:"100%", background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, padding:"10px 12px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginTop:2 }}>+ Ders günü ekle</button>
      <div style={{ marginTop:16 }}>
        <Btn bg="#111" onClick={() => { if(f.name.trim() && f.teacher_id){ onDuzenle(student.id, f); onClose(); } }}>Kaydet</Btn>
        <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function EkDersSheet({ student, onClose, onEkDersEkle }) {
  const now = new Date();
  const [date, setDate] = useState(now.toISOString().split("T")[0]);
  const [time, setTime] = useState("10:00");
  const [type, setType] = useState("physical");
  const [status, setStatus] = useState("planned");
  const [duration, setDuration] = useState(getLessonDuration(student));
  const [note, setNote] = useState("");
  const fee = ekDersFee(student);
  return (
    <Sheet title="Ek Ders Ekle" subtitle={student.name} onClose={onClose}>
      <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Bu ders döneme dahil değil, ayrıca ücretlendirilecek.</p>
      <label style={LBL}>Tarih</label>
      <input style={INP} type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <label style={LBL}>Saat</label>
      <select style={INP} value={time} onChange={e=>setTime(e.target.value)}>
        {TIMES.map(t=><option key={t}>{t}</option>)}
      </select>
      <label style={LBL}>Ders Süresi</label>
      <select style={INP} value={duration} onChange={e=>setDuration(parseInt(e.target.value)||45)}>
        <option value={45}>45 dakika</option>
        <option value={30}>30 dakika</option>
      </select>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>
          <label style={LBL}>Tür</label>
          <select style={INP} value={type} onChange={e=>setType(e.target.value)}>
            <option value="physical">Fiziki</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div>
          <label style={LBL}>Durum</label>
          <select style={INP} value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="planned">Planlandı</option>
            <option value="done">Yapıldı</option>
          </select>
        </div>
      </div>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginTop:12, fontSize:13, color:"#166534", fontWeight:700 }}>
        Ek ders ücreti: {fee.toLocaleString("tr-TR")} TL
      </div>
      <label style={LBL}>Not (opsiyonel)</label>
      <input style={INP} value={note} onChange={e=>setNote(e.target.value)} placeholder="Konu vb." />
      <div style={{ marginTop:16 }}>
        <Btn bg="#6366f1" onClick={() => { onEkDersEkle(student.id, { id:uid(), date: date+"T"+time+":00", type, status, durationMinutes:duration, fee, odendi:false, note, createdAt: new Date().toISOString() }); onClose(); }}>Ek Ders Kaydet</Btn>
        <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function PaymentHistoryItem({ student, payment, index, onPaymentEdit, onPaymentDelete }) {
  const info = paymentDisplayInfo(student, payment, index);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(payment.tarih || new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState(typeof payment.tutar === "number" ? String(payment.tutar) : "");
  const [startKey, setStartKey] = useState(payment.packageStart || info.startKey || "");
  const [endKey, setEndKey] = useState(payment.packageEnd || payment.packageStart || info.endKey || info.startKey || "");
  const lessonOptions = [...(student.schedule||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  return (
    <div style={{ borderBottom:"1px solid #f0f0f0", padding:"8px 0" }}>
      <button onClick={() => setOpen(v=>!v)} style={{ width:"100%", background:"transparent", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div style={{ minWidth:0 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#111" }}>{info.paidAt}</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#6b7280", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{info.periodShort}</p>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#111" }}>{info.amount}</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#9ca3af" }}>{open ? "▲" : "▼"}</p>
          </div>
        </div>
      </button>
      {open ? (
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 12px", marginTop:8 }}>
          <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:800, color:"#9ca3af", letterSpacing:1 }}>Ödenen dönem</p>
          <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:"#111" }}>{info.periodLong || "Dönem bilgisi yok"}</p>
          <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:800, color:"#9ca3af", letterSpacing:1 }}>Kapsam</p>
          <p style={{ margin:"0 0 8px", fontSize:13, color:"#374151" }}>{info.extraOnly ? (info.extra || "Ek ders") : info.lessonCount+" ders"+(info.extra ? " · "+info.extra : "")}</p>
          {info.delayText ? (
            <>
              <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:800, color:"#9ca3af", letterSpacing:1 }}>Ödeme Alışkanlığı</p>
              <p style={{ margin:"0 0 8px", fontSize:13, color:payment.gecikmeGunu>0?"#be123c":"#059669", fontWeight:700 }}>{info.delayText}</p>
            </>
          ) : null}
          {info.program ? (
            <>
              <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:800, color:"#9ca3af", letterSpacing:1 }}>Program</p>
              <p style={{ margin:0, fontSize:13, color:"#374151" }}>{info.program}</p>
            </>
          ) : null}
          {editing ? (
            <div style={{ marginTop:10 }}>
              <label style={{ ...LBL, marginTop:0 }}>Ödeme Tarihi</label>
              <input style={INP} type="date" value={date} onChange={e=>setDate(e.target.value)} />
              <label style={LBL}>Tutar (TL)</label>
              <input style={INP} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Örn. 5600" />
              <label style={LBL}>Kapsadığı İlk Ders</label>
              <select style={INP} value={startKey} onChange={e=>setStartKey(e.target.value)}>
                <option value="">Seçilmedi</option>
                {lessonOptions.map(l => <option key={l.id} value={dateKey(l.date)}>{fmtDate(l.date)} - {lessonTime(student, l)}</option>)}
              </select>
              <label style={LBL}>Kapsadığı Son Ders</label>
              <select style={INP} value={endKey} onChange={e=>setEndKey(e.target.value)}>
                <option value="">Seçilmedi</option>
                {lessonOptions.map(l => <option key={l.id} value={dateKey(l.date)}>{fmtDate(l.date)} - {lessonTime(student, l)}</option>)}
              </select>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
                <button onClick={() => { onPaymentEdit(index, { tarih:date, tutar:amount, packageStart:startKey, packageEnd:endKey }); setEditing(false); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"9px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Kaydet</button>
                <button onClick={() => { setDate(payment.tarih || ""); setAmount(typeof payment.tutar === "number" ? String(payment.tutar) : ""); setStartKey(payment.packageStart || info.startKey || ""); setEndKey(payment.packageEnd || payment.packageStart || info.endKey || info.startKey || ""); setEditing(false); }} style={{ background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, padding:"9px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Vazgeç</button>
              </div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
              <button onClick={() => setEditing(true)} style={{ background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, padding:"9px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Düzelt</button>
              <button onClick={() => { if(window.confirm("Bu ödeme kaydı silinsin mi?")) onPaymentDelete(index); }} style={{ background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:10, padding:"9px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Ödemeyi Sil</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DetailSheet({ student, teachers, initialTab="takvim", onClose, onRecharge, onUndoLastPackage, onLessonClick, onShift, onMoveOne, onTelafiDone, onTelafiPlanMessage, onTelafiEvaluationMessage, onMesaj, onÖdemeAl, onZamYap, onDelete, onStudentLeft, onEkDersEkle, onEkDersOdeme, onEkDersSil, onEkDersDurum, onDuzenle, onToggleFreeze, onPaymentEdit, onPaymentDelete }) {
  const [tab, setTab] = useState(initialTab);
  const [telafiSel, setTelafiSel] = useState(null);
  const [shiftSel, setShiftSel] = useState(null);
  const [showEkDers, setShowEkDers] = useState(false);
  const [showDuzenle, setShowDuzenle] = useState(false);
  const [showOdemeAl, setShowOdemeAl] = useState(false);
  const [showPaketYukle, setShowPaketYukle] = useState(false);
  const [showZam, setShowZam] = useState(false);
  const [showResumeProgram, setShowResumeProgram] = useState(false);
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const bal = calcBalance(student.schedule);
  const np = calcNextPayment(student.schedule);
  const telafiRecords = student.telafi_records || [];
  const active = telafiRecords.filter(r=>!r.done);
  const done = telafiRecords.filter(r=>r.done);
  const remainingTelafiRights = Math.max(0, 6 - telafiRecords.length);
  const ekDersler = student.ek_dersler || [];
  const odenmemisEk = unpaidEkDersler(student);
  const undoablePackage = lastUndoablePackageInfo(student);
  const payStats = paymentHabitStats(student);
  const attStats = attendanceStats(student);
  const homeworkStats = homeworkHabitStats(student);
  const currentOrLastInfo = currentPaymentDueInfo(student) || nextPayablePackageInfo(student) || lastCompletedPackageInfo(student);
  const startInfo = lessonStartInfo(student);
  const left = isStudentLeft(student);
  const pieceHistory = studentPieceHistory(student);
  const statusText = [
    left ? "Ayrılan" : student.frozen ? "Dondurulmuş" : "Aktif",
    isRaiseDue(student) ? "Zam zamanı" : "",
    ekDersler.length > 0 ? "+"+ekDersler.length+" ek ders" : "",
    odenmemisEk.length > 0 ? odenmemisEk.length+" ödenmemiş ek" : "",
  ].filter(Boolean).join(" · ");

  return (
    <>
      <Sheet title={student.name} onClose={onClose}>
        <div style={SECTION}>
          <div className="crm-student-info-grid" style={{ marginBottom:startInfo?12:0 }}>
            {[
              ["Enstrüman",student.instrument || "-"],
              ["Öğretmen",studentTeacherName(student) || "-"],
              ["Program",studentScheduleLabel(student) || "-"],
              ["Ders süresi",lessonDurationLabel(student)],
              ["Veli",student.veli_adi || "-"],
              ["Durum",statusText],
            ].map(([label,value])=><div className="crm-student-info-item" key={label}><span className="crm-student-info-label">{label}</span><span className="crm-student-info-value">{value}</span></div>)}
          </div>
          {startInfo ? (
            <div style={{ background:"#f8fafc", border:"1px solid #eef2f7", borderRadius:12, padding:"9px 11px" }}>
              <p style={{ margin:0, fontSize:10, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Derse Başlama</p>
              <p style={{ margin:"3px 0 0", fontSize:13, color:"#111", fontWeight:800 }}>{startInfo}</p>
            </div>
          ) : null}
        </div>
        <div className="crm-student-metrics" style={{ display:"grid", gap:8, marginBottom:8 }}>
          <MiniMetric label="Kalan Ders" value={bal} />
          <MiniMetric label="Aktif Telafi" value={active.length} tone={active.length>4?"danger":active.length===4?"warn":"info"} />
          <MiniMetric label="Kalan Telafi Hakkı" value={remainingTelafiRights} tone={remainingTelafiRights===0?"danger":remainingTelafiRights<=2?"warn":"good"} />
          <MiniMetric label="No-Show" value={student.no_show} tone={student.no_show>0?"danger":"neutral"} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:8, marginBottom:12 }}>
          <MiniMetric label="Derse Katılım" value={scoreLabel(attStats?.score)} tone="good" />
          <MiniMetric label="Ödev Yapma" value={scoreLabel(homeworkStats?.score)} tone={!homeworkStats?"neutral":homeworkStats.score>=8?"good":homeworkStats.score>=5?"warn":"danger"} />
          <MiniMetric label="Ödeme Alışkanlığı" value={scoreLabel(payStats?.score)} tone={payStats?.avgDelay>0?"warn":"info"} />
        </div>
        {np ? (
          <div style={SECTION}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Tahmini Sonraki Ödeme</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:700, color:"#111" }}>{fmtMed(np)}</p>
              </div>
              <span style={{ fontSize:22 }}>💳</span>
            </div>
          </div>
        ) : null}
        <ProgressChart student={student} />
        {pieceHistory.length > 0 ? (
          <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#888", letterSpacing:1 }}>PARÇA GEÇMİŞİ</p>
            {pieceHistory.map((piece,index) => (
              <div key={piece.name+"|"+piece.date.getTime()+"|"+index} style={{ borderBottom:index<pieceHistory.length-1?"1px solid #f0f0f0":"none", padding:"8px 0" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#111" }}>{piece.name}</p>
                    {piece.period ? <p style={{ margin:"2px 0 0", fontSize:11, color:"#94a3b8" }}>{piece.period}</p> : null}
                  </div>
                  <p style={{ margin:0, fontSize:12, color:piece.score===100?"#047857":piece.score===50?"#b45309":"#64748b", fontWeight:700, textAlign:"right", flexShrink:0 }}>{piece.result}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {student.odemeler && student.odemeler.length > 0 ? (
          <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#888", letterSpacing:1 }}>Ödeme Geçmişi</p>
            {[...student.odemeler].map((o,i)=>({o,i})).reverse().map(({o,i}) => (
              <PaymentHistoryItem key={i} student={student} payment={o} index={i} onPaymentEdit={(idx,changes)=>onPaymentEdit(student.id,idx,changes)} onPaymentDelete={(idx)=>onPaymentDelete(student.id,idx)} />
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
            if (l.kind === "telafi") {
              const record = l.record;
              return (
                <div key={l.id} style={{ background:record.done?"#f0fdf4":"#f0f9ff", border:"1.5px solid "+(record.done?"#bbf7d0":"#7dd3fc"), borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ cursor:"pointer", flex:1 }} onClick={() => setTelafiSel(record)}>
                      <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#0f172a" }}>{fmtDate(l.date)} · Telafi</p>
                      <p style={{ margin:"2px 0 0", fontSize:12, color:"#0369a1" }}>{timeFromISO(l.date)} · {record.done ? "yapıldı" : "planlandı"}</p>
                      <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b" }}>{fmtShort(record.lessonDate)} dersinin telafisi</p>
                    </div>
                    <StatusPill status="telafi" />
                  </div>
                  {record.plannedNote ? <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", marginTop:6 }}><p style={{ margin:0, fontSize:12, color:"#475569", fontStyle:"italic" }}>{record.plannedNote}</p></div> : null}
                </div>
              );
            }
            const clickable = true;
            return (
              <div key={l.id} style={{ background:clickable?"#f9fafb":"#fff", border:clickable?"1.5px solid #d1d5db":"1px solid #f3f4f6", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ cursor:"pointer", flex:1 }} onClick={() => onLessonClick(student, l.id, tab)}>
                    <p style={{ margin:0, fontWeight:600, fontSize:14, color:"#111" }}>{fmtDate(l.date)}</p>
                    <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{lessonTime(student, l)} · düzenle</p>
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <StatusPill status={l.status} />
                    {clickable ? <button onClick={() => setShiftSel(l)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"4px 8px", cursor:"pointer", fontSize:14, color:"#6366f1" }}>shift</button> : null}
                  </div>
                </div>
                {l.note ? <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", marginTop:6 }}><p style={{ margin:0, fontSize:12, color:"#475569", fontStyle:"italic" }}>{l.note}</p></div> : null}
              </div>
            );
          };
          const upcomingDersler = student.schedule.filter(l => l.status === "upcoming");
          const gecmisDersler = student.schedule.filter(l => l.status !== "upcoming");
          const güncelGecmisSayisi = gecmisDersler.length % 4;
          const güncelGecmis = güncelGecmisSayisi > 0 ? gecmisDersler.slice(-güncelGecmisSayisi) : [];
          const eskiPaketler = güncelGecmisSayisi > 0 ? gecmisDersler.slice(0, -güncelGecmisSayisi) : gecmisDersler;
          const currentScheduleItems = [...güncelGecmis, ...upcomingDersler];
          const currentStart = currentScheduleItems.length ? Math.min(...currentScheduleItems.map(l => new Date(l.date).getTime())) : null;
          const currentEnd = currentScheduleItems.length ? Math.max(...currentScheduleItems.map(l => new Date(l.date).getTime())) : null;
          const plannedTelafiler = telafiRecords
            .filter(r => telafiPlannedAt(r))
            .filter(r => {
              const t = new Date(telafiPlannedAt(r)).getTime();
              if (!Number.isFinite(t) || currentStart === null || currentEnd === null) return true;
              return !r.done || (t >= currentStart && t <= currentEnd);
            })
            .map(r => ({ id:"telafi-"+r.id, kind:"telafi", date:telafiPlannedAt(r), record:r }));
          const güncel = [...currentScheduleItems, ...plannedTelafiler].sort((a,b)=>new Date(a.date)-new Date(b.date));
          return (
            <div>
              {eskiPaketler.length > 0 ? (
                <div style={{ marginBottom:8 }}>
                  <button onClick={() => setGecmisAcik(!gecmisAcik)} style={{ width:"100%", background:"#f3f4f6", border:"none", borderRadius:10, padding:"10px 12px", fontSize:13, fontWeight:700, color:"#555", cursor:"pointer", fontFamily:"inherit", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>Geçmiş Dersler ({eskiPaketler.length})</span>
                    <span>{gecmisAcik ? "▲" : "▼"}</span>
                  </button>
                  {gecmisAcik ? (
                    <div style={{ marginTop:6 }}>
                      {eskiPaketler.map(l => <LessonCard key={l.id} l={l} />)}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {güncel.map(l => <LessonCard key={l.id} l={l} />)}
            </div>
          );
        })()}

        {tab === "telafi" ? (
          <div>
            {telafiRecords.length === 0 ? <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Aktif telafi hakkı yok</p> : null}
            {active.length > 0 ? (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:8 }}>Bekleyen</p>
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
                          {telafiPlannedAt(r) ? <p style={{ margin:"4px 0 0", fontSize:12, color:"#7e22ce", fontWeight:700 }}>Plan: {fmtDate(telafiPlannedAt(r))} · {timeFromISO(telafiPlannedAt(r))}</p> : null}
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
                <p style={{ fontSize:11, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:8 }}>Yapılmış</p>
                {done.map(r => (
                  <div key={r.id} onClick={() => setTelafiSel(r)} style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginBottom:6, cursor:"pointer" }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>{fmtDate(r.lessonDate)} dersi yapıldı</p>
                    {telafiDoneAt(r) ? <p style={{ margin:"3px 0 0", fontSize:12, color:"#16a34a" }}>{telafiDoneDateText(r)}</p> : null}
                    {telafiMetricText(r) ? <p style={{ margin:"3px 0 0", fontSize:12, color:"#166534" }}>{telafiMetricText(r)}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "ekders" ? (
          <div>
            <Btn bg="#6366f1" mb={12} onClick={() => setShowEkDers(true)}>Ek Ders Ekle</Btn>
            {odenmemisEk.length > 0 ? (
              <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:"10px 12px", marginBottom:10 }}>
                <p style={{ margin:0, fontSize:13, color:"#c2410c", fontWeight:700 }}>{odenmemisEk.length} ödenmemiş ek ders · {(odenmemisEk.reduce((sum,e)=>sum+(e.fee||ekDersFee(student)),0)).toLocaleString("tr-TR")} TL</p>
              </div>
            ) : null}
            {ekDersler.length === 0
              ? <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Henüz ek ders yok</p>
              : [...ekDersler].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e => (
                  <div key={e.id} style={{ background:e.odendi?"#f0fdf4":"#faf5ff", border:"1px solid "+(e.odendi?"#bbf7d0":"#e9d5ff"), borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                      <div>
                        <p style={{ margin:0, fontWeight:700, fontSize:14, color:e.odendi?"#166534":"#5b21b6" }}>{fmtDate(e.date)}</p>
                        <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{new Date(e.date).toLocaleTimeString("tr-TR", {hour:"2-digit",minute:"2-digit"})} · {ekDersTypeLabel(e.type)} · {ekDersStatusLabel(e.status)}</p>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#111" }}>{(e.fee||ekDersFee(student)).toLocaleString("tr-TR")} TL</p>
                        <Pill label={e.odendi?"Ödendi":"Ödenmedi"} bg={e.odendi?"#d1fae5":"#ffedd5"} color={e.odendi?"#065f46":"#c2410c"} />
                      </div>
                    </div>
                    {e.note ? <p style={{ margin:"4px 0 0", fontSize:12, color:"#475569", fontStyle:"italic" }}>{e.note}</p> : null}
                    <div style={{ display:"grid", gridTemplateColumns:e.odendi?"1fr 1fr":"1fr 1fr 1fr", gap:8, marginTop:8 }}>
                      {!e.odendi ? <button onClick={() => onEkDersOdeme(student.id, e.id, new Date().toISOString().split("T")[0])} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Ödeme Alındı</button> : null}
                      <button onClick={() => onEkDersDurum(student.id, e.id, e.status === "done" ? "planned" : "done")} style={{ background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, padding:"8px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{e.status === "done" ? "Planlandı Yap" : "Yapıldı Yap"}</button>
                      <button onClick={() => {
                        if (e.odendi) {
                          alert("Bu ek dersin ödemesi alınmış. Önce ödeme geçmişinden ilgili ödeme kaydını sil, sonra ek dersi silebilirsin.");
                          return;
                        }
                        if (window.confirm("Bu ek ders silinsin mi?")) onEkDersSil(student.id, e.id);
                      }} style={{ background:e.odendi?"#f3f4f6":"#fee2e2", color:e.odendi?"#9ca3af":"#991b1b", border:"none", borderRadius:10, padding:"8px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Sil</button>
                    </div>
                  </div>
                ))
            }
          </div>
        ) : null}

        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8 }}>
          <Btn bg="#10b981" onClick={() => setShowOdemeAl(true)}>Ödeme Al</Btn>
          <Btn bg="#f97316" onClick={() => setShowZam(true)}>Zam Yap</Btn>
          <Btn bg="#6366f1" onClick={() => setShowDuzenle(true)}>Öğrenciyi Düzenle</Btn>
          <Btn bg="#111" onClick={() => setShowPaketYukle(true)}>Paket Yükle</Btn>
          {undoablePackage ? (
            <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:12, padding:"10px 12px" }}>
              <p style={{ margin:"0 0 8px", fontSize:12, color:"#be123c", fontWeight:700 }}>Geri alınacak dersler: {undoablePackagePreview(student, undoablePackage)}</p>
              <Btn bg="#ef4444" onClick={() => { if(window.confirm("Son yüklenen paket geri alınsın mı?")) { onUndoLastPackage(student.id); onClose(); } }}>Son Paketi Geri Al</Btn>
            </div>
          ) : null}
          <div style={{ background:left?"#fff1f2":student.frozen?"#eff6ff":"#f9fafb", border:"1px solid "+(left?"#fecdd3":student.frozen?"#bfdbfe":"#e5e7eb"), borderRadius:12, padding:"12px 14px" }}>
            <button onClick={() => {
              if (student.frozen && !left) setShowResumeProgram(true);
              else onToggleFreeze(student.id, left ? false : true);
            }} style={{ width:"100%", background:left||student.frozen?"#2563eb":"#f59e0b", color:"#fff", border:"none", borderRadius:10, padding:"10px 12px", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
              {left ? "Öğrenciyi Yeniden Aktif Et" : student.frozen ? "Programı Devam Ettir" : "Programı Dondur"}
            </button>
            {!left ? <button onClick={() => { if(window.confirm(student.name+" ayrılan öğrenci olarak kaydedilsin mi? Geçmiş kayıtlar korunacaktır.")) onStudentLeft(student.id); }} style={{ width:"100%", marginTop:8, background:"#be123c", color:"#fff", border:"none", borderRadius:10, padding:"10px 12px", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Öğrenci Ayrıldı</button> : null}
          </div>
          <Btn bg="#ef4444" onClick={async() => { if(window.confirm(student.name+" öğrenci ekranlarından kaldırılsın mı? Geçmiş ders ve ödeme kayıtları finans geçmişinde korunacaktır.")){ const deleted=await onDelete(student.id); if(deleted) onClose(); } }}>Öğrenciyi Sil</Btn>
        </div>
      </Sheet>
      {telafiSel ? <TelafiSheet record={telafiSel} student={student} onClose={() => setTelafiSel(null)} onSave={(id, payload) => { onTelafiDone(student.id, id, payload); setTelafiSel(null); }} onPlanMessage={(record) => { setTelafiSel(null); onTelafiPlanMessage(student, record); }} onEvaluationMessage={(record) => { setTelafiSel(null); onTelafiEvaluationMessage(student, record); }} /> : null}
      {shiftSel ? <ShiftSheet lesson={shiftSel} student={student} onClose={() => setShiftSel(null)} onShift={(lid, days) => { onShift(student.id, lid, days); setShiftSel(null); }} onMoveOne={(lid, date, time) => { onMoveOne(student.id, lid, date, time); setShiftSel(null); }} /> : null}
      {showOdemeAl ? <OdemeAlSheet student={student} onClose={() => setShowOdemeAl(false)} onÖdemeAl={onÖdemeAl} /> : null}
      {showPaketYukle ? <ÖdemeSheet student={student} onClose={() => setShowPaketYukle(false)} onÖdemeAl={(sid, date, count) => { onRecharge(sid, date, count); setShowPaketYukle(false); onClose(); }} onMesajGonder={onMesaj} /> : null}
      {showZam ? <ZamSheet student={student} onClose={() => setShowZam(false)} onSave={onZamYap} /> : null}
      {showResumeProgram ? <ResumeProgramSheet student={student} onClose={() => setShowResumeProgram(false)} onResume={(startDate) => onToggleFreeze(student.id, false, startDate)} /> : null}
      {showEkDers ? <EkDersSheet student={student} onClose={() => setShowEkDers(false)} onEkDersEkle={(sid, ders) => { onEkDersEkle(sid, ders); setShowEkDers(false); }} /> : null}
      {showDuzenle ? <DuzenleSheet student={student} teachers={teachers} onClose={() => setShowDuzenle(false)} onDuzenle={onDuzenle} /> : null}
    </>
  );
}

function AddSheet({ teachers, onClose, onAdd }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const firstTeacher = teachers.find(t => t.active);
  const [f, setF] = useState({ name:"", teacher_id:firstTeacher?.id || "", phone:"", veli_adi:"", dogum_tarihi:"", lesson_start_date:todayISO, instrument:"Davul", lessonDuration:45, lessonSlots:[{ day:"Pazartesi", time:"15:00" }], count:4, firstDate:todayISO, ucret:"", last_raise_date:"" });
  const [saving, setSaving] = useState(false);
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const setSlot = (i,k,v) => setF(p=>({
    ...p,
    lessonSlots: p.lessonSlots.map((slot,idx)=>idx===i ? {...slot,[k]:v} : slot),
  }));
  const addSlot = () => setF(p=>({...p, lessonSlots:[...p.lessonSlots, { day:"Pazartesi", time:"15:00" }]}));
  const removeSlot = (i) => setF(p=>({...p, lessonSlots:p.lessonSlots.filter((_,idx)=>idx!==i)}));
  const previewDates = () => {
    if (!f.name) return "";
    if (!f.firstDate || f.firstDate.length < 10) return "";
    const from = new Date(f.firstDate + "T12:00:00");
    if (isNaN(from.getTime())) return "";
    return buildScheduleSlots(f.lessonSlots, f.count, from, f.lessonDuration).map(l=>fmtShort(l.date)+" "+l.time).join(" - ");
  };
  return (
    <Sheet title="Yeni Öğrenci" onClose={onClose}>
      <label style={LBL}>Ad Soyad</label>
      <input style={INP} value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Öğrenci adı" />
      <label style={LBL}>Öğretmen</label>
      <select style={INP} value={f.teacher_id} onChange={e=>s("teacher_id",e.target.value)}>
        <option value="">Öğretmen seçin</option>
        {teachers.filter(t => t.active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <label style={LBL}>Veli Adı</label>
      <input style={INP} value={f.veli_adi} onChange={e=>s("veli_adi",e.target.value)} placeholder="Veli adı soyadı" />
      <label style={LBL}>Doğum Tarihi (opsiyonel)</label>
      <input style={INP} type="date" value={f.dogum_tarihi||""} onChange={e=>s("dogum_tarihi",e.target.value)} />
      <label style={LBL}>Derse Başlama Tarihi</label>
      <input style={INP} type="date" value={f.lesson_start_date||""} onChange={e=>s("lesson_start_date",e.target.value)} />
      <label style={LBL}>Telefon (WhatsApp)</label>
      <input style={INP} value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="905xxxxxxxxx" type="tel" />
      <label style={LBL}>4 Ders Ücreti (TL)</label>
      <input style={INP} value={f.ucret} onChange={e=>s("ucret",e.target.value)} placeholder="5600" type="number" />
      <label style={LBL}>Son Zam Tarihi</label>
      <input style={INP} type="date" value={f.last_raise_date||""} onChange={e=>s("last_raise_date",e.target.value)} />
      <label style={LBL}>Enstrüman</label>
      <select style={INP} value={f.instrument} onChange={e=>s("instrument",e.target.value)}>
        {INSTRUMENTS.map(i=><option key={i}>{i}</option>)}
      </select>
      <label style={LBL}>Ders Süresi</label>
      <select style={INP} value={f.lessonDuration} onChange={e=>s("lessonDuration",parseInt(e.target.value)||45)}>
        <option value={45}>45 dakika</option>
        <option value={30}>30 dakika</option>
      </select>
      <label style={LBL}>Ders Günleri</label>
      {f.lessonSlots.map((slot,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:f.lessonSlots.length>1?"1fr 1fr 40px":"1fr 1fr", gap:10, alignItems:"end", marginBottom:8 }}>
          <div><select style={INP} value={slot.day} onChange={e=>setSlot(i,"day",e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><select style={INP} value={slot.time} onChange={e=>setSlot(i,"time",e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></div>
          {f.lessonSlots.length>1 ? <button onClick={()=>removeSlot(i)} style={{ height:40, border:"none", borderRadius:10, background:"#fee2e2", color:"#991b1b", fontWeight:800, cursor:"pointer" }}>x</button> : null}
        </div>
      ))}
      <button onClick={addSlot} style={{ width:"100%", background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, padding:"10px 12px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginTop:2 }}>+ Ders günü ekle</button>
      <label style={LBL}>Paket (ders sayısı)</label>
      <input style={INP} type="number" value={f.count} onChange={e=>s("count",Math.max(1,parseInt(e.target.value)||1))} min={1} max={12} />
      <label style={LBL}>İlk Ders Tarihi</label>
      <input style={INP} type="date" value={f.firstDate} onChange={e=>s("firstDate",e.target.value)} />
      {f.name && previewDates() ? <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginTop:12, fontSize:12, color:"#166534" }}><strong>Planlanacak dersler:</strong><br />{previewDates()}</div> : null}
      <div style={{ marginTop:16 }}><Btn bg="#111" onClick={async() => { if(!f.name.trim() || !f.teacher_id || !f.lesson_start_date || saving) return; setSaving(true); const saved=await onAdd(f); setSaving(false); if(saved) onClose(); }}>{saving?"Kaydediliyor...":"Kaydet"}</Btn></div>
    </Sheet>
  );
}

function msgDersHatirlatma(student) {
  const todayLesson = student.schedule.find(l => isToday(l.date) && l.status === "upcoming");
  const nextLesson = todayLesson || student.schedule.find(l => l.status === "upcoming");
  const info = currentPackageInfoForLesson(student, nextLesson);
  const status = packageStatusText(student, info);
  let msg = "Günaydın :) Ders saatimiz "+lessonTime(student, nextLesson)+". Lütfen 5 dakika önce hazır olun.";
  if (status) msg += "\n\nMevcut dönem durumu:\n"+status;
  return msg;
}
function msgTelafiDersHatirlatma(student, record) {
  const plannedAt = telafiPlannedAt(record);
  return "Günaydın :) Bugünkü telafi dersimizin saati "+timeFromISO(plannedAt)+". Lütfen 5 dakika önce hazır olun.";
}
function msgTelafiHakki(student, record) {
  const lessonText = record?.lessonDate ? fmtMed(record.lessonDate)+" tarihli dersiniz" : "Dersiniz";
  const expiryText = record?.expiry ? fmtMed(record.expiry) : "oluşturulduğu tarihten itibaren 30 gün";
  return "Merhaba,\n\n"+lessonText+" için telafi hakkı oluşturulmuştur. Telafi hakkınızı 30 gün içinde, "+expiryText+" tarihine kadar kullanabilirsiniz.\n\nUygunluk oluştuğunda telafi dersi planlaması için sizinle iletişime geçeceğiz.\n\nBodrum Sonsuz Sanat";
}
function msgTelafiPlanlandi(student, record) {
  const plannedAt = telafiPlannedAt(record);
  const plannedDate = new Date(plannedAt);
  const dateText = isNaN(plannedDate.getTime()) ? fmtDate(plannedAt) : plannedDate.toLocaleDateString("tr-TR", { day:"numeric", month:"long", weekday:"long" });
  return "Merhaba,\n\n"+student.name+" için telafi dersimiz "+dateText+" günü saat "+timeFromISO(plannedAt)+" olarak planlanmıştır.\n\nPlanlanan telafi derslerinde yeniden gün ve saat değişikliği yapılamamaktadır. Belirtilen tarih ve saatte katılımınızı rica ederiz.\n\nBilginize, iyi günler.\n\nBodrum Sonsuz Sanat";
}
function packageLessonsText(student, info) {
  if (!info) return "";
  const ids = new Set(info.lessonIds || []);
  return (student.schedule || [])
    .filter(l => ids.has(l.id))
    .sort((a,b)=>new Date(a.date)-new Date(b.date))
    .map((l,i) => (i+1)+". Ders: "+fmtDate(l.date)+" "+lessonTime(student, l))
    .join("\n");
}

function msgIlkDersÖdeme(student) {
  const info = currentPaymentDueInfo(student) || nextPayablePackageInfo(student);
  const lessons = packageLessonsText(student, info);
  let msg = "Merhaba,\n\nYeni ders dönemimiz bugünkü ders ile başlamaktadır. Bu sebeple bugün ödeme gününüzdür.\n\n";
  if (info) {
    msg += "Dönem: "+info.donem+"\n";
    if (lessons) msg += "Planlanan dersler:\n"+lessons+"\n\n";
  }
  msg += "İlginiz için teşekkür eder, iyi dersler dileriz.\n\nBodrum Sonsuz Sanat";
  return msg;
}

function msgYeniKayitKurallari() {
  return "Sonsuz Sanat Ders Süreci Bilgilendirmesi\n\nDerslerimiz haftalık sabit gün ve saatlerde ilerler. Eğitim sürecinde devamlılık ve düzenli katılım büyük önem taşır.\n\nLütfen aşağıdaki kuralları inceleyiniz:\n\nDers İptalleri\n\n• Ders iptallerinin en az 24 saat önceden bildirilmesi gerekir.\n• Her telafi hakkı oluşturulduğu tarihten itibaren 30 gün geçerlidir.\n• Kullanılmayan telafi hakları bir sonraki döneme devredilmez.\n\nDers Günü İptalleri\n\n• Ders günü yapılan iptallerde, eğer iptal sebebi sağlık sorunlarının dışındaysa ders yapılmış sayılır.\n• Derse habersiz gelinmemesi durumunda ders yapılmış sayılır ve telafi hakkı oluşmaz.\n\nTelafi Dersleri\n\n• Telafi dersleri kurumun uygunluk durumuna göre planlanır, uygunluk oluştuğunda tarafınıza bilgi verilir.\n\nProgram Dondurma\n\n• 2-3 hafta ve üzeri planlı yokluklarda program dondurulabilir veya mevcut haliyle devam ettirilebilir.\n• Programın devam etmesi halinde öğrenciye ayrılan gün ve saat korunur; ders ve ödeme takvimi normal şekilde işlemeye devam eder.\n• Planlı yokluk sırasında derslere katılmasanız bile, size ayırılan gün ve saatin korunması için ödeme günleri gelmeye devam eder ve telafi hakları birikebilir. Bunu istemiyorsanız programı dondurmanızı öneririz.\n• Program dondurulduğunda mevcut gün ve saat korunmaz.\n• Dönüşte aynı gün ve saat garanti edilmez; kontenjan durumuna göre yeniden planlama yapılır.\n\nÖdeme Düzeni\n\n• Ödemelerin zamanında yapılması programın devamlılığı açısından önemlidir.\n• Ödeme sürecinin aksaması durumunda program dondurulabilir ve ayrılan gün/saat başka öğrencilere açılabilir.\n\nAmacımız tüm öğrencilerimiz için düzenli, adil ve sürdürülebilir bir eğitim süreci oluşturmaktır.\n\nBodrum Sonsuz Sanat";
}
function msgWhatsAppGroup(student) {
  const greeting = student?.veli_adi ? "Merhaba "+student.veli_adi+"," : "Merhaba,";
  return greeting+"\n\nBodrum Sonsuz Sanat ders duyurularını ve önemli bilgilendirmeleri takip edebilmeniz için WhatsApp grubumuza aşağıdaki bağlantıdan katılabilirsiniz:\n\n"+WHATSAPP_GROUP_URL+"\n\nBodrum Sonsuz Sanat";
}
function msgNewsletter(student) {
  const greeting = student?.veli_adi ? "Merhaba "+student.veli_adi+"," : "Merhaba,";
  return greeting+"\n\nBodrum Sonsuz Sanat bültenine abone olarak sanat, eğitim ve etkinlik içeriklerimizi takip edebilirsiniz:\n\n"+NEWSLETTER_URL+"\n\nBodrum Sonsuz Sanat";
}
function msgGoogleReview(student) {
  const lessonPhrase = instrumentLessonPhrase(student);
  return "Merhaba,\n\nDers sürecimizle ilgili deneyiminizi Google’da paylaşmanız bizi çok mutlu eder. Yorumunuz hem bize hem de bizi araştıran ailelere çok yardımcı oluyor.\n\nYorumunuzda “"+lessonPhrase+"” ifadesine yer vermeniz, Bodrum’da "+lessonPhrase+" arayan ailelerin bizi bulmasına da yardımcı olur.\n\nYorum bırakmak için: "+GOOGLE_REVIEW_URL+"\n\nTeşekkür ederiz.\nBodrum Sonsuz Sanat";
}
function msgÖdemeHatirlatma() {
  return "Merhaba,\nDers ödemesini henüz tarafımıza ulaşmış olarak göremiyoruz.\nÖdemenizi uygun olduğunuzda gerçekleştirmenizi rica ederiz. Herhangi bir sorunuz olması durumunda bizimle iletişime geçebilirsiniz.\nTeşekkür eder, iyi günler dileriz.\nBodrum Sonsuz Sanat";
}
function paymentOverdueMessageLine(student) {
  const info = currentPaymentDueInfo(student) || [...customPackageInfos(student), ...regularPackageInfos(student)]
    .filter(item => item.complete && midday(new Date(item.start)) <= midday() && !hasPaymentForPackage(student, item))
    .sort((a,b)=>new Date(a.start)-new Date(b.start))[0];
  const days = info?.start ? paymentOverdueDays(info.start) : 0;
  return days > 0 ? "Ödemeniz "+days+" gün gecikmiştir." : "";
}
function msgÖdemeHatirlatma2(student) {
  const delay = paymentOverdueMessageLine(student);
  return "Merhaba,\n"+(delay ? delay+"\n" : "")+"Eğitim programının kesintisiz şekilde devam edebilmesi ve öğrencimizin gün/saat planlamasının korunabilmesi için ödemenizin bu hafta içerisinde tamamlanmasını rica ederiz.\nTeşekkür eder, iyi günler dileriz.\nBodrum Sonsuz Sanat";
}
function msgÖdemeHatirlatma3(student) {
  const delay = paymentOverdueMessageLine(student);
  return "Merhaba,"+(delay ? "\n\n"+delay : "")+"\n\nDüzenli ödeme yapılmayan programlarda öğrencinin gün ve saatini korumamız mümkün olmamaktadır. Bu nedenle ödemenin belirtilen süre içerisinde tamamlanmaması durumunda programınız dondurulacak, ayrılan gün ve saat bekleme listesindeki öğrenciler için kullanıma açılacaktır.\n\nLütfen ödemenizi en kısa sürede gerçekleştiriniz.\n\nTeşekkür eder, iyi günler dileriz.\n\nBodrum Sonsuz Sanat";
}
function msgDondurmaUyarisi(student) {
  const delay = paymentOverdueMessageLine(student);
  return "Merhaba,\n\nÖdeme konusunda daha önce tarafınıza bilgilendirme yapılmış olmasına rağmen ödemeniz henüz tarafımıza ulaşmamıştır."+(delay ? "\n"+delay : "")+"\n\nEğitim programlarımız sabit gün ve saat planlamasıyla yürütüldüğü için, düzenli ödeme yapılmayan programlarda öğrencinin gün ve saatini korumamız mümkün olmamaktadır.\n\nBu nedenle programınızı bugün itibarıyla donduruyoruz. Ayrılan gün ve saat, bekleme listesindeki diğer öğrencilerin kullanımına açılacaktır.\n\nİlerleyen dönemde programa devam etmek istemeniz halinde, o tarihteki uygun kontenjan durumuna göre yeni bir gün ve saat planlaması yapılabilir.\n\nAnlayışınız için teşekkür eder, iyi günler dileriz.\n\nBodrum Sonsuz Sanat";
}
function msgPaketOzeti(student) {
  const info = lastCompletedPackageInfo(student);
  const ids = new Set(info?.lessonIds || []);
  const sonPaket = (student.schedule || [])
    .filter(l => ids.has(l.id))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  let dersler = "";
  let donem = info?.donem || "";
  if (sonPaket.length > 0) {
    sonPaket.forEach(l => {
      const katildi = l.status === "completed";
      dersler += (katildi ? "Katıldı" : "Katılmadı") + " - " + fmtShort(l.date);
      if (l.activeMinutes || l.focusMinutes || l.productiveWindow || l.focusSection) {
        dersler += " ("+(l.activeMinutes||0)+" dk aktif";
        if (l.focusMinutes) dersler += ", "+l.focusMinutes+" dk odak";
        if (l.productiveWindow) dersler += ", "+l.productiveWindow+" en verimli bölüm";
        dersler += ")";
      }
      dersler += "\n";
    });
  }
  const verim = lessonEngagementStats(student, info);
  const aktifTelafi = (student.telafi_records||[]).filter(r => !r.done);
  const yapilanTelafi = (student.telafi_records||[]).filter(r => r.done);
  let msg = "Sonsuz Sanat - Ders Özeti\n\n";
  msg += "Öğrenci: "+student.name+"\n";
  msg += "Dönem: "+donem+"\n\n";
  msg += "Dersler:\n"+dersler;
  if (verim) {
    const completedWithStats = sonPaket.filter(l => l.status === "completed" && (l.activeMinutes || l.focusMinutes || l.productiveWindow || l.focusSection));
    const activeValues = completedWithStats.map(l=>parseInt(l.activeMinutes)||0);
    const focusValues = completedWithStats.map(l=>parseInt(l.focusMinutes)||0);
    const durationMax = completedWithStats.reduce((max,l)=>Math.max(max, getLessonDuration(student, l)), getLessonDuration(student));
    msg += "\nDers Verimi:\n";
    msg += "Ortalama aktif ders süresi: "+fmtNumber(verim.avgActive, 1)+" dk\n";
    if (verim.avgFocus) msg += "Ortalama odaklanma süresi: "+fmtNumber(verim.avgFocus, 1)+" dk\n";
    if (verim.topWindow) msg += "Genelde en verimli bölüm: "+verim.topWindow+"\n";
    msg += "\nGelişim Grafiği\n";
    if (activeValues.some(Boolean)) {
      msg += "Aktif süre:\n";
      completedWithStats.forEach((l, i) => {
        const active = parseInt(l.activeMinutes) || 0;
        msg += (i+1)+". Ders "+asciiBar(active, durationMax)+" "+active+" dk\n";
      });
    }
    if (focusValues.some(Boolean)) {
      msg += "\nOdaklanma:\n";
      completedWithStats.forEach((l, i) => {
        const focus = parseInt(l.focusMinutes) || 0;
        msg += (i+1)+". Ders "+asciiBar(focus, durationMax)+" "+focus+" dk\n";
      });
    }
    const activeTrend = activeValues.length >= 2 ? activeValues[activeValues.length-1] - activeValues[0] : 0;
    msg += "\nGenel yorum:\n";
    if (activeTrend > 0) msg += "Bu ders döneminde aktif katılım düzenli olarak yükselmiş.\n";
    else if (activeTrend < 0) msg += "Bu ders döneminde aktif katılımda düşüş görülmüş.\n";
    else msg += "Bu ders döneminde aktif katılım dengeli ilerlemiş.\n";
    const focusTrend = trendText(focusValues, "Odaklanma süresi");
    if (focusTrend) msg += focusTrend + "\n";
    if (verim.topWindow) msg += productiveWindowSummaryText(verim.topWindow) + "\n";
  }
  if (aktifTelafi.length > 0) {
    msg += "\nTelafi Hakları ("+aktifTelafi.length+"):\n";
    aktifTelafi.forEach(r => { msg += "- "+fmtShort(r.lessonDate)+" dersi\n"; });
  }
  if (yapilanTelafi.length > 0) {
    msg += "\nYapılan Telafiler:\n";
    yapilanTelafi.forEach(r => {
      const doneLabel = telafiDoneShortText(r);
      msg += "- "+fmtShort(r.lessonDate)+" dersi telafisi: "+doneLabel+" - "+telafiStatusLabel(r)+"\n";
      const metric = telafiMetricText(r);
      if (metric) msg += "  "+metric+"\n";
      if (r.doneNote) msg += "  Not: "+r.doneNote+"\n";
      else if (r.plannedNote) msg += "  Not: "+r.plannedNote+"\n";
    });
  }
  const bekleyenEkDersler = unpaidEkDersler(student);
  if (bekleyenEkDersler.length > 0) {
    const ekToplam = bekleyenEkDersler.reduce((sum,e)=>sum+(e.fee||ekDersFee(student)),0);
    msg += "\nDevreden ek ders: "+bekleyenEkDersler.length+" adet - "+ekToplam.toLocaleString("tr-TR")+" TL\n";
  }
  const upcoming = student.schedule.filter(l => l.status === "upcoming");
  if (upcoming.length > 0) {
    msg += "\nYeni dönem: "+fmtMed(upcoming[0].date)+"\n";
    msg += "Ödeme: "+fmtMed(upcoming[0].date);
  }
  return msg;
}

function msgDersDegerlendirmesi(student, record, type="normal") {
  const isTelafi = type === "telafi";
  const date = isTelafi ? (telafiDoneAt(record) || telafiPlannedAt(record)) : record?.date;
  const breakdown = record?.lessonScoreBreakdown || {};
  const lines = [
    student.name+" için "+(isTelafi ? "telafi dersi" : "bugünkü ders")+" değerlendirmesi:",
    date ? "Ders tarihi: "+fmtMed(date) : "",
    "",
    "Dersin temel odağı: "+(record?.lessonFocus || record?.lesson_focus || "-"),
    "Aktif ders süresi: "+(parseInt(record?.activeMinutes)||0)+" dakika ("+(breakdown.active ?? 0)+"/10)",
    "Görev odağını sürdürme: Yaklaşık "+(parseInt(record?.taskFocusMinutes ?? record?.task_focus_minutes)||0)+" dakika ("+(breakdown.taskFocus ?? 0)+"/20)",
    "Yeniden yönlendirme: "+(parseInt(record?.redirectionCount ?? record?.redirection_count)||0)+" kez ("+(breakdown.redirection ?? 0)+"/30)",
  ];
  if (breakdown.homeworkApplicable === false) lines.push("Önceki ödev: İlk ders olduğu için değerlendirilmedi");
  else lines.push("Önceki ödev: "+homeworkStatusLabel(record?.evaluatedHomeworkStatus)+" ("+(breakdown.homework ?? 0)+"/40)");
  lines.push("", "Ders Verim Puanı: "+fmtNumber(storedLessonScore(record) ?? 0)+"/100");
  if (record?.note || record?.doneNote) lines.push("", "Öğretmen notu: "+(record.note || record.doneNote));
  lines.push("", "Gelecek ders ödevi: "+(record?.homework || "-"));
  return lines.join("\n");
}

function msgDonemDegerlendirmesi(student, info, log) {
  const evaluation = log?.evaluation;
  if (!evaluation) return "";
  const lines = [
    "Merhaba,",
    "",
    student.name+" için dönem değerlendirmesi:",
  ];
  if (info?.donem) lines.push("Dönem: "+info.donem);
  lines.push(
    "",
    "Derse katılım: "+fmtNumber(evaluation.attendanceScore)+"/100 ("+evaluation.attendedLessonCount+"/"+evaluation.expectedLessonCount+" ders)",
    "Dönem derslerinin ortalaması: "+fmtNumber(evaluation.lessonAverage)+"/100",
    ...(evaluation.pieceName ? ["Parça: "+evaluation.pieceName] : []),
    "Parça sonucu: "+evaluation.pieceLabel+" ("+evaluation.pieceScore+"/100)",
    "",
    "Dönem Değerlendirme Puanı: "+fmtNumber(evaluation.periodScore)+"/100",
    "",
    "Not: Telafi dersleri dönem değerlendirmesine dahil edilmemiştir.",
    "",
    "Bodrum Sonsuz Sanat",
  );
  return lines.join("\n");
}

function WhatsAppPreviewSheet({ title, subtitle, text, onClose, onSent }) {
  const send = async () => {
    const phone = subtitle?.phone ? subtitle.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else await navigator.clipboard.writeText(text);
    if (onSent) await onSent(phone ? "whatsapp" : "copied");
  };
  const studentName = typeof subtitle === "object" ? subtitle.name : subtitle;
  return <Sheet title={title} subtitle={studentName} onClose={onClose}>
    <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
      <p style={{ margin:0, fontSize:12, color:"#475569", lineHeight:1.65, whiteSpace:"pre-line" }}>{text}</p>
    </div>
    <Btn bg="#25D366" onClick={send}>{subtitle?.phone ? "WhatsApp'ta Aç" : "Mesajı Kopyala"}</Btn>
    <Btn bg="#111" outline onClick={onClose}>Kapat</Btn>
  </Sheet>;
}

function DonemDegerlendirmeSheet({ student, info, onClose, onSave }) {
  const stats = packageEvaluationStats(student, info);
  const existing = periodEvaluationInfo(student, info)?.evaluation;
  const [pieceName, setPieceName] = useState(existing?.pieceName || "");
  const [pieceResult, setPieceResult] = useState(existing?.pieceResult || "");
  const [error, setError] = useState("");
  const piece = pieceResultOption(pieceResult);
  const total = piece && stats ? periodEvaluationScore(stats.attendanceScore, stats.lessonAverage, piece.score) : null;
  return <Sheet title="Dönemi Değerlendir" subtitle={student.name+(info?.donem ? " · "+info.donem : "")} onClose={onClose}>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:9, marginBottom:14 }}>
      <MiniMetric label="Katılım" value={stats ? fmtNumber(stats.attendanceScore)+"/100" : "-"} tone="info" />
      <MiniMetric label="Ders Ortalaması" value={stats ? fmtNumber(stats.lessonAverage)+"/100" : "-"} tone="special" />
    </div>
    {stats ? <p style={{ margin:"0 0 14px", fontSize:12, color:"#64748b" }}>{stats.attendedLessons.length}/{stats.expectedLessonCount} normal derse katıldı · Ortalama {stats.scoredLessons.length} puanlı normal dersten hesaplandı. Telafi dersleri dahil edilmedi.</p> : null}
    {!existing && stats && !stats.newEvaluationEligible ? <div style={{ background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:11, padding:"10px 12px", marginBottom:14, color:"#475569", fontSize:12, fontWeight:700 }}>Bu dönem v73 öncesindeki dersleri içerdiği için yeni puanlama sistemine alınmaz. Eski dersleri yeniden değerlendirmeniz gerekmez.</div> : null}
    <label style={{ ...LBL, marginTop:0 }}>Parçanın Adı</label>
    <input style={INP} value={pieceName} maxLength={120} onChange={event=>{ setPieceName(event.target.value); setError(""); }} placeholder="Örn. Für Elise" />
    <label style={LBL}>Net Bir Parça Çıktı mı?</label>
    <select style={INP} value={pieceResult} onChange={event=>{ setPieceResult(event.target.value); setError(""); }}>
      <option value="">Seçin</option>
      {PIECE_RESULT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label} · {option.score}/100</option>)}
    </select>
    {total !== null ? <div style={{ marginTop:14, background:"#ecfdf5", border:"1px solid #a7f3d0", borderRadius:12, padding:"12px 14px" }}><p style={{ margin:0, fontSize:11, color:"#047857", fontWeight:800 }}>DÖNEM DEĞERLENDİRME PUANI</p><p style={{ margin:"4px 0 0", fontSize:24, color:"#065f46", fontWeight:900 }}>{fmtNumber(total)}/100</p></div> : null}
    {error ? <p style={{ margin:"9px 0 0", color:"#dc2626", fontSize:12, fontWeight:800 }}>{error}</p> : null}
    <div style={{ marginTop:14 }}><Btn bg="#7e22ce" onClick={()=>{
      if (!pieceName.trim()) { setError("Parçanın adını yazın."); return; }
      if (!piece) { setError("Parça sonucunu seçin."); return; }
      if (!stats || (!existing && !stats.newEvaluationEligible)) { setError("Bu dönem yeni puanlama kapsamına alınmıyor."); return; }
      onSave({
        attendanceScore:stats.attendanceScore,
        attendedLessonCount:stats.attendedLessons.length,
        expectedLessonCount:stats.expectedLessonCount,
        lessonAverage:stats.lessonAverage,
        scoredLessonCount:stats.scoredLessons.length,
        pieceName:pieceName.trim(),
        pieceResult:piece.value,
        pieceLabel:piece.label,
        pieceScore:piece.score,
        periodScore:total,
      });
    }}>Değerlendirmeyi Kaydet</Btn></div>
    <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
  </Sheet>;
}

function MesajSheet({ student, onClose, initialKey = "" }) {
  const msgs = [
    { key:"ders", label:"Ders Hatırlatma", text:msgDersHatirlatma(student) },
    { key:"ilkders", label:"İlk Ders - Ödeme Günü", text:msgIlkDersÖdeme(student) },
    { key:"yenikayit", label:"Yeni Kayıt - Ders Süreci", text:msgYeniKayitKurallari() },
    { key:"odeme1", label:"Ödeme Hatırlatma (1.)", text:msgÖdemeHatirlatma() },
    { key:"odeme2", label:"Ödeme Hatırlatma (2.)", text:msgÖdemeHatirlatma2(student) },
    { key:"odeme3", label:"Ödeme Hatırlatma (3.)", text:msgÖdemeHatirlatma3(student) },
    { key:"dondur", label:"Dondurma Uyarısı", text:msgDondurmaUyarisi(student) },
  ];
  const visibleMsgs = initialKey ? msgs.filter(m => m.key === initialKey) : msgs;
  const send = (text) => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    const encoded = encodeURIComponent(text);
    if (phone) window.open("https://wa.me/"+phone+"?text="+encoded, "_blank");
    else navigator.clipboard.writeText(text);
  };
  return (
    <Sheet title={initialKey === "ozet" ? "Dönem Sonu Özeti" : "Mesaj Şablonları"} subtitle={student.name} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {visibleMsgs.map(m => (
          <div key={m.key} style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #f0f0f0" }}>
              <span style={{ fontWeight:700, fontSize:14, color:"#111" }}>{m.label}</span>
              <button onClick={() => send(m.text)} style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {student.phone ? "WhatsApp" : "Kopyala"}
              </button>
            </div>
            <div style={{ padding:"10px 14px" }}><p style={{ margin:0, fontSize:12, color:"#555", lineHeight:1.6, whiteSpace:"pre-line" }}>{m.text}</p></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function TelafiHakkiMesajSheet({ student, record, onClose, onSent }) {
  const text = msgTelafiHakki(student, record);
  const send = async () => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else await navigator.clipboard.writeText(text);
    await onSent(phone ? "whatsapp" : "copied");
  };
  return (
    <Sheet title="Veliye Bilgi Ver" subtitle={student.name+" · Telafi hakkı oluşturuldu"} onClose={onClose}>
      <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:12, color:"#1e3a8a", lineHeight:1.65, whiteSpace:"pre-line" }}>{text}</p>
      </div>
      <p style={{ margin:"0 0 12px", fontSize:12, color:"#64748b" }}>Telafi hakkı veritabanına kaydedildi. Mesajı şimdi veliye gönderebilirsiniz.</p>
      <Btn bg="#25D366" onClick={send}>{student.phone ? "WhatsApp'tan Gönder" : "Mesajı Kopyala"}</Btn>
      <Btn bg="#111" outline onClick={onClose}>Şimdi Değil</Btn>
    </Sheet>
  );
}

function TelafiPlanMesajSheet({ student, record, onClose, onSent }) {
  const text = msgTelafiPlanlandi(student, record);
  const send = async () => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else await navigator.clipboard.writeText(text);
    await onSent(phone ? "whatsapp" : "copied");
  };
  return (
    <Sheet title="Telafi Planını Bildir" subtitle={student.name+" · "+fmtDate(telafiPlannedAt(record))+" · "+timeFromISO(telafiPlannedAt(record))} onClose={onClose}>
      <div style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:12, color:"#581c87", lineHeight:1.65, whiteSpace:"pre-line" }}>{text}</p>
      </div>
      <p style={{ margin:"0 0 12px", fontSize:12, color:"#64748b" }}>Telafi günü ve saati veritabanına kaydedildi. Plan bilgisini şimdi veliye gönderebilirsiniz.</p>
      <Btn bg="#25D366" onClick={send}>{student.phone ? "WhatsApp'tan Gönder" : "Mesajı Kopyala"}</Btn>
      <Btn bg="#111" outline onClick={onClose}>Şimdi Değil</Btn>
    </Sheet>
  );
}

function ÖdemeSheet({ student, onClose, onÖdemeAl, onMesajGonder }) {
  const ekDersler = unpaidEkDersler(student);
  const ekToplam = ekDersler.reduce((sum,e)=>sum+(e.fee||ekDersFee(student)),0);
  const initialCount = PACKAGE_LOAD_OPTIONS.includes(getPreferredPackageLessonCount(student)) ? getPreferredPackageLessonCount(student) : PAYMENT_PACK_SIZE;
  const [paketDersSayisi, setPaketDersSayisi] = useState(initialCount);
  const paketTutar = (student.ucret || 0) * (paketDersSayisi / PAYMENT_PACK_SIZE);
  return (
    <Sheet title="Paket Yükle" subtitle={student.name} onClose={onClose}>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:13, color:"#166534" }}>{paketDersSayisi} yeni ders eklenecek.</p>
        <p style={{ margin:"6px 0 0", fontSize:13, color:"#166534", fontWeight:700 }}>Paket: {paketTutar.toLocaleString("tr-TR")} TL</p>
        {ekDersler.length > 0 ? <p style={{ margin:"6px 0 0", fontSize:13, color:"#5b21b6", fontWeight:700 }}>{ekDersler.length} ödenmemiş ek ders: {ekToplam.toLocaleString("tr-TR")} TL</p> : null}
        <p style={{ margin:"8px 0 0", fontSize:13, color:"#166534" }}>Ödeme uyarısı yeni periyodun ilk ders günü Bugünkü Ödemeler alanına düşer.</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
        {PACKAGE_LOAD_OPTIONS.map(count => (
          <button key={count} onClick={() => setPaketDersSayisi(count)} style={{ background:paketDersSayisi===count?"#111":"#f3f4f6", color:paketDersSayisi===count?"#fff":"#374151", border:"none", borderRadius:10, padding:"10px 6px", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>{count} Ders</button>
        ))}
      </div>
      <Btn bg="#111" onClick={() => { onÖdemeAl(student.id, new Date().toISOString().split("T")[0], paketDersSayisi); onClose(); }}>{paketDersSayisi} Derslik Paketi Yükle</Btn>
      <Btn bg="#f97316" onClick={() => { onMesajGonder(student); onClose(); }}>Ödeme Hatırlatması Gönder</Btn>
      <Btn bg="#6b7280" onClick={onClose} outline>İptal</Btn>
    </Sheet>
  );
}

function OdemeAlSheet({ student, onClose, onÖdemeAl }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const packageInfo = currentPaymentDueInfo(student) || nextPayablePackageInfo(student);
  const ekDersler = unpaidEkDersler(student);
  const ekToplam = ekDersler.reduce((sum,e)=>sum+(e.fee||ekDersFee(student)),0);
  const paketDersSayisi = packageInfo?.packageSize || getPackageLessonCount(student);
  const paketTutar = packageInfo ? (student.ucret||0) * (paketDersSayisi / PAYMENT_PACK_SIZE) : 0;
  const toplam = paketTutar + ekToplam;
  return (
    <Sheet title="Ödeme Al" subtitle={student.name} onClose={onClose}>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
        {packageInfo ? (
          <>
            <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#166534" }}>Paket: {paketTutar.toLocaleString("tr-TR")} TL</p>
            <p style={{ margin:"4px 0 0", fontSize:12, color:"#166534" }}>{packageInfo.donem} · {paketDersSayisi} ders</p>
          </>
        ) : (
          <p style={{ margin:0, fontSize:13, color:"#64748b" }}>Ödenmemiş yeni paket görünmüyor.</p>
        )}
        {ekDersler.length > 0 ? <p style={{ margin:"8px 0 0", fontSize:13, fontWeight:800, color:"#7e22ce" }}>Devreden ek ders: {ekToplam.toLocaleString("tr-TR")} TL</p> : null}
        <p style={{ margin:"10px 0 0", fontSize:15, fontWeight:900, color:"#111" }}>Toplam: {toplam.toLocaleString("tr-TR")} TL</p>
      </div>
      <label style={LBL}>Ödeme Tarihi</label>
      <input style={INP} type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <div style={{ marginTop:16 }}>
        {toplam > 0 ? <Btn bg="#10b981" onClick={() => { onÖdemeAl(student.id, date); onClose(); }}>Ödemeyi Kaydet</Btn> : <p style={{ margin:"0 0 12px", fontSize:13, color:"#999", fontWeight:700, textAlign:"center" }}>Kaydedilecek ödeme yok</p>}
        <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function ZamSheet({ student, onClose, onSave }) {
  const [fee, setFee] = useState(student.ucret || "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const next = nextRaiseDate(student);
  return (
    <Sheet title="Zam Yap" subtitle={student.name} onClose={onClose}>
      <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:13, color:"#9a3412" }}>Mevcut ücret: <strong>{(student.ucret||0).toLocaleString("tr-TR")} TL</strong></p>
        {student.last_raise_date ? <p style={{ margin:"5px 0 0", fontSize:12, color:"#9a3412" }}>Son zam: {fmtMed(student.last_raise_date)}{next ? " · Yeni zam: "+fmtMed(next) : ""}</p> : null}
      </div>
      <label style={LBL}>Yeni 4 Ders Ücreti (TL)</label>
      <input style={INP} type="number" value={fee} onChange={e=>setFee(e.target.value)} />
      <label style={LBL}>Zam Tarihi</label>
      <input style={INP} type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <div style={{ marginTop:16 }}>
        <Btn bg="#f97316" onClick={() => { onSave(student.id, fee, date); onClose(); }}>Zamı Kaydet</Btn>
        <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function WeekCal({ students, offset, setOffset, onStudentClick, teacherName = "" }) {
  const now = new Date();
  const dow = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (dow===0?6:dow-1) + offset*7);
  start.setHours(0,0,0,0);
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  const label = fmtMed(days[0].toISOString()) + " - " + fmtMed(days[6].toISOString());
  const todayMid = midday();
  const dayNames = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  const startMinutes = 10 * 60;
  const endMinutes = 20 * 60;
  const slotMinutes = 15;
  const rowCount = (endMinutes - startMinutes) / slotMinutes;
  const dayKeyToIndex = new Map(days.map((day,index)=>[localDateKey(day), index]));
  const calendarItems = [];
  const addItem = item => {
    const [hour, minute] = String(item.time || "").split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
    const row = Math.round(((hour * 60 + minute) - startMinutes) / slotMinutes);
    if (row < 0 || row >= rowCount) return;
    const duration = Math.max(15, parseInt(item.duration)||45);
    calendarItems.push({ ...item, row, span:Math.max(1, Math.min(rowCount-row, Math.ceil(duration/slotMinutes))) });
  };

  students.forEach(student => {
    if (student.frozen || isStudentLeft(student)) return;
    const schedule = student.schedule || [];
    const packageEnded = calcBalance(schedule) === 0;
    const scheduleDates = schedule.map(lesson=>new Date(lesson.date)).filter(date=>!isNaN(date.getTime()));
    const earliestSchedule = scheduleDates.length ? new Date(Math.min(...scheduleDates.map(date=>date.getTime()))) : null;
    const earliestScheduleWeek = earliestSchedule ? (() => {
      const date = midday(earliestSchedule);
      const day = date.getDay();
      date.setDate(date.getDate() - (day===0 ? 6 : day-1));
      return date;
    })() : null;
    const statedStart = student.lesson_start_date || student.lessonStartDate;
    const programStart = statedStart ? midday(new Date(statedStart+(/^\d{4}-\d{2}-\d{2}$/.test(statedStart)?"T12:00:00":""))) : (earliestScheduleWeek || todayMid);
    const actualKeys = new Set();

    schedule.forEach(lesson => {
      if (teacherName && teacherForDate(student, lesson.date, lesson) !== teacherName) return;
      const dayIndex = dayKeyToIndex.get(localDateKey(lesson.date));
      if (dayIndex === undefined) return;
      const time = lessonTime(student, lesson);
      actualKeys.add(dayIndex+"|"+time);
      addItem({
        key:"lesson-"+student.id+"-"+(lesson.id || localDateKey(lesson.date)+"-"+time),
        student,
        dayIndex,
        time,
        duration:getLessonDuration(student, lesson),
        kind:lesson.status === "telafi" ? "telafi-slot" : "normal",
        subtitle:lesson.status === "telafi" ? "Telafi hakkı · saat boş" : "",
      });
    });

    getStudentSlots(student).forEach((slot,slotIndex) => {
      if (teacherName && studentTeacherName(student) !== teacherName) return;
      const targetDay = slotDayIndex(slot.day);
      const dayIndex = days.findIndex(day=>day.getDay()===targetDay);
      if (dayIndex < 0) return;
      const slotDate = midday(days[dayIndex]);
      if (slotDate < midday(programStart) || slotDate < todayMid) return;
      if (actualKeys.has(dayIndex+"|"+slot.time)) return;
      addItem({
        key:"slot-"+student.id+"-"+slotIndex+"-"+localDateKey(slotDate),
        student,
        dayIndex,
        time:slot.time,
        duration:getLessonDuration(student),
        kind:packageEnded ? "package-ended" : "normal",
        subtitle:packageEnded ? "Paket bitti · yer korunuyor" : "",
      });
    });

    (student.telafi_records || []).forEach(record => {
      const plannedAt = telafiPlannedAt(record);
      if (!plannedAt) return;
      if (teacherName && teacherForDate(student, plannedAt, record) !== teacherName) return;
      const dayIndex = dayKeyToIndex.get(localDateKey(plannedAt));
      if (dayIndex === undefined) return;
      addItem({
        key:"planned-telafi-"+student.id+"-"+(record.id || plannedAt),
        student,
        dayIndex,
        time:timeFromISO(plannedAt),
        duration:record.plannedDurationMinutes || record.planned_duration_minutes || getLessonDuration(student),
        kind:"planned-telafi",
        subtitle:"Planlanmış telafi",
      });
    });
  });

  const groupedItems = Object.values(calendarItems.reduce((groups,item) => {
    const key = item.dayIndex+"|"+item.row;
    if (!groups[key]) groups[key] = { key, dayIndex:item.dayIndex, row:item.row, span:item.span, items:[] };
    groups[key].span = Math.max(groups[key].span, item.span);
    groups[key].items.push(item);
    return groups;
  }, {})).sort((a,b)=>a.dayIndex-b.dayIndex || a.row-b.row);

  const itemColors = {
    normal:{ background:"#526fd4", border:"#344fae", opacity:1 },
    "package-ended":{ background:"#43a66c", border:"#267849", opacity:1 },
    "telafi-slot":{ background:"#526fd4", border:"#344fae", opacity:.28 },
    "planned-telafi":{ background:"#df8a37", border:"#a85c19", opacity:1 },
  };
  return (
    <div>
      <style>{`
        .week-calendar-v66 { overflow:hidden; background:#fff; border:1px solid #e5e7eb; border-radius:14px; }
        .week-calendar-v66-grid { display:grid; grid-template-columns:48px repeat(7,minmax(0,1fr)); grid-template-rows:48px repeat(${rowCount},14px); width:100%; min-width:0; position:relative; }
        .week-calendar-v66-event { min-width:0; height:100%; border:0; border-left:4px solid; border-radius:7px; padding:3px 5px; color:#fff; font-family:inherit; text-align:left; overflow:hidden; cursor:pointer; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; gap:3px; }
        .week-calendar-v66-name,.week-calendar-v66-time { display:block; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .week-calendar-v66-name { font-size:10px; line-height:1.05; font-weight:800; letter-spacing:-.1px; }
        .week-calendar-v66-time { font-size:9px; line-height:1; font-weight:700; font-variant-numeric:tabular-nums; }
        @media (max-width:700px) {
          .week-calendar-v66-grid { grid-template-columns:42px repeat(7,minmax(0,1fr)); }
          .week-calendar-v66-event { border-left-width:2px; padding:3px 2px; }
          .week-calendar-v66-name { font-size:8px; }
          .week-calendar-v66-time { font-size:7px; }
        }
      `}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, background:"#fff", borderRadius:14, padding:"10px 14px", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <button onClick={()=>setOffset(o=>o-1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#111" }}>{label}</p>
          {offset!==0 ? <button onClick={()=>setOffset(0)} style={{ background:"none", border:"none", fontSize:11, color:"#3b82f6", fontWeight:600, cursor:"pointer", padding:0, marginTop:2 }}>Bugüne dön</button> : null}
        </div>
        <button onClick={()=>setOffset(o=>o+1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>›</button>
      </div>
      <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", padding:"0 2px 9px", color:"#64748b", fontSize:11, fontWeight:700 }}>
        {[
          ["#526fd4",1,"Aktif ders"],
          ["#43a66c",1,"Paket bitti · yer korunuyor"],
          ["#526fd4",.28,"Telafi hakkı · saat boş"],
          ["#df8a37",1,"Planlanmış telafi"],
        ].map(([color,opacity,text])=><span key={text} style={{ display:"inline-flex", alignItems:"center", gap:5 }}><span style={{ width:20, height:10, borderRadius:3, background:color, opacity }} />{text}</span>)}
      </div>
      <div className="week-calendar-v66">
        <div className="week-calendar-v66-grid">
          <div style={{ gridColumn:1, gridRow:1, background:"#fbfaf9", borderRight:"1px solid #d1d5db", borderBottom:"1px solid #d1d5db", zIndex:2 }} />
          {days.map((day,index) => {
            const today = midday(day).getTime() === todayMid.getTime();
            return <div key={localDateKey(day)} style={{ gridColumn:index+2, gridRow:1, zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, background:today?"#eff6ff":"#fbfaf9", color:today?"#1d4ed8":"#374151", borderRight:"1px solid #e5e7eb", borderBottom:"1px solid #d1d5db", fontWeight:800, fontSize:11 }}><span>{dayNames[index]}</span><span style={{ color:today?"#2563eb":"#94a3b8", fontSize:10 }}>{day.getDate()} {day.toLocaleDateString("tr-TR",{month:"short"})}</span></div>;
          })}
          {Array.from({length:10},(_,hourIndex) => <div key={hourIndex} style={{ gridColumn:1, gridRow:`${hourIndex*4+2} / span 4`, zIndex:2, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:6, background:"#fbfaf9", color:"#475569", borderRight:"1px solid #d1d5db", borderBottom:"1px solid #d1d5db", fontSize:11, lineHeight:1, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{String(hourIndex+10).padStart(2,"0")}:00</div>)}
          {Array.from({length:rowCount},(_,row) => days.map((day,dayIndex) => <div key={dayIndex+"-"+row} style={{ gridColumn:dayIndex+2, gridRow:row+2, zIndex:0, background:midday(day).getTime()===todayMid.getTime()?"#f8fbff":"#fff", borderRight:"1px solid #eef2f7", borderBottom:(row%4===3?"1px solid #d1d5db":"1px solid #f1f5f9") }} />))}
          {groupedItems.map(group => <div key={group.key} style={{ gridColumn:group.dayIndex+2, gridRow:`${group.row+2} / span ${group.span}`, zIndex:3, display:"flex", gap:2, minWidth:0, padding:"1px 3px" }}>
            {group.items.map(item => {
              const colors = itemColors[item.kind] || itemColors.normal;
              return <button key={item.key} className="week-calendar-v66-event" onClick={()=>onStudentClick(item.student)} style={{ flex:1, background:colors.background, borderLeftColor:colors.border, opacity:colors.opacity }} aria-label={item.student.name+" · "+item.time+(item.subtitle?" · "+item.subtitle:"")}>
                <span className="week-calendar-v66-name" style={{ fontSize:item.student.name.length>16?8:item.student.name.length>12?9:undefined }}>{item.student.name}</span>
                <span className="week-calendar-v66-time">{item.time}</span>
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
  );
}

function studentAge(student) {
  if (!student?.dogum_tarihi) return null;
  const birth = new Date(student.dogum_tarihi+(/^\d{4}-\d{2}-\d{2}$/.test(student.dogum_tarihi)?"T12:00:00":""));
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function ÖğretmenlerPaneli({ students, teachers, onStudentClick }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [teacherWeekOffset, setTeacherWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const activeTeachers = teachers.filter(teacher=>teacher.active);
  const selectedTeacher = activeTeachers.find(teacher=>teacher.id===selectedTeacherId) || null;
  const currentStudentsFor = teacher => students.filter(student => {
    if (student.frozen || isStudentLeft(student)) return false;
    if (student.teacher_id) return student.teacher_id === teacher.id;
    return studentTeacherName(student) === teacher.name;
  });
  const lessonCountsFor = (teacher, targetMonth) => {
    const counts = { normal:0, telafi:0, extra:0 };
    students.forEach(student => {
      (student.schedule || []).forEach(lesson => {
        if (lesson.status === "completed" && inMonth(lesson.date,targetMonth) && teacherForDate(student,lesson.date,lesson) === teacher.name) counts.normal++;
      });
      (student.telafi_records || []).forEach(record => {
        const doneAt = telafiDoneAt(record);
        if (record.done && record.doneStatus !== "counted" && doneAt && inMonth(doneAt,targetMonth) && teacherForDate(student,doneAt,record) === teacher.name) counts.telafi++;
      });
      (student.ek_dersler || []).forEach(extra => {
        if (extra.status === "done" && inMonth(extra.date,targetMonth) && teacherForDate(student,extra.date,extra) === teacher.name) counts.extra++;
      });
    });
    return { ...counts, total:counts.normal+counts.telafi+counts.extra };
  };
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(),now.getMonth(),1);

  if (!selectedTeacher) {
    return (
      <div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
          {activeTeachers.map(teacher => {
            const teacherStudents = currentStudentsFor(teacher);
            const counts = lessonCountsFor(teacher,currentMonth);
            return <button key={teacher.id} onClick={()=>{ setSelectedTeacherId(teacher.id); setTeacherWeekOffset(0); setMonthOffset(0); }} style={{ ...CARD, border:"1px solid #e8eaee", padding:"18px", textAlign:"left", cursor:"pointer", fontFamily:"inherit", background:"#fff" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
                <div><p style={{ margin:0, color:"#111", fontSize:17, fontWeight:850 }}>{teacher.name}</p><p style={{ margin:"5px 0 0", color:"#64748b", fontSize:12, fontWeight:650 }}>{teacherStudents.length} aktif öğrenci · Bu ay {counts.total} ders</p></div>
                <span style={{ width:34, height:34, borderRadius:12, display:"grid", placeItems:"center", background:"#eeeafd", color:"#6d28d9", fontSize:20, fontWeight:800 }}>›</span>
              </div>
            </button>;
          })}
        </div>
        {activeTeachers.length===0 ? <div style={{ textAlign:"center", padding:"48px 20px", color:"#94a3b8" }}><p style={{ fontSize:34, margin:"0 0 8px" }}>♬</p><p style={{ margin:0, fontWeight:700 }}>Aktif öğretmen bulunmuyor</p></div> : null}
      </div>
    );
  }

  const teacherStudents = currentStudentsFor(selectedTeacher).sort((a,b)=>a.name.localeCompare(b.name,"tr"));
  const targetMonth = new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
  const monthName = targetMonth.toLocaleDateString("tr-TR",{ month:"long", year:"numeric" });
  const counts = lessonCountsFor(selectedTeacher,targetMonth);
  return (
    <div>
      <button onClick={()=>setSelectedTeacherId(null)} style={{ border:"none", background:"transparent", color:"#6d28d9", fontWeight:800, fontSize:13, padding:"0 0 12px", cursor:"pointer", fontFamily:"inherit" }}>‹ Öğretmenlere dön</button>
      <div style={{ ...CARD, padding:"15px 17px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
        <div><p style={{ margin:0, fontSize:18, fontWeight:850, color:"#111" }}>{selectedTeacher.name}</p><p style={{ margin:"4px 0 0", fontSize:12, color:"#64748b", fontWeight:650 }}>{teacherStudents.length} aktif öğrenci</p></div>
        <TonePill tone="good">Aktif</TonePill>
      </div>

      <section style={{ marginBottom:20 }}>
        <p style={{ margin:"0 0 9px", fontSize:13, fontWeight:850, color:"#374151" }}>Haftalık ders takvimi</p>
        <WeekCal students={students} offset={teacherWeekOffset} setOffset={setTeacherWeekOffset} onStudentClick={onStudentClick} teacherName={selectedTeacher.name} />
      </section>

      <section style={{ ...CARD, padding:"16px 18px", marginBottom:16 }}>
        <p style={{ margin:"0 0 10px", fontSize:14, fontWeight:850, color:"#111" }}>Öğrenciler ({teacherStudents.length})</p>
        {teacherStudents.map(student => {
          const age = studentAge(student);
          return <button key={student.id} onClick={()=>onStudentClick(student)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 2px", border:"none", borderBottom:"1px solid #eef2f7", background:"transparent", textAlign:"left", cursor:"pointer", fontFamily:"inherit" }}>
            <strong style={{ color:"#111", fontSize:13 }}>{student.name}</strong>
            <span style={{ color:"#64748b", fontSize:12, textAlign:"right" }}>{age===null?"Yaş belirtilmemiş":age+" yaş"} · {student.instrument || "Enstrüman belirtilmemiş"} ›</span>
          </button>;
        })}
        {teacherStudents.length===0 ? <p style={{ margin:0, color:"#94a3b8", fontSize:13 }}>Bu öğretmene bağlı aktif öğrenci yok.</p> : null}
      </section>

      <section style={{ ...CARD, padding:"16px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <button onClick={()=>setMonthOffset(value=>value-1)} style={{ border:"none", borderRadius:8, background:"#f3f4f6", padding:"6px 12px", cursor:"pointer", fontSize:18 }}>‹</button>
          <div style={{ textAlign:"center" }}><p style={{ margin:0, fontSize:14, fontWeight:800, color:"#111", textTransform:"capitalize" }}>{monthName}</p>{monthOffset!==0?<button onClick={()=>setMonthOffset(0)} style={{ border:"none", background:"transparent", padding:"3px 0 0", color:"#6d28d9", fontSize:11, fontWeight:700, cursor:"pointer" }}>Bu aya dön</button>:null}</div>
          <button onClick={()=>setMonthOffset(value=>value+1)} style={{ border:"none", borderRadius:8, background:"#f3f4f6", padding:"6px 12px", cursor:"pointer", fontSize:18 }}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))", gap:8 }}>
          <MiniMetric label="Toplam" value={counts.total} tone="info" />
          <MiniMetric label="Normal" value={counts.normal} tone="good" />
          <MiniMetric label="Telafi" value={counts.telafi} tone="special" />
          <MiniMetric label="Ek Ders" value={counts.extra} tone="warn" />
        </div>
      </section>
    </div>
  );
}

function İletişimPaneli({ students, onStudentClick, onMessage, onStatusChange }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [googleConfirmId, setGoogleConfirmId] = useState(null);
  const activeStudents = students.filter(student=>!student.frozen && !isStudentLeft(student));
  const counts = {
    whatsapp:activeStudents.filter(student=>communicationFlag(student,"whatsapp_group")).length,
    newsletter:activeStudents.filter(student=>communicationFlag(student,"newsletter")).length,
    rules:activeStudents.filter(student=>communicationFlag(student,"rules_sent")).length,
    review:activeStudents.filter(student=>googleReviewState(student).key==="completed").length,
  };
  const visibleStudents = activeStudents.filter(student=>{
    if (search.trim() && !student.name.toLocaleLowerCase("tr-TR").includes(search.trim().toLocaleLowerCase("tr-TR"))) return false;
    if (filter==="incomplete") return !communicationFlag(student,"whatsapp_group") || !communicationFlag(student,"newsletter") || !communicationFlag(student,"rules_sent") || !["completed","closed"].includes(googleReviewState(student).key);
    if (filter==="whatsapp") return !communicationFlag(student,"whatsapp_group");
    if (filter==="newsletter") return !communicationFlag(student,"newsletter");
    if (filter==="rules") return !communicationFlag(student,"rules_sent");
    if (filter==="review") return googleReviewState(student).key!=="completed";
    return true;
  }).sort((a,b)=>a.name.localeCompare(b.name,"tr"));
  const smallAction = { border:"none", borderRadius:8, padding:"6px 8px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"inherit" };
  const sendGoogle = student => {
    onMessage(student,msgGoogleReview(student),"Google yorum mesajı WhatsApp'ta hazırlandı");
    setGoogleConfirmId(student.id);
  };
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:8, marginBottom:14 }}>
        <MiniMetric label="WhatsApp Grubunda" value={counts.whatsapp+" / "+activeStudents.length} tone="good" />
        <MiniMetric label="Bültene Abone" value={counts.newsletter+" / "+activeStudents.length} tone="info" />
        <MiniMetric label="Kurallar Gönderildi" value={counts.rules+" / "+activeStudents.length} tone="special" />
        <MiniMetric label="Google Yorumu Yaptı" value={counts.review+" / "+activeStudents.length} tone="warn" />
      </div>
      <div style={{ ...CARD, padding:"12px", marginBottom:12 }}>
        <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Öğrenci ara..." style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 12px", boxSizing:"border-box", fontFamily:"inherit", marginBottom:9 }} />
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["all","Tümü"],["incomplete","Eksikler"],["whatsapp","WhatsApp"],["newsletter","Bülten"],["rules","Kurallar"],["review","Google Yorumu"]].map(([key,label])=><button key={key} onClick={()=>setFilter(key)} style={{ ...smallAction, background:filter===key?"#5b42d6":"#f3f4f6", color:filter===key?"#fff":"#475569" }}>{label}</button>)}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {visibleStudents.map(student=>{
          const waJoined = communicationFlag(student,"whatsapp_group");
          const subscribed = communicationFlag(student,"newsletter");
          const rulesSent = communicationFlag(student,"rules_sent");
          const review = googleReviewState(student);
          return <div key={student.id} style={{ ...CARD, padding:"15px 16px" }}>
            <button onClick={()=>onStudentClick(student)} style={{ border:"none", background:"transparent", padding:0, margin:"0 0 11px", color:"#111", fontSize:15, fontWeight:850, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>{student.name} <span style={{ color:"#94a3b8", fontSize:11 }}>· {student.instrument}</span></button>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(205px,1fr))", gap:8 }}>
              <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center" }}><strong style={{ fontSize:12 }}>WhatsApp Grubu</strong><TonePill tone={waJoined?"good":"neutral"}>{waJoined?"Katıldı":"Katılmadı"}</TonePill></div>
                <div style={{ display:"flex", gap:6, marginTop:8 }}><button onClick={()=>onMessage(student,msgWhatsAppGroup(student),"Grup daveti WhatsApp'ta hazırlandı")} style={{ ...smallAction, background:"#dcfce7", color:"#166534" }}>Davet Gönder</button><button onClick={()=>onStatusChange(student,"whatsapp_group",!waJoined)} style={{ ...smallAction, background:waJoined?"#f3f4f6":"#111", color:waJoined?"#475569":"#fff" }}>{waJoined?"Geri Al":"Katıldı"}</button></div>
              </div>
              <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center" }}><strong style={{ fontSize:12 }}>Bülten</strong><TonePill tone={subscribed?"info":"neutral"}>{subscribed?"Abone":"Abone değil"}</TonePill></div>
                <div style={{ display:"flex", gap:6, marginTop:8 }}><button onClick={()=>onMessage(student,msgNewsletter(student),"Bülten bağlantısı WhatsApp'ta hazırlandı")} style={{ ...smallAction, background:"#dbeafe", color:"#1d4ed8" }}>Link Gönder</button><button onClick={()=>onStatusChange(student,"newsletter",!subscribed)} style={{ ...smallAction, background:subscribed?"#f3f4f6":"#111", color:subscribed?"#475569":"#fff" }}>{subscribed?"Geri Al":"Abone Oldu"}</button></div>
              </div>
              <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center" }}><strong style={{ fontSize:12 }}>Ders Kuralları</strong><TonePill tone={rulesSent?"special":"neutral"}>{rulesSent?"Gönderildi":"Gönderilmedi"}</TonePill></div>
                <div style={{ display:"flex", gap:6, marginTop:8 }}><button onClick={()=>onMessage(student,msgYeniKayitKurallari(),"Ders kuralları WhatsApp'ta hazırlandı")} style={{ ...smallAction, background:"#ede9fe", color:"#5b21b6" }}>Gönder</button><button onClick={()=>onStatusChange(student,"rules_sent",!rulesSent)} style={{ ...smallAction, background:rulesSent?"#f3f4f6":"#111", color:rulesSent?"#475569":"#fff" }}>{rulesSent?"Geri Al":"Gönderildi"}</button></div>
              </div>
              <div style={{ background:"#fff7ed", borderRadius:10, padding:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center" }}><strong style={{ fontSize:12 }}>Google Yorumu</strong><TonePill tone={review.key==="completed"?"good":review.key==="check"||review.key==="due"?"warn":"neutral"}>{review.label}</TonePill></div>
                <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                  {review.key!=="completed"&&review.key!=="closed"?<button onClick={()=>sendGoogle(student)} style={{ ...smallAction, background:"#f97316", color:"#fff" }}>Yorum Linkini Gönder</button>:null}
                  {googleConfirmId===student.id?<><button onClick={()=>{ onStatusChange(student,"google_review","requested"); setGoogleConfirmId(null); }} style={{ ...smallAction, background:"#111", color:"#fff" }}>Gönderdim</button><button onClick={()=>setGoogleConfirmId(null)} style={{ ...smallAction, background:"#f3f4f6", color:"#475569" }}>Göndermedim</button></>:null}
                  {review.key==="requested"||review.key==="check"?<button onClick={()=>onStatusChange(student,"google_review","completed")} style={{ ...smallAction, background:"#dcfce7", color:"#166534" }}>Yaptı</button>:null}
                  {review.key==="check"?<><button onClick={()=>onStatusChange(student,"google_review","waiting",{ remindAt:addDays(new Date().toISOString(),7) })} style={{ ...smallAction, background:"#fef3c7", color:"#92400e" }}>Yapmadı · 7 gün sonra</button><button onClick={()=>onStatusChange(student,"google_review","closed")} style={{ ...smallAction, background:"#f3f4f6", color:"#475569" }}>Takibi Kapat</button></>:null}
                </div>
              </div>
            </div>
          </div>;
        })}
        {visibleStudents.length===0?<div style={{ textAlign:"center", padding:"42px 20px", color:"#94a3b8", fontWeight:700 }}>Bu filtrede öğrenci yok.</div>:null}
      </div>
    </div>
  );
}

function YeniÖğrenciİletişimSheet({ student, onClose, onMessage, onStatusChange }) {
  const waJoined = communicationFlag(student,"whatsapp_group");
  const subscribed = communicationFlag(student,"newsletter");
  const rulesSent = communicationFlag(student,"rules_sent");
  const action = { border:"none", borderRadius:9, padding:"8px 10px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" };
  const row = (title,status,sendLabel,onSend,doneLabel,onDone,tone="neutral") => <div style={{ background:"#f8fafc", border:"1px solid #eef2f7", borderRadius:12, padding:"12px", marginBottom:9 }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}><strong style={{ fontSize:13 }}>{title}</strong><TonePill tone={status?tone:"neutral"}>{status?doneLabel:"Bekliyor"}</TonePill></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginTop:9 }}><button onClick={onSend} style={{ ...action, background:"#25D366", color:"#fff" }}>{sendLabel}</button><button onClick={onDone} style={{ ...action, background:status?"#f3f4f6":"#111", color:status?"#475569":"#fff" }}>{status?"Geri Al":doneLabel}</button></div></div>;
  return <Sheet title="Yeni Öğrenci İletişimi" subtitle={student.name+" başarıyla kaydedildi"} onClose={onClose}>
    {row("WhatsApp Grubu",waJoined,"Grup Davetini Gönder",()=>onMessage(student,msgWhatsAppGroup(student),"Grup daveti WhatsApp'ta hazırlandı"),"Katıldı",()=>onStatusChange(student,"whatsapp_group",!waJoined),"good")}
    {row("Bülten",subscribed,"Abonelik Linkini Gönder",()=>onMessage(student,msgNewsletter(student),"Bülten bağlantısı WhatsApp'ta hazırlandı"),"Abone Oldu",()=>onStatusChange(student,"newsletter",!subscribed),"info")}
    {row("Ders Kuralları",rulesSent,"Kuralları Gönder",()=>onMessage(student,msgYeniKayitKurallari(),"Ders kuralları WhatsApp'ta hazırlandı"),"Gönderildi",()=>onStatusChange(student,"rules_sent",!rulesSent),"special")}
    <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:"12px", marginBottom:13 }}><strong style={{ display:"block", fontSize:13, color:"#9a3412" }}>Google Yorumu</strong><span style={{ display:"block", marginTop:4, fontSize:12, color:"#9a3412" }}>İlk tamamlanan dersten bir ay sonra İletişim sekmesinde hatırlatılacak. Yorum linki oradan daha önce de gönderilebilir.</span></div>
    <Btn bg="#111" onClick={onClose}>Tamam</Btn>
  </Sheet>;
}

function BugünDersleri({ students, onWA, onWATelafi, onReminderToggle, onStudentClick, onTelafiClick }) {
  const todayLessons = [];
  students.forEach(s => {
    if (s.frozen || isStudentLeft(s)) return;
    s.schedule.forEach(l => {
      if (isToday(l.date) && l.status === "upcoming") todayLessons.push({ kind:"normal", student:s, lesson:l, time:lessonTime(s,l) });
    });
    (s.telafi_records || []).forEach(record => {
      const plannedAt = telafiPlannedAt(record);
      if (isCurrentTelafi(record) && plannedAt && isToday(plannedAt)) {
        todayLessons.push({ kind:"telafi", student:s, record, time:timeFromISO(plannedAt) });
      }
    });
  });
  todayLessons.sort((a,b) => a.time.localeCompare(b.time) || a.student.name.localeCompare(b.student.name,"tr"));
  if (todayLessons.length === 0) return null;
  return (
    <AçılırBugünBölümü title={`Bugünün Dersleri (${todayLessons.length})`} color="#0369a1" style={{ background:"#f0f9ff", border:"1.5px solid #bae6fd", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      {todayLessons.map(({kind, student, lesson, record, time}) => {
        const reminderRef = kind === "telafi" ? telafiReminderRef(record) : (lesson.id || dateKey(lesson.date));
        const sent = lessonReminderSentInfo(student, { id:reminderRef });
        const occurrenceDate = kind === "telafi" ? telafiPlannedAt(record) : lesson.date;
        const occurrenceRef = homeworkCheckRef(kind === "telafi" ? "telafi" : "schedule", kind === "telafi" ? record.id : lesson.id);
        const pendingHomework = pendingHomeworkBefore(student, occurrenceDate, occurrenceRef);
        return (
        <div key={kind+"-"+(lesson?.id || record?.id)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #e0f2fe" }}>
          <div onClick={() => kind === "telafi" ? onTelafiClick(student) : onStudentClick(student)} style={{ cursor:"pointer" }}>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{student.name}</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:kind==="telafi"?"#7e22ce":"#0369a1", fontWeight:kind==="telafi"?700:400 }}>{time} · {student.instrument}{kind === "telafi" ? " · Telafi dersi" : ""}</p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:sent?"#059669":"#64748b", fontWeight:700 }}>{sent ? "Hatırlatma gönderildi" : "Hatırlatma bekliyor"}</p>
            {pendingHomework ? <p style={{ margin:"3px 0 0", fontSize:11, color:"#b45309", fontWeight:800 }}>● Ödev kontrolü var</p> : null}
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {student.phone ? (
              <button onClick={() => kind === "telafi" ? onWATelafi(student, record) : onWA(student, lesson)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>WA</button>
            ) : null}
            <button onClick={() => onReminderToggle(student.id, reminderRef, !sent)} style={{ background:sent?"#dcfce7":"#f8fafc", color:sent?"#166534":"#475569", border:"1px solid #dbeafe", borderRadius:10, padding:"7px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{sent ? "Geri Al" : "İşaretle"}</button>
          </div>
        </div>
      );})}
    </AçılırBugünBölümü>
  );
}

function BekleyenTelafiler({ students, onStudentClick }) {
  const telafiler = [];
  students.forEach(student => {
    if (isStudentLeft(student)) return;
    (student.telafi_records || []).forEach(record => {
      if (isCurrentTelafi(record)) telafiler.push({ student, record });
    });
  });
  telafiler.sort((a,b) => {
    const parsedA = a.record.expiry ? new Date(a.record.expiry).getTime() : NaN;
    const parsedB = b.record.expiry ? new Date(b.record.expiry).getTime() : NaN;
    const aTime = Number.isFinite(parsedA) ? parsedA : Number.MAX_SAFE_INTEGER;
    const bTime = Number.isFinite(parsedB) ? parsedB : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.student.name.localeCompare(b.student.name, "tr");
  });
  if (telafiler.length === 0) return null;
  return (
    <AçılırBugünBölümü title={`Bekleyen Telafiler (${telafiler.length})`} color="#1d4ed8" style={{ background:"#eff6ff", border:"1.5px solid #93c5fd", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      {telafiler.map(({student, record}, index) => {
        const kalan = daysLeft(record.expiry);
        const acil = Number.isFinite(kalan) && kalan <= 7;
        const renk = acil ? "#d97706" : "#0284c7";
        return (
          <div key={student.id+"-"+record.id} onClick={() => onStudentClick(student)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"9px 0", borderBottom:index<telafiler.length-1?"1px solid #dbeafe":"none", cursor:"pointer" }}>
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{student.name}</p>
              <p style={{ margin:"2px 0 0", fontSize:12, color:"#475569" }}>{fmtShort(record.lessonDate)} dersinin telafisi</p>
              {telafiPlannedAt(record) ? <p style={{ margin:"2px 0 0", fontSize:12, color:"#7e22ce", fontWeight:700 }}>Plan: {fmtDate(telafiPlannedAt(record))} · {timeFromISO(telafiPlannedAt(record))}</p> : null}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <p style={{ margin:"0 0 4px", fontSize:11, color:"#64748b" }}>{record.expiry ? fmtMed(record.expiry) : "Süre belirtilmedi"}</p>
              <span style={{ display:"inline-block", background:renk, color:"#fff", borderRadius:20, padding:"4px 10px", fontSize:12, fontWeight:800 }}>{Number.isFinite(kalan) ? kalan+" gün" : "Süre yok"}</span>
            </div>
          </div>
        );
      })}
    </AçılırBugünBölümü>
  );
}

function BugünÖdemeleri({ students, onÖdemeAl, onMesaj, onStudentClick }) {
  const todayMid = midday();
  const [odemeModal, setÖdemeModal] = useState(null);
  const [odemeDate, setÖdemeDate] = useState(new Date().toISOString().split("T")[0]);

  const ödemeInfo = (student) => currentPaymentDueInfo(student);
  const bugünÖdeme = students.filter(s => {
    const info = ödemeInfo(s);
    return info && isToday(info.start);
  });

  const gecikenler = students.filter(s => {
    const info = ödemeInfo(s);
    if (!info) return false;
    if (bugünÖdeme.some(x=>x.id===s.id)) return false;
    const ilkDersTarih = midday(new Date(info.start));
    return ilkDersTarih < todayMid;
  });

  if (bugünÖdeme.length === 0 && gecikenler.length === 0) return null;

  return (
    <>
    <div style={{ marginBottom:14 }}>
      {bugünÖdeme.length > 0 ? (
        <AçılırBugünBölümü title={`Bugünkü Ödemeler (${bugünÖdeme.length})`} color="#c2410c" style={{ background:"#fff7ed", border:"1.5px solid #fb923c", borderRadius:14, padding:"12px 16px", marginBottom:10 }}>
          {bugünÖdeme.map(s => {
            const info = ödemeInfo(s);
            return (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fed7aa" }}>
              <div onClick={() => onStudentClick(s)} style={{ cursor:"pointer" }}>
                <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#9a3412" }}>{info?.donem || "Yeni dönem"} · {s.instrument} · {studentScheduleLabel(s)}</p>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; if(p) window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msgIlkDersÖdeme(s)),"_blank"); else onMesaj(s); }} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Mesaj</button>
                <button onClick={() => { setÖdemeDate(new Date().toISOString().split("T")[0]); setÖdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Yapıldı</button>
              </div>
            </div>
            );
          })}
        </AçılırBugünBölümü>
      ) : null}
      {gecikenler.length > 0 ? (
        <AçılırBugünBölümü title={`Geciken Ödemeler (${gecikenler.length})`} color="#be123c" style={{ background:"#fff1f2", border:"1.5px solid #fca5a5", borderRadius:14, padding:"12px 16px" }}>
          {gecikenler.map(s => {
            const info = ödemeInfo(s);
            const geciken = info ? paymentOverdueDays(info.start) : 0;
            return (
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fecdd3" }}>
                <div onClick={() => onStudentClick(s)} style={{ cursor:"pointer" }}>
                  <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#be123c" }}><strong>{geciken} gün</strong> gecikti</p>
                </div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"flex-end" }}>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; if(p) window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msgÖdemeHatirlatma()),"_blank"); }} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>WA 1</button>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; if(p) window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msgÖdemeHatirlatma2(s)),"_blank"); }} style={{ background:"#fef9c3", color:"#854d0e", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>WA 2</button>
                  <button onClick={() => { const p=s.phone?s.phone.replace(/[^0-9]/g,""):""; if(p) window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msgÖdemeHatirlatma3(s)),"_blank"); }} style={{ background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>WA 3</button>
                  <button onClick={() => { setÖdemeDate(new Date().toISOString().split("T")[0]); setÖdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Yapıldı</button>
                </div>
              </div>
            );
          })}
        </AçılırBugünBölümü>
      ) : null}
    </div>
    {odemeModal ? (
      <Sheet title="Ödeme Alındı" subtitle={odemeModal.name} onClose={() => setÖdemeModal(null)}>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Ödeme tarihi:</p>
        <input style={INP} type="date" value={odemeDate} onChange={e=>setÖdemeDate(e.target.value)} />
        <div style={{ marginTop:16 }}>
          <Btn bg="#10b981" onClick={() => { onÖdemeAl(odemeModal.id, odemeDate); setÖdemeModal(null); }}>Kaydet</Btn>
          <Btn bg="#111" outline onClick={() => setÖdemeModal(null)}>İptal</Btn>
        </div>
      </Sheet>
    ) : null}
    </>
  );
}

function previousCalendarMonth(reference = new Date()) {
  return new Date(reference.getFullYear(), reference.getMonth()-1, 1);
}

function monthReportKey(date) {
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
}

function monthReportDate(date) {
  return monthReportKey(date)+"-01";
}

function monthReportLabel(date) {
  const label = date.toLocaleDateString("tr-TR", { month:"long", year:"numeric" });
  return label.charAt(0).toLocaleUpperCase("tr-TR")+label.slice(1);
}

function reportMonthsToEnsure(existingReports, reference = new Date()) {
  const end = previousCalendarMonth(reference);
  const cursor = new Date(MONTHLY_REPORT_START+"T12:00:00");
  const existing = new Set((existingReports || []).map(row=>String(row.report_month || "").slice(0,7)));
  const months = [];
  while (monthReportKey(cursor) <= monthReportKey(end)) {
    if (!existing.has(monthReportKey(cursor))) months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth()+1);
  }
  return months;
}

function studentWasActiveAt(student,cutoff) {
  const cutoffTime = new Date(cutoff).getTime();
  const startValue = student.lesson_start_date || student.lessonStartDate || student.created_at;
  if (startValue && new Date(startValue).getTime()>cutoffTime) return false;
  const events = [...(student.status_history || [])]
    .filter(event=>event?.at && new Date(event.at).getTime()<=cutoffTime && ["frozen","active","left","deleted"].includes(event.type))
    .sort((a,b)=>new Date(a.at)-new Date(b.at));
  if (events.length) return events[events.length-1].type === "active";
  if (student.left_at && new Date(student.left_at).getTime()<=cutoffTime) return false;
  return !student.frozen && !isStudentDeleted(student);
}

function buildMonthlyInstitutionReport(students, teachers, expenses, targetMonth, branch) {
  const payments = [];
  const normalLessons = [];
  const noShows = [];
  const lastMinutes = [];
  const completedMakeups = [];
  const createdMakeups = [];
  const expiredMakeups = [];
  const extraLessons = [];
  const lessonScores = [];
  const periodEvaluations = [];
  const pieces = [];
  const frozenIds = new Set();
  const leftIds = new Set();
  const teacherCounts = {};
  const monthEnd = new Date(targetMonth.getFullYear(),targetMonth.getMonth()+1,0,23,59,59,999);

  const addTeacherLesson = name => {
    const teacherName = name || "Öğretmen belirtilmemiş";
    teacherCounts[teacherName] = (teacherCounts[teacherName] || 0) + 1;
  };

  (students || []).forEach(student => {
    (student.odemeler || []).forEach(payment => {
      if (!inMonth(payment.tarih,targetMonth)) return;
      const amount = typeof payment.tutar === "number" ? payment.tutar : (Number(student.ucret) || 0);
      payments.push({ amount, student:student.name, date:payment.tarih });
    });

    (student.schedule || []).forEach(lesson => {
      if (!inMonth(lesson.date,targetMonth)) return;
      if (lesson.status === "completed") {
        normalLessons.push(lesson);
        addTeacherLesson(teacherForDate(student,lesson.date,lesson));
        const score = storedLessonScore(lesson);
        if (score !== null) lessonScores.push(score);
      }
      if (lesson.status === "noshow") noShows.push(lesson);
      if (lesson.status === "lastminute") lastMinutes.push(lesson);
    });

    (student.telafi_records || []).forEach(record => {
      if (record.createdAt && inMonth(record.createdAt,targetMonth)) createdMakeups.push(record);
      const doneAt = telafiDoneAt(record);
      if (record.done && record.doneStatus !== "counted" && doneAt && inMonth(doneAt,targetMonth)) {
        completedMakeups.push(record);
        addTeacherLesson(teacherForDate(student,doneAt,record));
      }
      if (!record.done && record.expiry && inMonth(record.expiry,targetMonth) && new Date(record.expiry) <= monthEnd) expiredMakeups.push(record);
    });

    (student.ek_dersler || []).forEach(extra => {
      if (extra.status !== "done" || !inMonth(extra.date,targetMonth)) return;
      extraLessons.push(extra);
      addTeacherLesson(teacherForDate(student,extra.date,extra));
    });

    (student.status_history || []).forEach(event => {
      if (!inMonth(event.at,targetMonth)) return;
      if (event.type === "frozen") frozenIds.add(student.id);
      if (event.type === "left") leftIds.add(student.id);
    });

    (student.package_summary_logs || []).forEach(log => {
      if (!log?.evaluation) return;
      const evaluationDate = log.packageEnd || log.evaluatedAt;
      if (!inMonth(evaluationDate,targetMonth)) return;
      periodEvaluations.push(log.evaluation);
      if (log.evaluation.pieceName) pieces.push({ student:student.name, name:log.evaluation.pieceName, result:log.evaluation.pieceLabel || "" });
    });
  });

  const monthExpenses = (expenses || []).filter(expense=>expenseAppliesToMonth(expense,targetMonth));
  const expenseCategories = monthExpenses.reduce((acc,expense) => {
    const category = expense.category || "Diğer";
    acc[category] = (acc[category] || 0) + (Number(expense.amount) || 0);
    return acc;
  },{});
  const revenue = payments.reduce((sum,payment)=>sum+payment.amount,0);
  const expenseTotal = monthExpenses.reduce((sum,expense)=>sum+(Number(expense.amount)||0),0);
  const operational = (students || []).filter(student=>!isStudentDeleted(student));
  const activeStudents = operational.filter(student=>studentWasActiveAt(student,monthEnd));
  const newStudents = operational.filter(student=>inMonth(student.lesson_start_date || student.lessonStartDate,targetMonth));
  const lessonAverage = lessonScores.length ? roundedScore(lessonScores.reduce((sum,score)=>sum+score,0)/lessonScores.length) : null;
  const periodAverage = periodEvaluations.length ? roundedScore(periodEvaluations.reduce((sum,evaluation)=>sum+(Number(evaluation.periodScore)||0),0)/periodEvaluations.length) : null;

  return {
    schemaVersion:1,
    branchCode:branch?.code || CURRENT_BRANCH_CODE,
    branchName:branch?.name || "Bodrum Sonsuz Sanat",
    key:monthReportKey(targetMonth),
    label:monthReportLabel(targetMonth),
    periodStart:monthReportDate(targetMonth),
    periodEnd:localDateKey(monthEnd),
    generatedAt:new Date().toISOString(),
    revenue,
    expenseTotal,
    netProfit:revenue-expenseTotal,
    paymentCount:payments.length,
    expenseCount:monthExpenses.length,
    expenseCategories:Object.entries(expenseCategories).sort((a,b)=>b[1]-a[1]),
    activeStudentCount:activeStudents.length,
    newStudentCount:newStudents.length,
    frozenCount:frozenIds.size,
    leftCount:leftIds.size,
    normalLessonCount:normalLessons.length,
    makeupCreatedCount:createdMakeups.length,
    makeupCompletedCount:completedMakeups.length,
    makeupExpiredCount:expiredMakeups.length,
    extraLessonCount:extraLessons.length,
    noShowCount:noShows.length,
    lastMinuteCount:lastMinutes.length,
    lessonScoreCount:lessonScores.length,
    lessonAverage,
    periodCount:periodEvaluations.length,
    periodAverage,
    pieces,
    teacherRows:Object.entries(teacherCounts).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],"tr")),
  };
}

function reportFromRow(row) {
  return { ...(row?.report_data || {}), id:row?.id, reportMonth:row?.report_month, downloadedAt:row?.downloaded_at || null };
}

function concatPdfBytes(parts) {
  const total = parts.reduce((sum,part)=>sum+part.length,0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part=>{ output.set(part,offset); offset += part.length; });
  return output;
}

function jpegImagePdfBytes(jpegBytes,width,height) {
  const encode = value=>new TextEncoder().encode(value);
  const objects = [];
  const content = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
  objects[1] = encode("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects[3] = encode("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
  objects[4] = concatPdfBytes([encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),jpegBytes,encode("\nendstream")]);
  objects[5] = encode(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  const parts = [encode("%PDF-1.4\n%1234\n")];
  const offsets = [0];
  let length = parts[0].length;
  for (let i=1;i<=5;i++) {
    offsets[i] = length;
    const bytes = concatPdfBytes([encode(`${i} 0 obj\n`),objects[i],encode("\nendobj\n")]);
    parts.push(bytes);
    length += bytes.length;
  }
  const xrefOffset = length;
  const xref = ["xref","0 6","0000000000 65535 f "];
  for (let i=1;i<=5;i++) xref.push(String(offsets[i]).padStart(10,"0")+" 00000 n ");
  parts.push(encode(xref.join("\n")+`\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concatPdfBytes(parts);
}

function roundedCanvasRect(ctx,x,y,width,height,radius,fill) {
  ctx.beginPath();
  ctx.roundRect(x,y,width,height,radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function wrapCanvasText(ctx,text,maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach(word=>{
    const candidate = line ? line+" "+word : word;
    if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  });
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function monthlyReportCanvas(report) {
  const scale = 2;
  const width = 1240;
  const height = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = width*scale;
  canvas.height = height*scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale,scale);
  ctx.fillStyle = "#f7f5fb";
  ctx.fillRect(0,0,width,height);
  const margin = 72;
  const contentWidth = width-margin*2;
  let y = 70;

  ctx.fillStyle = "#6d28d9";
  ctx.font = "800 25px Arial";
  ctx.fillText(String(report.branchName || "SONSUZ SANAT").toLocaleUpperCase("tr-TR"),margin,y);
  y += 56;
  ctx.fillStyle = "#17131d";
  ctx.font = "900 52px Arial";
  ctx.fillText("Ay Sonu Yönetim Raporu",margin,y);
  y += 42;
  ctx.fillStyle = "#6b6474";
  ctx.font = "600 24px Arial";
  ctx.fillText(report.label+" · Oluşturulma: "+fmtMed(report.generatedAt),margin,y);
  y += 52;

  const cardGap = 16;
  const cardWidth = (contentWidth-cardGap*3)/4;
  const cards = [
    ["TAHSİLAT",report.revenue.toLocaleString("tr-TR")+" TL","#dcfce7","#047857"],
    ["GİDER",report.expenseTotal.toLocaleString("tr-TR")+" TL","#fee2e2","#b91c1c"],
    ["NET KÂR",report.netProfit.toLocaleString("tr-TR")+" TL",report.netProfit>=0?"#ede9fe":"#ffe4e6",report.netProfit>=0?"#6d28d9":"#be123c"],
    ["AY SONU AKTİF",String(report.activeStudentCount),"#e0f2fe","#0369a1"],
  ];
  cards.forEach((card,index)=>{
    const x = margin+index*(cardWidth+cardGap);
    roundedCanvasRect(ctx,x,y,cardWidth,128,18,card[2]);
    ctx.fillStyle = card[3];
    ctx.font = "800 18px Arial";
    ctx.fillText(card[0],x+20,y+34);
    ctx.font = "900 27px Arial";
    wrapCanvasText(ctx,card[1],cardWidth-40).slice(0,2).forEach((line,lineIndex)=>ctx.fillText(line,x+20,y+72+lineIndex*30));
  });
  y += 158;

  const drawSection = (title,rows,accent="#6d28d9")=>{
    ctx.font = "600 19px Arial";
    const prepared = rows.flatMap(row=>wrapCanvasText(ctx,row,contentWidth-78));
    const sectionHeight = 64+prepared.length*29+20;
    roundedCanvasRect(ctx,margin,y,contentWidth,sectionHeight,18,"#ffffff");
    ctx.fillStyle = accent;
    ctx.font = "900 22px Arial";
    ctx.fillText(title,margin+28,y+38);
    ctx.fillStyle = "#3f3947";
    ctx.font = "600 19px Arial";
    prepared.forEach((line,index)=>ctx.fillText("• "+line,margin+30,y+76+index*29));
    y += sectionHeight+16;
  };

  drawSection("Finans",[
    `${report.paymentCount} ödeme · ${report.expenseCount} gider kaydı`,
    report.expenseCategories.length ? "Gider dağılımı: "+report.expenseCategories.map(([category,amount])=>category+" "+amount.toLocaleString("tr-TR")+" TL").join(" · ") : "Bu ay gider kaydı yok",
  ],"#047857");
  drawSection("Dersler",[
    `${report.normalLessonCount} normal ders · ${report.makeupCompletedCount} telafi · ${report.extraLessonCount} ek ders`,
    `${report.noShowCount} no-show · ${report.lastMinuteCount} son dakika iptali`,
    `${report.makeupCreatedCount} telafi hakkı oluşturuldu · ${report.makeupExpiredCount} telafi hakkının süresi doldu`,
  ],"#0369a1");
  drawSection("Öğrenciler ve Takip",[
    `${report.newStudentCount} yeni kayıt · ${report.frozenCount} donduran · ${report.leftCount} ayrılan`,
    `Ay sonunda ${report.activeStudentCount} aktif öğrenci`,
  ],"#7e22ce");
  const pieceSummary = report.pieces.length
    ? "Tamamlanan parçalar: "+report.pieces.slice(0,12).map(piece=>piece.student+" — "+piece.name+(piece.result?" ("+piece.result+")":"")).join(" · ")+(report.pieces.length>12?` · ve ${report.pieces.length-12} kayıt daha`:"")
    : "Bu ay kaydedilmiş dönem parçası yok";
  drawSection("Eğitim",[
    `Ders puanı ortalaması: ${report.lessonAverage===null?"—":fmtNumber(report.lessonAverage)+"/100"} (${report.lessonScoreCount} değerlendirme)`,
    `Dönem puanı ortalaması: ${report.periodAverage===null?"—":fmtNumber(report.periodAverage)+"/100"} (${report.periodCount} dönem)`,
    pieceSummary,
  ],"#b45309");
  const teacherSummary = report.teacherRows.length ? report.teacherRows.slice(0,12).map(([name,count])=>name+": "+count+" ders") : ["Bu ay yapılmış ders yok"];
  if (report.teacherRows.length>12) teacherSummary.push(`ve ${report.teacherRows.length-12} öğretmen daha`);
  drawSection("Öğretmen Ders Dağılımı",teacherSummary,"#475569");

  ctx.fillStyle = "#8b8492";
  ctx.font = "600 17px Arial";
  ctx.fillText("Bu rapor Sonsuz Sanat CRM kayıtlarının değişmez aylık fotoğrafıdır.",margin,height-48);
  return canvas;
}

async function downloadMonthlyReportPdf(report) {
  const canvas = monthlyReportCanvas(report);
  const jpegBlob = await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PDF görseli oluşturulamadı")),"image/jpeg",0.98));
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBytes = jpegImagePdfBytes(jpegBytes,canvas.width,canvas.height);
  const url = URL.createObjectURL(new Blob([pdfBytes],{ type:"application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Sonsuz-Sanat-${report.branchCode || CURRENT_BRANCH_CODE}-Ay-Sonu-Raporu-${report.key}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function MonthlyReportPreviewSheet({ report, onClose, onDownload, downloading }) {
  return <Sheet title="Ay Sonu Raporu" subtitle={`${report.branchName} · ${report.label}`} onClose={onClose}>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8, marginBottom:12 }}>
      <MiniMetric label="Tahsilat" value={report.revenue.toLocaleString("tr-TR")+" TL"} tone="good" />
      <MiniMetric label="Gider" value={report.expenseTotal.toLocaleString("tr-TR")+" TL"} tone="danger" />
      <MiniMetric label="Net Kâr" value={report.netProfit.toLocaleString("tr-TR")+" TL"} tone="special" />
      <MiniMetric label="Ay Sonu Aktif" value={report.activeStudentCount} tone="info" />
    </div>
    <div style={{ ...SECTION, padding:"13px 14px" }}><p style={{ margin:"0 0 7px", fontSize:12, fontWeight:800 }}>Dersler</p><p style={{ margin:0, fontSize:12, color:"#64748b", lineHeight:1.6 }}>{report.normalLessonCount} normal · {report.makeupCompletedCount} telafi · {report.extraLessonCount} ek ders · {report.noShowCount} no-show</p></div>
    <div style={{ ...SECTION, padding:"13px 14px" }}><p style={{ margin:"0 0 7px", fontSize:12, fontWeight:800 }}>Öğrenciler</p><p style={{ margin:0, fontSize:12, color:"#64748b", lineHeight:1.6 }}>{report.newStudentCount} yeni kayıt · {report.frozenCount} donduran · {report.leftCount} ayrılan</p></div>
    <div style={{ ...SECTION, padding:"13px 14px" }}><p style={{ margin:"0 0 7px", fontSize:12, fontWeight:800 }}>Eğitim</p><p style={{ margin:0, fontSize:12, color:"#64748b", lineHeight:1.6 }}>Ders ortalaması: {report.lessonAverage===null?"—":fmtNumber(report.lessonAverage)+"/100"} · Dönem ortalaması: {report.periodAverage===null?"—":fmtNumber(report.periodAverage)+"/100"} · {report.pieces.length} parça kaydı</p></div>
    <Btn bg="#6d28d9" onClick={()=>onDownload(report)} disabled={downloading}>{downloading ? "PDF hazırlanıyor..." : "PDF İndir"}</Btn>
    <Btn bg="#111" outline onClick={onClose}>Kapat</Btn>
  </Sheet>;
}

function PendingMonthlyReports({ reports, onDownload, downloadingId }) {
  const [preview,setPreview] = useState(null);
  if (!reports.length) return null;
  return <>
    <AçılırBugünBölümü title={`Ay Sonu Raporu (${reports.length})`} color="#6d28d9" style={{ background:"#faf5ff", border:"1.5px solid #d8b4fe", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      {reports.map(report=><div key={report.id} style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f3e8ff" }}>
        <div><p style={{ margin:0, fontWeight:800, fontSize:14 }}>{report.label}</p><p style={{ margin:"2px 0 0", color:"#7e22ce", fontSize:12 }}>Yönetim raporu hazır · PDF indirilmedi</p></div>
        <div style={{ display:"flex", gap:6 }}><button onClick={()=>setPreview(report)} style={{ border:"none", borderRadius:8, padding:"7px 9px", background:"#ede9fe", color:"#5b21b6", fontWeight:800, cursor:"pointer" }}>Önizle</button><button disabled={downloadingId===report.id} onClick={()=>onDownload(report)} style={{ border:"none", borderRadius:8, padding:"7px 10px", background:"#6d28d9", color:"#fff", fontWeight:800, cursor:downloadingId===report.id?"wait":"pointer", opacity:downloadingId===report.id ? .7 : 1 }}>{downloadingId===report.id?"Hazırlanıyor...":"PDF İndir"}</button></div>
      </div>)}
    </AçılırBugünBölümü>
    {preview ? <MonthlyReportPreviewSheet report={preview} onClose={()=>setPreview(null)} onDownload={onDownload} downloading={downloadingId===preview.id} /> : null}
  </>;
}

function MonthlyReportsArchive({ reports, onDownload, downloadingId }) {
  const [preview,setPreview] = useState(null);
  return <div style={{ ...SECTION, padding:"15px 16px" }}>
    <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:800, color:"#111" }}>Ay Sonu Raporları</p>
    <p style={{ margin:"0 0 10px", fontSize:11, color:"#888" }}>Oluşturulan raporlar burada değişmeden saklanır.</p>
    {reports.length===0 ? <p style={{ margin:0, color:"#aaa", fontSize:13 }}>Henüz aylık rapor oluşmadı.</p> : reports.map((report,index)=><div key={report.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"9px 0", borderBottom:index<reports.length-1?"1px solid #f1f5f9":"none" }}>
      <div><strong style={{ fontSize:13 }}>{report.label}</strong><p style={{ margin:"2px 0 0", fontSize:11, color:report.downloadedAt?"#059669":"#c2410c", fontWeight:700 }}>{report.downloadedAt?"PDF indirildi · "+fmtMed(report.downloadedAt):"İndirme bekliyor"}</p></div>
      <div style={{ display:"flex", gap:6 }}><button onClick={()=>setPreview(report)} style={{ border:"none", borderRadius:8, padding:"6px 8px", background:"#f3f4f6", color:"#374151", fontSize:11, fontWeight:800, cursor:"pointer" }}>Görüntüle</button><button disabled={downloadingId===report.id} onClick={()=>onDownload(report)} style={{ border:"none", borderRadius:8, padding:"6px 9px", background:"#6d28d9", color:"#fff", fontSize:11, fontWeight:800, cursor:downloadingId===report.id?"wait":"pointer" }}>{downloadingId===report.id?"Hazırlanıyor...":"PDF"}</button></div>
    </div>)}
    {preview ? <MonthlyReportPreviewSheet report={preview} onClose={()=>setPreview(null)} onDownload={onDownload} downloading={downloadingId===preview.id} /> : null}
  </div>;
}

function AylikOzet({ students, teachers, monthlyReports, onMonthlyReportDownload, downloadingReportId, onTeacherAdd, onTeacherToggle }) {
  const [ayOffset, setAyOffset] = useState(0);
  const [yeniOgretmen, setYeniOgretmen] = useState("");
  const simdi = new Date();
  const hedefAy = new Date(simdi.getFullYear(), simdi.getMonth() + ayOffset, 1);
  const ayAdi = hedefAy.toLocaleDateString("tr-TR", { month:"long", year:"numeric" });
  const yapilanDersler = [];
  const ayOdemeleri = [];
  const donduranIds = new Set();
  const ayrilanIds = new Set();

  students.forEach(student => {
    (student.schedule || []).forEach(lesson => {
      if (lesson.status === "completed" && inMonth(lesson.date, hedefAy)) {
        yapilanDersler.push({ type:"Normal", teacher:teacherForDate(student, lesson.date, lesson), student:student.name });
      }
    });
    (student.telafi_records || []).forEach(record => {
      const doneAt = telafiDoneAt(record);
      if (record.done && record.doneStatus !== "counted" && doneAt && inMonth(doneAt, hedefAy)) {
        yapilanDersler.push({ type:"Telafi", teacher:teacherForDate(student, doneAt, record), student:student.name });
      }
    });
    (student.ek_dersler || []).forEach(extra => {
      if (extra.status === "done" && inMonth(extra.date, hedefAy)) {
        yapilanDersler.push({ type:"Ek Ders", teacher:teacherForDate(student, extra.date, extra), student:student.name });
      }
    });
    (student.odemeler || []).forEach(payment => {
      if (!inMonth(payment.tarih, hedefAy)) return;
      const tutar = typeof payment.tutar === "number" ? payment.tutar : (student.ucret || 0);
      ayOdemeleri.push({ ...payment, tutar, student:student.name });
    });
    (student.status_history || []).forEach(event => {
      if (!inMonth(event.at, hedefAy)) return;
      if (event.type === "frozen") donduranIds.add(student.id);
      if (event.type === "left") ayrilanIds.add(student.id);
    });
  });

  const yeniKayitlar = students.filter(student => inMonth(student.lesson_start_date || student.lessonStartDate, hedefAy));
  const toplamGelir = ayOdemeleri.reduce((sum,payment)=>sum+(payment.tutar||0),0);
  const normalCount = yapilanDersler.filter(x=>x.type==="Normal").length;
  const telafiCount = yapilanDersler.filter(x=>x.type==="Telafi").length;
  const ekCount = yapilanDersler.filter(x=>x.type==="Ek Ders").length;
  const teacherCounts = yapilanDersler.reduce((acc, lesson) => {
    const name = lesson.teacher || "Öğretmen belirtilmemiş";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const teacherRows = Object.entries(teacherCounts).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],"tr"));
  const trackingStart = new Date(LIFECYCLE_TRACKING_START+"T00:00:00");
  const lifecycleKnown = hedefAy.getTime() >= new Date(trackingStart.getFullYear(), trackingStart.getMonth(), 1).getTime();
  const submitTeacher = async () => {
    const name = yeniOgretmen.trim();
    if (!name) return;
    const saved = await onTeacherAdd(name);
    if (saved) setYeniOgretmen("");
  };

  return (
    <div>
      <MonthlyReportsArchive reports={monthlyReports} onDownload={onMonthlyReportDownload} downloadingId={downloadingReportId} />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, background:"#fff", borderRadius:14, padding:"10px 14px", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <button onClick={()=>setAyOffset(o=>o-1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111" }}>{ayAdi}</p>
          {ayOffset!==0 ? <button onClick={()=>setAyOffset(0)} style={{ background:"none", border:"none", fontSize:11, color:"#3b82f6", fontWeight:600, cursor:"pointer", padding:0, marginTop:2 }}>Bu aya dön</button> : null}
        </div>
        <button onClick={()=>setAyOffset(o=>o+1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>›</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))", gap:8, marginBottom:14 }}>
        <MiniMetric label="Yapılan Ders" value={yapilanDersler.length} tone="info" />
        <MiniMetric label="Tahsilat" value={toplamGelir.toLocaleString("tr-TR")+" TL"} tone="good" />
        <MiniMetric label="Yeni Kayıt" value={yeniKayitlar.length} tone="special" />
        <MiniMetric label="Donduran" value={lifecycleKnown ? donduranIds.size : "—"} tone="warn" />
        <MiniMetric label="Ayrılan" value={lifecycleKnown ? ayrilanIds.size : "—"} tone="danger" />
      </div>

      {!lifecycleKnown ? <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:12, padding:"10px 12px", marginBottom:14 }}><p style={{ margin:0, fontSize:12, color:"#92400e", fontWeight:700 }}>Dondurma ve ayrılma tarihçesi Ağustos 2026 itibarıyla kesin tutulur; önceki aylar tahmin edilmez.</p></div> : null}

      <div style={{ ...SECTION, padding:"15px 16px" }}>
        <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:800, color:"#111" }}>Ders Dağılımı</p>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
          <TonePill>{normalCount} normal</TonePill><TonePill tone="info">{telafiCount} telafi</TonePill><TonePill tone="special">{ekCount} ek ders</TonePill>
        </div>
        {teacherRows.length === 0 ? <p style={{ margin:0, color:"#aaa", fontSize:13 }}>Bu ay yapılmış ders yok.</p> : teacherRows.map(([name,count]) => {
          const pct = yapilanDersler.length ? Math.round(count / yapilanDersler.length * 100) : 0;
          return <div key={name} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:4 }}><strong style={{ fontSize:13 }}>{name}</strong><span style={{ fontSize:12, color:"#475569", fontWeight:700 }}>{count} ders · %{pct}</span></div>
            <div style={{ height:7, borderRadius:10, background:"#ede9fe", overflow:"hidden" }}><div style={{ width:pct+"%", height:"100%", background:"#6d28d9", borderRadius:10 }} /></div>
          </div>;
        })}
      </div>

      <div style={{ ...SECTION, padding:"15px 16px" }}>
        <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:800, color:"#111" }}>Yeni Kayıtlar</p>
        {yeniKayitlar.length === 0 ? <p style={{ margin:0, color:"#aaa", fontSize:13 }}>Bu ay yeni kayıt yok.</p> : yeniKayitlar.map(student=><div key={student.id} style={{ display:"flex", justifyContent:"space-between", gap:10, padding:"7px 0", borderBottom:"1px solid #f1f5f9" }}><strong style={{ fontSize:13 }}>{student.name}</strong><span style={{ fontSize:12, color:"#64748b" }}>{fmtMed(student.lesson_start_date || student.lessonStartDate)} · {studentTeacherName(student)}</span></div>)}
      </div>

      <div style={{ ...SECTION, padding:"15px 16px" }}>
        <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:800, color:"#111" }}>Öğretmenler</p>
        {teachers.map(teacher=><div key={teacher.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}><div><strong style={{ fontSize:13 }}>{teacher.name}</strong><span style={{ marginLeft:7, fontSize:11, color:teacher.active?"#059669":"#94a3b8", fontWeight:700 }}>{teacher.active?"Aktif":"Pasif"}</span></div><button onClick={()=>onTeacherToggle(teacher)} style={{ border:"none", borderRadius:8, padding:"6px 9px", background:teacher.active?"#fee2e2":"#dcfce7", color:teacher.active?"#991b1b":"#166534", fontSize:11, fontWeight:800, cursor:"pointer" }}>{teacher.active?"Pasife Al":"Aktif Et"}</button></div>)}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, marginTop:12 }}><input style={INP} value={yeniOgretmen} onChange={e=>setYeniOgretmen(e.target.value)} placeholder="Yeni öğretmen adı" /><button onClick={submitTeacher} style={{ border:"none", borderRadius:10, padding:"0 14px", background:"#111", color:"#fff", fontWeight:800, cursor:"pointer" }}>Ekle</button></div>
      </div>
    </div>
  );
}

function FinansRaporu({ students, expenses, onExpenseAdd, onExpenseRemove }) {
  const [ayOffset, setAyOffset] = useState(0);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [expenseForm, setExpenseForm] = useState({ title:"", category:"Kira", amount:"", expense_date:localDateKey(), is_recurring:false });
  const simdi = new Date();
  const hedefAy = new Date(simdi.getFullYear(), simdi.getMonth() + ayOffset, 1);
  const ayAdi = hedefAy.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  const ayÖdemeleri = [];
  students.forEach(s => {
    (s.odemeler || []).forEach(o => {
      const oTarih = new Date(o.tarih);
      if (oTarih.getFullYear() === hedefAy.getFullYear() && oTarih.getMonth() === hedefAy.getMonth()) {
        const gercekTutar = typeof o.tutar === "number" ? o.tutar : (s.ucret || 0);
        const gercekPaket = o.paketUcret || (typeof o.tutar !== "number" ? (s.ucret || 0) : 0);
        const gercekEk = o.ekTutar || 0;
        ayÖdemeleri.push({ ...o, tutar: gercekTutar, paketUcret: gercekPaket, ekTutar: gercekEk, ogrenci: s.name });
      }
    });
  });
  const toplamGelir = ayÖdemeleri.reduce((sum, o) => sum + o.tutar, 0);
  const paketGeliri = ayÖdemeleri.reduce((sum, o) => sum + (o.paketUcret || 0), 0);
  const ekGeliri = ayÖdemeleri.reduce((sum, o) => sum + (o.ekTutar || 0), 0);
  const ayGiderleri = (expenses || [])
    .filter(expense => expenseAppliesToMonth(expense, hedefAy))
    .sort((a,b) => String(a.expense_date).localeCompare(String(b.expense_date)) || a.title.localeCompare(b.title, "tr"));
  const toplamGider = ayGiderleri.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const netKar = toplamGelir - toplamGider;
  const hedefAyBaslangici = new Date(hedefAy.getFullYear(), hedefAy.getMonth(), 1);
  const buAyBaslangici = new Date(simdi.getFullYear(), simdi.getMonth(), 1);

  const openExpenseForm = () => {
    const sameMonth = hedefAy.getFullYear() === simdi.getFullYear() && hedefAy.getMonth() === simdi.getMonth();
    setExpenseForm({ title:"", category:"Kira", amount:"", expense_date:sameMonth ? localDateKey(simdi) : localDateKey(hedefAy), is_recurring:false });
    setExpenseError("");
    setShowExpenseForm(true);
  };

  const submitExpense = async () => {
    const amount = Number(String(expenseForm.amount).replace(",","."));
    if (!expenseForm.title.trim() || !expenseForm.expense_date || !Number.isFinite(amount) || amount <= 0) {
      setExpenseError("Gider adı, tarih ve sıfırdan büyük tutar girin.");
      return;
    }
    setExpenseError("");
    setSavingExpense(true);
    const saved = await onExpenseAdd({ ...expenseForm, title:expenseForm.title.trim(), amount });
    setSavingExpense(false);
    if (saved) setShowExpenseForm(false);
  };

  const removeExpense = async expense => {
    const recurring = !!expense.is_recurring;
    const message = recurring
      ? `${expense.title} sabit gideri ${ayAdi} ayından itibaren durdurulsun mu? Önceki aylar korunur.`
      : `${expense.title} gideri listeden kaldırılsın mı? Kayıt veritabanında geçmiş olarak korunur.`;
    if (!window.confirm(message)) return;
    await onExpenseRemove(expense, hedefAy);
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, background:"#fff", borderRadius:14, padding:"10px 14px", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <button onClick={()=>setAyOffset(o=>o-1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111" }}>{ayAdi}</p>
          {ayOffset!==0 ? <button onClick={()=>setAyOffset(0)} style={{ background:"none", border:"none", fontSize:11, color:"#3b82f6", fontWeight:600, cursor:"pointer", padding:0, marginTop:2 }}>Bu aya dön</button> : null}
        </div>
        <button onClick={()=>setAyOffset(o=>o+1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>›</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:14 }}>
        <div style={{ background:"linear-gradient(135deg, #059669, #10b981)", borderRadius:16, padding:"17px", color:"#fff" }}>
          <p style={{ margin:0, fontSize:11, opacity:.85, fontWeight:800, letterSpacing:.7 }}>TAHSİLAT</p>
          <p style={{ margin:"6px 0 0", fontSize:25, fontWeight:900 }}>{toplamGelir.toLocaleString("tr-TR")} TL</p>
          <p style={{ margin:"4px 0 0", fontSize:11, opacity:.85 }}>{ayÖdemeleri.length} ödeme</p>
        </div>
        <div style={{ background:"linear-gradient(135deg, #dc2626, #ef4444)", borderRadius:16, padding:"17px", color:"#fff" }}>
          <p style={{ margin:0, fontSize:11, opacity:.85, fontWeight:800, letterSpacing:.7 }}>GİDER</p>
          <p style={{ margin:"6px 0 0", fontSize:25, fontWeight:900 }}>{toplamGider.toLocaleString("tr-TR")} TL</p>
          <p style={{ margin:"4px 0 0", fontSize:11, opacity:.85 }}>{ayGiderleri.length} gider</p>
        </div>
        <div style={{ background:netKar>=0?"linear-gradient(135deg, #4338ca, #7c3aed)":"linear-gradient(135deg, #9f1239, #e11d48)", borderRadius:16, padding:"17px", color:"#fff" }}>
          <p style={{ margin:0, fontSize:11, opacity:.85, fontWeight:800, letterSpacing:.7 }}>NET KÂR</p>
          <p style={{ margin:"6px 0 0", fontSize:25, fontWeight:900 }}>{netKar.toLocaleString("tr-TR")} TL</p>
          <p style={{ margin:"4px 0 0", fontSize:11, opacity:.85 }}>Tahsilat − gider</p>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:"14px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600, letterSpacing:1 }}>Paket Geliri</p>
          <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:"#111" }}>{paketGeliri.toLocaleString("tr-TR")} TL</p>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:"14px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600, letterSpacing:1 }}>Ek Ders Geliri</p>
          <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:"#5b21b6" }}>{ekGeliri.toLocaleString("tr-TR")} TL</p>
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:14, padding:"16px", boxShadow:"0 1px 3px rgba(0,0,0,.05)", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:12 }}>
          <div><p style={{ margin:0, fontSize:13, fontWeight:800, color:"#111" }}>Bu Ayki Giderler</p><p style={{ margin:"3px 0 0", fontSize:11, color:"#888" }}>Sabit giderler başlangıç ayından itibaren otomatik görünür.</p></div>
          <button onClick={openExpenseForm} style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:9, padding:"7px 10px", fontSize:12, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>＋ Gider Ekle</button>
        </div>
        {ayGiderleri.length === 0 ? <p style={{ textAlign:"center", color:"#bbb", padding:"20px 0", fontWeight:600 }}>Bu ay gider yok</p> : ayGiderleri.map((expense,index) => {
          const canStopRecurring = expense.is_recurring && !expense.recurring_until && hedefAyBaslangici >= buAyBaslangici;
          return (
            <div key={expense.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"10px 0", borderBottom:index<ayGiderleri.length-1?"1px solid #f0f0f0":"none" }}>
              <div>
                <p style={{ margin:0, fontSize:14, fontWeight:750, color:"#111" }}>{expense.title}</p>
                <p style={{ margin:"2px 0 0", fontSize:11, color:"#888" }}>{expense.category} · {expense.is_recurring ? `Her ay · ${fmtMed(expense.expense_date)} başlangıç` : fmtMed(expense.expense_date)}</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                <strong style={{ fontSize:14, color:"#dc2626" }}>{(Number(expense.amount)||0).toLocaleString("tr-TR")} TL</strong>
                {(!expense.is_recurring || canStopRecurring) ? <button onClick={()=>removeExpense(expense)} style={{ border:"none", borderRadius:8, padding:"5px 7px", background:"#fee2e2", color:"#991b1b", fontSize:10, fontWeight:800, cursor:"pointer" }}>{expense.is_recurring ? "Durdur" : "Kaldır"}</button> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background:"#fff", borderRadius:14, padding:"16px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:"#111" }}>Bu Ayki Ödemeler</p>
        {ayÖdemeleri.length === 0
          ? <p style={{ textAlign:"center", color:"#bbb", padding:"20px 0", fontWeight:600 }}>Bu ay ödeme yok</p>
          : [...ayÖdemeleri].reverse().map((o, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: i < ayÖdemeleri.length-1 ? "1px solid #f0f0f0" : "none" }}>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111" }}>{o.ogrenci}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{fmtMed(o.tarih)}{o.ekDersSayisi > 0 ? " +" + o.ekDersSayisi + " ek ders" : ""}</p>
                </div>
                <p style={{ margin:0, fontSize:15, fontWeight:800, color:"#059669" }}>{typeof o.tutar === "number" ? o.tutar.toLocaleString("tr-TR")+" TL" : o.tutar}</p>
              </div>
            ))
        }
      </div>

      {showExpenseForm ? (
        <Sheet title="Gider Ekle" subtitle={ayAdi} onClose={()=>{ if(!savingExpense) setShowExpenseForm(false); }}>
          <label style={LBL}>Gider Adı</label>
          <input style={INP} value={expenseForm.title} onChange={e=>setExpenseForm(f=>({...f,title:e.target.value}))} placeholder="Örn. Atölye kirası" />
          <label style={LBL}>Kategori</label>
          <select style={INP} value={expenseForm.category} onChange={e=>setExpenseForm(f=>({...f,category:e.target.value}))}>{EXPENSE_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select>
          <label style={LBL}>Tutar</label>
          <input style={INP} type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e=>setExpenseForm(f=>({...f,amount:e.target.value}))} placeholder="0" />
          <label style={LBL}>Başlangıç / Gider Tarihi</label>
          <input style={INP} type="date" value={expenseForm.expense_date} onChange={e=>setExpenseForm(f=>({...f,expense_date:e.target.value}))} />
          <label style={{ display:"flex", alignItems:"center", gap:9, margin:"4px 0 18px", fontSize:13, fontWeight:750, color:"#374151", cursor:"pointer" }}><input type="checkbox" checked={expenseForm.is_recurring} onChange={e=>setExpenseForm(f=>({...f,is_recurring:e.target.checked}))} /> Her ay otomatik tekrarla</label>
          {expenseForm.is_recurring ? <p style={{ margin:"-8px 0 16px", padding:"9px 10px", background:"#eff6ff", borderRadius:9, fontSize:11, color:"#1d4ed8", fontWeight:650 }}>Bu gider başlangıç ayından itibaren her ay net kâr hesabına katılır.</p> : null}
          {expenseError ? <p style={{ margin:"0 0 12px", color:"#b91c1c", fontSize:12, fontWeight:700 }}>{expenseError}</p> : null}
          <button disabled={savingExpense} onClick={submitExpense} style={{ width:"100%", display:"block", marginBottom:8, border:"none", borderRadius:14, padding:"13px 16px", background:"#dc2626", color:"#fff", fontWeight:700, fontSize:14, cursor:savingExpense?"wait":"pointer", opacity:savingExpense?.7:1, fontFamily:"inherit" }}>{savingExpense ? "Kaydediliyor..." : "Gideri Kaydet"}</button>
          <Btn bg="#111" outline onClick={()=>{ if(!savingExpense) setShowExpenseForm(false); }}>İptal</Btn>
        </Sheet>
      ) : null}
    </div>
  );
}

export default function App() {
  const [giris, setGiris] = useState(() => {
    if (isPasswordSetupLink()) return false;
    return sessionStorage.getItem(CRM_AUTH_KEY) === "ok" && sessionStorage.getItem(CRM_AUTH_METHOD_KEY) !== "supabase";
  });
  const [sifre, setSifre] = useState("");
  const [sifreHata, setSifreHata] = useState(false);
  const SIFRE = "sonsuz2024";
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState(() => isPasswordSetupLink() ? "set-password" : "supabase");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordAgain, setAuthPasswordAgain] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(() => {
    const params = authHashParams();
    return params.get("error") ? authErrorMessage(params.get("error_description") || params.get("error")) : "";
  });
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const [loadedSources, setLoadedSources] = useState({ students:false, teachers:false, expenses:false });
  const reportInitializationRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [lessonEvaluationPrompt, setLessonEvaluationPrompt] = useState(null);
  const [telafiMessagePrompt, setTelafiMessagePrompt] = useState(null);
  const [telafiPlanMessagePrompt, setTelafiPlanMessagePrompt] = useState(null);
  const [periodEvaluationModal, setPeriodEvaluationModal] = useState(null);
  const [periodSummaryPrompt, setPeriodSummaryPrompt] = useState(null);
  const [detailSt, setDetailSt] = useState(null);
  const [detailInitialTab, setDetailInitialTab] = useState("takvim");
  const [showAdd, setShowAdd] = useState(false);
  const [welcomeStudentId, setWelcomeStudentId] = useState(null);
  const communicationQueueRef = useRef(Promise.resolve());
  const [filter, setFilter] = useState("all");
  const [mainTab, setMainTab] = useState("bugün");
  const [weekOffset, setWeekOffset] = useState(0);
  const [toast, setToast] = useState(null);
  const [mesajSt, setMesajSt] = useState(null);
  const [mesajInitialKey, setMesajInitialKey] = useState("");
  const [summaryOpeningId, setSummaryOpeningId] = useState(null);
  const [odemeSt, setÖdemeSt] = useState(null);
  const [odemeKaydetModal, setÖdemeKaydetModal] = useState(null);
  const [odemeKaydetDate, setÖdemeKaydetDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [failedOps, setFailedOps] = useState(() => readFailedOps());
  const [retryingOps, setRetryingOps] = useState({});

  useEffect(() => {
    let active = true;
    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      const session = data?.session || null;
      setAuthSession(session);
      if (error) setAuthError(authErrorMessage(error));

      if (session && isPasswordSetupLink()) {
        setAuthMode("set-password");
        setGiris(false);
      } else if (session) {
        const profile = await activeStaffProfile(session.user?.id);
        if (!active) return;
        if (profile) {
          sessionStorage.setItem(CRM_AUTH_KEY, "ok");
          sessionStorage.setItem(CRM_AUTH_METHOD_KEY, "supabase");
          setGiris(true);
        } else {
          await supabase.auth.signOut();
          if (!active) return;
          setAuthSession(null);
          setAuthError("Bu hesabın aktif CRM yönetici veya öğretmen yetkisi yok.");
        }
      } else if (!session && sessionStorage.getItem(CRM_AUTH_METHOD_KEY) === "supabase") {
        sessionStorage.removeItem(CRM_AUTH_KEY);
        sessionStorage.removeItem(CRM_AUTH_METHOD_KEY);
        setGiris(false);
      }
      if (active) setAuthReady(true);
    };

    initializeAuth().catch(error => {
      if (!active) return;
      setAuthError(authErrorMessage(error));
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setAuthSession(session || null);
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(CRM_PASSWORD_SETUP_PENDING_KEY, "ok");
        sessionStorage.removeItem(CRM_AUTH_KEY);
        sessionStorage.removeItem(CRM_AUTH_METHOD_KEY);
        setAuthMode("set-password");
        setGiris(false);
        setAuthError("");
        setAuthReady(true);
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(CRM_AUTH_KEY);
        sessionStorage.removeItem(CRM_AUTH_METHOD_KEY);
        sessionStorage.removeItem(CRM_PASSWORD_SETUP_PENDING_KEY);
        setAuthMode("supabase");
        setGiris(false);
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const authorizeStaffSession = async session => {
    const profile = await activeStaffProfile(session?.user?.id);
    if (!profile) {
      await supabase.auth.signOut();
      setAuthSession(null);
      setAuthError("Bu hesabın aktif CRM yönetici veya öğretmen yetkisi yok.");
      return false;
    }
    sessionStorage.setItem(CRM_AUTH_KEY, "ok");
    sessionStorage.setItem(CRM_AUTH_METHOD_KEY, "supabase");
    setAuthSession(session);
    setGiris(true);
    return true;
  };

  const handleSupabaseLogin = async () => {
    if (authBusy) return;
    if (!authEmail.trim() || !authPassword) {
      setAuthError("E-posta ve parola alanlarını doldurun.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email:authEmail.trim(),
      password:authPassword,
    });
    if (error || !data?.session) setAuthError(authErrorMessage(error));
    else await authorizeStaffSession(data.session);
    setAuthBusy(false);
  };

  const handlePasswordSetup = async () => {
    if (authBusy) return;
    if (!authSession?.user) {
      setAuthError("Davet oturumu bulunamadı. Yeni davet bağlantısını bu cihazda bir kez açın.");
      return;
    }
    if (authPassword.length < 12) {
      setAuthError("Parolanız en az 12 karakter olmalıdır.");
      return;
    }
    if (authPassword !== authPasswordAgain) {
      setAuthError("Parolalar birbiriyle aynı değil.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    const { data, error } = await supabase.auth.updateUser({ password:authPassword });
    if (error || !data?.user) {
      setAuthError(authErrorMessage(error));
      setAuthBusy(false);
      return;
    }
    const { data:sessionData } = await supabase.auth.getSession();
    const authorized = await authorizeStaffSession(sessionData?.session);
    if (authorized && typeof window !== "undefined") {
      sessionStorage.removeItem(CRM_PASSWORD_SETUP_PENDING_KEY);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
    setAuthBusy(false);
  };

  const handleLegacyLogin = () => {
    if (sifre === SIFRE) {
      sessionStorage.setItem(CRM_AUTH_KEY, "ok");
      sessionStorage.setItem(CRM_AUTH_METHOD_KEY, "legacy");
      setGiris(true);
      return;
    }
    setSifreHata(true);
  };

  const handleSecureLogout = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    const supabaseLogin = sessionStorage.getItem(CRM_AUTH_METHOD_KEY) === "supabase" || !!authSession;
    if (supabaseLogin) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(authErrorMessage(error));
        pop("Güvenli çıkış tamamlanamadı. Tekrar deneyin.", 6000);
        setAuthBusy(false);
        return;
      }
    }
    sessionStorage.removeItem(CRM_AUTH_KEY);
    sessionStorage.removeItem(CRM_AUTH_METHOD_KEY);
    sessionStorage.removeItem(CRM_PASSWORD_SETUP_PENDING_KEY);
    setAuthSession(null);
    setAuthMode("supabase");
    setAuthEmail("");
    setAuthPassword("");
    setAuthPasswordAgain("");
    setSifre("");
    setGiris(false);
    setAuthBusy(false);
  };

  const pop = (msg, ms=3000) => { setToast(msg); setTimeout(()=>setToast(null), ms); };

  const openMesaj = (student, initialKey = "") => {
    setMesajInitialKey(initialKey);
    setMesajSt(student);
  };

  const persistFailedOps = (items) => {
    setFailedOps(items);
    writeFailedOps(items);
  };

  const rememberFailedOperation = (operation, error) => {
    if (!operation) return;
    const nextOp = {
      ...operation,
      id: operation.id || uid(),
      failedAt: new Date().toISOString(),
      attempts: operation.attempts || MAX_SAVE_RETRIES,
      error: error?.message || "Kayıt doğrulanamadı",
    };
    persistFailedOps([nextOp, ...failedOps.filter(op => op.id !== nextOp.id)]);
  };

  const loadStudents = async () => {
    const { data, error } = await supabase.from("students").select("*").order("created_at");
    if (!error && data) {
      setStudents(data.map(s => ({ ...s, record_version: typeof s.record_version === "number" ? s.record_version : 0 })));
      setLoadedSources(current=>({ ...current, students:true }));
    }
    if (error) {
      console.error("Veri yükleme hatası:", error);
      pop("Veriler yüklenemedi. Bağlantı veya Supabase yetkisini kontrol et.", 6000);
    }
    setLoading(false);
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase.from("teachers").select("*").order("name");
    if (!error && data) {
      setTeachers(data);
      setLoadedSources(current=>({ ...current, teachers:true }));
    }
    if (error) {
      console.error("Öğretmen listesi yükleme hatası:", error);
      pop("Öğretmen listesi yüklenemedi. v58 Supabase SQL dosyasını kontrol edin.", 8000);
    }
  };

  const loadExpenses = async () => {
    const { data, error } = await supabase.from("expenses").select("*").order("expense_date");
    if (!error && data) {
      setExpenses(data);
      setLoadedSources(current=>({ ...current, expenses:true }));
    }
    if (error) {
      console.error("Gider listesi yükleme hatası:", error);
      pop("Giderler yüklenemedi. v61 Supabase SQL dosyasını çalıştırdığınızdan emin olun.", 8000);
    }
  };

  useEffect(() => { loadStudents(); loadTeachers(); loadExpenses(); document.title = "Sonsuz Sanat CRM"; }, []);

  useEffect(() => {
    if (!giris || !loadedSources.students || !loadedSources.teachers || !loadedSources.expenses || reportInitializationRef.current) return;
    reportInitializationRef.current = true;
    const initialize = async () => {
      const branchResult = await supabase.from("branches").select("id,code,name").eq("code",CURRENT_BRANCH_CODE).single();
      if (branchResult.error || !branchResult.data?.id) {
        console.error("Aylık rapor şube kaydı yüklenemedi:",branchResult.error);
        pop("Ay sonu raporu kurulumu eksik. v83 Supabase SQL dosyasını çalıştırın.",9000);
        return;
      }
      const branch = branchResult.data;
      const reportResult = await supabase.from("monthly_reports").select("*").eq("branch_id",branch.id).order("report_month",{ ascending:false });
      if (reportResult.error) {
        console.error("Aylık rapor arşivi yüklenemedi:",reportResult.error);
        pop("Ay sonu rapor arşivi yüklenemedi. v83 Supabase SQL dosyasını kontrol edin.",9000);
        return;
      }
      let rows = reportResult.data || [];
      const missingMonths = reportMonthsToEnsure(rows);
      for (const targetMonth of missingMonths) {
        const snapshot = buildMonthlyInstitutionReport(students,teachers,expenses,targetMonth,branch);
        const insertResult = await supabase.from("monthly_reports").insert({ branch_id:branch.id, report_month:monthReportDate(targetMonth), report_data:snapshot }).select("*").single();
        if (insertResult.error) {
          const duplicate = String(insertResult.error.code || "") === "23505";
          if (!duplicate) {
            console.error("Aylık rapor oluşturulamadı:",insertResult.error);
            pop(snapshot.label+" raporu veritabanında doğrulanamadı.",9000);
          }
        } else if (insertResult.data) rows = [insertResult.data,...rows];
      }
      const refreshed = await supabase.from("monthly_reports").select("*").eq("branch_id",branch.id).order("report_month",{ ascending:false });
      if (refreshed.error) {
        console.error("Aylık rapor arşivi doğrulanamadı:",refreshed.error);
        pop("Ay sonu rapor arşivi doğrulanamadı.",9000);
        return;
      }
      setMonthlyReports((refreshed.data || []).map(reportFromRow));
    };
    initialize().catch(error=>{
      console.error("Aylık rapor başlatma hatası:",error);
      pop("Ay sonu raporu hazırlanamadı.",9000);
    });
  },[giris,loadedSources.students,loadedSources.teachers,loadedSources.expenses,students,teachers,expenses]);

  const handleMonthlyReportDownload = async report => {
    if (!report?.id || downloadingReportId) return;
    setDownloadingReportId(report.id);
    try {
      await downloadMonthlyReportPdf(report);
      if (!report.downloadedAt) {
        const downloadedAt = new Date().toISOString();
        const result = await supabase.from("monthly_reports").update({ downloaded_at:downloadedAt, updated_at:downloadedAt }).eq("id",report.id).is("downloaded_at",null).select("*").single();
        if (result.error || !result.data?.downloaded_at) {
          const existing = await supabase.from("monthly_reports").select("*").eq("id",report.id).single();
          if (existing.data?.downloaded_at) setMonthlyReports(current=>current.map(item=>item.id===report.id?reportFromRow(existing.data):item));
          else {
            console.error("PDF indirme kaydı doğrulanamadı:",result.error || existing.error);
            pop("PDF hazırlandı; indirme kaydı doğrulanamadığı için Bugün uyarısı korunuyor.",9000);
            return;
          }
        } else {
          setMonthlyReports(current=>current.map(item=>item.id===report.id?reportFromRow(result.data):item));
        }
      }
      pop("Ay sonu raporu PDF olarak indirildi");
    } catch (error) {
      console.error("PDF oluşturma hatası:",error);
      pop("PDF oluşturulamadı: "+(error?.message || "Bilinmeyen hata"),9000);
    } finally {
      setDownloadingReportId(null);
    }
  };

  const studentPayload = (student, recordVersion, writeId) => {
    const slots = getStudentSlots(student);
    return {
      id: student.id,
      name: student.name,
      phone: student.phone || "",
      veli_adi: student.veli_adi || "",
      dogum_tarihi: student.dogum_tarihi || "",
      lesson_start_date: student.lesson_start_date || student.lessonStartDate || null,
      teacher_id: student.teacher_id || null,
      teacher_name: studentTeacherName(student),
      teacher_history: student.teacher_history || [],
      ucret: student.ucret || 0,
      last_raise_date: student.last_raise_date || null,
      package_lesson_count: getPackageLessonCount(student),
      lesson_duration: getLessonDuration(student),
      instrument: student.instrument,
      day: slots[0]?.day || student.day,
      time: slots[0]?.time || student.time,
      lesson_slots: slots,
      no_show: student.no_show,
      frozen: student.frozen,
      odemeler: student.odemeler || [],
      telafi_records: student.telafi_records || [],
      schedule: student.schedule || [],
      ek_dersler: student.ek_dersler || [],
      package_summary_logs: student.package_summary_logs || [],
      lesson_reminder_logs: student.lesson_reminder_logs || [],
      status_history: student.status_history || [],
      left_at: student.left_at || null,
      record_version: recordVersion,
      last_write_id: writeId,
      last_saved_at: new Date().toISOString(),
    };
  };

  const saveStudent = async (student) => {
    const currentVersion = typeof student.record_version === "number" ? student.record_version : 0;
    const writeId = uid();
    const nextVersion = currentVersion + 1;
    const payload = studentPayload(student, nextVersion, writeId);
    const isExisting = !!student.created_at || typeof student.record_version === "number";
    let data = null;
    let error = null;

    if (isExisting) {
      const result = await supabase
        .from("students")
        .update(payload)
        .eq("id", student.id)
        .eq("record_version", currentVersion)
        .select("*")
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("students")
        .insert(payload)
        .select("*")
        .single();
      data = result.data;
      error = result.error;
    }

    if (error || !data?.id || data.last_write_id !== writeId || data.record_version !== nextVersion) {
      console.error("Kayıt hatası:", error);
      pop("Kayıt güvenli şekilde doğrulanamadı. Ekran veritabanından yenilendi.", 8000);
      await loadStudents();
      throw new Error("Veritabanı kaydı doğrulanamadı");
    }

    setStudents(prev => prev.map(s => s.id === data.id ? data : s));
    return data;
  };

  const saveStudentWithRetry = async (student, operation=null, options={}) => {
    let lastError = null;
    const attempts = options.attempts || MAX_SAVE_RETRIES;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await saveStudent(student);
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise(resolve => setTimeout(resolve, 450 * attempt));
          const { data } = await supabase.from("students").select("*").eq("id", student.id).single();
          if (data) student = { ...student, record_version: typeof data.record_version === "number" ? data.record_version : 0 };
        }
      }
    }
    rememberFailedOperation(operation, lastError);
    pop("İşlem şu an kaydedilemedi. Tekrar denemek için üstte uyarı olarak tutuldu.", 9000);
    throw lastError || new Error("Kayıt başarısız");
  };

  const updLesson = (schedule, lid, status, note="") => {
    if (lid) return schedule.map(l => l.id===lid ? {...l,status,note} : l);
    const i = schedule.findIndex(l=>l.status==="upcoming");
    if (i===-1) return schedule;
    const s=[...schedule]; s[i]={...s[i],status,note}; return s;
  };

  const mkTelafi = (student, lid, note) => {
    const lesson = lid ? student.schedule.find(l=>l.id===lid) : student.schedule.find(l=>l.status==="upcoming");
    return { id:uid(), lessonId:lesson?.id||null, lessonDate:lesson?.date||new Date().toISOString(), note, createdAt:new Date().toISOString(), expiry:expiry30(), done:false, doneAt:null };
  };

  const clearHomeworkEffects = (schedule, lessonId) => (schedule || []).map(item => {
    if (item.id === lessonId) {
      return {
        ...item,
        activeMinutes:0,
        taskFocusMinutes:0,
        redirectionCount:0,
        lessonFocus:"",
        lessonScore:null,
        lessonScoreBreakdown:null,
        evaluatedHomework:"",
        evaluatedHomeworkStatus:"",
        homework:"",
        homeworkStatus:"",
        homeworkCheckNote:"",
        homeworkCheckedAt:null,
        homeworkCheckedInRef:null,
      };
    }
    if (item.homeworkCheckedInRef === homeworkCheckRef("lesson", lessonId)) {
      return {
        ...item,
        homeworkStatus:"pending",
        homeworkCheckNote:"",
        homeworkCheckedAt:null,
        homeworkCheckedInRef:null,
      };
    }
    return item;
  });

  const clearHomeworkCheckInTelafi = (records, checkRef) => (records || []).map(item => item.homeworkCheckedInRef === checkRef ? {
    ...item,
    homeworkStatus:"pending",
    homeworkCheckNote:"",
    homeworkCheckedAt:null,
    homeworkCheckedInRef:null,
  } : item);

  const buildActionUpdate = (sourceStudents, sid, action, note="", lid=null) => {
    let msg = "Kaydedildi";
    const updated = sourceStudents.map(s => {
      if (s.id !== sid) return s;
      const oldLesson = lid ? s.schedule.find(l=>l.id===lid) : s.schedule.find(l=>l.status==="upcoming");
      const noShowFix = oldLesson?.status === "noshow" ? -1 : 0;
      const cleanTelafiForLesson = (records) => records.filter(r => !(lid && (r.lessonId === lid || (!r.lessonId && oldLesson && dateKey(r.lessonDate) === dateKey(oldLesson.date) && !r.done))));
      switch(action) {
        case "attended": {
          const detail = typeof note === "object" && note ? note : {};
          msg = "Katılım ve verim bilgisi kaydedildi";
          const homeworkText = (detail.homework || "").trim();
          const checkedAt = new Date().toISOString();
          const checkRef = homeworkCheckRef("lesson", lid);
          const cleanedTelafiRecords = cleanTelafiForLesson(s.telafi_records||[]).map(record => detail.previousHomeworkSource === "telafi" && record.id === detail.previousHomeworkSourceId ? {
            ...record,
            homeworkStatus:detail.homeworkStatus,
            homeworkCheckNote:"",
            homeworkCheckedAt:checkedAt,
            homeworkCheckedInRef:checkRef,
          } : record);
          return {
            ...s,
            no_show:Math.max(0, s.no_show+noShowFix),
            telafi_records:cleanedTelafiRecords,
            schedule:(s.schedule||[]).map(l => {
              if (detail.previousHomeworkSource === "schedule" && l.id === detail.previousHomeworkSourceId) {
                return {
                  ...l,
                  homeworkStatus:detail.homeworkStatus,
                  homeworkCheckNote:"",
                  homeworkCheckedAt:checkedAt,
                  homeworkCheckedInRef:checkRef,
                };
              }
              if (l.id !== lid) return l;
              const homeworkChanged = (l.homework || "") !== homeworkText;
              return {
                ...l,
                status:"completed",
                note:detail.note || "",
                activeMinutes:detail.activeMinutes || 0,
                taskFocusMinutes:detail.taskFocusMinutes || 0,
                redirectionCount:detail.redirectionCount || 0,
                lessonFocus:detail.lessonFocus || "",
                lessonScore:detail.lessonScore,
                lessonScoreBreakdown:detail.lessonScoreBreakdown || null,
                evaluatedHomework:detail.evaluatedHomework || "",
                evaluatedHomeworkStatus:detail.homeworkStatus || "",
                homework:homeworkText,
                homeworkStatus:homeworkText ? (homeworkChanged ? "pending" : (l.homeworkStatus || "pending")) : "",
                homeworkCheckNote:homeworkText && !homeworkChanged ? (l.homeworkCheckNote || "") : "",
                homeworkCheckedAt:homeworkText && !homeworkChanged ? (l.homeworkCheckedAt || null) : null,
                homeworkCheckedInRef:homeworkText && !homeworkChanged ? (l.homeworkCheckedInRef || null) : null,
              };
            }),
          };
        }
        case "telafi": {
          const rec = mkTelafi(s, lid, note||"24 saat oncesi iptal");
          const recs = clearHomeworkCheckInTelafi([...cleanTelafiForLesson(s.telafi_records||[]), rec], homeworkCheckRef("lesson", lid));
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "6. telafi - program donduruldu" : ac===5 ? "5. telafi uyarisi" : "Telafi oluşturuldu";
          const next = {...s, no_show:Math.max(0, s.no_show+noShowFix), frozen, telafi_records:recs, schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "telafi", note)};
          return frozen && !s.frozen ? withStatusEvent(next, "frozen") : next;
        }
        case "lm-telafi": {
          const rec = mkTelafi(s, lid, note||"Son dakika iptali");
          const recs = clearHomeworkCheckInTelafi([...cleanTelafiForLesson(s.telafi_records||[]), rec], homeworkCheckRef("lesson", lid));
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "6. telafi - program donduruldu" : "Son dakika + telafi kaydedildi";
          const next = {...s, no_show:Math.max(0, s.no_show+noShowFix), frozen, telafi_records:recs, schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "lastminute", note||"Son dakika iptali")};
          return frozen && !s.frozen ? withStatusEvent(next, "frozen") : next;
        }
        case "lm-notelafi": msg = "Son dakika iptali"; return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:clearHomeworkCheckInTelafi(cleanTelafiForLesson(s.telafi_records||[]), homeworkCheckRef("lesson", lid)), schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "lastminute", note||"Son dakika iptali")};
        case "noshow": msg = "No-show kaydedildi"; return {...s, no_show:Math.max(0, s.no_show + (oldLesson?.status === "noshow" ? 0 : 1)), telafi_records:clearHomeworkCheckInTelafi(cleanTelafiForLesson(s.telafi_records||[]), homeworkCheckRef("lesson", lid)), schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "noshow", note||"Habersiz gelmedi")};
        case "reset-upcoming": msg = "Ders planlandıya alındı"; return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:clearHomeworkCheckInTelafi(cleanTelafiForLesson(s.telafi_records||[]), homeworkCheckRef("lesson", lid)), schedule: clearHomeworkEffects(s.schedule, lid).map(l => l.id===lid ? {...l, status:"upcoming", note:"", activeMinutes:0, taskFocusMinutes:0, redirectionCount:0, lessonFocus:"", lessonScore:null, lessonScoreBreakdown:null, evaluatedHomework:"", evaluatedHomeworkStatus:"", focusMinutes:0, productiveMinutes:0, productiveWindow:"", focusSection:""} : l)};
        default: return s;
      }
    });
    return { updated, msg };
  };

  const handleAction = async (sid, action, note="", lid=null) => {
    const built = buildActionUpdate(students, sid, action, note, lid);
    const msg = built.msg;
    const updated = built.updated.map(student => student.id === sid ? invalidatePeriodEvaluationForLesson(student, lid) : student);
    const student = updated.find(s => s.id === sid);
    const originalStudent = students.find(s => s.id === sid);
    const lesson = originalStudent?.schedule?.find(l => l.id === lid) || originalStudent?.schedule?.find(l => l.status === "upcoming");
    const operation = {
      type:"lessonAction",
      studentId:sid,
      studentName:originalStudent?.name || student?.name || "Öğrenci",
      lessonId:lid,
      action,
      note,
      label:(originalStudent?.name || student?.name || "Öğrenci") + " - " + msg,
      detail:lesson ? fmtDate(lesson.date)+" "+lessonTime(originalStudent, lesson) : "",
    };
    setStudents(updated);
    try {
      const savedStudent = await saveStudentWithRetry(student, operation);
      pop(msg);
      setActionModal(null);
      if (action === "attended") {
        const evaluatedLesson = (savedStudent.schedule || []).find(item => item.id === (lid || lesson?.id));
        if (evaluatedLesson && storedLessonScore(evaluatedLesson) !== null) setLessonEvaluationPrompt({ student:savedStudent, record:evaluatedLesson, type:"normal" });
      }
      if (action === "telafi" || action === "lm-telafi") {
        const previousIds = new Set((originalStudent?.telafi_records || []).map(record => record.id));
        const createdRecord = (student?.telafi_records || []).find(record => !previousIds.has(record.id));
        if (createdRecord) setTelafiMessagePrompt({ student, record:createdRecord });
      }
    } catch {
      setActionModal(null);
    }
  };

  const handleToggleFreeze = async (sid, frozen, resumeDate=null) => {
    const resumeStart = resumeDate ? new Date(resumeDate+"T12:00:00") : null;
    if (!frozen && resumeDate && (!/^\d{4}-\d{2}-\d{2}$/.test(resumeDate) || isNaN(resumeStart.getTime()) || midday(resumeStart) < midday())) {
      pop("Geçerli bir başlangıç tarihi seçin", 5000);
      return false;
    }
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      let nextSchedule = s.schedule || [];
      if (!frozen && resumeDate) {
        const upcomingLessons = [...nextSchedule].filter(lesson=>lesson.status==="upcoming").sort((a,b)=>new Date(a.date)-new Date(b.date));
        const fixedLessons = nextSchedule.filter(lesson=>lesson.status!=="upcoming");
        const plannedDates = buildScheduleSlots(getStudentSlots(s), upcomingLessons.length, resumeStart, getLessonDuration(s));
        const movedUpcoming = upcomingLessons.map((lesson,index) => {
          const planned = plannedDates[index];
          return planned ? { ...lesson, date:planned.date, day:planned.day, time:planned.time } : lesson;
        });
        nextSchedule = [...fixedLessons, ...movedUpcoming].sort((a,b)=>new Date(a.date)-new Date(b.date));
      }
      const next = { ...s, frozen, left_at:frozen ? (s.left_at || null) : null, schedule:nextSchedule };
      return withStatusEvent(next, frozen ? "frozen" : "active");
    });
    setStudents(updated);
    const savedStudent = await saveStudent(updated.find(s=>s.id===sid));
    const firstUpcoming = [...(savedStudent.schedule||[])].filter(lesson=>lesson.status==="upcoming").sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
    pop(frozen ? "Program donduruldu" : firstUpcoming ? "Program devam ettirildi · İlk ders "+fmtShort(firstUpcoming.date)+" "+lessonTime(savedStudent, firstUpcoming) : "Program tekrar aktif edildi");
    return savedStudent;
  };

  const handleStudentLeft = async (sid) => {
    const leftAt = new Date().toISOString().split("T")[0];
    const updated = students.map(s => s.id!==sid ? s : withStatusEvent({ ...s, frozen:true, left_at:leftAt }, "left", leftAt));
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Öğrenci ayrılan olarak kaydedildi");
  };

  const handleTelafiDone = async (sid, tid, payload = {}) => {
    const action = payload.action || "attended";
    const updated = students.map(s => {
      if (s.id !== sid) return s;
      const checkRef = homeworkCheckRef("telafi", tid);
      const checkedAt = new Date().toISOString();
      const schedule = (s.schedule || []).map(lesson => action === "attended" && payload.previousHomeworkSource === "schedule" && lesson.id === payload.previousHomeworkSourceId ? {
        ...lesson,
        homeworkStatus:payload.homeworkStatus,
        homeworkCheckNote:"",
        homeworkCheckedAt:checkedAt,
        homeworkCheckedInRef:checkRef,
      } : lesson);
      const telafiRecords = (s.telafi_records || []).map(r => {
        if (action === "attended" && payload.previousHomeworkSource === "telafi" && r.id === payload.previousHomeworkSourceId) {
          return {
            ...r,
            homeworkStatus:payload.homeworkStatus,
            homeworkCheckNote:"",
            homeworkCheckedAt:checkedAt,
            homeworkCheckedInRef:checkRef,
          };
        }
        if (r.id !== tid) return r;
        if (action === "plan") {
          return {
            ...r,
            plannedAt: payload.plannedAt,
            plannedDurationMinutes: payload.plannedDurationMinutes,
            plannedNote: payload.plannedNote || "",
          };
        }
        if (action === "counted") {
          return {
            ...r,
            done:true,
            doneStatus:"counted",
            doneAt:payload.doneAt || telafiPlannedAt(r) || new Date().toISOString(),
            doneNote:payload.doneNote || "",
          };
        }
        const homeworkText = (payload.homework || "").trim();
        const homeworkChanged = (r.homework || "") !== homeworkText;
        return {
          ...r,
          done:true,
          doneStatus:"attended",
          doneAt:payload.doneAt || telafiPlannedAt(r) || new Date().toISOString(),
          doneNote:payload.doneNote || "",
          activeMinutes:payload.activeMinutes || 0,
          taskFocusMinutes:payload.taskFocusMinutes || 0,
          redirectionCount:payload.redirectionCount || 0,
          lessonFocus:payload.lessonFocus || "",
          lessonScore:payload.lessonScore,
          lessonScoreBreakdown:payload.lessonScoreBreakdown || null,
          evaluatedHomework:payload.evaluatedHomework || "",
          evaluatedHomeworkStatus:payload.homeworkStatus || "",
          homework:homeworkText,
          homeworkStatus:homeworkText ? (homeworkChanged ? "pending" : (r.homeworkStatus || "pending")) : "",
          homeworkCheckNote:homeworkText && !homeworkChanged ? (r.homeworkCheckNote || "") : "",
          homeworkCheckedAt:homeworkText && !homeworkChanged ? (r.homeworkCheckedAt || null) : null,
          homeworkCheckedInRef:homeworkText && !homeworkChanged ? (r.homeworkCheckedInRef || null) : null,
        };
      });
      return { ...s, schedule, telafi_records:telafiRecords };
    });
    setStudents(updated);
    const savedStudent = await saveStudent(updated.find(s=>s.id===sid));
    pop(action === "plan" ? "Telafi planlandı" : "Telafi yapıldı");
    if (action === "plan") {
      const plannedRecord = (savedStudent.telafi_records || []).find(record => record.id === tid);
      if (plannedRecord?.plannedAt) setTelafiPlanMessagePrompt({ student:savedStudent, record:plannedRecord });
    } else if (action === "attended") {
      const evaluatedRecord = (savedStudent.telafi_records || []).find(record => record.id === tid);
      if (evaluatedRecord && storedLessonScore(evaluatedRecord) !== null) setLessonEvaluationPrompt({ student:savedStudent, record:evaluatedRecord, type:"telafi" });
    }
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

  const handleMoveOneLesson = async (sid, lid, date, time) => {
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      return {
        ...s,
        schedule: (s.schedule||[]).map(l => {
          if (l.id !== lid) return l;
          const nextTime = time || lessonTime(s, l) || s.time || "10:00";
          const moved = setTimeOnDate(new Date((date || dateKey(l.date)) + "T12:00:00"), nextTime);
          return { ...l, date:moved.toISOString(), time:nextTime };
        }).sort((a,b)=>new Date(a.date)-new Date(b.date))
      };
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ders tarih ve saate taşındı");
  };

  const handleDelete = async (sid) => {
    const source = students.find(student=>student.id===sid);
    if (!source) return false;
    const deletedAt = new Date().toISOString();
    const archived = withStatusEvent({ ...source, frozen:true, left_at:dateKey(deletedAt) }, "deleted", deletedAt);
    setStudents(prev=>prev.map(student=>student.id===sid?archived:student));
    try {
      await saveStudent(archived);
      pop("Öğrenci silindi; geçmiş ders ve ödemeler korundu");
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleRecharge = async (sid, odemeDate, selectedLessonCount) => {
    let lessonCount = PAYMENT_PACK_SIZE;
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const last = [...s.schedule].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      const from = last ? new Date(new Date(last.date).getTime()+86400000) : new Date();
      const parsedCount = parseInt(selectedLessonCount);
      lessonCount = PACKAGE_LOAD_OPTIONS.includes(parsedCount) ? parsedCount : getPreferredPackageLessonCount(s);
      const newLessons = buildScheduleSlots(getStudentSlots(s), lessonCount, from, getLessonDuration(s));
      const next = {...s, frozen:false, left_at:null, schedule:[...s.schedule, ...newLessons]};
      return (s.frozen || isStudentLeft(s)) ? withStatusEvent(next, "active") : next;
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop(lessonCount+" ders yüklendi");
  };

  const handleUndoLastPackage = async (sid) => {
    let removed = 0;
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const info = lastUndoablePackageInfo(s);
      if (!info) return s;
      const ids = new Set(info.lessonIds || []);
      removed = ids.size;
      return { ...s, schedule:(s.schedule||[]).filter(l => !ids.has(l.id)) };
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop(removed ? "Son paket geri alındı" : "Geri alınacak paket yok");
  };

  const handleAdd = async (f) => {
    const from = new Date((f.firstDate||new Date().toISOString().split("T")[0])+"T12:00:00");
    const slots = normalizeSlots(f.lessonSlots);
    const packageLessonCount = Math.max(1, parseInt(f.count)||PAYMENT_PACK_SIZE);
    const teacher = teachers.find(t => t.id === f.teacher_id);
    if (!teacher) { pop("Öğretmen seçilmeden öğrenci eklenemez", 5000); return; }
    const teacherFrom = f.lesson_start_date || dateKey(from);
    const newStudent = {
      id: uid(), name: f.name, phone: f.phone||"", veli_adi: f.veli_adi||"", dogum_tarihi: f.dogum_tarihi||"",
      lesson_start_date: f.lesson_start_date || null, teacher_id:teacher.id, teacher_name:teacher.name, teacher_history:[{ teacherId:teacher.id, teacherName:teacher.name, from:teacherFrom }], ucret: parseInt(f.ucret)||0, last_raise_date: f.last_raise_date || null, packageLessonCount, package_lesson_count: packageLessonCount, preferredPackageLessonCount: packageLessonCount, preferred_package_lesson_count: packageLessonCount, lessonDuration: parseInt(f.lessonDuration)||45, lesson_duration: parseInt(f.lessonDuration)||45, instrument: f.instrument, day: slots[0].day, time: slots[0].time, lessonSlots: slots, lesson_slots: slots,
      no_show: 0, frozen: false, left_at:null, status_history:[], odemeler: [], telafi_records: [],
      schedule: buildScheduleSlots(slots, packageLessonCount, from, f.lessonDuration), ek_dersler: [],
    };
    setStudents(p=>[...p, newStudent]);
    try {
      const saved = await saveStudent(newStudent);
      pop("Öğrenci eklendi");
      setWelcomeStudentId(saved.id);
      return saved;
    } catch (error) {
      return null;
    }
  };

  const handleCommunicationMessage = async (student, text, successText) => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g,"") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text),"_blank");
    else { await navigator.clipboard.writeText(text); pop("Telefon bulunamadı; mesaj kopyalandı"); return; }
    pop(successText || "Mesaj WhatsApp'ta hazırlandı");
  };

  const handleCommunicationStatus = (student, key, value, extra={}) => {
    const persist = async () => {
      const result = await supabase.from("students").select("*").eq("id",student.id).single();
      const current = result.data || students.find(item=>item.id===student.id) || student;
      const event = { id:uid(), type:"communication_"+key, value, at:new Date().toISOString(), ...extra };
      const updatedStudent = { ...current, status_history:[...(current.status_history || []),event] };
      setStudents(prev=>prev.map(item=>item.id===updatedStudent.id?updatedStudent:item));
      try {
        await saveStudent(updatedStudent);
        pop("İletişim durumu kaydedildi");
        return true;
      } catch (error) {
        return false;
      }
    };
    communicationQueueRef.current = communicationQueueRef.current.then(persist,persist);
    return communicationQueueRef.current;
  };

  const buildPaymentUpdate = (sourceStudents, sid, tarih) => {
    const odemeDate = tarih||new Date().toISOString().split("T")[0];
    const updated = sourceStudents.map(s => {
      if (s.id!==sid) return s;
      const packageInfo = currentPaymentDueInfo(s) || nextPayablePackageInfo(s);
      const upcoming = s.schedule.filter(l => l.status === "upcoming");
      let donem = "";
      if (packageInfo) donem = packageInfo.donem;
      else if (upcoming.length > 0) donem = fmtShort(upcoming[0].date)+" - "+fmtShort(upcoming[upcoming.length-1].date);
      else { const gecmis = s.schedule.filter(l => l.status !== "upcoming"); const son4 = gecmis.slice(-4); if (son4.length > 0) donem = fmtShort(son4[0].date)+" - "+fmtShort(son4[son4.length-1].date); }
      const ucret = s.ucret||0;
      const paketDersSayisi = packageInfo?.packageSize || 0;
      const paketCarpani = paketDersSayisi / PAYMENT_PACK_SIZE;
      const paketUcret = ucret * paketCarpani;
      const odenmemisEk = unpaidEkDersler(s);
      const ekTutar = odenmemisEk.reduce((sum,e)=>sum+(e.fee||ekDersFee(s)),0);
      const toplamTutar = paketUcret + ekTutar;
      const odemeVade = packageInfo?.startKey || null;
      const gecikmeGunu = odemeVade ? daysBetweenDates(odemeVade, odemeDate) : 0;
      const ekDersler = (s.ek_dersler||[]).map(e => odenmemisEk.some(x=>x.id===e.id) ? {...e, odendi:true, paidAt:odemeDate} : e);
      const odemeler = [...(s.odemeler||[]), {
        tarih:odemeDate,
        tutar:toplamTutar,
        paketUcret,
        ekDersSayisi:odenmemisEk.length,
        ekTutar,
        ekDersIds:odenmemisEk.map(e=>e.id),
        donem,
        packageId: packageInfo?.packageId,
        packageIndex: packageInfo?.packageIndex,
        packageLessonCount: paketDersSayisi,
        packageLessonIds: packageInfo?.lessonIds || [],
        packageStart: packageInfo?.startKey,
        packageEnd: packageInfo?.endKey,
        programSnapshot: studentScheduleLabel(s),
        programSnapshotVersion: 1,
        odemeVade,
        gecikmeGunu,
        zamaninda: gecikmeGunu === 0,
        sadeceEkDers: !packageInfo && odenmemisEk.length > 0,
        odendi:true
      }];
      return {...s, odemeler, ek_dersler: ekDersler};
    });
    return { updated, odemeDate };
  };

  const handleÖdemeKaydet = async (sid, tarih) => {
    const { updated, odemeDate } = buildPaymentUpdate(students, sid, tarih);
    const student = updated.find(s=>s.id===sid);
    const originalStudent = students.find(s=>s.id===sid);
    const operation = {
      type:"payment",
      studentId:sid,
      studentName:originalStudent?.name || student?.name || "Öğrenci",
      date:odemeDate,
      label:(originalStudent?.name || student?.name || "Öğrenci") + " - ödeme kaydı",
      detail:fmtMed(odemeDate),
    };
    setStudents(updated);
    try {
      await saveStudentWithRetry(student, operation);
      pop("Ödeme kaydedildi");
    } catch {}
  };

  const removeFailedOperation = (id) => {
    persistFailedOps(failedOps.filter(op => op.id !== id));
  };

  const retryFailedOperation = async (op) => {
    if (!op?.studentId || retryingOps[op.id]) return;
    setRetryingOps(prev => ({ ...prev, [op.id]: true }));
    try {
      const { data, error } = await supabase.from("students").select("*").eq("id", op.studentId).single();
      if (error || !data) throw error || new Error("Öğrenci bulunamadı");
      let built = null;
      if (op.type === "lessonAction") {
        built = buildActionUpdate([data], op.studentId, op.action, op.note, op.lessonId);
      } else if (op.type === "payment") {
        built = buildPaymentUpdate([data], op.studentId, op.date);
      }
      const nextStudent = built?.updated?.[0];
      if (!nextStudent) throw new Error("İşlem tekrar hazırlanamadı");
      await saveStudentWithRetry(nextStudent, { ...op, attempts:(op.attempts||0)+1 }, { attempts:1 });
      persistFailedOps(failedOps.filter(item => item.id !== op.id));
      await loadStudents();
      pop("Bekleyen işlem kaydedildi");
    } catch (error) {
      persistFailedOps(failedOps.map(item => item.id === op.id ? { ...item, attempts:(item.attempts||0)+1, error:error?.message || "Tekrar deneme başarısız" } : item));
      pop("Bekleyen işlem hâlâ kaydedilemedi.", 7000);
    } finally {
      setRetryingOps(prev => ({ ...prev, [op.id]: false }));
    }
  };

  const handleÖdemeDuzenle = async (sid, index, changes) => {
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const original = (s.odemeler||[])[index];
      if (!original) return s;
      let packageStart = changes.packageStart || null;
      let packageEnd = changes.packageEnd || null;
      if (packageStart && !packageEnd) packageEnd = packageStart;
      if (!packageStart && packageEnd) packageStart = packageEnd;
      if (packageStart && packageEnd && new Date(packageStart) > new Date(packageEnd)) {
        const tmp = packageStart;
        packageStart = packageEnd;
        packageEnd = tmp;
      }
      const schedule = [...(s.schedule||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
      const packageLessons = packageStart && packageEnd
        ? schedule.filter(l => dateKey(l.date) >= packageStart && dateKey(l.date) <= packageEnd)
        : [];
      const parsedAmount = parseFloat(String(changes.tutar || "").replace(",", "."));
      const odemeVade = packageStart || original.odemeVade || null;
      const nextDate = changes.tarih || original.tarih;
      const gecikmeGunu = odemeVade ? daysBetweenDates(odemeVade, nextDate) : original.gecikmeGunu;
      const nextPayment = {
        ...original,
        tarih: nextDate,
        tutar: Number.isFinite(parsedAmount) ? parsedAmount : original.tutar,
        packageStart: packageStart || undefined,
        packageEnd: packageEnd || undefined,
        packageLessonIds: packageLessons.length ? packageLessons.map(l=>l.id).filter(Boolean) : (packageStart || packageEnd ? [] : original.packageLessonIds),
        packageLessonCount: packageLessons.length || (packageStart || packageEnd ? 0 : original.packageLessonCount),
        packageId: packageLessons.length && packageLessons.every(l=>l.packageId && l.packageId===packageLessons[0].packageId) ? packageLessons[0].packageId : original.packageId,
        donem: packageLessons.length ? fmtShort(packageLessons[0].date)+" - "+fmtShort(packageLessons[packageLessons.length-1].date) : original.donem,
        odemeVade,
        gecikmeGunu,
        zamaninda: gecikmeGunu === 0,
      };
      return {
        ...s,
        odemeler: (s.odemeler||[]).map((o,i)=>i===index ? nextPayment : o),
        ek_dersler: (s.ek_dersler||[]).map(e => original?.ekDersIds?.includes(e.id) ? {...e, paidAt:nextPayment.tarih||e.paidAt} : e),
      };
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ödeme kaydı düzeltildi");
  };

  const handleÖdemeSil = async (sid, index) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s,
      odemeler: (s.odemeler||[]).filter((_,i)=>i!==index),
      ek_dersler: (s.ek_dersler||[]).map(e => {
        const deleted = (s.odemeler||[])[index];
        return deleted?.ekDersIds?.includes(e.id) ? {...e, odendi:false, paidAt:null} : e;
      })
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ödeme kaydı silindi");
  };

  const handleDonemDegerlendirmeAc = (sid) => {
    const student = students.find(s => s.id === sid);
    if (!student) { pop("Öğrenci kaydı bulunamadı", 5000); return; }
    const info = lastCompletedPackageInfo(student);
    if (!info || !packageSummaryKey(info)) { pop("Dönem kaydı oluşturulamadı", 5000); return; }
    const stats = packageEvaluationStats(student, info);
    if (!periodEvaluationInfo(student, info) && !stats?.newEvaluationEligible) { pop("Bu dönem v73 öncesi dersleri içerdiği için yeni değerlendirmeye alınmıyor", 6000); return; }
    setPeriodEvaluationModal({ student, info });
  };

  const handleDonemDegerlendirmeKaydet = async (sid, info, evaluation) => {
    if (summaryOpeningId) return;
    const student = students.find(s => s.id === sid);
    const key = packageSummaryKey(info);
    if (!student || !key) { pop("Dönem kaydı bulunamadı", 5000); return; }
    const existing = (student.package_summary_logs || []).find(log => log.packageKey === key);
    const logs = (student.package_summary_logs || []).filter(log => log.packageKey !== key);
    const updatedStudent = {
      ...student,
      package_summary_logs: [
        ...logs,
        {
          ...(existing || {}),
          packageKey:key,
          evaluatedAt:new Date().toISOString(),
          sentAt:null,
          packageStart:info.startKey,
          packageEnd:info.endKey,
          evaluation,
        }
      ]
    };
    setSummaryOpeningId(sid);
    try {
      await saveStudent(updatedStudent);
      setPeriodEvaluationModal(null);
      pop("Dönem değerlendirmesi kaydedildi");
    } catch {
      // saveStudent kayıt doğrulanamadığında öğrencileri veritabanından yeniden yükler.
    } finally {
      setSummaryOpeningId(null);
    }
  };

  const handlePaketOzetiAc = (sid) => {
    const student = students.find(s => s.id === sid);
    const info = lastCompletedPackageInfo(student);
    const log = periodEvaluationInfo(student, info);
    if (!student || !info || !log) { pop("Önce dönem değerlendirmesini tamamlayın", 5000); return; }
    setPeriodSummaryPrompt({ student, info, log });
  };

  const handlePaketOzetiGonderildi = async (sid, info) => {
    const student = students.find(s => s.id === sid);
    const key = packageSummaryKey(info);
    const existing = (student?.package_summary_logs || []).find(log => log.packageKey === key);
    if (!student || !existing?.evaluation) return;
    const updatedStudent = {
      ...student,
      package_summary_logs:(student.package_summary_logs || []).map(log => log.packageKey === key ? { ...log, sentAt:new Date().toISOString() } : log),
    };
    await saveStudent(updatedStudent);
    setPeriodSummaryPrompt(null);
    pop("Dönem özeti WhatsApp'ta hazırlandı");
  };

  const handleDuzenle = async (sid, f) => {
    const slots = normalizeSlots(f.lessonSlots, f.day, f.time);
    const duration = parseInt(f.lessonDuration)||45;
    const selectedTeacher = teachers.find(t => t.id === f.teacher_id);
    if (!selectedTeacher) { pop("Geçerli bir öğretmen seçin", 5000); return; }
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const schedule = s.schedule || [];
      const upcomingLessons = schedule.filter(l=>l.status==="upcoming");
      const fixedLessons = schedule.filter(l=>l.status!=="upcoming");
      const slotsChanged = !sameSlots(getStudentSlots(s), slots);
      const daysChanged = !sameSlotDays(getStudentSlots(s), slots);
      const upcomingNeedsSync = !upcomingScheduleMatchesSlots(upcomingLessons, slots);
      let nextSchedule = schedule.map(l=>l.status==="upcoming" ? {...l, durationMinutes:duration} : l);

      if (slotsChanged && !daysChanged && upcomingLessons.length) {
        const cleanSlots = normalizeSlots(slots);
        const byDay = {};
        cleanSlots.forEach(slot => { byDay[slotDayIndex(slot.day)] = slot; });
        nextSchedule = schedule.map(l => {
          if (l.status !== "upcoming") return l;
          const slot = byDay[new Date(l.date).getDay()] || cleanSlots[0];
          const nextDate = setTimeOnDate(l.date, slot.time);
          return { ...l, date:nextDate.toISOString(), day:slot.day, time:slot.time, durationMinutes:duration };
        }).sort((a,b)=>new Date(a.date)-new Date(b.date));
      } else if ((slotsChanged || upcomingNeedsSync) && upcomingLessons.length) {
        const lastFixed = [...fixedLessons].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
        const firstUpcoming = [...upcomingLessons].sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
        const from = lastFixed?.date
          ? new Date(new Date(lastFixed.date).getTime()+86400000)
          : (firstUpcoming?.date ? new Date(firstUpcoming.date) : new Date());
        if (lastFixed?.date) from.setHours(12,0,0,0);
        else from.setHours(0,0,0,0);
        const plannedDates = buildScheduleSlots(slots, upcomingLessons.length, from, duration);
        const upcomingSorted = [...upcomingLessons].sort((a,b)=>new Date(a.date)-new Date(b.date));
        const movedUpcoming = upcomingSorted.map((lesson, i) => {
          const planned = plannedDates[i];
          if (!planned) return { ...lesson, durationMinutes:duration };
          return {
            ...lesson,
            date:planned.date,
            day:planned.day,
            time:planned.time,
            durationMinutes:duration,
          };
        });
        nextSchedule = [...fixedLessons, ...movedUpcoming].sort((a,b)=>new Date(a.date)-new Date(b.date));
      }

      return {
        ...s,
        name: f.name,
        teacher_id: selectedTeacher.id,
        teacher_name: selectedTeacher.name,
        teacher_history: (s.teacher_id || teachers.find(t => t.name === studentTeacherName(s))?.id) === selectedTeacher.id
          ? (s.teacher_history || [])
          : [
              ...(s.teacher_history || []).filter(entry => dateKey(entry.from) !== (f.teacher_change_date || new Date().toISOString().split("T")[0])),
              { teacherId:selectedTeacher.id, teacherName:selectedTeacher.name, from:f.teacher_change_date || new Date().toISOString().split("T")[0] }
            ].sort((a,b)=>dateKey(a.from).localeCompare(dateKey(b.from))),
        phone: f.phone,
        veli_adi: f.veli_adi||"",
        dogum_tarihi: f.dogum_tarihi||"",
        lesson_start_date: f.lesson_start_date || null,
        ucret: parseInt(f.ucret)||0,
        last_raise_date: f.last_raise_date || null,
        lessonDuration: duration,
        lesson_duration: duration,
        preferredPackageLessonCount: PACKAGE_LOAD_OPTIONS.includes(parseInt(f.preferredPackageLessonCount)) ? parseInt(f.preferredPackageLessonCount) : getPreferredPackageLessonCount(s),
        preferred_package_lesson_count: PACKAGE_LOAD_OPTIONS.includes(parseInt(f.preferredPackageLessonCount)) ? parseInt(f.preferredPackageLessonCount) : getPreferredPackageLessonCount(s),
        packageLessonCount: getPackageLessonCount(s),
        package_lesson_count: getPackageLessonCount(s),
        instrument: f.instrument,
        day: slots[0].day,
        time: slots[0].time,
        lessonSlots: slots,
        lesson_slots: slots,
        schedule: nextSchedule
      };
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Bilgiler güncellendi");
  };

  const handleZamYap = async (sid, fee, date) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s,
      ucret: parseInt(fee)||s.ucret||0,
      last_raise_date: date || new Date().toISOString().split("T")[0]
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Zam kaydedildi");
  };

  const handleEkDersEkle = async (sid, ders) => {
    const updated = students.map(s => s.id!==sid ? s : { ...s, ek_dersler: [...(s.ek_dersler||[]), ders] });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ek ders eklendi");
  };

  const handleEkDersOdeme = async (sid, ekId, tarih) => {
    const odemeDate = tarih || new Date().toISOString().split("T")[0];
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const ek = (s.ek_dersler||[]).find(e=>e.id===ekId);
      if (!ek) return s;
      const tutar = ek.fee || ekDersFee(s);
      const odemeler = [...(s.odemeler||[]), {
        tarih: odemeDate,
        tutar,
        paketUcret:0,
        ekDersSayisi:1,
        ekTutar:tutar,
        ekDersIds:[ekId],
        donem: "Ek ders - "+fmtShort(ek.date),
        sadeceEkDers:true,
        odendi:true
      }];
      const ekDersler = (s.ek_dersler||[]).map(e=>e.id===ekId ? {...e, odendi:true, paidAt:odemeDate} : e);
      return {...s, odemeler, ek_dersler:ekDersler};
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ek ders ödemesi kaydedildi");
  };

  const handleEkDersSil = async (sid, ekId) => {
    let blocked = false;
    let removed = false;
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const ek = (s.ek_dersler||[]).find(e=>e.id===ekId);
      if (!ek) return s;
      if (ek.odendi) {
        blocked = true;
        return s;
      }
      removed = true;
      return { ...s, ek_dersler:(s.ek_dersler||[]).filter(e=>e.id!==ekId) };
    });
    if (blocked) {
      pop("Ödenmiş ek ders silinemez. Önce ödeme kaydını sil.", 6000);
      return;
    }
    if (!removed) {
      pop("Silinecek ek ders bulunamadı", 5000);
      return;
    }
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ek ders silindi");
  };

  const handleEkDersDurum = async (sid, ekId, status) => {
    const updated = students.map(s => s.id!==sid ? s : {
      ...s,
      ek_dersler: (s.ek_dersler||[]).map(e=>e.id===ekId ? {...e, status} : e)
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Ek ders durumu güncellendi");
  };

  const handleReminderToggle = async (sid, lessonRef, sent) => {
    const key = reminderKey(lessonRef);
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const logs = (s.lesson_reminder_logs || []).filter(log => log.lessonKey !== key);
      return sent
        ? { ...s, lesson_reminder_logs:[...logs, { lessonKey:key, sentAt:new Date().toISOString(), date:dateKey(new Date().toISOString()) }] }
        : { ...s, lesson_reminder_logs:logs };
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop(sent ? "Hatırlatma gönderildi işaretlendi" : "Hatırlatma işareti kaldırıldı");
  };

  const handleWADers = async (student, lesson) => {
    const text = msgDersHatirlatma(student);
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else { navigator.clipboard.writeText(text); pop("Mesaj kopyalandı"); }
    if (lesson) await handleReminderToggle(student.id, lesson.id || dateKey(lesson.date), true);
  };

  const handleWATelafi = async (student, record) => {
    const text = msgTelafiDersHatirlatma(student, record);
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else { await navigator.clipboard.writeText(text); pop("Telafi hatırlatma mesajı kopyalandı"); }
    await handleReminderToggle(student.id, telafiReminderRef(record), true);
  };

  const handleGoogleCalendarExport = () => {
    const count = downloadGoogleCalendarICS(students);
    pop(count ? count + " ders Google Takvim dosyasına aktarıldı" : "Aktarılacak ders bulunamadı");
  };

  const handleCalendarLinkCopy = async () => {
    const url = window.location.origin + "/api/calendar?v=" + CALENDAR_FEED_VERSION;
    try {
      await navigator.clipboard.writeText(url);
      pop("Takvim abonelik linki kopyalandı");
    } catch {
      window.prompt("Google Takvim'e URL ile ekle:", url);
    }
  };

  const handleTeacherAdd = async (name) => {
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (teachers.some(t => t.name.toLocaleLowerCase("tr-TR") === cleanName.toLocaleLowerCase("tr-TR"))) {
      pop("Bu öğretmen zaten kayıtlı", 5000);
      return false;
    }
    const { data, error } = await supabase.from("teachers").insert({ name:cleanName, active:true }).select("*").single();
    if (error || !data?.id) {
      console.error("Öğretmen ekleme hatası:", error);
      pop("Öğretmen kaydedilemedi", 6000);
      return false;
    }
    setTeachers(prev => [...prev, data].sort((a,b)=>a.name.localeCompare(b.name,"tr")));
    pop("Öğretmen eklendi");
    return true;
  };

  const handleTeacherToggle = async (teacher) => {
    if (teacher.active && teachers.filter(t=>t.active).length <= 1) {
      pop("En az bir aktif öğretmen kalmalıdır", 5000);
      return;
    }
    const nextActive = !teacher.active;
    const { data, error } = await supabase.from("teachers").update({ active:nextActive }).eq("id",teacher.id).select("*").single();
    if (error || !data?.id || data.active !== nextActive) {
      console.error("Öğretmen durumu güncelleme hatası:", error);
      pop("Öğretmen durumu kaydedilemedi", 6000);
      await loadTeachers();
      return;
    }
    setTeachers(prev => prev.map(t=>t.id===data.id?data:t));
    pop(nextActive ? "Öğretmen aktif edildi" : "Öğretmen pasife alındı");
  };

  const handleExpenseAdd = async expense => {
    const payload = {
      title:expense.title,
      category:expense.category,
      amount:expense.amount,
      expense_date:expense.expense_date,
      is_recurring:!!expense.is_recurring,
      recurring_until:null,
      deleted_at:null,
      updated_at:new Date().toISOString(),
    };
    const { data, error } = await supabase.from("expenses").insert(payload).select("*").single();
    if (error || !data?.id) {
      console.error("Gider kaydetme hatası:", error);
      pop("Gider veritabanına kaydedilemedi", 6000);
      return false;
    }
    setExpenses(prev => [...prev, data].sort((a,b)=>String(a.expense_date).localeCompare(String(b.expense_date))));
    pop(expense.is_recurring ? "Sabit gider kaydedildi" : "Gider kaydedildi");
    return true;
  };

  const handleExpenseRemove = async (expense, targetMonth) => {
    const updatedAt = new Date().toISOString();
    const changes = expense.is_recurring
      ? { recurring_until:localDateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0)), updated_at:updatedAt }
      : { deleted_at:updatedAt, updated_at:updatedAt };
    const { data, error } = await supabase.from("expenses").update(changes).eq("id",expense.id).select("*").single();
    if (error || !data?.id) {
      console.error("Gider güncelleme hatası:", error);
      pop(expense.is_recurring ? "Sabit gider durdurulamadı" : "Gider kaldırılamadı", 6000);
      return false;
    }
    setExpenses(prev => prev.map(item=>item.id===data.id?data:item));
    pop(expense.is_recurring ? "Sabit gider durduruldu; geçmiş aylar korundu" : "Gider listeden kaldırıldı");
    return true;
  };

  const isÖdemeBekleyen = (s) => {
    return isPaymentDue(s);
  };

  const operationalStudents = students.filter(student=>!isStudentDeleted(student));
  const todayPayments = operationalStudents.filter(isÖdemeBekleyen);
  const raiseDueList = operationalStudents.filter(isRaiseDue);
  const filtered = operationalStudents.filter(s => {
    if (search.trim() && !s.name.toLowerCase().includes(search.toLowerCase().trim())) return false;
    if (filter==="active") return !s.frozen;
    if (filter==="frozen") return s.frozen && !isStudentLeft(s);
    if (filter==="left") return isStudentLeft(s);
    if (filter==="telafi") return s.telafi_records.some(r=>!r.done);
    if (filter==="odeme") return isÖdemeBekleyen(s);
    if (filter==="zam") return isRaiseDue(s);
    return true;
  });

  const stats = { total:operationalStudents.length, active:operationalStudents.filter(s=>!s.frozen && !isStudentLeft(s)).length, frozen:operationalStudents.filter(s=>s.frozen && !isStudentLeft(s)).length, left:operationalStudents.filter(isStudentLeft).length, telafi:operationalStudents.filter(s=>s.telafi_records.some(r=>!r.done)).length, odeme:todayPayments.length, zam:raiseDueList.length };
  const telafiWarnList = operationalStudents.filter(s => s.telafi_records.filter(r=>!r.done).length===5 && !s.frozen);
  const pendingMonthlyReports = monthlyReports.filter(report=>!report.downloadedAt);
  const mainNav = [
    { key:"bugün", label:"Bugün", icon:"◫" },
    { key:"liste", label:"Öğrenciler", icon:<StudentsNavIcon />, badge:stats.active },
    { key:"ogretmenler", label:"Öğretmenler", icon:<TeachersNavIcon />, badge:teachers.filter(t=>t.active).length },
    { key:"iletisim", label:"İletişim", icon:<CommunicationNavIcon /> },
    { key:"takvim", label:"Takvim", icon:"□" },
    { key:"gelir", label:"Finans", icon:"↗" },
    { key:"ozet", label:"Özet", icon:"◎" },
  ];
  const viewMeta = {
    bugün:{ eyebrow:"Günlük Merkez", title:"Bugünün akışı", subtitle:"Dersler, ödemeler ve bekleyen işler tek ekranda." },
    liste:{ eyebrow:"ÖĞRENCİ YÖNETİMİ", title:"Öğrenciler", subtitle:"Tüm öğrencileri, paketleri ve gelişim durumlarını yönet." },
    ogretmenler:{ eyebrow:"ÖĞRETMEN YÖNETİMİ", title:"Öğretmenler", subtitle:"Öğretmenlerin öğrencilerini, haftalık programını ve aylık derslerini gör." },
    iletisim:{ eyebrow:"VELİ İLETİŞİMİ", title:"İletişim", subtitle:"WhatsApp grubu, bülten, ders kuralları ve Google yorumlarını takip et." },
    takvim:{ eyebrow:"Haftalık Program", title:"Ders takvimi", subtitle:"Haftanın derslerini ve değişikliklerini birlikte gör." },
    gelir:{ eyebrow:"Finansal Görünüm", title:"Finans", subtitle:"Tahsilat, gider ve net kârını aylık olarak takip et." },
    ozet:{ eyebrow:"AYLIK YÖNETİM", title:"Kurum özeti", subtitle:"Ders, gelir, kayıt, öğrenci durumu ve öğretmen dağılımını ay ay izle." },
  }[mainTab];

  if (!giris) {
    return (
      <>
      <style>{MIZAN_UI_CSS}</style>
      <div className="crm-login">
        <section className="crm-login-brand">
          <div className="crm-brand-mark">S</div>
          <h1>Sonsuz CRM</h1>
          <p>Öğrenciler, dersler, ödemeler ve gelişim takibi için sakin ve düzenli çalışma alanın.</p>
        </section>
        <section className="crm-login-panel">
        <div className="crm-login-card">
          <p className="crm-eyebrow">Sonsuz Sanat</p>
          {!authReady ? (
            <>
              <h2>Giriş doğrulanıyor</h2>
              <p>Güvenli oturum kontrol ediliyor...</p>
            </>
          ) : authMode === "set-password" ? (
            <>
              <h2>Parolanı oluştur</h2>
              <p>Yönetici hesabını tamamlamak için yalnızca sana ait güçlü bir parola belirle.</p>
              <label>Yeni parola</label>
              <input
                type="password"
                autoComplete="new-password"
                value={authPassword}
                onChange={e => { setAuthPassword(e.target.value); setAuthError(""); }}
                placeholder="En az 12 karakter"
              />
              <label style={{marginTop:13}}>Yeni parola tekrar</label>
              <input
                type="password"
                autoComplete="new-password"
                value={authPasswordAgain}
                onChange={e => { setAuthPasswordAgain(e.target.value); setAuthError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handlePasswordSetup(); }}
                placeholder="Parolanızı tekrar girin"
              />
              {authError && <p style={{ color:"#dc5d51", fontSize:12, fontWeight:700, margin:"9px 0 0" }}>{authError}</p>}
              <button disabled={authBusy} onClick={handlePasswordSetup} style={{opacity:authBusy ? .65 : 1}}>
                {authBusy ? "Kaydediliyor..." : "Parolayı Kaydet ve CRM'e Gir"}
              </button>
            </>
          ) : authMode === "supabase" ? (
            <>
              <h2>Tekrar hoş geldin</h2>
              <p>Yönetici veya öğretmen hesabınla güvenli giriş yap.</p>
              <label>E-posta</label>
              <input
                type="email"
                autoComplete="username"
                value={authEmail}
                onChange={e => { setAuthEmail(e.target.value); setAuthError(""); }}
                placeholder="ornek@eposta.com"
              />
              <label style={{marginTop:13}}>Parola</label>
              <input
                type="password"
                autoComplete="current-password"
                value={authPassword}
                onChange={e => { setAuthPassword(e.target.value); setAuthError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleSupabaseLogin(); }}
                placeholder="Parolanızı girin"
              />
              {authError && <p style={{ color:"#dc5d51", fontSize:12, fontWeight:700, margin:"9px 0 0" }}>{authError}</p>}
              <button disabled={authBusy} onClick={handleSupabaseLogin} style={{opacity:authBusy ? .65 : 1}}>
                {authBusy ? "Giriş yapılıyor..." : "Güvenli Giriş"}
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("legacy"); setAuthError(""); }}
                style={{background:"transparent",color:"#756f7a",border:"1px solid #ded9d3",marginTop:10}}
              >
                Geçici ortak şifreyle giriş
              </button>
            </>
          ) : (
            <>
              <h2>Geçici giriş</h2>
              <p>Supabase Auth geçişi tamamlanana kadar mevcut CRM şifresi çalışmaya devam eder.</p>
              <label>Mevcut CRM şifresi</label>
              <input
                type="password"
                value={sifre}
                onChange={e => { setSifre(e.target.value); setSifreHata(false); }}
                onKeyDown={e => { if (e.key === "Enter") handleLegacyLogin(); }}
                placeholder="Şifrenizi girin"
                style={sifreHata ? {borderColor:"#dc5d51"} : undefined}
              />
              {sifreHata && <p style={{ color:"#dc5d51", fontSize:12, fontWeight:700, margin:"7px 0 0" }}>Şifre hatalı</p>}
              <button onClick={handleLegacyLogin}>CRM'e Gir</button>
              <button
                type="button"
                onClick={() => { setAuthMode("supabase"); setSifreHata(false); }}
                style={{background:"transparent",color:"#756f7a",border:"1px solid #ded9d3",marginTop:10}}
              >
                Güvenli hesaba dön
              </button>
            </>
          )}
        </div>
        </section>
      </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
      <style>{MIZAN_UI_CSS}</style>
      <div className="crm-loading">
        <div>
          <div className="crm-loading-mark">S</div>
          <p style={{ fontWeight:750, color:"#77717d" }}>Çalışma alanın hazırlanıyor...</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <style>{MIZAN_UI_CSS}</style>
    <div className="crm-app">
      <aside className="crm-sidebar">
        <div className="crm-brand">
          <div className="crm-brand-mark">S</div>
          <div className="crm-brand-copy"><strong>Sonsuz Sanat</strong><span>ÖĞRENCİ YÖNETİMİ</span></div>
        </div>
        <p className="crm-nav-label">MENÜ</p>
        <nav className="crm-nav">
          {mainNav.map(t=>(
            <button key={t.key} className={`crm-nav-btn ${mainTab===t.key?"active":""}`} onClick={()=>setMainTab(t.key)}>
              <span className="crm-nav-icon">{t.icon}</span><span>{t.label}</span>{t.badge !== undefined ? <span className="crm-nav-badge">{t.badge}</span> : null}
            </button>
          ))}
        </nav>
        <button className="crm-side-action" disabled={authBusy} onClick={handleSecureLogout} style={{marginTop:12}}>↪ Güvenli çıkış</button>
        <div className="crm-sidebar-bottom">
          <div className="crm-tip"><strong>Bugünün özeti</strong>{stats.active} aktif öğrenci · {stats.odeme} ödeme bekliyor · {telafiWarnList.length} telafi uyarısı.</div>
          <button className="crm-side-action" onClick={handleCalendarLinkCopy}>⌁ Takvim linkini kopyala</button>
          <button className="crm-side-action" onClick={handleGoogleCalendarExport}>⇧ Google Takvim'e aktar</button>
        </div>
      </aside>

      <main className="crm-content">
        <header className="crm-topbar">
          <div><p className="crm-eyebrow">{viewMeta.eyebrow}</p><h1 className="crm-title">{viewMeta.title}</h1><p className="crm-subtitle">{viewMeta.subtitle}</p></div>
          <div className="crm-header-actions">
            <button className="crm-primary" onClick={()=>setShowAdd(true)}>＋ Öğrenci ekle</button>
          </div>
        </header>
        <section className="crm-page">
        {failedOps.length > 0 ? (
          <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:800, color:"#991b1b" }}>{failedOps.length} işlem kaydedilemedi</p>
            <p style={{ margin:"0 0 10px", fontSize:12, color:"#7f1d1d", fontWeight:600 }}>Bilgiler kaybolmadı. Sistem tekrar deneyebilir; başarıyla kaydedilince bu uyarı kalkar.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {failedOps.slice(0,3).map(op => (
                <div key={op.id} style={{ background:"#fff", border:"1px solid #fecaca", borderRadius:10, padding:"10px 12px" }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#111" }}>{op.label || failedOperationLabel(op)}</p>
                  <p style={{ margin:"3px 0 8px", fontSize:12, color:"#7f1d1d" }}>{op.detail || ""}{op.error ? " · " + op.error : ""}</p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <button onClick={() => retryFailedOperation(op)} disabled={!!retryingOps[op.id]} style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"8px 10px", fontSize:12, fontWeight:800, cursor:retryingOps[op.id]?"wait":"pointer", fontFamily:"inherit" }}>{retryingOps[op.id] ? "Deneniyor..." : "Tekrar Dene"}</button>
                    <button onClick={() => removeFailedOperation(op.id)} style={{ background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:8, padding:"8px 10px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Vazgeç</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {mainTab === "bugün" ? (
          <div>
            <PendingMonthlyReports reports={pendingMonthlyReports} onDownload={handleMonthlyReportDownload} downloadingId={downloadingReportId} />
            {(() => {
              const bugün = new Date();
              const bugünMD = (bugün.getMonth()+1)+"-"+bugün.getDate();
              const dogumGünleri = operationalStudents.filter(s => {
                if (isStudentLeft(s)) return false;
                if (!s.dogum_tarihi) return false;
                const d = new Date(s.dogum_tarihi);
                return (d.getMonth()+1)+"-"+d.getDate() === bugünMD;
              });
              if (dogumGünleri.length === 0) return null;
              return (
                <AçılırBugünBölümü title={`Bugün Doğum Günü (${dogumGünleri.length})`} color="#86198f" style={{ background:"#fdf4ff", border:"1.5px solid #e879f9", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                  {dogumGünleri.map(s => {
                    const yaş = new Date().getFullYear() - new Date(s.dogum_tarihi).getFullYear();
                    return (
                      <div key={s.id} onClick={() => setDetailSt(s)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", cursor:"pointer" }}>
                        <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                        <span style={{ fontSize:13, color:"#86198f", fontWeight:600 }}>{yaş} yaş</span>
                      </div>
                    );
                  })}
                </AçılırBugünBölümü>
              );
            })()}
            <BugünDersleri students={operationalStudents} onWA={handleWADers} onWATelafi={handleWATelafi} onReminderToggle={handleReminderToggle} onStudentClick={setDetailSt} onTelafiClick={(s) => { setDetailInitialTab("telafi"); setDetailSt(s); }} />
            <BekleyenTelafiler students={operationalStudents} onStudentClick={(s) => { setDetailInitialTab("telafi"); setDetailSt(s); }} />
            {operationalStudents.filter(s => calcBalance(s.schedule) === 0 && !s.frozen).length > 0 ? (
              <AçılırBugünBölümü title={`Paketi Biten Öğrenciler (${operationalStudents.filter(s => calcBalance(s.schedule) === 0 && !s.frozen).length})`} color="#7e22ce" style={{ background:"#faf5ff", border:"1.5px solid #d8b4fe", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                {operationalStudents.filter(s => calcBalance(s.schedule) === 0 && !s.frozen).map(s => {
                  const info = lastCompletedPackageInfo(s);
                  const evaluationLog = periodEvaluationInfo(s, info);
                  const evaluationStats = packageEvaluationStats(s, info);
                  const newEvaluationEligible = !!evaluationLog || !!evaluationStats?.newEvaluationEligible;
                  const sent = evaluationLog?.sentAt;
                  return (
                    <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f3e8ff" }}>
                      <div onClick={() => setDetailSt(s)} style={{ cursor:"pointer" }}>
                        <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                        <p style={{ margin:"2px 0 0", fontSize:12, color:"#7e22ce" }}>Dönem tamamlandı{info?.donem ? " · "+info.donem : ""}</p>
                        <p style={{ margin:"2px 0 0", fontSize:12, color:sent?"#059669":evaluationLog?"#7e22ce":"#c2410c", fontWeight:700 }}>
                          {sent ? "Dönem özeti gönderildi · "+fmtMed(sent) : evaluationLog ? "Dönem puanı: "+fmtNumber(evaluationLog.evaluation.periodScore)+"/100 · Özet gönderilmedi" : newEvaluationEligible ? "Dönem değerlendirilmedi" : "v73 öncesi dönem · Yeni değerlendirmeye alınmaz"}
                        </p>
                      </div>
                      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                        {evaluationLog
                          ? <button disabled={summaryOpeningId===s.id} onClick={() => handlePaketOzetiAc(s.id)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:summaryOpeningId===s.id?"wait":"pointer", opacity:summaryOpeningId===s.id ? .7 : 1 }}>Dönem Özetini Gönder</button>
                          : newEvaluationEligible ? <button disabled={summaryOpeningId===s.id} onClick={() => handleDonemDegerlendirmeAc(s.id)} style={{ background:"#a855f7", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:summaryOpeningId===s.id?"wait":"pointer", opacity:summaryOpeningId===s.id ? .7 : 1 }}>Dönemi Değerlendir</button> : null}
                        <button onClick={() => setÖdemeSt(s)} style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Paket Yükle</button>
                      </div>
                    </div>
                  );
                })}
              </AçılırBugünBölümü>
            ) : null}
            <BugünÖdemeleri students={operationalStudents} onÖdemeAl={handleÖdemeKaydet} onMesaj={(s)=>setMesajSt(s)} onStudentClick={setDetailSt} />
            {pendingMonthlyReports.length===0 && operationalStudents.filter(s=>{ if (s.frozen) return false; const l=s.schedule.find(x=>x.status==="upcoming"); return l&&isToday(l.date); }).length===0 && !operationalStudents.some(s=>isÖdemeBekleyen(s)) && !operationalStudents.some(s=>!isStudentLeft(s)&&(s.telafi_records||[]).some(isCurrentTelafi)) ? (
              <div style={{ textAlign:"center", padding:"48px 20px" }}>
                <p style={{ fontSize:36 }}>☀️</p>
                <p style={{ fontWeight:600, color:"#aaa" }}>Bugün için bir şey yok</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {mainTab === "takvim" ? <WeekCal students={operationalStudents} offset={weekOffset} setOffset={setWeekOffset} onStudentClick={setDetailSt} /> : null}
        {mainTab === "ogretmenler" ? <ÖğretmenlerPaneli students={students} teachers={teachers} onStudentClick={setDetailSt} /> : null}
        {mainTab === "iletisim" ? <İletişimPaneli students={students} onStudentClick={setDetailSt} onMessage={handleCommunicationMessage} onStatusChange={handleCommunicationStatus} /> : null}
        {mainTab === "gelir" ? <FinansRaporu students={students} expenses={expenses} onExpenseAdd={handleExpenseAdd} onExpenseRemove={handleExpenseRemove} /> : null}
        {mainTab === "ozet" ? <AylikOzet students={students} teachers={teachers} monthlyReports={monthlyReports} onMonthlyReportDownload={handleMonthlyReportDownload} downloadingReportId={downloadingReportId} onTeacherAdd={handleTeacherAdd} onTeacherToggle={handleTeacherToggle} /> : null}
        {mainTab === "liste" ? (
          <div>
            {telafiWarnList.length > 0 ? (
              <div style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#92400e" }}>Telafi limitine yaklaşan öğrenciler:</p>
                {telafiWarnList.map(s=>(<p key={s.id} style={{ margin:"4px 0 0", fontSize:13, color:"#78350f" }}>· {s.name} 5/6 telafi</p>))}
              </div>
            ) : null}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8, marginBottom:14 }}>
              {[
                { key:"all", label:"Toplam", val:stats.total, bg:"#fff", color:"#111" },
                { key:"active", label:"Aktif", val:stats.active, bg:"#ecfdf5", color:"#059669" },
                { key:"frozen", label:"Donuk", val:stats.frozen, bg:"#eff6ff", color:"#3b82f6" },
                { key:"left", label:"Ayrılan", val:stats.left, bg:stats.left>0?"#fff1f2":"#f9fafb", color:stats.left>0?"#be123c":"#999" },
                { key:"telafi", label:"Telafi", val:stats.telafi, bg:stats.telafi>0?"#faf5ff":"#f9fafb", color:stats.telafi>0?"#9333ea":"#999" },
                { key:"odeme", label:"Ödeme", val:stats.odeme, bg:stats.odeme>0?"#fff7ed":"#f9fafb", color:stats.odeme>0?"#ea580c":"#999" },
                { key:"zam", label:"Zam", val:stats.zam, bg:stats.zam>0?"#fff7ed":"#f9fafb", color:stats.zam>0?"#ea580c":"#999" },
              ].map(s=>(
                <button type="button" key={s.key} onClick={()=>setFilter(s.key)} style={{ background:s.bg, border:filter===s.key?`2px solid ${s.color}`:"2px solid transparent", borderRadius:12, padding:"10px 6px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,.05)", cursor:"pointer", fontFamily:"inherit" }}>
                  <p style={{ fontSize:22, fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
                  <p style={{ fontSize:10, color:"#999", margin:"2px 0 0", fontWeight:600 }}>{s.label}</p>
                </button>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Öğrenci ara..." style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:12, padding:"11px 14px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", background:"#fff", color:"#111" }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.map(s => {
                const left = isStudentLeft(s);
                const ac = s.telafi_records.filter(r=>!r.done).length;
                const warn = ac===5 && !s.frozen;
                const payDue = isÖdemeBekleyen(s);
                const age = studentAge(s);
                const ekCount = (s.ek_dersler||[]).length;
                const unpaidEkCount = unpaidEkDersler(s).length;
                const stripe = left ? "#be123c" : s.frozen ? "#3b82f6" : warn ? "#f59e0b" : payDue ? "#fb923c" : "#10b981";
                return (
                  <div key={s.id} style={{ ...CARD, position:"relative", overflow:"hidden", background:left?"#fff7f7":s.frozen?"#f8fbff":"#fff", padding:"14px 16px 14px 20px", border:left?"1.5px solid #fecdd3":warn?"1.5px solid #fcd34d":payDue?"1.5px solid #fb923c":s.frozen?"1.5px solid #bfdbfe":"1px solid #e8eaee" }}>
                    <div style={{ position:"absolute", left:0, top:0, bottom:0, width:5, background:stripe }} />
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setDetailSt(s)}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <p style={{ fontWeight:700, fontSize:15, margin:0, color:"#111" }}>{s.name}</p>
                          {left ? <TonePill tone="danger">Ayrılan</TonePill> : s.frozen ? <TonePill tone="info">Donuk</TonePill> : null}
                          {warn ? <TonePill tone="warn">5/6 Telafi</TonePill> : null}
                          {payDue ? <TonePill tone="warn">Ödeme</TonePill> : null}
                          {isRaiseDue(s) ? <TonePill tone="warn">Zam</TonePill> : null}
                          {ekCount>0 ? <TonePill tone="special">+{ekCount} ek</TonePill> : null}
                          {unpaidEkCount>0 ? <TonePill tone="warn">{unpaidEkCount} ek ödenmedi</TonePill> : null}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:3, marginTop:8, fontSize:12, color:"#64748b", lineHeight:1.45, textAlign:"left" }}>
                          <span><strong>Yaş:</strong> {age === null ? "-" : age}</span>
                          <span style={{ color:"#059669" }}><strong>Ücret:</strong> {s.ucret ? Number(s.ucret).toLocaleString("tr-TR")+" TL" : "-"}</span>
                          <span><strong>Enstrüman:</strong> {s.instrument || "-"}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6, marginLeft:10, flexShrink:0 }}>
                        <button onClick={()=>s.frozen ? setDetailSt(s) : setActionModal({student:s,lessonId:null})} style={{ background:left?"#ffe4e6":s.frozen?"#e0f2fe":"#111", color:left?"#be123c":s.frozen?"#0369a1":"#fff", border:"none", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>{left ? "Görüntüle" : s.frozen ? "Devam" : "İşlem"}</button>
                        {payDue ? <button onClick={()=>setÖdemeKaydetModal(s)} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:800, cursor:"pointer", flexShrink:0 }}>💳</button> : null}
                        <button onClick={()=>setMesajSt(s)} style={{ background:"#ecfdf5", color:"#166534", border:"1px solid #bbf7d0", borderRadius:10, padding:"8px 10px", fontSize:16, cursor:"pointer", flexShrink:0 }}>💬</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length===0 ? (
                <div style={{ textAlign:"center", padding:"48px 20px", color:"#bbb" }}>
                  <p style={{ fontSize:36 }}>🎵</p>
                  <p style={{ fontWeight:600, color:"#aaa" }}>{operationalStudents.length===0 ? "Henüz öğrenci yok" : "Bu filtrede öğrenci yok"}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        </section>
      </main>

      <nav className="crm-mobile-nav">
        {mainNav.map(t=>(
          <button key={t.key} className={mainTab===t.key?"active":""} onClick={()=>setMainTab(t.key)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
        <button disabled={authBusy} onClick={handleSecureLogout}>
          <span>↪</span>Çıkış
        </button>
      </nav>

      {actionModal ? <ActionSheet student={students.find(s=>s.id===actionModal.student.id)} lessonId={actionModal.lessonId} onClose={()=>setActionModal(null)} onBack={actionModal.returnTo ? ()=>{ const student=students.find(s=>s.id===actionModal.returnTo.studentId); setActionModal(null); setDetailInitialTab(actionModal.returnTo.tab || "takvim"); if(student) setDetailSt(student); } : null} onAction={(a,n,l)=>handleAction(actionModal.student.id,a,n,l)} onEvaluationMessage={(record)=>{ const student=students.find(s=>s.id===actionModal.student.id); setActionModal(null); setLessonEvaluationPrompt({ student, record, type:"normal" }); }} /> : null}
      {telafiMessagePrompt ? <TelafiHakkiMesajSheet student={telafiMessagePrompt.student} record={telafiMessagePrompt.record} onClose={()=>setTelafiMessagePrompt(null)} onSent={async(result)=>{ setTelafiMessagePrompt(null); pop(result === "copied" ? "Telafi hakkı mesajı kopyalandı" : "Telafi hakkı mesajı WhatsApp'ta hazırlandı"); }} /> : null}
      {detailSt ? <DetailSheet student={students.find(s=>s.id===detailSt.id)} teachers={teachers} initialTab={detailInitialTab} onClose={()=>{ setDetailSt(null); setDetailInitialTab("takvim"); }} onRecharge={handleRecharge} onUndoLastPackage={handleUndoLastPackage} onLessonClick={(st,lid,tab)=>{ const returnTab=tab || "takvim"; setDetailSt(null); setDetailInitialTab(returnTab); setTimeout(()=>setActionModal({student:st,lessonId:lid,returnTo:{studentId:st.id,tab:returnTab}}),100); }} onShift={handleShift} onMoveOne={handleMoveOneLesson} onTelafiDone={handleTelafiDone} onTelafiPlanMessage={(student,record)=>setTelafiPlanMessagePrompt({student,record})} onTelafiEvaluationMessage={(student,record)=>{ setDetailSt(null); setLessonEvaluationPrompt({student,record,type:"telafi"}); }} onMesaj={(st)=>setMesajSt(st)} onÖdemeAl={handleÖdemeKaydet} onZamYap={handleZamYap} onDelete={handleDelete} onStudentLeft={handleStudentLeft} onEkDersEkle={handleEkDersEkle} onEkDersOdeme={handleEkDersOdeme} onEkDersSil={handleEkDersSil} onEkDersDurum={handleEkDersDurum} onDuzenle={handleDuzenle} onToggleFreeze={handleToggleFreeze} onPaymentEdit={handleÖdemeDuzenle} onPaymentDelete={handleÖdemeSil} /> : null}
      {lessonEvaluationPrompt ? <WhatsAppPreviewSheet title={lessonEvaluationPrompt.type === "telafi" ? "Telafi Dersi Değerlendirmesi" : "Ders Değerlendirmesi"} subtitle={lessonEvaluationPrompt.student} text={msgDersDegerlendirmesi(lessonEvaluationPrompt.student, lessonEvaluationPrompt.record, lessonEvaluationPrompt.type)} onClose={()=>setLessonEvaluationPrompt(null)} onSent={async(result)=>{ setLessonEvaluationPrompt(null); pop(result === "copied" ? "Ders değerlendirmesi kopyalandı" : "Ders değerlendirmesi WhatsApp'ta hazırlandı"); }} /> : null}
      {telafiPlanMessagePrompt ? <TelafiPlanMesajSheet student={telafiPlanMessagePrompt.student} record={telafiPlanMessagePrompt.record} onClose={()=>setTelafiPlanMessagePrompt(null)} onSent={async(result)=>{ setTelafiPlanMessagePrompt(null); pop(result === "copied" ? "Telafi planı mesajı kopyalandı" : "Telafi planı mesajı WhatsApp'ta hazırlandı"); }} /> : null}
      {showAdd ? <AddSheet teachers={teachers} onClose={()=>setShowAdd(false)} onAdd={handleAdd} /> : null}
      {welcomeStudentId && students.find(student=>student.id===welcomeStudentId) ? <YeniÖğrenciİletişimSheet student={students.find(student=>student.id===welcomeStudentId)} onClose={()=>setWelcomeStudentId(null)} onMessage={handleCommunicationMessage} onStatusChange={handleCommunicationStatus} /> : null}
      {mesajSt ? <MesajSheet student={mesajSt} initialKey={mesajInitialKey} onClose={()=>{ setMesajSt(null); setMesajInitialKey(""); }} /> : null}
      {periodEvaluationModal ? <DonemDegerlendirmeSheet student={students.find(student=>student.id===periodEvaluationModal.student.id) || periodEvaluationModal.student} info={periodEvaluationModal.info} onClose={()=>setPeriodEvaluationModal(null)} onSave={evaluation=>handleDonemDegerlendirmeKaydet(periodEvaluationModal.student.id, periodEvaluationModal.info, evaluation)} /> : null}
      {periodSummaryPrompt ? <WhatsAppPreviewSheet title="Dönem Sonu Özeti" subtitle={periodSummaryPrompt.student} text={msgDonemDegerlendirmesi(periodSummaryPrompt.student, periodSummaryPrompt.info, periodSummaryPrompt.log)} onClose={()=>setPeriodSummaryPrompt(null)} onSent={()=>handlePaketOzetiGonderildi(periodSummaryPrompt.student.id, periodSummaryPrompt.info)} /> : null}
      {odemeSt ? <ÖdemeSheet student={odemeSt} onClose={()=>setÖdemeSt(null)} onÖdemeAl={handleRecharge} onMesajGonder={(st)=>setMesajSt(st)} /> : null}

      {odemeKaydetModal ? (
        <Sheet title="Ödeme Alındı" subtitle={odemeKaydetModal.name} onClose={() => setÖdemeKaydetModal(null)}>
          <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Ödeme tarihi:</p>
          <input style={INP} type="date" value={odemeKaydetDate} onChange={e=>setÖdemeKaydetDate(e.target.value)} />
          <div style={{ marginTop:16 }}>
            <Btn bg="#10b981" onClick={() => { handleÖdemeKaydet(odemeKaydetModal.id, odemeKaydetDate); setÖdemeKaydetModal(null); }}>Kaydet</Btn>
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
    </>
  );
}
