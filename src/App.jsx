import { useState, useEffect, useEffectEvent, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";
const CRM_AUTH_KEY = "crm_auth";
const CRM_AUTH_METHOD_KEY = "crm_auth_method";
const CRM_PASSWORD_SETUP_PENDING_KEY = "crm_password_setup_pending";
const TRUSTED_DEVICE_DAYS = 30;
const INITIAL_AUTH_LINK_TYPE = typeof window === "undefined"
  ? ""
  : new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") || "";
if (typeof window !== "undefined" && ["invite", "recovery"].includes(INITIAL_AUTH_LINK_TYPE)) {
  sessionStorage.setItem(CRM_PASSWORD_SETUP_PENDING_KEY, "ok");
}
const SUPABASE_AUTH_STORAGE = typeof window === "undefined" ? undefined : window.sessionStorage;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth:{ persistSession:true, ...(SUPABASE_AUTH_STORAGE ? { storage:SUPABASE_AUTH_STORAGE } : {}) },
});
const FAILED_OPS_KEY = "sonsuz_crm_failed_operations_v1";
const SINGLE_LESSON_ISSUE_KEY = "sonsuz_crm_single_lesson_issue_v1";
const EXTRA_LESSON_PAYMENT_ISSUE_KEY = "sonsuz_crm_extra_lesson_payment_issue_v1";
const PACKAGE_PAYMENT_ISSUE_KEY = "sonsuz_crm_package_payment_issue_v1";
const BRANCH_LIFECYCLE_ISSUE_KEY = "sonsuz_crm_branch_lifecycle_issue_v1";
const STAFF_INVITATION_ISSUE_KEY = "sonsuz_crm_staff_invitation_issue_v1";
const STAFF_ACTIVATION_ISSUE_KEY = "sonsuz_crm_staff_activation_issue_v1";
const STAFF_ASSIGNMENT_ISSUE_KEY = "sonsuz_crm_staff_assignment_issue_v1";
const STAFF_DEACTIVATION_ISSUE_KEY = "sonsuz_crm_staff_deactivation_issue_v1";
const NORMAL_LESSON_EVALUATION_ISSUE_KEY = "sonsuz_crm_normal_lesson_evaluation_issue_v1";
const NORMAL_LESSON_MAKEUP_ISSUE_KEY = "sonsuz_crm_normal_lesson_makeup_issue_v1";
const NORMAL_LESSON_MAKEUP_PLAN_ISSUE_KEY = "sonsuz_crm_normal_lesson_makeup_plan_issue_v1";
const NORMAL_LESSON_MAKEUP_COMPLETION_ISSUE_KEY = "sonsuz_crm_normal_lesson_makeup_completion_issue_v1";
const STAFF_ISSUE_STORE_VERSION = 2;
const STAFF_ISSUE_LEGACY_ACTOR_KEY = "__legacy__";
const NORMAL_LESSON_EVALUATION_ISSUE_STORE_VERSION = 1;
const NORMAL_LESSON_EVALUATION_ABSENCE_SETTLE_MS = 20000;
const NORMAL_LESSON_MAKEUP_ISSUE_STORE_VERSION = 1;
const NORMAL_LESSON_MAKEUP_ABSENCE_SETTLE_MS = 20000;
const NORMAL_LESSON_MAKEUP_PLAN_ISSUE_STORE_VERSION = 1;
const NORMAL_LESSON_MAKEUP_PLAN_ABSENCE_SETTLE_MS = 20000;
const NORMAL_LESSON_MAKEUP_COMPLETION_ISSUE_STORE_VERSION = 1;
const NORMAL_LESSON_MAKEUP_COMPLETION_ABSENCE_SETTLE_MS = 20000;
const SINGLE_LESSON_REQUEST_TIMEOUT_MS = 15000;
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

function accessBranchOptions(context) {
  const organizations = Array.isArray(context?.organizations) ? context.organizations : [];
  return organizations.flatMap(organization => {
    const branches = Array.isArray(organization?.branches) ? organization.branches : [];
    return branches.map(branch => ({
      organization,
      branch,
      organizationId:organization.id,
      organizationName:organization.name || "Kurum",
      branchId:branch.id,
      branchName:branch.name || "Şube",
      selectable:branch.selectable === true && branch.active !== false,
    }));
  });
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

async function trustedDeviceRequest(session, action) {
  if (!session?.access_token) return { trusted:false, unavailable:true };
  try {
    const response = await fetch("/api/trusted-device", {
      method:"POST",
      credentials:"same-origin",
      headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer " + session.access_token,
      },
      body:JSON.stringify({ action }),
    });
    if (!response.ok) return { trusted:false, unavailable:response.status >= 500 };
    const data = await response.json();
    return { trusted:data?.trusted === true, expiresAt:data?.expiresAt || "", unavailable:false };
  } catch {
    return { trusted:false, unavailable:true };
  }
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
function expiry30FromLessonDate(value) {
  const d = telafiPolicyDate(value);
  if (!d) return "";
  d.setDate(d.getDate() + 30);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function daysLeft(iso) { if (!iso) return null; return Math.ceil((new Date(iso) - new Date()) / 86400000); }
function isCurrentTelafi(record) {
  if (!record || record.done) return false;
  if (!record.expiry) return true;
  const expiryDate = /^\d{4}-\d{2}-\d{2}$/.test(record.expiry) ? new Date(record.expiry+"T00:00:00") : new Date(record.expiry);
  if (isNaN(expiryDate.getTime())) return true;
  return midday(expiryDate).getTime() >= midday().getTime();
}
function activeTelafiRecords(records) { return (records || []).filter(isCurrentTelafi); }
function isTodayPlannedTelafi(record) {
  const plannedAt = telafiPlannedAt(record);
  return !record?.done && !!plannedAt && isToday(plannedAt);
}
function telafiPolicyDate(value) {
  if (!value) return null;
  const text = String(value);
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2])-1, Number(ymd[3]), 12, 0, 0, 0)
    : new Date(value);
  if (isNaN(parsed.getTime())) return null;
  parsed.setHours(12,0,0,0);
  return parsed;
}
function registrationAnniversary(startDate, yearOffset) {
  const year = startDate.getFullYear() + yearOffset;
  const month = startDate.getMonth();
  const day = startDate.getDate();
  const lastDay = new Date(year, month+1, 0, 12, 0, 0, 0).getDate();
  return new Date(year, month, Math.min(day,lastDay), 12, 0, 0, 0);
}
function registrationYearPeriod(student, value = new Date()) {
  const start = telafiPolicyDate(student?.lesson_start_date || student?.lessonStartDate);
  const target = telafiPolicyDate(value);
  if (!start || !target) return null;
  if (target < start) return { key:"before-start", number:0, start:null, end:null, beforeStart:true };
  let offset = target.getFullYear() - start.getFullYear();
  if (target < registrationAnniversary(start, offset)) offset -= 1;
  const periodStart = registrationAnniversary(start, offset);
  const periodEnd = registrationAnniversary(start, offset+1);
  return { key:"registration-year-"+offset, number:offset+1, start:periodStart, end:periodEnd, beforeStart:false };
}
function telafiPeriodForRecord(student, record) {
  return registrationYearPeriod(student, record?.lessonDate);
}
function isManagerTelafiException(record) {
  return record?.managerException === true || record?.manager_exception === true;
}
function telafiRecordsWithoutLesson(records, lesson) {
  if (!lesson?.id) return records || [];
  return (records || []).filter(record => !(record.lessonId === lesson.id || (!record.lessonId && dateKey(record.lessonDate) === dateKey(lesson.date) && !record.done)));
}
function telafiQuotaInfo(student, referenceDate = new Date(), records = student?.telafi_records || []) {
  const period = registrationYearPeriod(student, referenceDate);
  if (!period || period.beforeStart) return { period, count:null, used:[], normalRecords:[], exceptionRecords:[], legacyOverflowRecords:[], remaining:null, exceptionCount:0, legacyOverflowCount:0 };
  const used = (records || []).filter(record => telafiPeriodForRecord(student, record)?.key === period.key);
  const explicitExceptions = used.filter(isManagerTelafiException);
  const unmarked = used.filter(record=>!isManagerTelafiException(record)).sort((a,b)=>{
    const aTime = telafiPolicyDate(a.createdAt || a.created_at || a.lessonDate)?.getTime() || 0;
    const bTime = telafiPolicyDate(b.createdAt || b.created_at || b.lessonDate)?.getTime() || 0;
    return aTime-bTime;
  });
  const normalRecords = unmarked.slice(0,6);
  const legacyOverflowRecords = unmarked.slice(6);
  const exceptionRecords = explicitExceptions;
  const count = normalRecords.length;
  return { period, count, used, normalRecords, exceptionRecords, legacyOverflowRecords, remaining:Math.max(0,6-count), exceptionCount:exceptionRecords.length, legacyOverflowCount:legacyOverflowRecords.length };
}
function telafiPeriodGroups(student) {
  const groups = new Map();
  (student?.telafi_records || []).forEach(record => {
    const period = telafiPeriodForRecord(student, record);
    const key = period?.key || "unassigned";
    if (!groups.has(key)) groups.set(key, { key, period, records:[] });
    groups.get(key).records.push(record);
  });
  return [...groups.values()].sort((a,b) => {
    const aTime = a.period?.start?.getTime() ?? -Infinity;
    const bTime = b.period?.start?.getTime() ?? -Infinity;
    return bTime-aTime;
  });
}
function telafiPeriodLabel(period) {
  if (!period) return "Dönemi hesaplanamayan kayıtlar";
  if (period.beforeStart) return "Başlangıç tarihinden önceki kayıtlar";
  return telafiPeriodTitle(period)+" · "+telafiPeriodDateRange(period);
}
function telafiPeriodTitle(period) {
  if (!period) return "Dönemi hesaplanamayan kayıtlar";
  if (period.beforeStart) return "Başlangıç tarihinden önceki kayıtlar";
  return period.number+". Telafi Hak Dönemi";
}
function telafiPeriodDateRange(period) {
  if (!period || period.beforeStart) return "";
  const lastDay = new Date(period.end); lastDay.setDate(lastDay.getDate()-1);
  const full = date => date.toLocaleDateString("tr-TR", { day:"numeric", month:"long", year:"numeric" });
  return full(period.start)+" – "+full(lastDay);
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
function turkeyDateKey(value = new Date()) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/Istanbul", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(d);
  const part = type => parts.find(item=>item.type===type)?.value || "";
  return [part("year"),part("month"),part("day")].join("-");
}
function isValidLocalDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year,month,day] = value.split("-").map(Number);
  const parsed = new Date(year,month-1,day);
  return parsed.getFullYear()===year && parsed.getMonth()===month-1 && parsed.getDate()===day;
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
const LESSON_FOCUS_OPTIONS = ["Parça Tekrarı","Yeni Parça Çalışması","Teknik","Ritim","Teori/Nota","Dikkat Süresi Arttırma","Bilişsel Dayanıklılık Arttırma"];
const PIECE_RESULT_OPTIONS = [
  { value:"complete", label:"Tam ve akıcı", score:100 },
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

function displayPieceResult(value, storedLabel, fallback = "Sonuç belirtilmedi") {
  const option = pieceResultOption(value);
  if (option) return option.label;
  if (storedLabel === "Tam ve akıcı parça çıktı") return "Tam ve akıcı";
  return storedLabel || fallback;
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

function readSingleLessonIssue() {
  try {
    const raw = localStorage.getItem(SINGLE_LESSON_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSingleLessonIssue(issue) {
  if (typeof window === "undefined") return;
  if (issue) localStorage.setItem(SINGLE_LESSON_ISSUE_KEY, JSON.stringify(issue));
  else localStorage.removeItem(SINGLE_LESSON_ISSUE_KEY);
}

function readExtraLessonPaymentIssue() {
  try {
    const raw = localStorage.getItem(EXTRA_LESSON_PAYMENT_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && parsed.operationId ? parsed : null;
  } catch {
    return null;
  }
}

function writeExtraLessonPaymentIssue(issue) {
  if (typeof window === "undefined") return false;
  try {
    if (issue) localStorage.setItem(EXTRA_LESSON_PAYMENT_ISSUE_KEY, JSON.stringify(issue));
    else localStorage.removeItem(EXTRA_LESSON_PAYMENT_ISSUE_KEY);
    return true;
  } catch {
    return false;
  }
}

function extraLessonPaymentIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Ek Ders ödemesi Supabase'de bulunamadı. Ödeme oluşmadı; gerekiyorsa işlemi yeniden yapın.";
  if (issue.state === "applied_pending_refresh") return "Ek Ders ödemesi Supabase'e kaydedildi; öğrenci ekranı henüz yenilenemedi. İkinci ödeme göndermeyin.";
  return "Ek Ders ödeme işleminin sonucu henüz kesinleştirilemedi. Sistem ikinci bir ödeme göndermeden Supabase kaydını kontrol edecek.";
}

function readPackagePaymentIssue() {
  try {
    const raw = localStorage.getItem(PACKAGE_PAYMENT_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && parsed.operationId ? parsed : null;
  } catch {
    return null;
  }
}

function writePackagePaymentIssue(issue) {
  if (typeof window === "undefined") return false;
  try {
    if (issue) localStorage.setItem(PACKAGE_PAYMENT_ISSUE_KEY, JSON.stringify(issue));
    else localStorage.removeItem(PACKAGE_PAYMENT_ISSUE_KEY);
    return true;
  } catch {
    return false;
  }
}

function readBranchLifecycleIssue() {
  try {
    const raw = localStorage.getItem(BRANCH_LIFECYCLE_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && parsed.operationId ? parsed : null;
  } catch {
    return null;
  }
}

function writeBranchLifecycleIssue(issue) {
  if (typeof window === "undefined") return false;
  try {
    if (issue) localStorage.setItem(BRANCH_LIFECYCLE_ISSUE_KEY, JSON.stringify(issue));
    else localStorage.removeItem(BRANCH_LIFECYCLE_ISSUE_KEY);
    return true;
  } catch {
    return false;
  }
}

function branchLifecycleIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Şube işlemi Supabase'de bulunamadı. Değişiklik oluşmadı; gerekiyorsa işlemi yeniden başlatabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Şube işlemi Supabase'e kaydedildi; güncel şube listesi henüz doğrulanamadı. İşlemi yeniden göndermeyin.";
  return "Şube işleminin sonucu henüz kesinleştirilemedi. Sistem işlemi tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function readStaffIssueStore(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version === STAFF_ISSUE_STORE_VERSION && parsed.issues && typeof parsed.issues === "object") {
      return Object.fromEntries(Object.entries(parsed.issues).filter(([,issue])=>issue && typeof issue === "object" && issue.operationId));
    }
    if (parsed && typeof parsed === "object" && parsed.operationId) {
      return { [String(parsed.actorUserId || STAFF_ISSUE_LEGACY_ACTOR_KEY)]:parsed };
    }
    return {};
  } catch {
    return {};
  }
}

function readStaffIssue(storageKey, actorUserId="") {
  const issues = readStaffIssueStore(storageKey);
  const actorKey = String(actorUserId || "");
  if (actorKey && issues[actorKey]) return issues[actorKey];
  const legacy = issues[STAFF_ISSUE_LEGACY_ACTOR_KEY];
  if (actorKey && legacy && (!legacy.actorUserId || legacy.actorUserId === actorKey)) return legacy;
  return actorKey ? null : legacy || null;
}

function writeStaffIssue(storageKey, actorUserId, issue, expectedOperationId="") {
  if (typeof window === "undefined") return false;
  try {
    const issues = readStaffIssueStore(storageKey);
    const actorKey = String(actorUserId || issue?.actorUserId || STAFF_ISSUE_LEGACY_ACTOR_KEY);
    const current = issues[actorKey];
    if (!issue && expectedOperationId && current?.operationId !== expectedOperationId) return false;
    if (issue) {
      issues[actorKey] = issue;
      if (actorKey !== STAFF_ISSUE_LEGACY_ACTOR_KEY && issues[STAFF_ISSUE_LEGACY_ACTOR_KEY]?.operationId === issue.operationId) {
        delete issues[STAFF_ISSUE_LEGACY_ACTOR_KEY];
      }
    } else {
      delete issues[actorKey];
    }
    if (Object.keys(issues).length) {
      localStorage.setItem(storageKey, JSON.stringify({ version:STAFF_ISSUE_STORE_VERSION, issues }));
    } else {
      localStorage.removeItem(storageKey);
    }
    return true;
  } catch {
    return false;
  }
}

function readNormalLessonEvaluationIssueStore() {
  try {
    const raw = localStorage.getItem(NORMAL_LESSON_EVALUATION_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== NORMAL_LESSON_EVALUATION_ISSUE_STORE_VERSION || !parsed.issues || typeof parsed.issues !== "object") return {};
    return Object.fromEntries(Object.entries(parsed.issues).filter(([,issue])=>issue && typeof issue === "object" && issue.operationId));
  } catch {
    return {};
  }
}

function readNormalLessonEvaluationIssue(actorUserId="") {
  const actorKey = String(actorUserId || "");
  if (!actorKey) return null;
  return readNormalLessonEvaluationIssueStore()[actorKey] || null;
}

function writeNormalLessonEvaluationIssue(actorUserId, issue, expectedOperationId="") {
  if (typeof window === "undefined" || !actorUserId) return false;
  try {
    const issues = readNormalLessonEvaluationIssueStore();
    const actorKey = String(actorUserId);
    const current = issues[actorKey];
    if (expectedOperationId && current?.operationId !== expectedOperationId) return false;
    if (issue) issues[actorKey] = issue;
    else delete issues[actorKey];
    if (Object.keys(issues).length) {
      localStorage.setItem(NORMAL_LESSON_EVALUATION_ISSUE_KEY,JSON.stringify({ version:NORMAL_LESSON_EVALUATION_ISSUE_STORE_VERSION, issues }));
    } else {
      localStorage.removeItem(NORMAL_LESSON_EVALUATION_ISSUE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function readNormalLessonMakeupIssueStore() {
  try {
    const raw = localStorage.getItem(NORMAL_LESSON_MAKEUP_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== NORMAL_LESSON_MAKEUP_ISSUE_STORE_VERSION || !parsed.issues || typeof parsed.issues !== "object") return {};
    return Object.fromEntries(Object.entries(parsed.issues).filter(([,issue])=>issue && typeof issue === "object" && issue.operationId));
  } catch {
    return {};
  }
}

function readNormalLessonMakeupIssue(actorUserId="") {
  const actorKey = String(actorUserId || "");
  if (!actorKey) return null;
  return readNormalLessonMakeupIssueStore()[actorKey] || null;
}

function writeNormalLessonMakeupIssue(actorUserId, issue, expectedOperationId="") {
  if (typeof window === "undefined" || !actorUserId) return false;
  try {
    const issues = readNormalLessonMakeupIssueStore();
    const actorKey = String(actorUserId);
    const current = issues[actorKey];
    if (expectedOperationId && current?.operationId !== expectedOperationId) return false;
    if (issue) issues[actorKey] = issue;
    else delete issues[actorKey];
    if (Object.keys(issues).length) {
      localStorage.setItem(NORMAL_LESSON_MAKEUP_ISSUE_KEY,JSON.stringify({ version:NORMAL_LESSON_MAKEUP_ISSUE_STORE_VERSION, issues }));
    } else {
      localStorage.removeItem(NORMAL_LESSON_MAKEUP_ISSUE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function readNormalLessonMakeupPlanIssueStore() {
  try {
    const raw = localStorage.getItem(NORMAL_LESSON_MAKEUP_PLAN_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== NORMAL_LESSON_MAKEUP_PLAN_ISSUE_STORE_VERSION || !parsed.issues || typeof parsed.issues !== "object") return {};
    return Object.fromEntries(Object.entries(parsed.issues).filter(([,issue])=>issue && typeof issue === "object" && issue.operationId));
  } catch {
    return {};
  }
}

function readNormalLessonMakeupPlanIssue(actorUserId="") {
  const actorKey = String(actorUserId || "");
  if (!actorKey) return null;
  return readNormalLessonMakeupPlanIssueStore()[actorKey] || null;
}

function writeNormalLessonMakeupPlanIssue(actorUserId, issue, expectedOperationId="") {
  if (typeof window === "undefined" || !actorUserId) return false;
  try {
    const issues = readNormalLessonMakeupPlanIssueStore();
    const actorKey = String(actorUserId);
    const current = issues[actorKey];
    if (expectedOperationId && current?.operationId !== expectedOperationId) return false;
    if (issue) issues[actorKey] = issue;
    else delete issues[actorKey];
    if (Object.keys(issues).length) {
      localStorage.setItem(NORMAL_LESSON_MAKEUP_PLAN_ISSUE_KEY,JSON.stringify({ version:NORMAL_LESSON_MAKEUP_PLAN_ISSUE_STORE_VERSION, issues }));
    } else {
      localStorage.removeItem(NORMAL_LESSON_MAKEUP_PLAN_ISSUE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function readNormalLessonMakeupCompletionIssueStore() {
  try {
    const raw = localStorage.getItem(NORMAL_LESSON_MAKEUP_COMPLETION_ISSUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== NORMAL_LESSON_MAKEUP_COMPLETION_ISSUE_STORE_VERSION || !parsed.issues || typeof parsed.issues !== "object") return {};
    return Object.fromEntries(Object.entries(parsed.issues).filter(([,issue])=>issue && typeof issue === "object" && issue.operationId));
  } catch {
    return {};
  }
}

function readNormalLessonMakeupCompletionIssue(actorUserId="") {
  const actorKey = String(actorUserId || "");
  if (!actorKey) return null;
  return readNormalLessonMakeupCompletionIssueStore()[actorKey] || null;
}

function writeNormalLessonMakeupCompletionIssue(actorUserId, issue, expectedOperationId="") {
  if (typeof window === "undefined" || !actorUserId) return false;
  try {
    const issues = readNormalLessonMakeupCompletionIssueStore();
    const actorKey = String(actorUserId);
    const current = issues[actorKey];
    if (expectedOperationId && current?.operationId !== expectedOperationId) return false;
    if (issue) issues[actorKey] = issue;
    else delete issues[actorKey];
    if (Object.keys(issues).length) {
      localStorage.setItem(NORMAL_LESSON_MAKEUP_COMPLETION_ISSUE_KEY,JSON.stringify({ version:NORMAL_LESSON_MAKEUP_COMPLETION_ISSUE_STORE_VERSION, issues }));
    } else {
      localStorage.removeItem(NORMAL_LESSON_MAKEUP_COMPLETION_ISSUE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result,key)=>{
      if (value[key] !== undefined) result[key] = canonicalJson(value[key]);
      return result;
    },{});
  }
  return value;
}

function normalLessonEvaluationIntentSignature(value) {
  const text = JSON.stringify(canonicalJson(value));
  let first = 2166136261;
  let second = 2246822507;
  for (let index=0; index<text.length; index+=1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code,16777619);
    second = Math.imul(second ^ code,3266489909);
  }
  return (first>>>0).toString(16).padStart(8,"0")+(second>>>0).toString(16).padStart(8,"0")+":"+text.length;
}

function normalLessonEvaluationIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Ders değerlendirmesi Supabase'de bulunamadı. Kayıt oluşmadı; uyarıyı kapattıktan sonra işlemi yeniden yapabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Ders değerlendirmesi Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi yeniden göndermeyin.";
  if (issue.state === "conflict") return "Ders değerlendirme kanıtı beklenen öğrenci veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.";
  return "Ders değerlendirmesinin sonucu henüz kesinleştirilemedi. Sistem değerlendirmeyi tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function normalLessonMakeupIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Telafi hakkı işlemi Supabase'de bulunamadı. Kayıt oluşmadı; uyarıyı kapattıktan sonra işlemi yeniden yapabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Telafi hakkı Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi yeniden göndermeyin.";
  if (issue.state === "conflict") return "Telafi hakkı kanıtı beklenen öğrenci, ders veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.";
  return "Telafi hakkı işleminin sonucu henüz kesinleştirilemedi. Sistem işlemi tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function normalLessonMakeupPlanIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Telafi planı Supabase'de bulunamadı. Kayıt oluşmadı; uyarıyı kapattıktan sonra işlemi yeniden yapabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Telafi planı Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi yeniden göndermeyin.";
  if (issue.state === "conflict") return "Telafi planı kanıtı beklenen öğrenci, telafi hakkı veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.";
  return "Telafi planının sonucu henüz kesinleştirilemedi. Sistem planı tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function normalLessonMakeupCompletionIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Telafi tamamlama işlemi Supabase'de bulunamadı. Kayıt oluşmadı; uyarıyı kapattıktan sonra işlemi yeniden yapabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Telafi sonucu Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi yeniden göndermeyin.";
  if (issue.state === "conflict") return "Telafi tamamlama kanıtı beklenen öğrenci, telafi hakkı veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.";
  return "Telafi tamamlama işleminin sonucu henüz kesinleştirilemedi. Sistem işlemi tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

// v173: evidence belongs to one occurrence, never to an entire week/program.
const SINGLE_LESSON_MOVE_ISSUE_PREFIX = "sonsuz_crm_single_lesson_move_issue_v1:";
const SINGLE_LESSON_MOVE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function singleLessonMovePosition(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(iso)) return null;
  if (!isValidLocalDateInput(iso.slice(0,10))) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB",{ timeZone:"Europe/Istanbul", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(date);
  return { date:iso, localDate:turkeyDateKey(date), time:parts.find(p=>p.type==="hour").value+":"+parts.find(p=>p.type==="minute").value };
}

function singleLessonMoveOrigin(lesson) {
  const marker = lesson?.calendarMove;
  if (marker?.kind !== "single_lesson_shift_v1" || marker.lessonId !== lesson.id || !lesson.id) return null;
  const source = singleLessonMovePosition(marker?.origin?.date);
  const target = singleLessonMovePosition(lesson?.date);
  if (!source || !target
    || !SINGLE_LESSON_MOVE_UUID.test(marker.operationId || "")
    || !SINGLE_LESSON_MOVE_UUID.test(marker.originOperationId || "")
    || !SINGLE_LESSON_MOVE_UUID.test(marker.actorUserId || "")
    || !singleLessonMovePosition(marker.recordedAt)
    || marker.origin.timezone !== "Europe/Istanbul"
    || marker.origin.basis !== "observed_before_first_recorded_move"
    || marker.origin.localDate !== source.localDate || marker.origin.time !== source.time
    || marker.target?.date !== lesson.date || marker.target.localDate !== target.localDate
    || marker.target.time !== target.time || lesson.time !== target.time) return null;
  return source;
}

function singleLessonMoveIntent(student, lessonId, targetDate, targetTime) {
  const lessons = (student?.schedule || []).filter(lesson=>lesson.id === lessonId);
  const lesson = lessons.length === 1 ? lessons[0] : null;
  const source = singleLessonMovePosition(lesson?.date);
  if (!lesson || lesson.status !== "upcoming" || !source
    || (Object.hasOwn(lesson,"time") && lesson.time !== source.time)
    || !isValidLocalDateInput(targetDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(targetTime || "")
    || !Number.isInteger(student.record_version) || student.record_version < 0
    || source.localDate < turkeyDateKey() || targetDate < turkeyDateKey()
    || (source.localDate === targetDate && source.time === targetTime)) return null;
  return {
    studentId:student.id, lessonId, expectedRecordVersion:student.record_version,
    expectedDate:lesson.date, expectedTime:source.time, targetDate, targetTime,
  };
}

function readSingleLessonMoveIssue(actorUserId) {
  if (!actorUserId) return null;
  const raw = localStorage.getItem(SINGLE_LESSON_MOVE_ISSUE_PREFIX+actorUserId);
  if (!raw) return null;
  const issue = JSON.parse(raw);
  if (issue.version !== 1 || issue.actorUserId !== actorUserId || !issue.operationId || !issue.requestPayload) throw new Error("SINGLE_LESSON_MOVE_LOCAL_EVIDENCE_INVALID");
  return issue;
}

function writeSingleLessonMoveIssue(actorUserId, issue, expectedOperationId="") {
  try {
    const current = readSingleLessonMoveIssue(actorUserId);
    if (!actorUserId || (expectedOperationId ? current?.operationId !== expectedOperationId : !!current)) return false;
    const key = SINGLE_LESSON_MOVE_ISSUE_PREFIX+actorUserId;
    if (issue) localStorage.setItem(key,JSON.stringify({ ...issue, version:1 }));
    else localStorage.removeItem(key);
    const saved = readSingleLessonMoveIssue(actorUserId);
    return issue ? JSON.stringify(canonicalJson(saved)) === JSON.stringify(canonicalJson({ ...issue,version:1 })) : !saved;
  } catch { return false; }
}

function singleLessonMoveEvidenceMatches(issue, row) {
  const request = issue?.requestPayload;
  const before = row?.target_before;
  const after = row?.target_after;
  const origin = singleLessonMoveOrigin(after);
  const marker = after?.calendarMove;
  if (!request || !origin || row.operation_id !== issue.operationId
    || row.student_id !== request.studentId || row.branch_id !== issue.branchId
    || row.lesson_id !== request.lessonId || row.actor_user_id !== issue.actorUserId
    || row.operation_kind !== "single_lesson_shift"
    || Number(row.expected_record_version) !== request.expectedRecordVersion
    || Number(row.resulting_record_version) !== request.expectedRecordVersion+1
    || JSON.stringify(canonicalJson(row.request_payload)) !== JSON.stringify(canonicalJson(request))
    || before?.id !== request.lessonId || after.id !== request.lessonId
    || before.status !== "upcoming" || after.status !== "upcoming"
    || before.date !== request.expectedDate || singleLessonMovePosition(before.date)?.time !== request.expectedTime
    || (Object.hasOwn(before,"time") && before.time !== request.expectedTime)
    || marker.operationId !== issue.operationId || marker.actorUserId !== issue.actorUserId
    || marker.target.localDate !== request.targetDate || marker.target.time !== request.targetTime
    || marker.originOperationId !== row.origin_operation_id
    || JSON.stringify(canonicalJson(marker.origin)) !== JSON.stringify(canonicalJson(row.origin_position))) return false;
  const withoutPosition = lesson => Object.fromEntries(Object.entries(lesson).filter(([key])=>!["date","time","calendarMove"].includes(key)));
  return JSON.stringify(canonicalJson(withoutPosition(before))) === JSON.stringify(canonicalJson(withoutPosition(after)));
}

function singleLessonMoveKnownRejection(error) {
  return /^SINGLE_LESSON_MOVE_(NOT_AUTHORIZED|INVALID_INPUT|INVALID_TARGET_DATE|STUDENT_NOT_FOUND|STALE_STUDENT|INVALID_SCHEDULE|LESSON_NOT_FOUND|AMBIGUOUS_LESSON|PROCESSED_LESSON|UNKNOWN_SOURCE_POSITION|SOURCE_POSITION_MISMATCH|PAST_LESSON|NO_CHANGE|SOURCE_EVIDENCE_CONFLICT|UNVERIFIED_SOURCE_EVIDENCE|INVALID_SCHEDULE_DATES)$/.test(String(error?.message || ""));
}

function singleLessonMoveIssueMessage(issue) {
  if (issue.state === "writing") return "Seçilen ders taşınıyor. Supabase kaydı doğrulanmadan başarı gösterilmez.";
  if (issue.state === "not_applied") return "Taşıma sunucu tarafından reddedildi ve kayıt oluşmadığı doğrulandı. Uyarıyı kapatıp güncel ders üzerinden tekrar seçebilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Taşıma kaydedildi; güncel öğrenci henüz doğrulanamadı. İşlemi tekrar göndermeyin.";
  if (issue.state === "conflict") return "Taşıma kanıtı beklenen öğrenci, ders veya içerikle eşleşmiyor. İşlemi tekrar göndermeyin.";
  return "Taşımanın sonucu henüz kesin değil. Yeniden Kontrol Et yalnız Supabase kaydını okur; taşıma otomatik tekrarlanmaz.";
}

// v174: read-only calendar proof. Never attach this evidence to a student payload.
function calendarMoveReadRequests(students, scope, offset=0) {
  if (!SINGLE_LESSON_MOVE_UUID.test(scope?.actorUserId || "") || !SINGLE_LESSON_MOVE_UUID.test(scope?.branchId || "")) return [];
  const start = new Date();
  const dow = start.getDay();
  start.setDate(start.getDate() - (dow===0?6:dow-1) + offset*7);
  start.setHours(0,0,0,0);
  const visibleDates = new Set(Array.from({length:7},(_,index)=>{
    const day = new Date(start);
    day.setDate(start.getDate()+index);
    return turkeyDateKey(day);
  }));
  return students.flatMap(student => {
    if (student.branch_id !== scope.branchId || student.frozen || isStudentLeft(student)) return [];
    const counts = new Map();
    (student.schedule || []).forEach(lesson=>counts.set(lesson.id,(counts.get(lesson.id) || 0)+1));
    return (student.schedule || []).flatMap(lesson => {
      const origin = singleLessonMoveOrigin(lesson);
      if (counts.get(lesson.id) !== 1 || !origin || !visibleDates.has(origin.localDate)
        || lesson.calendarMove.operationId === lesson.calendarMove.originOperationId) return [];
      return [{ studentId:student.id, branchId:student.branch_id, recordVersion:student.record_version,
        lessonId:lesson.id, date:lesson.date, time:lesson.time, packageId:lesson.packageId,
        packageLessonCount:lesson.packageLessonCount, marker:lesson.calendarMove }];
    });
  });
}

function calendarMoveVerifiedSources(request, rows) {
  const same = (a,b) => JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b));
  const current = { id:request.lessonId, date:request.date, time:request.time, calendarMove:request.marker };
  const origin = singleLessonMoveOrigin(current);
  if (!origin || !Number.isInteger(request.recordVersion)) return null;
  const byId = new Map();
  for (const row of rows) {
    if (byId.has(row.operation_id)) return null;
    byId.set(row.operation_id,row);
  }
  const sources = new Set();
  const visited = new Set();
  let operationId = request.marker.operationId;
  let newer = null;
  while (operationId) {
    if (visited.has(operationId)) return null;
    visited.add(operationId);
    const row = byId.get(operationId);
    const before = row?.target_before;
    const after = row?.target_after;
    const intent = row?.request_payload;
    if (!row || row.student_id !== request.studentId || row.branch_id !== request.branchId || row.lesson_id !== request.lessonId
      || !SINGLE_LESSON_MOVE_UUID.test(row.operation_id || "") || !SINGLE_LESSON_MOVE_UUID.test(row.actor_user_id || "")
      || !Number.isInteger(intent?.expectedRecordVersion) || intent.expectedRecordVersion < 0
      || !singleLessonMoveEvidenceMatches({ operationId, actorUserId:row.actor_user_id, branchId:request.branchId, requestPayload:intent },row)
      || !same(row.origin_position,request.marker.origin) || row.origin_operation_id !== request.marker.originOperationId
      || before.packageId !== request.packageId || after.packageId !== request.packageId
      || before.packageLessonCount !== request.packageLessonCount || after.packageLessonCount !== request.packageLessonCount) return null;
    if (!newer) {
      if (!same(after.calendarMove,request.marker) || after.date !== request.date || after.time !== request.time
        || request.recordVersion < Number(row.resulting_record_version)) return null;
    } else if (after.date !== newer.target_before.date || after.time !== singleLessonMovePosition(newer.target_before.date)?.time
      || Number(row.resulting_record_version) > Number(newer.expected_record_version)
      || (newer.target_before.calendarMove && !same(after.calendarMove,newer.target_before.calendarMove))) return null;
    const source = singleLessonMovePosition(before.date);
    // Other dates/weeks may have independent program reservations: do not hide them.
    if (source?.localDate === origin.localDate) sources.add(source.localDate+"|"+source.time);
    if (operationId === request.marker.originOperationId) {
      if (row.previous_operation_id != null || source?.date !== origin.date) return null;
      return [...sources];
    }
    if (!SINGLE_LESSON_MOVE_UUID.test(row.previous_operation_id || "")) return null;
    newer = row;
    operationId = row.previous_operation_id;
  }
  return null;
}

async function readCalendarMoveEvidence(client, requests, scope, isCurrent) {
  const rows = [];
  const seen = new Set();
  let pending = [...new Set(requests.map(request=>request.marker.operationId))];
  // Fetch only explicit operation IDs, at most 40 rows/query (below server row caps).
  for (let depth=0; pending.length && depth<128; depth+=1) {
    const next = [];
    for (let index=0; index<pending.length; index+=40) {
      if (!isCurrent()) return null;
      const ids = pending.slice(index,index+40);
      const result = await timedSingleLessonRequest(()=>client.from("single_lesson_move_operations")
        .select("operation_id,student_id,branch_id,lesson_id,operation_kind,expected_record_version,resulting_record_version,request_payload,target_before,target_after,origin_position,origin_operation_id,previous_operation_id,actor_user_id")
        .eq("branch_id",scope.branchId).in("operation_id",ids));
      if (!isCurrent()) return null;
      if (result.error || !Array.isArray(result.data) || result.data.length !== ids.length) throw new Error("CALENDAR_MOVE_READ_INCOMPLETE");
      for (const row of result.data) {
        if (!ids.includes(row.operation_id) || seen.has(row.operation_id) || row.branch_id !== scope.branchId
          || !requests.some(request=>request.studentId===row.student_id && request.lessonId===row.lesson_id)) throw new Error("CALENDAR_MOVE_READ_CONFLICT");
        seen.add(row.operation_id);
        rows.push(row);
        if (rows.length > 4096) throw new Error("CALENDAR_MOVE_READ_LIMIT");
        if (row.operation_id !== row.origin_operation_id) {
          if (!SINGLE_LESSON_MOVE_UUID.test(row.previous_operation_id || "")) throw new Error("CALENDAR_MOVE_READ_CONFLICT");
          next.push(row.previous_operation_id);
        }
      }
    }
    pending = [...new Set(next)].filter(id=>!seen.has(id));
  }
  if (pending.length) throw new Error("CALENDAR_MOVE_READ_LIMIT");
  const sources = requests.map(request=>({ studentId:request.studentId, lessonId:request.lessonId, keys:calendarMoveVerifiedSources(request,rows) }));
  if (sources.some(source=>source.keys===null)) throw new Error("CALENDAR_MOVE_READ_CONFLICT");
  return sources;
}

function staffInvitationIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Personel daveti Supabase'de bulunamadı. Davet oluşmadı; uyarıyı kapatıp işlemi yeniden başlatabilirsiniz.";
  if (issue.state === "prepared") return "Davet niyeti kaydedildi fakat e-posta daveti ve pasif profil henüz kesin olarak tamamlanmadı. İşlemi yalnız açık onayınızla aynı kimlikle tamamlayabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Personel daveti tamamlandı; güncel personel listesi henüz doğrulanamadı. İkinci davet göndermeyin.";
  if (issue.state === "conflict") return "Personel davet kanıtı beklenen kurum veya kullanıcıyla eşleşmedi. Yeni işlem göndermeyin.";
  return "Personel davetinin sonucu henüz kesinleştirilemedi. Sistem daveti tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function staffActivationIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Personel şube ataması Supabase'de bulunamadı. Yetki verilmedi; uyarıyı kapatıp şubeleri yeniden seçebilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Personel erişimi Supabase'e kaydedildi; güncel personel listesi henüz doğrulanamadı. Atamayı yeniden göndermeyin.";
  if (issue.state === "conflict") return "Personel erişim kanıtı beklenen davet veya şubelerle eşleşmedi. Yeni işlem göndermeyin.";
  return "Personel şube atamasının sonucu henüz kesinleştirilemedi. Sistem atamayı tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function staffAssignmentIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Personel şube değişikliği Supabase'de bulunamadı. Erişim değişmedi; uyarıyı kapatıp işlemi yeniden başlatabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Personel şube değişikliği Supabase'e kaydedildi; güncel üyelik listesi henüz doğrulanamadı. Değişikliği yeniden göndermeyin.";
  if (issue.state === "conflict") return "Personel şube değişikliği kanıtı beklenen kullanıcı, rol veya şubelerle eşleşmedi. Yeni işlem göndermeyin.";
  return "Personel şube değişikliğinin sonucu henüz kesinleştirilemedi. Sistem işlemi tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function staffDeactivationIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Personel pasifleştirme işlemi Supabase'de bulunamadı. Erişim değişmedi; uyarıyı kapatıp işlemi yeniden başlatabilirsiniz.";
  if (issue.state === "applied_pending_refresh") return "Personel erişimi Supabase'de pasife alındı; güncel personel listesi henüz doğrulanamadı. İşlemi yeniden göndermeyin.";
  if (issue.state === "conflict") return "Personel pasifleştirme kanıtı beklenen kullanıcı, kurum veya rolle eşleşmedi. Yeni işlem göndermeyin.";
  return "Personel pasifleştirme işleminin sonucu henüz kesinleştirilemedi. Sistem işlemi tekrar göndermeden yalnızca Supabase kaydını kontrol edecek.";
}

function canonicalStaffBranchIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))].sort();
}

function currentStaffBranchIds(memberships, targetUserId, appRole) {
  const expectedRole = appRole === "admin" ? "branch_manager" : "teacher";
  return canonicalStaffBranchIds((Array.isArray(memberships) ? memberships : [])
    .filter(membership=>membership.user_id===targetUserId && membership.role===expectedRole && membership.active)
    .map(membership=>membership.branch_id));
}

function staffAccessFacts(profiles, organizationMemberships, branchMemberships, deactivations, targetUserId, appRole) {
  const profile = (Array.isArray(profiles) ? profiles : []).find(item=>item.user_id===targetUserId) || null;
  const organizationMembership = (Array.isArray(organizationMemberships) ? organizationMemberships : []).find(item=>item.user_id===targetUserId) || null;
  const branchIds = currentStaffBranchIds(branchMemberships,targetUserId,appRole);
  const deactivation = (Array.isArray(deactivations) ? deactivations : []).find(item=>item.target_user_id===targetUserId) || null;
  const roleMatches = profile?.role === appRole && organizationMembership?.role === "member";
  return {
    profile,
    organizationMembership,
    branchIds,
    deactivation,
    active:roleMatches && profile?.active === true && organizationMembership?.active === true && branchIds.length > 0 && !deactivation,
    deactivated:roleMatches && profile?.active === false && organizationMembership?.active === false && branchIds.length === 0 && !!deactivation,
  };
}

function staffRoleLabel(role) {
  return role === "admin" ? "Yönetici" : "Öğretmen";
}

function branchLocalCodeFromName(value) {
  const tr = { "ç":"c", "ğ":"g", "ı":"i", "ö":"o", "ş":"s", "ü":"u" };
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, char => tr[char] || char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0,60);
}

function packagePaymentIssueMessage(issue) {
  if (!issue) return "";
  if (issue.state === "not_applied") return "Paket ödemesi Supabase'de bulunamadı. Ödeme oluşmadı; gerekiyorsa işlemi yeniden yapın.";
  if (issue.state === "applied_pending_refresh") return "Paket ödemesi Supabase'e kaydedildi; öğrenci ekranı henüz yenilenemedi. İkinci ödeme göndermeyin.";
  return "Paket ödeme işleminin sonucu henüz kesinleştirilemedi. Sistem ikinci bir ödeme göndermeden Supabase kaydını kontrol edecek.";
}

function singleLessonIssueMessage(issue) {
  if (!issue) return "";
  if (issue.kind === "setup") return "Tek Ders güvenlik kurulumu doğrulanamadı. v111 Supabase SQL dosyasını kontrol edin.";
  if (issue.kind === "security") return "Tek Ders kayıtları yüklendi ancak işlem güvenliği doğrulanamadı. Sorun çözülene kadar Tek Ders değişiklikleri durduruldu.";
  if (issue.kind === "operation") {
    if (issue.state === "not_applied") return "Tek Ders işlemi veritabanında bulunamadı. Ekran güncellendi; işlemi gerekiyorsa yeniden yapın.";
    return "Tek Ders işleminin sonucu kesinleştirilemedi. Sistem yalnızca veritabanını kontrol edecek; işlemi otomatik tekrarlamayacak.";
  }
  return "Tek Ders kayıtları yüklenemedi. Ekrandaki Tek Ders bilgileri eksik veya eski olabilir.";
}

async function timedSingleLessonRequest(buildRequest, timeoutMs = SINGLE_LESSON_REQUEST_TIMEOUT_MS) {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  let timer = null;
  let didTimeout = false;
  try {
    let request = buildRequest(controller?.signal || null);
    if (controller && request && typeof request.abortSignal === "function") request = request.abortSignal(controller.signal);
    const requestResult = Promise.resolve(request)
      .then(result => ({ type:"result", result }))
      .catch(error => ({ type:"error", error }));
    const timeoutResult = new Promise(resolve => {
      timer = setTimeout(() => {
        didTimeout = true;
        if (controller) controller.abort();
        resolve({ type:"timeout" });
      }, timeoutMs);
    });
    const outcome = await Promise.race([requestResult, timeoutResult]);
    if (outcome.type === "timeout") return { data:null, error:new Error("SINGLE_LESSON_REQUEST_TIMEOUT"), timedOut:true };
    if (outcome.type === "error") return { data:null, error:outcome.error, timedOut:didTimeout };
    return { ...(outcome.result || {}), timedOut:false };
  } catch (error) {
    return { data:null, error, timedOut:didTimeout };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function waitMilliseconds(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function calendarEventsFromSingleLessons(singleLessons) {
  return (singleLessons || [])
    .filter(lesson=>!lesson.deleted_at && lesson.lesson_status==="planned" && lesson.starts_at)
    .map(lesson=>{
      const start = new Date(lesson.starts_at);
      if (isNaN(start.getTime())) return null;
      const duration = Math.max(15,parseInt(lesson.duration_minutes)||45);
      const mode = lesson.lesson_mode==="online" ? "Online" : "Fiziki";
      const lessonType = singleLessonTypeLabel(lesson);
      return {
        uid:"tek-ders-"+lesson.id+"@sonsuz-sanat-crm",
        start,
        end:addMinutes(start,duration),
        summary:lessonType+" - "+lesson.participant_name,
        description:[
          "Katılımcı: "+lesson.participant_name,
          "Ders: "+lessonType,
          "Ders tipi: "+mode,
        ].join("\n"),
      };
    })
    .filter(Boolean)
    .sort((a,b)=>a.start-b.start);
}

function buildGoogleCalendarICS(students, singleLessons=[]) {
  const events = [...calendarEventsFromStudents(students),...calendarEventsFromSingleLessons(singleLessons)].sort((a,b)=>a.start-b.start);
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

function downloadGoogleCalendarICS(students, singleLessons=[]) {
  const { content, count } = buildGoogleCalendarICS(students,singleLessons);
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

function currentOpenLessonPeriodIds(student) {
  const schedule = [...(student?.schedule || [])]
    .filter(lesson=>lesson?.id && lesson?.date)
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  const firstUpcoming = schedule.find(lesson=>lesson.status === "upcoming");
  if (!firstUpcoming) return new Set();

  for (const payment of (student?.odemeler || [])) {
    if (!payment || payment.sadeceEkDers) continue;
    const storedIds = Array.isArray(payment.packageLessonIds) ? payment.packageLessonIds.filter(Boolean) : [];
    if (storedIds.includes(firstUpcoming.id)) return new Set(storedIds);
    if (payment.packageStart && payment.packageEnd) {
      const startKey = dateKey(payment.packageStart);
      const endKey = dateKey(payment.packageEnd);
      const upcomingKey = dateKey(firstUpcoming.date);
      if (upcomingKey >= startKey && upcomingKey <= endKey) {
        return new Set(schedule.filter(lesson => {
          const key = dateKey(lesson.date);
          return key >= startKey && key <= endKey;
        }).map(lesson=>lesson.id));
      }
    }
    if (payment.packageId && firstUpcoming.packageId === payment.packageId) {
      return new Set(schedule.filter(lesson=>lesson.packageId === payment.packageId).map(lesson=>lesson.id));
    }
  }

  if (firstUpcoming.packageId) {
    return new Set(schedule.filter(lesson=>lesson.packageId === firstUpcoming.packageId).map(lesson=>lesson.id));
  }
  return new Set([firstUpcoming.id]);
}

function splitCurrentAndArchivedLessons(student) {
  const schedule = [...(student?.schedule || [])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const currentPeriodIds = currentOpenLessonPeriodIds(student);
  const currentPeriodLessons = schedule.filter(lesson=>currentPeriodIds.has(lesson.id));
  const current = schedule.filter(lesson=>lesson.status === "upcoming" || currentPeriodIds.has(lesson.id));
  const archived = schedule.filter(lesson=>lesson.status !== "upcoming" && !currentPeriodIds.has(lesson.id));
  return { current, archived, currentPeriodLessons };
}

function historicalLessonYearGroups(student, lessons) {
  const historical = [...(lessons || [])]
    .filter(lesson => lesson?.date && !isNaN(new Date(lesson.date).getTime()))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  const schedule = student?.schedule || [];
  const periodByLessonId = new Map();
  const periodMeta = new Map();
  const assignPeriod = (periodKey, periodLessons, storedStart="", storedEnd="") => {
    const valid = (periodLessons || []).filter(lesson => lesson?.id && lesson?.date);
    if (!valid.length) return;
    const ordered = [...valid].sort((a,b)=>new Date(a.date)-new Date(b.date));
    periodMeta.set(periodKey, {
      start:storedStart || dateKey(ordered[0].date),
      end:storedEnd || dateKey(ordered[ordered.length-1].date),
    });
    ordered.forEach(lesson => {
      if (!periodByLessonId.has(lesson.id)) periodByLessonId.set(lesson.id, periodKey);
    });
  };

  (student?.odemeler || []).forEach((payment,index) => {
    if (!payment || payment.sadeceEkDers) return;
    let periodLessons = [];
    const storedIds = Array.isArray(payment.packageLessonIds) ? payment.packageLessonIds.filter(Boolean) : [];
    if (storedIds.length) {
      const ids = new Set(storedIds);
      periodLessons = schedule.filter(lesson => ids.has(lesson.id));
    } else if (payment.packageStart && payment.packageEnd) {
      const startKey = dateKey(payment.packageStart);
      const endKey = dateKey(payment.packageEnd);
      periodLessons = schedule.filter(lesson => {
        const key = dateKey(lesson.date);
        return key >= startKey && key <= endKey;
      });
    } else if (payment.packageId) {
      periodLessons = schedule.filter(lesson => lesson.packageId === payment.packageId);
    }
    assignPeriod("payment:"+index, periodLessons, payment.packageStart || "", payment.packageEnd || "");
  });

  const packageGroups = new Map();
  schedule.forEach(lesson => {
    if (!lesson?.id || !lesson.packageId || periodByLessonId.has(lesson.id)) return;
    const key = "package:"+lesson.packageId;
    if (!packageGroups.has(key)) packageGroups.set(key, []);
    packageGroups.get(key).push(lesson);
  });
  packageGroups.forEach((periodLessons,key)=>assignPeriod(key,periodLessons));

  const years = new Map();
  historical.forEach(lesson => {
    const year = new Date(lesson.date).getFullYear();
    const periodKey = periodByLessonId.get(lesson.id) || "unknown:"+year;
    if (!years.has(year)) years.set(year,new Map());
    const periods = years.get(year);
    if (!periods.has(periodKey)) periods.set(periodKey,[]);
    periods.get(periodKey).push(lesson);
  });

  return [...years.entries()]
    .sort((a,b)=>b[0]-a[0])
    .map(([year,periodMap]) => {
      const chronological = [...periodMap.entries()].sort((a,b)=>new Date(a[1][0].date)-new Date(b[1][0].date));
      const numberedKeys = new Map(chronological.filter(([key])=>!key.startsWith("unknown:")).map(([key],index)=>[key,index+1]));
      const periods = chronological.reverse().map(([key,periodLessons]) => {
        const ordered = [...periodLessons].sort((a,b)=>new Date(b.date)-new Date(a.date));
        const meta = periodMeta.get(key);
        const start = meta?.start || dateKey(ordered[ordered.length-1].date);
        const end = meta?.end || dateKey(ordered[0].date);
        return {
          key,
          label:key.startsWith("unknown:")
            ? "Dönemi belirlenemeyen dersler"
            : numberedKeys.get(key)+". Dönem · "+fmtShort(start)+" – "+fmtShort(end),
          lessons:ordered,
        };
      });
      return { year, periods, count:periods.reduce((sum,period)=>sum+period.lessons.length,0) };
    });
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
      if (log?.type === "manual_piece") {
        const name = String(log?.piece?.name || "").trim();
        if (!name) return null;
        return {
          id:log.id || null,
          name,
          result:displayPieceResult(log.piece.result, log.piece.label),
          score:Number(log.piece.score),
          period:log.addedAt ? "Manuel kayıt · "+fmtShort(log.addedAt) : "Manuel kayıt",
          date:new Date(log.addedAt || 0),
        };
      }
      const name = String(log?.evaluation?.pieceName || "").trim();
      if (!name) return null;
      return {
        id:null,
        name,
        result:displayPieceResult(log.evaluation.pieceResult, log.evaluation.pieceLabel),
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

function invalidatedPackageKeyForLesson(student, lessonId) {
  if (!student || !lessonId) return "";
  const info = [...customPackageInfos(student), ...regularPackageInfos(student)].find(item => (item.lessonIds || []).includes(lessonId));
  const key = packageSummaryKey(info);
  if (!key) return "";
  return (student.package_summary_logs || []).some(log => log.packageKey === key && log.evaluation) ? key : "";
}

function normalLessonEvaluationIntent(student, lessonId, detail={}, correctionReason="") {
  const lesson = (student?.schedule || []).find(item=>item.id === lessonId);
  const scoreValue = lesson?.lessonScore ?? lesson?.lesson_score;
  const expectedOperationKind = lesson && ((lesson.status || "upcoming") !== "upcoming" || (scoreValue !== null && scoreValue !== undefined && String(scoreValue).trim() !== "")) ? "corrected" : "recorded";
  const previousHomeworkSource = String(detail.previousHomeworkSource || "").trim();
  const previousHomeworkSourceId = String(detail.previousHomeworkSourceId || "").trim();
  const evaluation = {
    note:String(detail.note || "").trim(),
    activeMinutes:Math.max(0,parseInt(detail.activeMinutes) || 0),
    taskFocusMinutes:Math.max(0,parseInt(detail.taskFocusMinutes) || 0),
    redirectionCount:Math.max(0,parseInt(detail.redirectionCount) || 0),
    lessonFocus:String(detail.lessonFocus || "").trim(),
    homework:String(detail.homework || "").trim(),
    ...(previousHomeworkSource && previousHomeworkSourceId ? {
      previousHomeworkSource,
      previousHomeworkSourceId,
      homeworkStatus:String(detail.homeworkStatus || "").trim(),
    } : {}),
  };
  const expectedRecordVersion = Math.max(0,parseInt(student?.record_version) || 0);
  const reason = String(correctionReason || "").trim();
  const invalidatedPackageKey = invalidatedPackageKeyForLesson(student,lessonId);
  const requestPayload = {
    studentId:String(student?.id || ""),
    lessonId:String(lessonId || "").trim(),
    expectedRecordVersion,
    evaluation,
    ...(reason ? { correctionReason:reason } : {}),
    ...(invalidatedPackageKey ? { invalidatedPackageKey } : {}),
  };
  return { lesson, expectedOperationKind, expectedRecordVersion, evaluation, correctionReason:reason, invalidatedPackageKey, requestPayload };
}

function normalLessonEvaluationKnownRejection(error) {
  const message = String(error?.message || error || "");
  return [
    "NORMAL_LESSON_EVALUATION_NOT_AUTHORIZED",
    "NORMAL_LESSON_EVALUATION_INVALID_INPUT",
    "NORMAL_LESSON_EVALUATION_INPUT_TOO_LONG",
    "NORMAL_LESSON_EVALUATION_INVALID_METRICS",
    "NORMAL_LESSON_EVALUATION_INVALID_HOMEWORK_INPUT",
    "NORMAL_LESSON_EVALUATION_STUDENT_NOT_FOUND",
    "NORMAL_LESSON_EVALUATION_STALE_STUDENT",
    "NORMAL_LESSON_EVALUATION_INVALID_STUDENT_DATA",
    "NORMAL_LESSON_EVALUATION_LESSON_NOT_FOUND",
    "NORMAL_LESSON_EVALUATION_AMBIGUOUS_LESSON",
    "NORMAL_LESSON_EVALUATION_CORRECTION_REASON_REQUIRED",
    "NORMAL_LESSON_EVALUATION_METRICS_EXCEED_DURATION",
    "NORMAL_LESSON_EVALUATION_HOMEWORK_SOURCE_IS_TARGET",
    "NORMAL_LESSON_EVALUATION_HOMEWORK_SOURCE_NOT_FOUND",
    "NORMAL_LESSON_EVALUATION_AMBIGUOUS_HOMEWORK_SOURCE",
    "NORMAL_LESSON_EVALUATION_HOMEWORK_SOURCE_REMOVED",
    "NORMAL_LESSON_EVALUATION_INVALID_PACKAGE_KEY",
    "NORMAL_LESSON_EVALUATION_PACKAGE_KEY_MISMATCH",
  ].some(code=>message.includes(code));
}

function normalLessonEvaluationErrorText(error) {
  const message = String(error?.message || error || "");
  if (message.includes("STALE_STUDENT")) return "Öğrenci kaydı başka bir işlemle değişti. Eski ekran bilgisi gönderilmedi; liste Supabase'den yenilendi.";
  if (message.includes("CORRECTION_REASON_REQUIRED")) return "Daha önce değerlendirilmiş ders için düzeltme nedeni zorunludur. Kayıt yapılmadı.";
  if (message.includes("NOT_AUTHORIZED")) return "Bu öğrencinin şubesinde değerlendirme kaydetme yetkisi doğrulanamadı. Kayıt yapılmadı.";
  if (message.includes("HOMEWORK_SOURCE") || message.includes("PACKAGE_KEY")) return "Dersin ödev veya dönem bağlantısı bu sırada değişti. Eski bilgi kaydedilmedi; liste yenilendi.";
  if (message.includes("LESSON_NOT_FOUND") || message.includes("STUDENT_NOT_FOUND") || message.includes("AMBIGUOUS")) return "Öğrenci veya ders kaydı güvenli biçimde eşleştirilemedi. Kayıt yapılmadı; liste yenilendi.";
  if (message.includes("INVALID") || message.includes("EXCEED") || message.includes("TOO_LONG")) return "Ders değerlendirme bilgileri doğrulanamadı. Kayıt yapılmadı.";
  return "Ders değerlendirmesi kaydedilemedi. Sonuç Supabase'den kontrol edilecek; işlemi tekrar göndermeyin.";
}

function normalLessonMakeupIntent(student, lessonId, actionKind, note="", actionOptions={}) {
  const lesson = (student?.schedule || []).find(item=>item.id === lessonId);
  const lessonDate = String(lesson?.date || "").slice(0,10);
  const hasReplacedRecord = (student?.telafi_records || []).some(record=>(
    String(record?.lessonId || "") === String(lessonId || "")
    || (!record?.lessonId && String(record?.lessonDate || "").slice(0,10) === lessonDate && String(record?.done ?? false).toLowerCase() !== "true")
  ));
  const expectedOperationKind = lesson && (lesson.status || "upcoming") === "upcoming" && !hasReplacedRecord ? "created" : "corrected";
  const expectedRecordVersion = Math.max(0,parseInt(student?.record_version) || 0);
  const managerExceptionRequested = actionOptions.managerException === true;
  const invalidatedPackageKey = invalidatedPackageKeyForLesson(student,lessonId);
  const normalizedNote = String(note || "");
  const requestPayload = {
    studentId:String(student?.id || ""),
    lessonId:String(lessonId || "").trim(),
    expectedRecordVersion,
    actionKind,
    note:normalizedNote,
    managerExceptionRequested,
    ...(invalidatedPackageKey ? { invalidatedPackageKey } : {}),
  };
  return { lesson, expectedOperationKind, expectedRecordVersion, managerExceptionRequested, invalidatedPackageKey, note:normalizedNote, requestPayload };
}

function normalLessonMakeupIntentSignature(value) {
  return normalLessonEvaluationIntentSignature(value);
}

function normalLessonMakeupKnownRejection(error) {
  const message = String(error?.message || error || "");
  return [
    "NORMAL_LESSON_MAKEUP_NOT_AUTHORIZED",
    "NORMAL_LESSON_MAKEUP_INVALID_INPUT",
    "NORMAL_LESSON_MAKEUP_INPUT_TOO_LONG",
    "NORMAL_LESSON_MAKEUP_STUDENT_NOT_FOUND",
    "NORMAL_LESSON_MAKEUP_STALE_STUDENT",
    "NORMAL_LESSON_MAKEUP_INVALID_STUDENT_DATA",
    "NORMAL_LESSON_MAKEUP_LESSON_NOT_FOUND",
    "NORMAL_LESSON_MAKEUP_AMBIGUOUS_LESSON",
    "NORMAL_LESSON_MAKEUP_INVALID_LESSON_DATE",
    "NORMAL_LESSON_MAKEUP_START_DATE_REQUIRED",
    "NORMAL_LESSON_MAKEUP_LESSON_BEFORE_START_DATE",
    "NORMAL_LESSON_MAKEUP_QUOTA_FULL",
    "NORMAL_LESSON_MAKEUP_RECORD_ID_CONFLICT",
    "NORMAL_LESSON_MAKEUP_INVALID_PACKAGE_KEY",
    "NORMAL_LESSON_MAKEUP_PACKAGE_KEY_MISMATCH",
    "NORMAL_LESSON_MAKEUP_TARGET_REMOVED",
  ].some(code=>message.includes(code));
}

function normalLessonMakeupErrorText(error) {
  const message = String(error?.message || error || "");
  if (message.includes("STALE_STUDENT")) return "Öğrenci kaydı başka bir işlemle değişti. Eski ekran bilgisi gönderilmedi; liste Supabase'den yenilendi.";
  if (message.includes("QUOTA_FULL")) return "Telafi hakları 6/6 dolu. Yönetici inisiyatifi onayı olmadan telafi oluşturulmadı.";
  if (message.includes("START_DATE_REQUIRED") || message.includes("LESSON_BEFORE_START_DATE")) return "Derse başlangıç tarihi olmadan telafi hak dönemi doğrulanamadı; kayıt oluşturulmadı.";
  if (message.includes("NOT_AUTHORIZED")) return "Bu öğrencinin şubesinde telafi hakkı oluşturma yetkisi doğrulanamadı. Kayıt yapılmadı.";
  if (message.includes("PACKAGE_KEY")) return "Dersin dönem bağlantısı bu sırada değişti. Eski bilgi kaydedilmedi; liste yenilendi.";
  if (message.includes("LESSON_NOT_FOUND") || message.includes("STUDENT_NOT_FOUND") || message.includes("AMBIGUOUS")) return "Öğrenci veya ders kaydı güvenli biçimde eşleştirilemedi. Kayıt yapılmadı; liste yenilendi.";
  if (message.includes("INVALID") || message.includes("TOO_LONG") || message.includes("TARGET_REMOVED") || message.includes("RECORD_ID_CONFLICT")) return "Telafi hakkı bilgileri doğrulanamadı. Kayıt yapılmadı.";
  return "Telafi hakkı kaydedilemedi. Sonuç Supabase'den kontrol edilecek; işlemi tekrar göndermeyin.";
}

function normalLessonMakeupSuccessMessage(actionKind, createdRecord, quotaNormalCount) {
  const managerException = createdRecord?.managerException === true || createdRecord?.manager_exception === true;
  if (managerException) return actionKind === "lm-telafi" ? "Yönetici inisiyatifiyle son dakika telafisi oluşturuldu" : "Yönetici inisiyatifiyle telafi oluşturuldu";
  if (Number(quotaNormalCount) === 6) return "6/6 telafi hakkı doldu";
  if (Number(quotaNormalCount) === 5) return "5. telafi uyarisi";
  return actionKind === "lm-telafi" ? "Son dakika + telafi kaydedildi" : "Telafi oluşturuldu";
}

function normalLessonMakeupPlanIntent(student, makeupRecordId, payload={}) {
  const matchingRecords = (student?.telafi_records || []).filter(record=>String(record?.id || "") === String(makeupRecordId || ""));
  const record = matchingRecords.length === 1 ? matchingRecords[0] : null;
  const expectedRecordVersion = Math.max(0,parseInt(student?.record_version) || 0);
  const plannedAt = String(payload.plannedAt || "");
  const plannedDurationMinutes = parseInt(payload.plannedDurationMinutes);
  const plannedNote = String(payload.plannedNote || "");
  const expectedOperationKind = record && telafiPlannedAt(record) ? "rescheduled" : "planned";
  const requestPayload = {
    studentId:String(student?.id || ""),
    makeupRecordId:String(makeupRecordId || ""),
    expectedRecordVersion,
    plannedAt,
    plannedDurationMinutes,
    plannedNote,
  };
  return { record, matchingRecordCount:matchingRecords.length, expectedRecordVersion, expectedOperationKind, plannedAt, plannedDurationMinutes, plannedNote, requestPayload };
}

function normalLessonMakeupPlanIntentSignature(value) {
  return normalLessonEvaluationIntentSignature(value);
}

function normalLessonMakeupPlanKnownRejection(error) {
  const message = String(error?.message || error || "");
  return [
    "NORMAL_LESSON_MAKEUP_PLAN_NOT_AUTHORIZED",
    "NORMAL_LESSON_MAKEUP_PLAN_INVALID_INPUT",
    "NORMAL_LESSON_MAKEUP_PLAN_INPUT_TOO_LONG",
    "NORMAL_LESSON_MAKEUP_PLAN_INVALID_DATE",
    "NORMAL_LESSON_MAKEUP_PLAN_STUDENT_NOT_FOUND",
    "NORMAL_LESSON_MAKEUP_PLAN_STALE_STUDENT",
    "NORMAL_LESSON_MAKEUP_PLAN_INVALID_STUDENT_DATA",
    "NORMAL_LESSON_MAKEUP_PLAN_RECORD_NOT_FOUND",
    "NORMAL_LESSON_MAKEUP_PLAN_AMBIGUOUS_RECORD",
    "NORMAL_LESSON_MAKEUP_PLAN_ALREADY_COMPLETED",
    "NORMAL_LESSON_MAKEUP_PLAN_OPERATION_ID_CONFLICT",
    "NORMAL_LESSON_MAKEUP_PLAN_TARGET_REMOVED",
  ].some(code=>message.includes(code));
}

function normalLessonMakeupPlanErrorText(error) {
  const message = String(error?.message || error || "");
  if (message.includes("STALE_STUDENT")) return "Öğrenci kaydı başka bir işlemle değişti. Eski telafi planı gönderilmedi; liste Supabase'den yenilendi.";
  if (message.includes("ALREADY_COMPLETED")) return "Bu telafi dersi bu sırada tamamlanmış. Plan değişikliği kaydedilmedi; liste yenilendi.";
  if (message.includes("NOT_AUTHORIZED")) return "Bu öğrencinin şubesinde telafi planlama yetkisi doğrulanamadı. Kayıt yapılmadı.";
  if (message.includes("RECORD_NOT_FOUND") || message.includes("STUDENT_NOT_FOUND") || message.includes("AMBIGUOUS")) return "Öğrenci veya telafi hakkı güvenli biçimde eşleştirilemedi. Kayıt yapılmadı; liste yenilendi.";
  if (message.includes("INVALID") || message.includes("TOO_LONG") || message.includes("TARGET_REMOVED") || message.includes("OPERATION_ID_CONFLICT")) return "Telafi planı bilgileri doğrulanamadı. Kayıt yapılmadı.";
  return "Telafi planı kaydedilemedi. Sonuç Supabase'den kontrol edilecek; işlemi tekrar göndermeyin.";
}

function normalLessonMakeupCompletionIntent(student, makeupRecordId, payload={}, correctionReason="") {
  const matchingRecords = (student?.telafi_records || []).filter(record=>String(record?.id || "") === String(makeupRecordId || ""));
  const record = matchingRecords.length === 1 ? matchingRecords[0] : null;
  const expectedRecordVersion = Math.max(0,parseInt(student?.record_version) || 0);
  const actionKind = payload.action === "counted" ? "counted" : "attended";
  const doneAt = String(payload.doneAt || telafiPlannedAt(record) || "");
  const doneNote = String(payload.doneNote || "").trim();
  const normalizedCorrectionReason = String(correctionReason || "").trim();
  const expectedOperationKind = record && (record.done === true || String(record.done).toLowerCase() === "true") ? "corrected" : "completed";
  const evaluation = actionKind === "attended" ? {
    note:doneNote,
    activeMinutes:parseInt(payload.activeMinutes) || 0,
    taskFocusMinutes:parseInt(payload.taskFocusMinutes) || 0,
    redirectionCount:parseInt(payload.redirectionCount) || 0,
    lessonFocus:String(payload.lessonFocus || "").trim(),
    homework:String(payload.homework || "").trim(),
    ...(payload.previousHomeworkSource ? { previousHomeworkSource:String(payload.previousHomeworkSource) } : {}),
    ...(payload.previousHomeworkSourceId ? { previousHomeworkSourceId:String(payload.previousHomeworkSourceId) } : {}),
    ...(payload.previousHomeworkSource ? { homeworkStatus:String(payload.homeworkStatus || "") } : {}),
  } : {};
  const requestPayload = {
    studentId:String(student?.id || ""),
    makeupRecordId:String(makeupRecordId || ""),
    expectedRecordVersion,
    actionKind,
    doneAt,
    doneNote,
    evaluation,
    correctionReason:normalizedCorrectionReason,
  };
  return {
    record,
    matchingRecordCount:matchingRecords.length,
    expectedRecordVersion,
    expectedOperationKind,
    actionKind,
    doneAt,
    doneNote,
    evaluation,
    expectedEvaluatedHomework:String(payload.evaluatedHomework || ""),
    correctionReason:normalizedCorrectionReason,
    requestPayload,
  };
}

function normalLessonMakeupCompletionIntentSignature(value) {
  return normalLessonEvaluationIntentSignature(value);
}

function normalLessonMakeupCompletionTargetMatches(target, intent) {
  if (!target || String(target.id || "") !== String(intent?.record?.id || "")) return false;
  if (String(target.done).toLowerCase() !== "true" || String(target.doneStatus || target.done_status || "") !== intent.actionKind) return false;
  if (telafiDoneAt(target) !== intent.doneAt || String(target.doneNote || "") !== intent.doneNote) return false;
  if (intent.actionKind === "counted") return true;
  const storedScore = storedLessonScore(target);
  const expectedScoreBreakdown = calculateLessonScore({
    homeworkStatus:intent.evaluation.homeworkStatus,
    homeworkApplicable:!!intent.evaluation.previousHomeworkSource,
    activeMinutes:intent.evaluation.activeMinutes,
    taskFocusMinutes:intent.evaluation.taskFocusMinutes,
    redirectionCount:intent.evaluation.redirectionCount,
  });
  const homeworkChanged = String(intent.record?.homework || "") !== intent.evaluation.homework;
  const expectedHomeworkStatus = intent.evaluation.homework
    ? (homeworkChanged ? "pending" : String(intent.record?.homeworkStatus || "pending"))
    : "";
  return Number(target.activeMinutes || 0) === Number(intent.evaluation.activeMinutes)
    && Number(target.taskFocusMinutes ?? target.task_focus_minutes ?? 0) === Number(intent.evaluation.taskFocusMinutes)
    && Number(target.redirectionCount ?? target.redirection_count ?? 0) === Number(intent.evaluation.redirectionCount)
    && String(target.lessonFocus || target.lesson_focus || "") === intent.evaluation.lessonFocus
    && String(target.homework || "") === intent.evaluation.homework
    && String(target.homeworkStatus || "") === expectedHomeworkStatus
    && String(target.evaluatedHomework || "") === String(intent.expectedEvaluatedHomework || "")
    && String(target.evaluatedHomeworkStatus || "") === String(intent.evaluation.homeworkStatus || "")
    && storedScore === expectedScoreBreakdown.total
    && JSON.stringify(canonicalJson(target.lessonScoreBreakdown || {})) === JSON.stringify(canonicalJson(expectedScoreBreakdown));
}

function normalLessonMakeupCompletionHomeworkMatches(student, intent) {
  if (intent?.actionKind !== "attended" || !intent?.evaluation?.previousHomeworkSource) return true;
  const sourceKind = intent.evaluation.previousHomeworkSource;
  const sourceId = intent.evaluation.previousHomeworkSourceId;
  const source = (sourceKind === "schedule" ? student?.schedule : student?.telafi_records || [])
    ?.find(item=>String(item?.id || "") === String(sourceId || ""));
  return !!source
    && String(source.homework || "") === String(intent.expectedEvaluatedHomework || "")
    && String(source.homeworkStatus || "") === intent.evaluation.homeworkStatus
    && String(source.homeworkCheckNote || "") === ""
    && !!source.homeworkCheckedAt
    && String(source.homeworkCheckedInRef || "") === homeworkCheckRef("telafi",intent.record?.id);
}

function normalLessonMakeupCompletionKnownRejection(error) {
  const message = String(error?.message || error || "");
  return [
    "NORMAL_LESSON_MAKEUP_COMPLETION_NOT_AUTHORIZED",
    "NORMAL_LESSON_MAKEUP_COMPLETION_INVALID_INPUT",
    "NORMAL_LESSON_MAKEUP_COMPLETION_INPUT_TOO_LONG",
    "NORMAL_LESSON_MAKEUP_COMPLETION_INVALID_DATE",
    "NORMAL_LESSON_MAKEUP_COMPLETION_INVALID_EVALUATION",
    "NORMAL_LESSON_MAKEUP_COMPLETION_INVALID_METRICS",
    "NORMAL_LESSON_MAKEUP_COMPLETION_INVALID_HOMEWORK_INPUT",
    "NORMAL_LESSON_MAKEUP_COMPLETION_COUNTED_HAS_EVALUATION",
    "NORMAL_LESSON_MAKEUP_COMPLETION_STUDENT_NOT_FOUND",
    "NORMAL_LESSON_MAKEUP_COMPLETION_STALE_STUDENT",
    "NORMAL_LESSON_MAKEUP_COMPLETION_INVALID_STUDENT_DATA",
    "NORMAL_LESSON_MAKEUP_COMPLETION_RECORD_NOT_FOUND",
    "NORMAL_LESSON_MAKEUP_COMPLETION_AMBIGUOUS_RECORD",
    "NORMAL_LESSON_MAKEUP_COMPLETION_NOT_PLANNED",
    "NORMAL_LESSON_MAKEUP_COMPLETION_PLAN_MISMATCH",
    "NORMAL_LESSON_MAKEUP_COMPLETION_ALREADY_COMPLETED",
    "NORMAL_LESSON_MAKEUP_COMPLETION_CORRECTION_REASON_REQUIRED",
    "NORMAL_LESSON_MAKEUP_COMPLETION_UNEXPECTED_CORRECTION_REASON",
    "NORMAL_LESSON_MAKEUP_COMPLETION_METRICS_EXCEED_DURATION",
    "NORMAL_LESSON_MAKEUP_COMPLETION_HOMEWORK_SOURCE_NOT_FOUND",
    "NORMAL_LESSON_MAKEUP_COMPLETION_AMBIGUOUS_HOMEWORK_SOURCE",
    "NORMAL_LESSON_MAKEUP_COMPLETION_OPERATION_ID_CONFLICT",
    "NORMAL_LESSON_MAKEUP_COMPLETION_TARGET_REMOVED",
    "NORMAL_LESSON_MAKEUP_COMPLETION_HOMEWORK_SOURCE_REMOVED",
  ].some(code=>message.includes(code));
}

function normalLessonMakeupCompletionErrorText(error) {
  const message = String(error?.message || error || "");
  if (message.includes("STALE_STUDENT") || message.includes("PLAN_MISMATCH")) return "Öğrenci veya telafi planı başka bir işlemle değişti. Eski ekran bilgisi gönderilmedi; liste Supabase'den yenilendi.";
  if (message.includes("CORRECTION_REASON_REQUIRED")) return "Daha önce tamamlanmış telafi verilerini değiştirmek için düzeltme nedeni zorunludur. Kayıt yapılmadı.";
  if (message.includes("ALREADY_COMPLETED")) return "Bu tamamlanmış telafi sonucu bu işlemle değiştirilemez. Kayıt yapılmadı; liste yenilendi.";
  if (message.includes("NOT_AUTHORIZED")) return "Bu öğrencinin şubesinde telafi tamamlama yetkisi doğrulanamadı. Kayıt yapılmadı.";
  if (message.includes("HOMEWORK_SOURCE")) return "Telafiyle bağlantılı ödev kaydı bu sırada değişti. Eski bilgi kaydedilmedi; liste yenilendi.";
  if (message.includes("RECORD_NOT_FOUND") || message.includes("STUDENT_NOT_FOUND") || message.includes("AMBIGUOUS")) return "Öğrenci veya telafi hakkı güvenli biçimde eşleştirilemedi. Kayıt yapılmadı; liste yenilendi.";
  if (message.includes("INVALID") || message.includes("EXCEED") || message.includes("TOO_LONG") || message.includes("NOT_PLANNED") || message.includes("TARGET_REMOVED") || message.includes("OPERATION_ID_CONFLICT")) return "Telafi tamamlama bilgileri doğrulanamadı. Kayıt yapılmadı.";
  return "Telafi sonucu kaydedilemedi. Sonuç Supabase'den kontrol edilecek; işlemi tekrar göndermeyin.";
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

function extraLessonReminderRef(extra) {
  return "ek-ders-"+(extra?.id || [dateKey(extra?.date),timeFromISO(extra?.date).replace(":","")].filter(Boolean).join("-"));
}

function extraLessonPaymentRef(extra) {
  return extra?.id || "legacy:"+String(extra?.date || "");
}

function isPaymentDue(student) {
  return !!currentPaymentDueInfo(student);
}

const INSTRUMENTS = ["Davul","Piyano","Gitar"];
const DAYS = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
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
  .crm-desktop-logout{position:fixed;right:82px;bottom:24px;z-index:50;border:1px solid #ded9d3;background:#fff;color:#5b42d6;border-radius:12px;padding:11px 15px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 8px 24px rgba(38,30,48,.14)}.crm-desktop-logout:hover{border-color:#9e90d8;background:#f8f6ff}.crm-desktop-logout:disabled{cursor:wait;opacity:.65}
  .crm-owner-branches{display:none;border:1px solid #ddd6fe;border-radius:12px;padding:10px 12px;background:#fff;color:#5b42d6;font-weight:850;cursor:pointer;white-space:nowrap}
  .crm-content{min-height:100vh;margin-left:245px;padding:38px clamp(28px,5vw,76px) 76px;max-width:1530px;background:var(--crm-paper)}
  .crm-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:28px}
  .crm-eyebrow{margin:0 0 8px;color:#9d96a4;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
  .crm-title{margin:0;font-size:clamp(29px,3vw,39px);font-weight:780;letter-spacing:-.045em}.crm-subtitle{margin:7px 0 0;color:var(--crm-muted);font-size:14px}
  .crm-header-actions{display:flex;gap:10px;padding-top:10px}.crm-primary,.crm-secondary{border:0;border-radius:12px;padding:12px 17px;font-weight:800;cursor:pointer;transition:.2s;white-space:nowrap}.crm-primary{background:var(--crm-purple);color:#fff;box-shadow:0 7px 20px rgba(91,66,214,.18)}.crm-primary:hover{background:var(--crm-purple-dark);transform:translateY(-1px)}.crm-secondary{background:#fff;border:1px solid var(--crm-border)}.crm-secondary:hover{border-color:#c7bfd6;color:var(--crm-purple)}.crm-branch-switch{border:1px solid #ddd6fe;border-radius:12px;padding:10px 13px;background:#fff;color:#5b42d6;font:800 12px inherit;cursor:pointer;white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis}
  .crm-page{max-width:1120px}.crm-page>div>div,.crm-page>div>div>div{transition:border-color .2s,box-shadow .2s}
  .crm-mobile-nav{display:none}
  .crm-login{min-height:100vh;display:grid;grid-template-columns:.82fr 1.18fr;background:#fbfaf7}.crm-login-brand{padding:clamp(42px,8vw,120px);display:flex;flex-direction:column;justify-content:center;background:var(--crm-purple);color:#fff;position:relative;overflow:hidden}.crm-login-brand:after{content:"";position:absolute;width:420px;height:420px;border:82px solid rgba(255,255,255,.045);border-radius:50%;right:-220px;bottom:-190px}.crm-login-brand .crm-brand-mark{background:#fff;color:var(--crm-purple);width:52px;height:52px;font-size:25px}.crm-login-brand h1{margin:20px 0 8px;font-size:42px;letter-spacing:-.05em}.crm-login-brand p{max-width:330px;color:rgba(255,255,255,.72);line-height:1.6}.crm-login-panel{display:grid;place-items:center;padding:28px}.crm-login-card{width:min(100%,430px)}.crm-login-card .crm-eyebrow{color:var(--crm-purple)}.crm-login-card h2{margin:0 0 8px;font-size:31px;letter-spacing:-.04em}.crm-login-card>p{margin:0 0 28px;color:var(--crm-muted);font-size:13px}.crm-login-card label{display:block;margin:0 0 7px;color:#756f7a;font-size:11px;font-weight:800}.crm-login-card input{width:100%;border:1px solid #ded9d3;background:#fff;border-radius:11px;padding:13px 14px;outline:none;color:var(--crm-ink)}.crm-login-card input:focus{border-color:var(--crm-purple);box-shadow:0 0 0 3px #eeeafd}.crm-login-card button{width:100%;margin-top:15px;border:0;border-radius:12px;padding:13px;background:var(--crm-purple);color:#fff;font-weight:800;cursor:pointer}
  .crm-login-card h2{color:var(--crm-ink)}
  .crm-loading{min-height:100vh;display:grid;place-items:center;background:var(--crm-paper);text-align:center}.crm-loading-mark{width:50px;height:50px;margin:0 auto 14px;display:grid;place-items:center;border-radius:17px 17px 17px 5px;background:var(--crm-purple);color:#fff;font-size:24px;box-shadow:0 10px 28px rgba(91,66,214,.22)}
  .crm-sheet-backdrop{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:20px;background:rgba(29,27,36,.52);backdrop-filter:blur(6px)}.crm-sheet{width:min(100%,560px);max-height:calc(100vh - 40px);overflow:hidden;background:#fff;border-radius:22px;box-shadow:0 25px 90px rgba(0,0,0,.22)}.crm-sheet-head{display:flex;justify-content:space-between;align-items:center;padding:20px 23px;border-bottom:1px solid var(--crm-border);background:#fff}.crm-sheet-head strong{display:block;font-size:18px;letter-spacing:-.025em}.crm-sheet-head span{display:block;margin-top:3px;color:#96909b;font-size:12px}.crm-sheet-close{width:34px;height:34px;border:0;border-radius:50%;background:#f4f1ee;color:#746e78;font-size:20px;cursor:pointer}.crm-sheet-body{padding:20px 23px 28px;max-height:calc(100vh - 124px);overflow-y:auto}
  @media(max-width:980px){.crm-content{padding-left:26px;padding-right:26px}.crm-sidebar{width:220px}.crm-content{margin-left:220px}}
  .crm-student-metrics{grid-template-columns:repeat(3,1fr)}
  .crm-student-info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
  .crm-student-info-item{min-width:0;padding:8px 13px;border-left:1px solid #ece8e4;font-size:12px;line-height:1.4}
  .crm-student-info-item:nth-child(3n+1){border-left:0;padding-left:0}.crm-student-info-item:nth-child(n+4){border-top:1px solid #ece8e4;padding-top:12px;margin-top:4px}
  .crm-student-info-label{display:block;margin-bottom:3px;color:#7b7680;font-size:10px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}.crm-student-info-value{display:block;color:#1c1921;font-weight:750;overflow-wrap:anywhere}
  @media(max-width:760px){.crm-sidebar{display:none}.crm-desktop-logout{display:none}.crm-content{margin-left:0;padding:24px 17px 108px}.crm-topbar{align-items:center;margin-bottom:22px}.crm-title{font-size:27px}.crm-subtitle{max-width:235px;font-size:12px}.crm-header-actions .crm-secondary{display:none}.crm-owner-branches{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;font-size:0}.crm-owner-branches:after{content:"⌂";font-size:19px}.crm-branch-switch{max-width:105px;padding:9px 10px;font-size:10px}.crm-primary{width:44px;height:44px;padding:0;font-size:0}.crm-primary:after{content:"+";font-size:25px;font-weight:500}.crm-mobile-nav{position:fixed;display:grid;grid-template-columns:repeat(var(--crm-mobile-nav-columns,9),1fr);left:8px;right:8px;bottom:8px;z-index:40;background:rgba(255,255,255,.95);backdrop-filter:blur(14px);border:1px solid var(--crm-border);border-radius:17px;padding:6px 3px;box-shadow:0 8px 30px rgba(38,30,48,.13)}.crm-mobile-nav button{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:transparent;color:#8d8691;font-size:7px;font-weight:700;padding:5px 1px;min-width:0}.crm-mobile-nav button span{font-size:18px}.crm-mobile-nav button.active{color:var(--crm-purple)}.crm-login{grid-template-columns:1fr}.crm-login-brand{display:none}.crm-login-panel{min-height:100vh;padding:24px}.crm-sheet-backdrop{place-items:end center;padding:0}.crm-sheet{max-height:92vh;border-radius:22px 22px 0 0}.crm-sheet-body{max-height:calc(92vh - 76px);padding:17px 18px 28px}.crm-student-metrics{grid-template-columns:repeat(3,1fr)}.crm-student-info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.crm-student-info-item:nth-child(3n+1){border-left:1px solid #ece8e4;padding-left:13px}.crm-student-info-item:nth-child(2n+1){border-left:0;padding-left:0}.crm-student-info-item:nth-child(n+3){border-top:1px solid #ece8e4;padding-top:12px;margin-top:4px}.crm-page [style*="grid-template-columns: repeat(6"],.crm-page [style*="grid-template-columns: repeat(7"]{grid-template-columns:repeat(2,1fr)!important}.crm-page [style*="gridTemplateColumns:\"repeat(6"],.crm-page [style*="gridTemplateColumns:\"repeat(7"]{grid-template-columns:repeat(2,1fr)!important}}
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

function Btn({ children, onClick, bg="#111", color="#fff", outline=false, mb=8, disabled=false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:"100%", background:outline?"transparent":bg, color:outline?bg:color, border:outline?`2px solid ${bg}`:"none", borderRadius:14, padding:"13px 16px", fontWeight:700, fontSize:14, cursor:disabled?"not-allowed":"pointer", opacity:disabled ? .65 : 1, fontFamily:"inherit", marginBottom:mb, display:"block" }}>
      {children}
    </button>
  );
}

function NoteArea({ value, onChange, placeholder="Açıklama ekle...", label="Açıklama (opsiyonel)" }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:6 }}>{label}</label>
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

function ActionSheet({ student, lessonId, onClose, onBack, onAction, onEvaluationMessage, saving=false }) {
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
  const [correctionReason, setCorrectionReason] = useState("");
  const [formError, setFormError] = useState("");
  const [pendingExceptionAction, setPendingExceptionAction] = useState("");
  const quotaRecordsForLesson = telafiRecordsWithoutLesson(student.telafi_records, lesson);
  const telafiQuota = telafiQuotaInfo(student, lesson?.date || new Date(), quotaRecordsForLesson);
  const willWarn = telafiQuota.count === 4;
  const willFill = telafiQuota.count === 5;
  const needsException = telafiQuota.count !== null && telafiQuota.count >= 6;
  const storedScoreValue = lesson?.lessonScore ?? lesson?.lesson_score;
  const correctionRequired = !!lesson && ((lesson.status || "upcoming") !== "upcoming" || (storedScoreValue !== null && storedScoreValue !== undefined && String(storedScoreValue).trim() !== ""));
  const reset = (s) => { setNote(s === "attended" ? (lesson?.note || "") : ""); setPendingExceptionAction(""); setStep(s); };
  const act = (a) => {
    if (saving) return;
    if ((a === "telafi" || a === "lm-telafi") && telafiQuota.count === null) { setPendingExceptionAction(a); setStep("telafi-start-required"); return; }
    if ((a === "telafi" || a === "lm-telafi") && needsException) { setPendingExceptionAction(a); setStep("telafi-exception"); return; }
    onAction(a, note, lessonId || lesson?.id);
  };

  const TelafiWarn = () => (
    <>
      {willWarn && <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#92400e", fontWeight:600 }}>Uyarı: Bu telafi ile 5. hakka ulaşılacak.</div>}
      {willFill && <div style={{ background:"#fff7ed", border:"1px solid #fdba74", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#9a3412", fontWeight:700 }}>Bilgi: Bu telafi ile öğrencinin normal hakkı 6/6 dolacak. Program devam eder; sonraki telafiler yönetici inisiyatifi gerektirir.</div>}
      {needsException && <div style={{ background:"#fff7ed", border:"1px solid #fdba74", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#9a3412", fontWeight:700 }}>Bu telafi hak döneminin normal kotası 6/6 dolu. Devam ederseniz ayrıca yönetici inisiyatifi onayı istenir.</div>}
      {telafiQuota.count === null && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#991b1b", fontWeight:700 }}>Derse başlangıç tarihi eksik olduğu için telafi hak dönemi hesaplanamıyor. Tarihi öğrenci düzenleme ekranından girin.</div>}
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
                {lesson.lessonScoreBreakdown ? <p style={{ margin:"5px 0 0", fontSize:11, color:"#047857" }}>{lesson.lessonScoreBreakdown.homeworkApplicable === false ? "Değerlendirilecek önceki ödev yok" : "Ödev "+lesson.lessonScoreBreakdown.homework+"/40"} · Aktif süre {lesson.lessonScoreBreakdown.active}/10 · Görev odağı {lesson.lessonScoreBreakdown.taskFocus}/20 · Yönlendirme {lesson.lessonScoreBreakdown.redirection}/30</p> : null}
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
        <Btn bg="#3b82f6" disabled={saving} onClick={() => act("telafi")}>{saving ? "Kaydediliyor..." : "Telafi Hakkı Oluştur"}</Btn>
        <Btn bg="#111" outline disabled={saving} onClick={() => { if (!saving) reset("main"); }}>Geri</Btn>
      </>}
      {step === "telafi-exception" && <>
        <div style={{ background:"#fff7ed", border:"1.5px solid #fb923c", borderRadius:13, padding:"13px 14px", marginBottom:14 }}>
          <p style={{ margin:0, fontSize:14, color:"#9a3412", fontWeight:900 }}>Telafi hakları dolmuş</p>
          <p style={{ margin:"7px 0 0", fontSize:13, color:"#9a3412", lineHeight:1.6 }}>Bu öğrenci bu telafi hak dönemindeki 6 normal telafinin tamamını kullanmış. Öğrenci normal kurala göre artık telafi dersi alamaz.</p>
          <p style={{ margin:"7px 0 0", fontSize:13, color:"#7c2d12", lineHeight:1.6, fontWeight:800 }}>Yine de verirseniz bu kayıt “Yönetici İnisiyatifi” olarak ayrıca sayılacak ve veli mesajında açıkça belirtilecektir.</p>
          {telafiQuota.exceptionCount>0 ? <p style={{ margin:"7px 0 0", fontSize:12, color:"#c2410c", fontWeight:800 }}>Daha önce verilen yönetici inisiyatifi: {telafiQuota.exceptionCount}</p> : null}
        </div>
        <Btn bg="#c2410c" disabled={saving} onClick={() => { if (!saving) onAction(pendingExceptionAction, note, lessonId || lesson?.id, { managerException:true }); }}>{saving ? "Kaydediliyor..." : "Yönetici İnisiyatifiyle Telafi Ver"}</Btn>
        <Btn bg="#111" outline disabled={saving} onClick={() => { if (saving) return; setStep(pendingExceptionAction === "lm-telafi" ? "sondakika" : "telafi"); setPendingExceptionAction(""); }}>Vazgeç</Btn>
      </>}
      {step === "telafi-start-required" && <>
        <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:13, padding:"13px 14px", marginBottom:14 }}>
          <p style={{ margin:0, fontSize:14, color:"#991b1b", fontWeight:900 }}>Derse başlangıç tarihi gerekli</p>
          <p style={{ margin:"7px 0 0", fontSize:13, color:"#991b1b", lineHeight:1.6 }}>Bu öğrencinin 12 aylık telafi hak dönemi hesaplanamadığı için telafi kaydı oluşturulmadı. Öğrenci düzenleme ekranından derse başlangıç tarihini girdikten sonra tekrar deneyin.</p>
        </div>
        <Btn bg="#111" outline onClick={() => { setStep(pendingExceptionAction === "lm-telafi" ? "sondakika" : "telafi"); setPendingExceptionAction(""); }}>Geri</Btn>
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
          {lessonFocus && !LESSON_FOCUS_OPTIONS.includes(lessonFocus) ? <option value={lessonFocus}>{lessonFocus} (Eski kayıt)</option> : null}
          {LESSON_FOCUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={LBL}>Öğretmen Notu (İsteğe Bağlı)</label>
        <NoteArea value={note} onChange={value=>{ setNote(value); setFormError(""); }} placeholder="Kısa not" />
        <label style={LBL}>Gelecek Ders İçin Ödev (İsteğe Bağlı)</label>
        <NoteArea value={homework} onChange={value=>{ setHomework(value); setFormError(""); }} placeholder="Örn. Beyer 1, sayfa 24–25; sağ el çalışılacak." />
        {correctionRequired ? <>
          <div style={{ background:"#fff7ed", border:"1px solid #fdba74", borderRadius:11, padding:"10px 11px", marginTop:14 }}>
            <p style={{ margin:0, fontSize:12, color:"#9a3412", fontWeight:800, lineHeight:1.5 }}>Bu ders daha önce işlendiği için yapılacak değişiklik geçmişte gerekçesiyle korunacak.</p>
          </div>
          <label style={LBL}>Düzeltme Nedeni</label>
          <NoteArea value={correctionReason} onChange={value=>{ setCorrectionReason(value); setFormError(""); }} label="Düzeltme gerekçesi" placeholder="Örn. Aktif ders süresi yanlış girilmişti." />
        </> : null}
        {formError ? <p style={{ margin:"8px 0 0", fontSize:12, color:"#dc2626", fontWeight:800 }}>{formError}</p> : null}
        <Btn bg="#10b981" disabled={saving} onClick={() => {
          if (saving) return;
          const duration = getLessonDuration(student, lesson);
          if (homeworkToEvaluate && !homeworkStatus) { setFormError("Ödev durumunu seçin."); return; }
          if (activeMinutes === "" || parseInt(activeMinutes) < 0 || parseInt(activeMinutes) > duration) { setFormError("Geçerli aktif ders süresi girin."); return; }
          if (taskFocusMinutes === "" || parseInt(taskFocusMinutes) < 0 || parseInt(taskFocusMinutes) > duration) { setFormError("Geçerli görev odağı süresi girin."); return; }
          if (redirectionCount === "" || parseInt(redirectionCount) < 0) { setFormError("Yeniden yönlendirme sayısını girin; gerekmediyse 0 yazın."); return; }
          if (!lessonFocus) { setFormError("Dersin temel odağını seçin."); return; }
          if (correctionRequired && !correctionReason.trim()) { setFormError("Daha önce kaydedilmiş ders verilerini değiştirmek için düzeltme nedenini yazın."); return; }
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
          }, lessonId || lesson?.id, { correctionReason:correctionRequired ? correctionReason.trim() : "" });
        }}>{saving ? "Kaydediliyor..." : "Katılımı Kaydet"}</Btn>
        <Btn bg="#111" outline disabled={saving} onClick={() => { if (!saving) reset("main"); }}>Geri</Btn>
      </>}
      {step === "yapildi" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Neden yapıldı sayılıyor?</p>
        <Btn bg="#f97316" onClick={() => reset("sondakika")}>Son Dakika İptali</Btn>
        <Btn bg="#ef4444" onClick={() => reset("noshow")}>Habersiz Gelmedi</Btn>
        <Btn bg="#111" outline disabled={saving} onClick={() => { if (!saving) reset("main"); }}>Geri</Btn>
      </>}
      {step === "sondakika" && <>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Son dakika iptali — telafi verilsin mi?</p>
        <TelafiWarn />
        <NoteArea value={note} onChange={setNote} />
        <Btn bg="#3b82f6" disabled={saving} onClick={() => act("lm-telafi")}>{saving ? "Kaydediliyor..." : "Telafiye Al"}</Btn>
        <Btn bg="#374151" disabled={saving} onClick={() => act("lm-notelafi")}>Telafi Verme</Btn>
        <Btn bg="#111" outline disabled={saving} onClick={() => { if (!saving) reset("yapildi"); }}>Geri</Btn>
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
  const plannedDate = plannedAt ? dateKey(plannedAt) : turkeyDateKey();
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
  const [correctionReason, setCorrectionReason] = useState("");
  const [formError, setFormError] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const days = daysLeft(record.expiry);
  const expired = days !== null && days < 0;
  const urgent = !expired && days !== null && days <= 7;
  const savePlan = async () => {
    if (savingPlan) return;
    setSavingPlan(true);
    try {
      const saved = await onSave(record.id, {
        action: "plan",
        plannedAt: `${date}T${time}:00`,
        plannedDurationMinutes: parseInt(duration) || getLessonDuration(student),
        plannedNote: note,
      });
      if (saved !== false) onClose();
    } finally {
      setSavingPlan(false);
    }
  };
  const saveCompletion = async payload => {
    if (savingCompletion) return;
    setSavingCompletion(true);
    try {
      const saved = await onSave(record.id,{
        ...payload,
        correctionReason:record.done ? correctionReason.trim() : "",
      });
      if (saved === true) onClose();
    } finally {
      setSavingCompletion(false);
    }
  };

  return (
    <Sheet title="Telafi Dersi" subtitle={student?.name} onClose={()=>{ if (!savingPlan && !savingCompletion) onClose(); }}>
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
              <Btn bg="#10b981" disabled={savingPlan} onClick={savePlan}>{savingPlan ? "Kaydediliyor..." : "Telafiyi Planla"}</Btn>
              {plannedAt ? <Btn bg="#111" outline disabled={savingPlan} onClick={() => setStep("main")}>Geri</Btn> : null}
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
                  {lessonFocus && !LESSON_FOCUS_OPTIONS.includes(lessonFocus) ? <option value={lessonFocus}>{lessonFocus} (Eski kayıt)</option> : null}
                  {LESSON_FOCUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label style={LBL}>Öğretmen Notu (İsteğe Bağlı)</label>
                <NoteArea value={doneNote} onChange={value=>{ setDoneNote(value); setFormError(""); }} placeholder="Kısa not" />
                <label style={LBL}>Gelecek Ders İçin Ödev (İsteğe Bağlı)</label>
                <NoteArea value={homework} onChange={value=>{ setHomework(value); setFormError(""); }} placeholder="Örn. Beyer 1, sayfa 24–25; sağ el çalışılacak." />
                {record.done ? <>
                  <label style={LBL}>Düzeltme Nedeni</label>
                  <NoteArea value={correctionReason} onChange={value=>{ setCorrectionReason(value); setFormError(""); }} placeholder="Örn. Öğretmen notundaki süre yanlış girilmişti." />
                </> : null}
                {formError ? <p style={{ margin:"8px 0 0", fontSize:12, color:"#dc2626", fontWeight:800 }}>{formError}</p> : null}
                <Btn bg="#10b981" disabled={savingCompletion} onClick={() => {
                  const lessonDuration = parseInt(duration) || getLessonDuration(student);
                  if (homeworkToEvaluate && !homeworkStatus) { setFormError("Ödev durumunu seçin."); return; }
                  if (activeMinutes === "" || parseInt(activeMinutes) < 0 || parseInt(activeMinutes) > lessonDuration) { setFormError("Geçerli aktif ders süresi girin."); return; }
                  if (taskFocusMinutes === "" || parseInt(taskFocusMinutes) < 0 || parseInt(taskFocusMinutes) > lessonDuration) { setFormError("Geçerli görev odağı süresi girin."); return; }
                  if (redirectionCount === "" || parseInt(redirectionCount) < 0) { setFormError("Yeniden yönlendirme sayısını girin; gerekmediyse 0 yazın."); return; }
                  if (!lessonFocus) { setFormError("Dersin temel odağını seçin."); return; }
                  if (record.done && !correctionReason.trim()) { setFormError("Düzeltme nedenini yazın."); return; }
                  const scoreBreakdown = calculateLessonScore({ homeworkStatus, homeworkApplicable:!!homeworkToEvaluate, activeMinutes, taskFocusMinutes, redirectionCount });
                  void saveCompletion({
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
                }}>{savingCompletion ? "Kaydediliyor..." : "Katılımı Kaydet"}</Btn>
                <Btn bg="#111" outline disabled={savingCompletion} onClick={() => setStep("main")}>Geri</Btn>
              </>
            : step === "counted"
              ? <>
                  <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Neden yapıldı sayılıyor?</p>
                  <NoteArea value={doneNote} onChange={setDoneNote} placeholder="Açıklama" />
                  <Btn bg="#f97316" disabled={savingCompletion} onClick={() => { void saveCompletion({ action: "counted", doneAt: plannedAt || `${date}T${time}:00`, doneNote }); }}>{savingCompletion ? "Kaydediliyor..." : "Kaydet"}</Btn>
                  <Btn bg="#111" outline disabled={savingCompletion} onClick={() => setStep("main")}>Geri</Btn>
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
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const [moveDate, setMoveDate] = useState(dateKey(lesson.date) || new Date().toISOString().split("T")[0]);
  const [moveTime, setMoveTime] = useState(lessonTime(student, lesson) || student.time || "10:00");
  return (
    <Sheet title="Ders Tarihi Kaydır" subtitle={fmtDate(lesson.date)+" - "+lessonTime(student, lesson)} onClose={()=>{ if (!movingRef.current) onClose(); }}>
      <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>1/2 hafta ileri alırsan bu dersten sonraki planlı dersler de aynı şekilde kayar.</p>
      <Btn bg="#6366f1" disabled={moving} onClick={() => { onShift(lesson.id, 7); onClose(); }}>1 Hafta İleri Al</Btn>
      <Btn bg="#8b5cf6" disabled={moving} onClick={() => { onShift(lesson.id, 14); onClose(); }}>2 Hafta İleri Al</Btn>
      <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, padding:12, margin:"12px 0" }}>
        <p style={{ margin:"0 0 8px", fontSize:13, color:"#666" }}>Sadece bu dersi başka bir tarih ve saate taşı.</p>
        <input style={INP} type="date" value={moveDate} disabled={moving} onChange={e=>setMoveDate(e.target.value)} />
        <div style={{ height:8 }} />
        <select style={INP} value={moveTime} disabled={moving} onChange={e=>setMoveTime(e.target.value)}>
          {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ marginTop:10 }}>
          <Btn bg="#0ea5e9" disabled={moving} onClick={async () => {
            if (movingRef.current) return;
            movingRef.current = true;
            setMoving(true);
            try { if (await onMoveOne(lesson.id,moveDate,moveTime)) onClose(); }
            finally { movingRef.current = false; setMoving(false); }
          }}>{moving ? "Kaydediliyor…" : "Tarihe Taşı"}</Btn>
        </div>
      </div>
      <Btn bg="#111" outline disabled={moving} onClick={onClose}>İptal</Btn>
    </Sheet>
  );
}

function DuzenleSheet({ student, teachers, onClose, onDuzenle }) {
  const currentTeacherId = student.teacher_id || teachers.find(t => t.name === studentTeacherName(student))?.id || "";
  const [f, setF] = useState({
    name: student.name,
    teacher_id: currentTeacherId,
    teacher_change_date: turkeyDateKey(),
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
  const [date, setDate] = useState(turkeyDateKey());
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

function EkDersOdemeSheet({ student, extra, onClose, onConfirm }) {
  const [date,setDate] = useState(turkeyDateKey());
  const [saving,setSaving] = useState(false);
  const amount = extra?.fee || ekDersFee(student);
  const submit = async () => {
    if (!isValidLocalDateInput(date) || saving) return;
    setSaving(true);
    try {
      const saved = await onConfirm(student.id,extra,date);
      if (saved !== false) onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title="Ek Ders Ödemesi" subtitle={student.name} onClose={()=>{ if(!saving) onClose(); }}>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#166534" }}>Ek Ders: {amount.toLocaleString("tr-TR")} TL</p>
        <p style={{ margin:"4px 0 0", fontSize:12, color:"#166534" }}>{fmtDate(extra.date)} · {timeFromISO(extra.date)} · {ekDersTypeLabel(extra.type)}</p>
      </div>
      <label style={LBL}>Ödeme Tarihi</label>
      <input style={INP} type="date" value={date} onChange={event=>setDate(event.target.value)} disabled={saving} />
      <p style={{ margin:"6px 0 14px", fontSize:12, lineHeight:1.5, color:"#64748b" }}>Bu işlem yalnız bu Ek Dersin ayrı tahsilatını kaydeder. İptal edersen Ek Ders ödenmemiş kalır ve takip eden paket ödemesine dahil edilmeye devam eder.</p>
      <button type="button" disabled={saving || !isValidLocalDateInput(date)} onClick={submit} style={{ width:"100%", background:saving?"#86efac":"#10b981", color:"#fff", border:"none", borderRadius:14, padding:"13px 16px", fontWeight:800, fontSize:14, cursor:saving?"wait":"pointer", fontFamily:"inherit", marginBottom:8 }}>{saving?"Kaydediliyor...":"Ödemeyi Kaydet"}</button>
      <button type="button" disabled={saving} onClick={onClose} style={{ width:"100%", background:"transparent", color:"#111", border:"2px solid #111", borderRadius:14, padding:"11px 16px", fontWeight:700, fontSize:14, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit" }}>İptal</button>
    </Sheet>
  );
}

function PaymentHistoryItem({ student, payment, index, onPaymentEdit, onPaymentDelete }) {
  const info = paymentDisplayInfo(student, payment, index);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(payment.tarih || turkeyDateKey());
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

function PieceAddSheet({ student, onClose, onSave }) {
  const [pieceName, setPieceName] = useState("");
  const [pieceResult, setPieceResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <Sheet title="Parça Ekle" subtitle={student.name} onClose={onClose}>
    <label style={{ ...LBL, marginTop:0 }}>Parçanın Adı</label>
    <input style={INP} value={pieceName} maxLength={120} onChange={event=>{ setPieceName(event.target.value); setError(""); }} placeholder="Örn. Für Elise" />
    <label style={LBL}>Parça Sonucu</label>
    <select style={INP} value={pieceResult} onChange={event=>{ setPieceResult(event.target.value); setError(""); }}>
      <option value="">Seçin</option>
      {PIECE_RESULT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {error ? <p style={{ margin:"9px 0 0", color:"#dc2626", fontSize:12, fontWeight:800 }}>{error}</p> : null}
    <div style={{ marginTop:14 }}><Btn bg="#7e22ce" onClick={async()=>{
      const piece = pieceResultOption(pieceResult);
      if (!pieceName.trim()) { setError("Parçanın adını yazın."); return; }
      if (!piece) { setError("Parça sonucunu seçin."); return; }
      if (saving) return;
      setSaving(true);
      const saved = await onSave({ name:pieceName.trim(), result:piece.value, label:piece.label, score:piece.score });
      setSaving(false);
      if (saved) onClose();
    }}>{saving ? "Kaydediliyor..." : "Parçayı Kaydet"}</Btn></div>
    <Btn bg="#111" outline onClick={onClose}>İptal</Btn>
  </Sheet>;
}

function studentLinkedSingleLessons(singleLessons, studentId) {
  return (singleLessons || [])
    .filter(lesson=>!lesson.deleted_at && lesson.participant_kind==="student" && lesson.student_id===studentId)
    .sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));
}

function DetailSheet({ student, teachers, singleLessons=[], singleLessonsLoading=false, initialTab="takvim", onClose, onRecharge, onUndoLastPackage, onLessonClick, onShift, onMoveOne, onTelafiDone, onTelafiPlanMessage, onTelafiEvaluationMessage, onPieceAdd, onMesaj, onÖdemeAl, paymentSavingId="", onZamYap, onDelete, onStudentLeft, onEkDersEkle, onEkDersOdeme, onEkDersSil, onEkDersDurum, onSingleLessonOpen=()=>{}, onDuzenle, onToggleFreeze, onPaymentEdit, onPaymentDelete }) {
  const [tab, setTab] = useState(initialTab);
  const [telafiSel, setTelafiSel] = useState(null);
  const [shiftSel, setShiftSel] = useState(null);
  const [showEkDers, setShowEkDers] = useState(false);
  const [showDuzenle, setShowDuzenle] = useState(false);
  const [showOdemeAl, setShowOdemeAl] = useState(false);
  const [showPaketYukle, setShowPaketYukle] = useState(false);
  const [showZam, setShowZam] = useState(false);
  const [showResumeProgram, setShowResumeProgram] = useState(false);
  const [showPieceAdd, setShowPieceAdd] = useState(false);
  const [ekDersOdemeSel, setEkDersOdemeSel] = useState(null);
  const [mevcutAcik, setMevcutAcik] = useState(true);
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const bal = calcBalance(student.schedule);
  const np = calcNextPayment(student.schedule);
  const telafiRecords = student.telafi_records || [];
  const active = activeTelafiRecords(telafiRecords);
  const currentTelafiQuota = telafiQuotaInfo(student);
  const remainingTelafiRights = currentTelafiQuota.remaining;
  const telafiGroups = telafiPeriodGroups(student);
  const ekDersler = student.ek_dersler || [];
  const linkedSingleLessons = studentLinkedSingleLessons(singleLessons,student.id);
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
          <MiniMetric label="Kalan Telafi Hakkı" value={remainingTelafiRights===null?"—":remainingTelafiRights} tone={remainingTelafiRights===null?"neutral":remainingTelafiRights===0?"danger":remainingTelafiRights<=2?"warn":"good"} />
        </div>
        {currentTelafiQuota.count === null ? <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:12, padding:"9px 11px", marginBottom:10 }}><p style={{ margin:0, fontSize:12, color:"#991b1b", fontWeight:800 }}>Telafi hak dönemi hesabı için derse başlangıç tarihini öğrenci düzenleme ekranından girin.</p></div> : null}
        {currentTelafiQuota.exceptionCount > 0 ? <div style={{ background:"#fff7ed", border:"1px solid #fdba74", borderRadius:12, padding:"9px 11px", marginBottom:10 }}><p style={{ margin:0, fontSize:12, color:"#9a3412", fontWeight:800 }}>Bu telafi hak dönemi: {currentTelafiQuota.count}/6 normal hak · {currentTelafiQuota.exceptionCount} yönetici inisiyatifi</p></div> : null}
        {currentTelafiQuota.legacyOverflowCount > 0 ? <div style={{ background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:12, padding:"9px 11px", marginBottom:10 }}><p style={{ margin:0, fontSize:12, color:"#475569", fontWeight:800 }}>Bu telafi hak döneminde v98 öncesinden {currentTelafiQuota.legacyOverflowCount} ek telafi kaydı var; yönetici inisiyatifi olarak varsayılmadı.</p></div> : null}
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
        <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:pieceHistory.length?6:0 }}>
            <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#888", letterSpacing:1 }}>PARÇA GEÇMİŞİ</p>
            <button onClick={()=>setShowPieceAdd(true)} style={{ border:"none", borderRadius:9, background:"#ede9fe", color:"#6d28d9", padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>+ Parça Ekle</button>
          </div>
          {pieceHistory.length > 0 ? (
            <>
            {pieceHistory.map((piece,index) => (
              <div key={piece.id || piece.name+"|"+piece.date.getTime()+"|"+index} style={{ borderBottom:index<pieceHistory.length-1?"1px solid #f0f0f0":"none", padding:"8px 0" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#111" }}>{piece.name}</p>
                    {piece.period ? <p style={{ margin:"2px 0 0", fontSize:11, color:"#94a3b8" }}>{piece.period}</p> : null}
                  </div>
                  <p style={{ margin:0, fontSize:12, color:piece.score===100?"#047857":piece.score===50?"#b45309":"#64748b", fontWeight:700, textAlign:"right", flexShrink:0 }}>{piece.result}</p>
                </div>
              </div>
            ))}
            </>
          ) : <p style={{ margin:"9px 0 2px", fontSize:12, color:"#94a3b8" }}>Henüz parça kaydı yok.</p>}
        </div>
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
          const lessonSections = splitCurrentAndArchivedLessons(student);
          const upcomingDersler = student.schedule.filter(l => l.status === "upcoming");
          const tümTamamlananDersler = student.schedule.filter(l => l.status !== "upcoming");
          const mevcutDonemDersleri = lessonSections.current;
          const gecmisDersler = lessonSections.archived;
          const historicalGroups = historicalLessonYearGroups(student, gecmisDersler);
          const telafiPencereGecmisSayisi = tümTamamlananDersler.length % 4;
          const telafiPencereGecmis = telafiPencereGecmisSayisi > 0 ? tümTamamlananDersler.slice(-telafiPencereGecmisSayisi) : [];
          const telafiWindowItems = [...telafiPencereGecmis, ...upcomingDersler];
          const currentStart = telafiWindowItems.length ? Math.min(...telafiWindowItems.map(l => new Date(l.date).getTime())) : null;
          const currentEnd = telafiWindowItems.length ? Math.max(...telafiWindowItems.map(l => new Date(l.date).getTime())) : null;
          const plannedTelafiler = telafiRecords
            .filter(r => telafiPlannedAt(r))
            .filter(r => {
              const t = new Date(telafiPlannedAt(r)).getTime();
              if (!Number.isFinite(t) || currentStart === null || currentEnd === null) return true;
              return !r.done || (t >= currentStart && t <= currentEnd);
            })
            .map(r => ({ id:"telafi-"+r.id, kind:"telafi", date:telafiPlannedAt(r), record:r }));
          const güncel = [...mevcutDonemDersleri, ...plannedTelafiler].sort((a,b)=>new Date(a.date)-new Date(b.date));
          return (
            <div style={{ display:"grid", gap:10 }}>
              {güncel.length > 0 ? (
                <div>
                  <button onClick={() => setMevcutAcik(!mevcutAcik)} style={{ width:"100%", background:"#eef2ff", border:"1px solid #c7d2fe", borderRadius:10, padding:"10px 12px", fontSize:13, fontWeight:800, color:"#4338ca", cursor:"pointer", fontFamily:"inherit", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>Mevcut Dönem ({lessonSections.currentPeriodLessons.length || mevcutDonemDersleri.length})</span>
                    <span>{mevcutAcik ? "▲" : "▼"}</span>
                  </button>
                  {mevcutAcik ? <div style={{ marginTop:7 }}>{güncel.map(l => <LessonCard key={l.id} l={l} />)}</div> : null}
                </div>
              ) : null}
              {gecmisDersler.length > 0 ? (
                <div>
                  <button onClick={() => setGecmisAcik(!gecmisAcik)} style={{ width:"100%", background:"#f3f4f6", border:"none", borderRadius:10, padding:"10px 12px", fontSize:13, fontWeight:700, color:"#555", cursor:"pointer", fontFamily:"inherit", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>Geçmiş Dersler ({gecmisDersler.length})</span>
                    <span>{gecmisAcik ? "▲" : "▼"}</span>
                  </button>
                  {gecmisAcik ? (
                    <div style={{ marginTop:7, display:"grid", gap:7 }}>
                      {historicalGroups.map(yearGroup => (
                        <details key={yearGroup.year} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"0 10px" }}>
                          <summary style={{ cursor:"pointer", padding:"10px 2px", fontSize:13, fontWeight:900, color:"#334155" }}>{yearGroup.year} · {yearGroup.count} ders</summary>
                          <div style={{ display:"grid", gap:6, padding:"0 0 9px" }}>
                            {yearGroup.periods.map(period => (
                              <details key={period.key} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:9, padding:"0 9px" }}>
                                <summary style={{ cursor:"pointer", padding:"9px 1px", fontSize:12, fontWeight:800, color:"#6366f1" }}>{period.label} · {period.lessons.length} ders</summary>
                                <div style={{ paddingBottom:4 }}>{period.lessons.map(l => <LessonCard key={l.id} l={l} />)}</div>
                              </details>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })()}

        {tab === "telafi" ? (
          <div>
            {telafiRecords.length === 0 ? <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Henüz telafi kaydı yok</p> : null}
            {telafiGroups.map(group => {
              const waiting = group.records.filter(isCurrentTelafi);
              const expiredInPeriod = group.records.filter(record=>!record.done && !isCurrentTelafi(record));
              const doneInPeriod = group.records.filter(record=>record.done);
              const groupQuota = group.period && !group.period.beforeStart ? telafiQuotaInfo(student, group.period.start, group.records) : null;
              const exceptionCount = groupQuota?.exceptionCount || 0;
              const legacyOverflowCount = groupQuota?.legacyOverflowCount || 0;
              const isCurrentPeriod = !!group.period && group.period.key === currentTelafiQuota.period?.key;
              const renderRecord = (record,status) => {
                const managerExceptionRecord = !!groupQuota?.exceptionRecords?.includes(record);
                const legacyOverflowRecord = !!groupQuota?.legacyOverflowRecords?.includes(record);
                const leftDays = daysLeft(record.expiry);
                const urgent = status === "waiting" && leftDays !== null && leftDays <= 7;
                const doneRecord = status === "done";
                const expiredRecord = status === "expired";
                const background = doneRecord?"#f0fdf4":expiredRecord?"#fff1f2":urgent?"#fffbeb":"#f0f9ff";
                const border = doneRecord?"#bbf7d0":expiredRecord?"#fca5a5":urgent?"#fcd34d":"#bae6fd";
                const tone = doneRecord?"#166534":expiredRecord?"#dc2626":urgent?"#d97706":"#0369a1";
                return <div key={record.id} onClick={() => setTelafiSel(record)} style={{ background, border:"1px solid "+border, borderRadius:11, padding:"11px 12px", marginBottom:7, cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:9 }}>
                    <div style={{ minWidth:0 }}>
                      <p style={{ margin:0, fontSize:13, fontWeight:850, color:doneRecord?"#166534":"#0f172a" }}>{fmtDate(record.lessonDate)} dersi</p>
                      {record.note ? <p style={{ margin:"5px 0 0", fontSize:12, color:"#64748b", fontStyle:"italic", lineHeight:1.45 }}>{record.note}</p> : null}
                      {telafiPlannedAt(record) ? <p style={{ margin:"6px 0 0", fontSize:11, color:"#7e22ce", fontWeight:800 }}>Planlandı: {fmtDate(telafiPlannedAt(record))} · {timeFromISO(telafiPlannedAt(record))}</p> : null}
                      {doneRecord && telafiDoneAt(record) ? <p style={{ margin:"5px 0 0", fontSize:11, color:"#16a34a", fontWeight:700 }}>{telafiDoneDateText(record)}</p> : null}
                      {doneRecord && telafiMetricText(record) ? <p style={{ margin:"4px 0 0", fontSize:11, color:"#166534" }}>{telafiMetricText(record)}</p> : null}
                      {managerExceptionRecord ? <p style={{ margin:"4px 0 0", fontSize:11, color:"#c2410c", fontWeight:900 }}>Yönetici İnisiyatifiyle Verildi</p> : null}
                      {legacyOverflowRecord ? <p style={{ margin:"4px 0 0", fontSize:11, color:"#475569", fontWeight:900 }}>v98 Öncesi Ek Telafi · Türü İşaretlenmemiş</p> : null}
                      {!doneRecord ? <p style={{ margin:"6px 0 0", fontSize:11, color:"#64748b" }}>Son geçerlilik <strong style={{ color:tone }}>· {record.expiry?fmtMed(record.expiry):"Belirtilmedi"}</strong></p> : null}
                    </div>
                    <span style={{ background:tone, color:"#fff", borderRadius:20, padding:"4px 9px", fontSize:11, fontWeight:800, flexShrink:0 }}>{doneRecord?"Yapıldı":expiredRecord?"Doldu":leftDays===null?"Bekliyor":leftDays+"g"}</span>
                  </div>
                </div>;
              };
              const quotaSummary = groupQuota ? <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ background:groupQuota.count>=6?"#fee2e2":"#eef2ff", color:groupQuota.count>=6?"#b91c1c":"#4338ca", borderRadius:20, padding:"5px 9px", fontSize:10, fontWeight:900 }}>{groupQuota.count}/6 kullanıldı</span>
                <span style={{ background:"#ecfdf5", color:"#047857", borderRadius:20, padding:"5px 9px", fontSize:10, fontWeight:900 }}>{groupQuota.remaining} hak kaldı</span>
                {exceptionCount>0?<span style={{ background:"#fff7ed", color:"#c2410c", borderRadius:20, padding:"5px 9px", fontSize:10, fontWeight:900 }}>{exceptionCount} yönetici inisiyatifi</span>:null}
                {legacyOverflowCount>0?<span style={{ background:"#f1f5f9", color:"#475569", borderRadius:20, padding:"5px 9px", fontSize:10, fontWeight:900 }}>{legacyOverflowCount} geçmiş ek kayıt</span>:null}
              </div> : null;
              const recordSections = <div style={{ display:"grid", gap:8 }}>
                {waiting.length>0?<div><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", margin:"0 0 7px" }}><p style={{ fontSize:10, fontWeight:900, color:"#0369a1", letterSpacing:1, margin:0 }}>BEKLEYEN TELAFİLER</p><span style={{ fontSize:10, fontWeight:900, color:"#0369a1" }}>{waiting.length}</span></div>{waiting.map(record=>renderRecord(record,"waiting"))}</div>:isCurrentPeriod?<div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 12px", fontSize:12, color:"#64748b", fontWeight:700 }}>Bu dönemde bekleyen telafi yok.</div>:null}
                {expiredInPeriod.length>0?<details style={{ borderTop:"1px solid #e5e7eb", paddingTop:8 }}><summary style={{ cursor:"pointer", padding:"3px 0 8px" }}><span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><p style={{ margin:0, fontSize:11, fontWeight:850, color:"#dc2626" }}>SÜRESİ DOLAN</p><strong style={{ fontSize:10, color:"#dc2626" }}>{expiredInPeriod.length}</strong></span></summary>{expiredInPeriod.map(record=>renderRecord(record,"expired"))}</details>:null}
                {doneInPeriod.length>0?<details style={{ borderTop:"1px solid #e5e7eb", paddingTop:8 }}><summary style={{ cursor:"pointer", padding:"3px 0 8px" }}><span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><p style={{ margin:0, fontSize:11, fontWeight:850, color:"#166534" }}>YAPILMIŞ</p><strong style={{ fontSize:10, color:"#166534" }}>{doneInPeriod.length}</strong></span></summary>{doneInPeriod.map(record=>renderRecord(record,"done"))}</details>:null}
              </div>;
              if (!isCurrentPeriod) return <details key={group.key} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"0 11px", marginBottom:9 }}>
                <summary style={{ cursor:"pointer", padding:"11px 1px", listStyle:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center" }}><div><p style={{ margin:0, fontSize:12, fontWeight:900, color:"#334155" }}>{telafiPeriodTitle(group.period)}</p>{telafiPeriodDateRange(group.period)?<p style={{ margin:"3px 0 0", fontSize:10, color:"#94a3b8" }}>{telafiPeriodDateRange(group.period)}</p>:null}</div><span style={{ color:"#64748b", fontSize:11, fontWeight:850 }}>{group.records.length} kayıt · Aç</span></div>
                </summary>
                <div style={{ borderTop:"1px solid #eef2f7", padding:"10px 0 4px" }}>{quotaSummary}<div style={{ height:9 }} />{recordSections}</div>
              </details>;
              return <div key={group.key} style={{ background:"#fff", border:"1.5px solid #c4b5fd", borderRadius:14, padding:"13px", marginBottom:12 }}>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:9 }}><div><p style={{ margin:0, fontSize:13, color:"#111", fontWeight:950 }}>{telafiPeriodTitle(group.period)}</p><p style={{ margin:"4px 0 0", fontSize:11, color:"#64748b" }}>{telafiPeriodDateRange(group.period)}</p></div><span style={{ background:"#f3e8ff", color:"#7e22ce", borderRadius:20, padding:"5px 9px", fontSize:10, fontWeight:900, whiteSpace:"nowrap" }}>Güncel dönem</span></div>
                  {quotaSummary}
                </div>
                {recordSections}
              </div>;
            })}
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
                      {!e.odendi ? <button onClick={() => setEkDersOdemeSel(e)} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Ödeme Alındı</button> : null}
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
            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:16, paddingTop:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:10 }}>
                <div>
                  <p style={{ margin:0, fontSize:12, fontWeight:900, color:"#4c1d95", letterSpacing:.4 }}>TEK DERSLER</p>
                  <p style={{ margin:"3px 0 0", fontSize:11, color:"#64748b" }}>Paket ve mevcut Ek Ders kayıtlarından bağımsızdır.</p>
                </div>
                <span style={{ background:"#ede9fe", color:"#6d28d9", borderRadius:20, padding:"5px 9px", fontSize:11, fontWeight:900, whiteSpace:"nowrap" }}>Tek Ders ({linkedSingleLessons.length})</span>
              </div>
              {singleLessonsLoading ? <p style={{ textAlign:"center", color:"#94a3b8", padding:"16px 0", fontWeight:700 }}>Tek ders kayıtları yükleniyor...</p> : null}
              {!singleLessonsLoading && linkedSingleLessons.length === 0 ? <p style={{ textAlign:"center", color:"#aaa", padding:"16px 0", fontWeight:600 }}>Bu öğrenciye bağlı Tek Ders kaydı yok</p> : null}
              {!singleLessonsLoading ? linkedSingleLessons.map(lesson => {
                const free = lesson.billing_status === "free";
                const paid = lesson.billing_status === "paid";
                return <button type="button" key={lesson.id} onClick={()=>onSingleLessonOpen(lesson)} style={{ width:"100%", display:"block", textAlign:"left", background:paid?"#f0fdf4":free?"#faf5ff":"#fff7ed", border:"1px solid "+(paid?"#bbf7d0":free?"#ddd6fe":"#fed7aa"), borderLeft:"5px solid #7c3aed", borderRadius:10, padding:"10px 12px", marginBottom:8, cursor:"pointer", fontFamily:"inherit" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                    <div style={{ minWidth:0 }}>
                      <p style={{ margin:0, fontWeight:800, fontSize:14, color:"#111" }}>{fmtDate(lesson.starts_at)}</p>
                      <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b" }}>{timeFromISO(lesson.starts_at)} · {lesson.lesson_mode==="online"?"Online":"Fiziki"} · {singleLessonStatusLabel(lesson.lesson_status)}</p>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <p style={{ margin:0, fontSize:13, fontWeight:900, color:free?"#6d28d9":"#111" }}>{free?"Ücretsiz":Number(lesson.fee).toLocaleString("tr-TR")+" TL"}</p>
                      <p style={{ margin:"3px 0 0", fontSize:11, fontWeight:800, color:paid?"#047857":free?"#6d28d9":"#c2410c" }}>{singleLessonBillingLabel(lesson.billing_status)}</p>
                    </div>
                  </div>
                </button>;
              }) : null}
            </div>
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
      {telafiSel ? <TelafiSheet record={telafiSel} student={student} onClose={() => setTelafiSel(null)} onSave={(id, payload) => onTelafiDone(student.id, id, payload)} onPlanMessage={(record) => { setTelafiSel(null); onTelafiPlanMessage(student, record); }} onEvaluationMessage={(record) => { setTelafiSel(null); onTelafiEvaluationMessage(student, record); }} /> : null}
      {shiftSel ? <ShiftSheet lesson={shiftSel} student={student} onClose={() => setShiftSel(null)} onShift={(lid, days) => { onShift(student.id, lid, days); setShiftSel(null); }} onMoveOne={(lid, date, time) => onMoveOne(student.id, lid, date, time)} /> : null}
      {showOdemeAl ? <OdemeAlSheet student={student} saving={paymentSavingId===student.id} onClose={() => setShowOdemeAl(false)} onÖdemeAl={onÖdemeAl} /> : null}
      {showPaketYukle ? <ÖdemeSheet student={student} onClose={() => setShowPaketYukle(false)} onÖdemeAl={(sid, date, count) => { onRecharge(sid, date, count); setShowPaketYukle(false); onClose(); }} onMesajGonder={onMesaj} /> : null}
      {showZam ? <ZamSheet student={student} onClose={() => setShowZam(false)} onSave={onZamYap} /> : null}
      {showResumeProgram ? <ResumeProgramSheet student={student} onClose={() => setShowResumeProgram(false)} onResume={(startDate) => onToggleFreeze(student.id, false, startDate)} /> : null}
      {showEkDers ? <EkDersSheet student={student} onClose={() => setShowEkDers(false)} onEkDersEkle={(sid, ders) => { onEkDersEkle(sid, ders); setShowEkDers(false); }} /> : null}
      {ekDersOdemeSel ? <EkDersOdemeSheet student={student} extra={ekDersOdemeSel} onClose={()=>setEkDersOdemeSel(null)} onConfirm={onEkDersOdeme} /> : null}
      {showDuzenle ? <DuzenleSheet student={student} teachers={teachers} onClose={() => setShowDuzenle(false)} onDuzenle={onDuzenle} /> : null}
      {showPieceAdd ? <PieceAddSheet student={student} onClose={()=>setShowPieceAdd(false)} onSave={piece=>onPieceAdd(student.id,piece)} /> : null}
    </>
  );
}

function AddSheet({ teachers, onClose, onAdd }) {
  const todayISO = turkeyDateKey();
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
function msgEkDersHatirlatma(extra) {
  const mode = extra?.type === "online" ? "online " : "";
  return "Günaydın :) Bugünkü "+mode+"ek dersimizin saati "+timeFromISO(extra?.date)+". Lütfen 5 dakika önce hazır olun.";
}
function msgTekDersHatirlatma(lesson) {
  const mode = lesson?.lesson_mode === "online" ? "online " : "";
  if (isTrialSingleLesson(lesson)) return "Günaydın :) Bugünkü "+mode+"deneme dersiniz saat "+timeFromISO(lesson?.starts_at)+". Lütfen 5 dakika önce hazır olun.";
  return "Günaydın :) Bugünkü "+mode+(lesson?.instrument || "müzik")+" tek dersimizin saati "+timeFromISO(lesson?.starts_at)+". Lütfen 5 dakika önce hazır olun.";
}
function msgTelafiHakki(student, record) {
  const lessonText = record?.lessonDate ? fmtMed(record.lessonDate)+" tarihli dersiniz" : "Dersiniz";
  const expiryText = record?.expiry ? fmtMed(record.expiry) : "asıl ders tarihinden itibaren 30 gün";
  const exceptionText = isManagerTelafiException(record) ? "\n\nBu telafi hak dönemindeki 6 normal telafi hakkınız dolmuş olmasına rağmen, bildirilen durum kurum yönetimi tarafından değerlendirilmiş ve yönetici inisiyatifiyle istisnai bir telafi hakkı tanımlanmıştır." : "";
  return "Merhaba,\n\n"+lessonText+" için telafi hakkı oluşturulmuştur."+exceptionText+" Telafi hakkınızı 30 gün içinde, "+expiryText+" tarihine kadar kullanabilirsiniz.\n\nUygunluk oluştuğunda telafi dersi planlaması için sizinle iletişime geçeceğiz.\n\nBodrum Sonsuz Sanat";
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
  return "Sonsuz Sanat Ders Süreci Bilgilendirmesi\n\nDerslerimiz haftalık sabit gün ve saatlerde ilerler. Eğitim sürecinde devamlılık ve düzenli katılım büyük önem taşır.\n\nLütfen aşağıdaki kuralları inceleyiniz:\n\nDers İptalleri\n\n• Ders iptallerinin en az 24 saat önceden bildirilmesi gerekir.\n• Her telafi hakkı, telafiye alınan asıl ders tarihinden itibaren 30 gün geçerlidir.\n• Kullanılmayan telafi hakları bir sonraki döneme devredilmez.\n\nDers Günü İptalleri\n\n• Ders günü yapılan iptallerde, eğer iptal sebebi sağlık sorunlarının dışındaysa ders yapılmış sayılır.\n• Derse habersiz gelinmemesi durumunda ders yapılmış sayılır ve telafi hakkı oluşmaz.\n\nTelafi Dersleri\n\n• Telafi dersleri kurumun uygunluk durumuna göre planlanır, uygunluk oluştuğunda tarafınıza bilgi verilir.\n\nProgram Dondurma\n\n• 2-3 hafta ve üzeri planlı yokluklarda program dondurulabilir veya mevcut haliyle devam ettirilebilir.\n• Programın devam etmesi halinde öğrenciye ayrılan gün ve saat korunur; ders ve ödeme takvimi normal şekilde işlemeye devam eder.\n• Planlı yokluk sırasında derslere katılmasanız bile, size ayırılan gün ve saatin korunması için ödeme günleri gelmeye devam eder ve telafi hakları birikebilir. Bunu istemiyorsanız programı dondurmanızı öneririz.\n• Program dondurulduğunda mevcut gün ve saat korunmaz.\n• Dönüşte aynı gün ve saat garanti edilmez; kontenjan durumuna göre yeniden planlama yapılır.\n\nÖdeme Düzeni\n\n• Ödemelerin zamanında yapılması programın devamlılığı açısından önemlidir.\n• Ödeme sürecinin aksaması durumunda program dondurulabilir ve ayrılan gün/saat başka öğrencilere açılabilir.\n\nAmacımız tüm öğrencilerimiz için düzenli, adil ve sürdürülebilir bir eğitim süreci oluşturmaktır.\n\nBodrum Sonsuz Sanat";
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
  const aktifTelafi = activeTelafiRecords(student.telafi_records);
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
  if (breakdown.homeworkApplicable === false) lines.push("Önceki ödev: Bu ders için değerlendirilecek ödev yoktu");
  else lines.push("Önceki ödev: "+homeworkStatusLabel(record?.evaluatedHomeworkStatus)+" ("+(breakdown.homework ?? 0)+"/40)");
  lines.push("", "Ders Verim Puanı: "+fmtNumber(storedLessonScore(record) ?? 0)+"/100");
  if (record?.note || record?.doneNote) lines.push("", "Öğretmen notu: "+(record.note || record.doneNote));
  lines.push("", "Gelecek ders ödevi: "+(record?.homework || "Ödev verilmedi"));
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
    "Parça sonucu: "+displayPieceResult(evaluation.pieceResult, evaluation.pieceLabel)+" ("+evaluation.pieceScore+"/100)",
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

function OdemeAlSheet({ student, onClose, onÖdemeAl, saving=false }) {
  const [date, setDate] = useState(turkeyDateKey());
  const packageInfo = currentPaymentDueInfo(student) || nextPayablePackageInfo(student);
  const ekDersler = unpaidEkDersler(student);
  const ekToplam = ekDersler.reduce((sum,e)=>sum+(e.fee||ekDersFee(student)),0);
  const paketDersSayisi = packageInfo?.packageSize || getPackageLessonCount(student);
  const paketTutar = packageInfo ? (student.ucret||0) * (paketDersSayisi / PAYMENT_PACK_SIZE) : 0;
  const toplam = paketTutar + ekToplam;
  return (
    <Sheet title="Ödeme Al" subtitle={student.name} onClose={()=>{ if(!saving) onClose(); }}>
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
      <input style={INP} type="date" value={date} disabled={saving} onChange={e=>setDate(e.target.value)} />
      <div style={{ marginTop:16 }}>
        {toplam > 0 ? <Btn bg="#10b981" disabled={saving} onClick={async() => { if(await onÖdemeAl(student.id, date)) onClose(); }}>{saving ? "Kaydediliyor…" : "Ödemeyi Kaydet"}</Btn> : <p style={{ margin:"0 0 12px", fontSize:13, color:"#999", fontWeight:700, textAlign:"center" }}>Kaydedilecek ödeme yok</p>}
        <Btn bg="#111" outline disabled={saving} onClick={onClose}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function ZamSheet({ student, onClose, onSave }) {
  const [fee, setFee] = useState(student.ucret || "");
  const [date, setDate] = useState(turkeyDateKey());
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

function WeekCal({ students, singleLessons=[], offset, setOffset, onStudentClick, onSingleLessonClick=()=>{}, onExtraLessonClick=()=>{}, teacherName = "", calendarMoveReadScope=null, availabilityOpen=false, onAvailabilityClose=()=>{} }) {
  const moveRequests = calendarMoveReadRequests(students,calendarMoveReadScope,offset);
  const moveReadKey = JSON.stringify([calendarMoveReadScope,moveRequests]);
  const moveReadKeyRef = useRef(moveReadKey);
  moveReadKeyRef.current = moveReadKey;
  const [moveReadResult,setMoveReadResult] = useState(null);
  const [moveReadRetry,setMoveReadRetry] = useState(0);
  useEffect(()=>{
    let cancelled = false;
    const isCurrent = () => !cancelled && moveReadKeyRef.current===moveReadKey;
    if (!moveRequests.length) { setMoveReadResult(null); return ()=>{ cancelled=true; }; }
    setMoveReadResult({ key:moveReadKey, state:"loading", sources:[] });
    readCalendarMoveEvidence(supabase,moveRequests,calendarMoveReadScope,isCurrent)
      .then(sources=>{ if (isCurrent() && sources) setMoveReadResult({ key:moveReadKey, state:"ready", sources }); })
      .catch(()=>{ if (isCurrent()) setMoveReadResult({ key:moveReadKey, state:"error", sources:[] }); });
    return ()=>{ cancelled=true; };
  },[moveReadKey,moveReadRetry]);
  const verifiedMoveSources = moveReadResult?.key===moveReadKey && moveReadResult.state==="ready" ? moveReadResult.sources : [];
  const moveReadState = moveRequests.length ? (moveReadResult?.key===moveReadKey ? moveReadResult.state : "loading") : "";
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
  // Read-only observation: uses the existing source filters, never changes calendar items.
  const availabilityIntervals = [];
  let availabilityInvalid = false;
  const observeAvailability = (date,time,duration,kind) => {
    if (!availabilityOpen || kind==="telafi-slot") return;
    const interval = calendarAvailabilityInterval(date,time,duration);
    if (interval) availabilityIntervals.push(interval);
    else availabilityInvalid = true;
  };
  const addItem = item => {
    const [hour, minute] = String(item.time || "").split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
    const row = Math.round(((hour * 60 + minute) - startMinutes) / slotMinutes);
    if (row < 0 || row >= rowCount) return;
    const duration = Math.max(15, parseInt(item.duration)||45);
    calendarItems.push({ ...item, durationMinutes:duration, row, span:Math.max(1, Math.min(rowCount-row, Math.ceil(duration/slotMinutes))) });
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
    const lessonIdCounts = new Map();
    schedule.forEach(lesson=>lessonIdCounts.set(lesson.id,(lessonIdCounts.get(lesson.id) || 0)+1));
    const movedSourceKeys = new Set(schedule.flatMap(lesson => {
      if (lessonIdCounts.get(lesson.id) !== 1) return [];
      const origin = singleLessonMoveOrigin(lesson);
      const verified = verifiedMoveSources.find(source=>source.studentId===student.id && source.lessonId===lesson.id);
      return origin ? [origin.localDate+"|"+origin.time,...(verified?.keys || [])] : [];
    }));

    schedule.forEach(lesson => {
      if (teacherName && teacherForDate(student, lesson.date, lesson) !== teacherName) return;
      observeAvailability(lesson.date,lessonTime(student,lesson),getLessonDuration(student,lesson),lesson.status==="telafi"?"telafi-slot":"normal");
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
      if (movedSourceKeys.has(turkeyDateKey(slotDate)+"|"+slot.time)) return;
      observeAvailability(slotDate,slot.time,getLessonDuration(student),packageEnded?"package-ended":"normal");
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
      observeAvailability(plannedAt,timeFromISO(plannedAt),record.plannedDurationMinutes || record.planned_duration_minutes || getLessonDuration(student),"planned-telafi");
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

    (student.ek_dersler || []).forEach(extra => {
      if (isStudentDeleted(student) || !extra.date || !shouldShowExtraLessonOnCalendar(extra)) return;
      if (teacherName && teacherForDate(student, extra.date, extra) !== teacherName) return;
      const startAt = new Date(extra.date);
      if (isNaN(startAt.getTime())) return;
      observeAvailability(startAt,timeFromISO(startAt),getLessonDuration(student,extra),"extra-lesson");
      const dayIndex = dayKeyToIndex.get(localDateKey(startAt));
      if (dayIndex === undefined) return;
      addItem({
        key:"extra-lesson-"+student.id+"-"+(extra.id || localDateKey(startAt)+"-"+timeFromISO(startAt)),
        student,
        extraLesson:extra,
        dayIndex,
        time:timeFromISO(startAt),
        duration:getLessonDuration(student, extra),
        kind:"extra-lesson",
        subtitle:"Ek Ders · "+ekDersTypeLabel(extra.type),
      });
    });
  });

  singleLessons.forEach(lesson=>{
    if (lesson.deleted_at || !["planned","completed"].includes(lesson.lesson_status) || !lesson.starts_at) return;
    if (teacherName && lesson.teacher_name!==teacherName) return;
    const startAt = new Date(lesson.starts_at);
    if (isNaN(startAt.getTime())) return;
    observeAvailability(startAt,timeFromISO(startAt),lesson.duration_minutes || 45,"single-lesson");
    const dayIndex = dayKeyToIndex.get(localDateKey(startAt));
    if (dayIndex===undefined) return;
    addItem({
      key:"single-lesson-"+lesson.id,
      singleLesson:lesson,
      displayName:lesson.participant_name,
      dayIndex,
      time:timeFromISO(startAt),
      duration:lesson.duration_minutes || 45,
      kind:"single-lesson",
      subtitle:singleLessonTypeLabel(lesson)+" · "+(lesson.lesson_mode==="online"?"Online":"Fiziki"),
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
    "extra-lesson":{ background:"#db2777", border:"#9d174d", opacity:1 },
    "single-lesson":{ background:"#7c3aed", border:"#5b21b6", opacity:1 },
  };
  return (
    <div>
      <style>{`
        .week-calendar-v66 { overflow:hidden; background:#fff; border:1px solid #e5e7eb; border-radius:14px; }
        .week-calendar-v66-grid { display:grid; grid-template-columns:48px repeat(7,minmax(0,1fr)); grid-template-rows:48px repeat(${rowCount},14px); width:100%; min-width:0; position:relative; }
        .week-calendar-v66-event { min-width:0; height:100%; border:0; border-left:4px solid; border-radius:7px; padding:3px 5px; color:#fff; font-family:inherit; text-align:left; overflow:hidden; cursor:pointer; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; gap:3px; }
        .week-calendar-v66-name,.week-calendar-v66-time,.week-calendar-v66-meta { display:block; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .week-calendar-v66-name { font-size:10px; line-height:1.05; font-weight:800; letter-spacing:-.1px; }
        .week-calendar-v66-time { font-size:9px; line-height:1; font-weight:700; font-variant-numeric:tabular-nums; }
        .week-calendar-v66-meta { font-size:7px; line-height:1; font-weight:750; opacity:.9; }
        .week-calendar-v66-event-compact { padding:1px 4px; gap:1px; }
        .week-calendar-v66-event-compact .week-calendar-v66-name { font-size:9px; line-height:1; }
        .week-calendar-v66-compact-line { display:block; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:6.5px; line-height:1; font-weight:750; letter-spacing:-.12px; font-variant-numeric:tabular-nums; }
        @media (max-width:700px) {
          .week-calendar-v66-grid { grid-template-columns:42px repeat(7,minmax(0,1fr)); }
          .week-calendar-v66-event { border-left-width:2px; padding:3px 2px; }
          .week-calendar-v66-name { font-size:8px; }
          .week-calendar-v66-time { font-size:7px; }
          .week-calendar-v66-event-compact { padding:1px 2px; }
          .week-calendar-v66-event-compact .week-calendar-v66-name { font-size:7px; }
          .week-calendar-v66-compact-line { font-size:5.5px; }
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
          ["#db2777",1,"Ek Ders"],
          ["#7c3aed",1,"Tek Ders"],
        ].map(([color,opacity,text])=><span key={text} style={{ display:"inline-flex", alignItems:"center", gap:5 }}><span style={{ width:20, height:10, borderRadius:3, background:color, opacity }} />{text}</span>)}
      </div>
      {["loading","error"].includes(moveReadState) ? <div role="status" style={{ marginBottom:10, padding:"8px 12px", borderRadius:8, background:moveReadState==="error"?"#fff7ed":"#f8fafc", color:moveReadState==="error"?"#9a3412":"#64748b", fontSize:12 }}>
        {moveReadState==="error" ? <>Taşınan derslerin eski program kartları doğrulanamadı; takvimde fazladan kart olabilir. <button onClick={()=>setMoveReadRetry(value=>value+1)} style={{ background:"none", border:"none", color:"inherit", textDecoration:"underline", cursor:"pointer", fontFamily:"inherit" }}>Yalnız takvimi yeniden kontrol et</button></> : moveReadState==="loading" ? "Taşınan derslerin takvim konumları kontrol ediliyor…" : null}
      </div> : null}
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
              const displayName = item.displayName || item.student?.name || "Ders";
              const compact = item.durationMinutes===30;
              const compactSpecialLessonLine = compact && (item.singleLesson || item.extraLesson)
                ? item.singleLesson
                  ? item.time+" · "+(isTrialSingleLesson(item.singleLesson)?"Deneme":"Tek Ders")+" · "+(item.singleLesson.lesson_mode==="online"?"Online":"Fiziki")
                  : item.time+" · Ek Ders · "+ekDersTypeLabel(item.extraLesson.type)
                : "";
              return <button key={item.key} className={"week-calendar-v66-event"+(compact?" week-calendar-v66-event-compact":"")} onClick={()=>item.singleLesson?onSingleLessonClick(item.singleLesson):item.extraLesson?onExtraLessonClick(item.student,item.extraLesson):onStudentClick(item.student)} style={{ flex:1, background:colors.background, borderLeftColor:colors.border, opacity:colors.opacity }} aria-label={displayName+" · "+item.time+(item.subtitle?" · "+item.subtitle:"")}>
                <span className="week-calendar-v66-name" style={{ fontSize:displayName.length>16?8:displayName.length>12?9:undefined }}>{displayName}</span>
                {compactSpecialLessonLine ? <span className="week-calendar-v66-compact-line">{compactSpecialLessonLine}</span> : <>
                  <span className="week-calendar-v66-time">{item.time}</span>
                  {item.singleLesson || item.extraLesson ? <span className="week-calendar-v66-meta">{item.subtitle}</span> : null}
                </>}
              </button>;
            })}
          </div>)}
        </div>
      </div>
      {availabilityOpen ? <CalendarAvailabilitySheet key={JSON.stringify([calendarMoveReadScope,offset])} days={days} intervals={availabilityIntervals} invalid={availabilityInvalid} moveReadState={moveReadState} onRetry={()=>setMoveReadRetry(value=>value+1)} onClose={onAvailabilityClose} /> : null}
    </div>
  );
}


// Availability is a read-only projection of WeekCal's selected sources, not a booking engine.
function calendarAvailabilityStarts(dayIndex) {
  const first = dayIndex<3 ? 14*60+45 : dayIndex<5 ? 14*60+30 : 10*60;
  return Array.from({length:7},(_,index)=>{
    const minutes=first+index*45;
    return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0");
  });
}
function calendarAvailabilityInterval(date,time,duration) {
  const start=new Date(date);
  const match=/^(\d{2}):(\d{2})$/.exec(String(time || ""));
  const minutes=Number(duration);
  if (isNaN(start.getTime()) || !match || Number(match[1])>23 || Number(match[2])>59 || !Number.isFinite(minutes) || minutes<=0) return null;
  start.setHours(Number(match[1]),Number(match[2]),0,0);
  const end=start.getTime()+minutes*60000;
  return Number.isFinite(end) ? {start:start.getTime(),end} : null;
}
function calendarAvailabilityModel(days,intervals,generatedAt=new Date()) {
  if (days.length!==7 || days.some(day=>isNaN(new Date(day).getTime())) || intervals.some(item=>!Number.isFinite(item.start)||!Number.isFinite(item.end)||item.end<=item.start)) return null;
  const dayNames=["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
  const dates=days.map(day=>new Date(day));
  const weekLabel=dates[0].toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"})+" - "+dates[6].toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"});
  return {
    weekLabel,
    generatedLabel:new Date(generatedAt).toLocaleString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).replace(/\s/g," "),
    days:dates.map((day,index)=>({
      dateKey:localDateKey(day),
      dayName:dayNames[index],
      dateLabel:day.toLocaleDateString("tr-TR",{day:"numeric",month:"long"}),
      times:calendarAvailabilityStarts(index).filter(time=>{
        const slot=calendarAvailabilityInterval(day,time,45);
        return !intervals.some(item=>item.start<slot.end && item.end>slot.start);
      }),
    })),
  };
}
function calendarAvailabilityText(model) {
  return [
    "Sonsuz Sanat - Uygun Ders Saatleri",
    model.weekLabel,
    "Her ders 45 dakikadır.",
    "",
    ...model.days.map(day=>day.dayName+" ("+day.dateLabel+"): "+(day.times.length?day.times.join(", "):"Uygun saat yok")),
    "",
    "Hazırlanma: "+model.generatedLabel,
    "Saatler mevcut takvime göredir; rezervasyon değildir. Randevu öncesi tekrar kontrol edilir.",
  ].join("\n");
}

/*
Embedded TrueType subset for Turkish, selectable vector PDF text.
Generated only from the bundled Liberation Sans font; no remote font request.
Digitized data copyright (c) 2010 Google Corporation
	with Reserved Font Arimo, Tinos and Cousine.
Copyright (c) 2012 Red Hat, Inc.
	with Reserved Font Name Liberation.

This Font Software is licensed under the SIL Open Font License,
Version 1.1.

This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE The goals of the Open Font License (OFL) are to stimulate
worldwide development of collaborative font projects, to support the font
creation efforts of academic and linguistic communities, and to provide
a free and open framework in which fonts may be shared and improved in
partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves.
The fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works.  The fonts and derivatives,
however, cannot be released under any other type of license.  The
requirement for fonts to remain under this license does not apply to
any document created using the fonts or their derivatives.

 

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such.
This may include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components
as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting ? in part or in whole ?
any of the components of the Original Version, by changing formats or
by porting the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical writer
or other person who contributed to the Font Software.


PERMISSION & CONDITIONS

Permission is hereby granted, free of charge, to any person obtaining a
copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,in
   Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
   redistributed and/or sold with any software, provided that each copy
   contains the above copyright notice and this license. These can be
   included either as stand-alone text files, human-readable headers or
   in the appropriate machine-readable metadata fields within text or
   binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
   Name(s) unless explicit written permission is granted by the
   corresponding Copyright Holder. This restriction only applies to the
   primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
   Software shall not be used to promote, endorse or advertise any
   Modified Version, except to acknowledge the contribution(s) of the
   Copyright Holder(s) and the Author(s) or with their explicit written
   permission.

5) The Font Software, modified or unmodified, in part or in whole, must
   be distributed entirely under this license, and must not be distributed
   under any other license. The requirement for fonts to remain under
   this license does not apply to any document created using the Font
   Software.


 
TERMINATION
This license becomes null and void if any of the above conditions are not met.

 

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT.  IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER
DEALINGS IN THE FONT SOFTWARE.
*/
const CALENDAR_AVAILABILITY_PDF_FONT = {"characters":" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÇçĞğİıÖöŞşÜü","widths":[277.832,277.832,354.98,556.152,556.152,889.16,666.992,190.918,333.008,333.008,389.16,583.984,277.832,333.008,277.832,277.832,556.152,556.152,556.152,556.152,556.152,556.152,556.152,556.152,556.152,556.152,277.832,277.832,583.984,583.984,583.984,556.152,1015.137,666.992,666.992,722.168,722.168,666.992,610.84,777.832,722.168,277.832,500,666.992,556.152,833.008,722.168,777.832,666.992,777.832,722.168,666.992,610.84,722.168,666.992,943.848,666.992,666.992,610.84,277.832,277.832,277.832,469.238,556.152,333.008,556.152,556.152,500,556.152,556.152,277.832,556.152,556.152,222.168,222.168,500,222.168,833.008,556.152,556.152,556.152,556.152,333.008,500,277.832,556.152,500,722.168,500,500,500,333.984,259.766,333.984,583.984,722.168,500,777.832,556.152,277.832,277.832,777.832,556.152,666.992,500,722.168,556.152],"bbox":[-203.125,-303.223,1050.293,910.156],"ascent":728.027,"descent":-210.449,"capHeight":687.988,"font":"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bwBuACAAUwBhAG4AcwAAQXNjZW5kZXIgLSBMaWJlcmF0aW9uIFNhbnMAAEwAaQBiAGUAcgBhAHQAaQBvAG4AIABTAGEAbgBzAABMaWJlcmF0aW9uIFNhbnMAAFYAZQByAHMAaQBvAG4AIAAxAC4AMAA3AC4ANAAAVmVyc2lvbiAxLjA3LjQAAEwAaQBiAGUAcgBhAHQAaQBvAG4AUwBhAG4AcwAATGliZXJhdGlvblNhbnMAAEwAaQBiAGUAcgBhAHQAaQBvAG4AIABpAHMAIABhACAAdAByAGEAZABlAG0AYQByAGsAIABvAGYAIABSAGUAZAAgAEgAYQB0ACwAIABJAG4AYwAuACAAcgBlAGcAaQBzAHQAZQByAGUAZAAgAGkAbgAgAFUALgBTAC4AIABQAGEAdABlAG4AdAAgAGEAbgBkACAAVAByAGEAZABlAG0AYQByAGsAIABPAGYAZgBpAGMAZQAgAGEAbgBkACAAYwBlAHIAdABhAGkAbgAgAG8AdABoAGUAcgAgAGoAdQByAGkAcwBkAGkAYwB0AGkAbwBuAHMALgAATGliZXJhdGlvbiBpcyBhIHRyYWRlbWFyayBvZiBSZWQgSGF0LCBJbmMuIHJlZ2lzdGVyZWQgaW4gVS5TLiBQYXRlbnQgYW5kIFRyYWRlbWFyayBPZmZpY2UgYW5kIGNlcnRhaW4gb3RoZXIganVyaXNkaWN0aW9ucy4AAEEAcwBjAGUAbgBkAGUAcgAgAEMAbwByAHAAbwByAGEAdABpAG8AbgAAQXNjZW5kZXIgQ29ycG9yYXRpb24AAFMAdABlAHYAZQAgAE0AYQB0AHQAZQBzAG8AbgAAU3RldmUgTWF0dGVzb24AAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBhAHMAYwBlAG4AZABlAHIAYwBvAHIAcAAuAGMAbwBtAC8AAGh0dHA6Ly93d3cuYXNjZW5kZXJjb3JwLmNvbS8AAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBhAHMAYwBlAG4AZABlAHIAYwBvAHIAcAAuAGMAbwBtAC8AdAB5AHAAZQBkAGUAcwBpAGcAbgBlAHIAcwAuAGgAdABtAGwAAGh0dHA6Ly93d3cuYXNjZW5kZXJjb3JwLmNvbS90eXBlZGVzaWduZXJzLmh0bWwAAEwAaQBjAGUAbgBzAGUAZAAgAHUAbgBkAGUAcgAgAHQAaABlACAATABpAGIAZQByAGEAdABpAG8AbgAgAEYAbwBuAHQAcwAgAGwAaQBjAGUAbgBzAGUALAAgAHMAZQBlACAAaAB0AHQAcABzADoALwAvAGYAZQBkAG8AcgBhAHAAcgBvAGoAZQBjAHQALgBvAHIAZwAvAHcAaQBrAGkALwBMAGkAYwBlAG4AcwBpAG4AZwAvAEwAaQBiAGUAcgBhAHQAaQBvAG4ARgBvAG4AdABMAGkAYwBlAG4AcwBlAABMaWNlbnNlZCB1bmRlciB0aGUgTGliZXJhdGlvbiBGb250cyBsaWNlbnNlLCBzZWUgaHR0cHM6Ly9mZWRvcmFwcm9qZWN0Lm9yZy93aWtpL0xpY2Vuc2luZy9MaWJlcmF0aW9uRm9udExpY2Vuc2UAAGgAdAB0AHAAcwA6AC8ALwBmAGUAZABvAHIAYQBwAHIAbwBqAGUAYwB0AC4AbwByAGcALwB3AGkAawBpAC8ATABpAGMAZQBuAHMAaQBuAGcALwBMAGkAYgBlAHIAYQB0AGkAbwBuAEYAbwBuAHQATABpAGMAZQBuAHMAZQAAaHR0cHM6Ly9mZWRvcmFwcm9qZWN0Lm9yZy93aWtpL0xpY2Vuc2luZy9MaWJlcmF0aW9uRm9udExpY2Vuc2UAAAAAAwAAAAAAAP+9AJYAAAAAAAAAAAAAAAAAAAAAAAAAALEJQL4BBwABAB8BBwABAJ8BBECOAcD9Aa/9AQD9AQpP+wEg+wH1UCgf8kYoH/FGKh/wRisfX+9/7wIP70/vX++P76/vBQvl5B4f4+JGHw/iAUDiRhYf4eBGH8/g3+Dv4ANA4DM2RuBGGB/dPd9V3j0DVd8BA1XcA/8fD9Uf1QIP1R/VAkDKGBtGz8IBvcA8H8FQJh+8vigf/7kBULhwuIC4A7j/wED/uBIyRh+3P7dPt2+3f7eft6+3B3CyoLKwsgMPsgGQtQGwtQEPtQEID7M/s++zA4CwkLACsLDAsNCwAy+vP68CoK2wrQLArdCtAi+sP6wCn6sBwKrQqgJPqY+pAi+pb6m/qf+pBJybJB9QmwFvlgG/lgGWRh0flZQXH3+Uj5T/lAMwkUCRAoCRAXCPgI8CkI8BwI/QjwJPjF+Mb4wDhkb/H5+FAYSDMR90cz8fc1AmH29uPB9uRjUfGgEYVRkzGFUHMwNVBgP/H2BQJh9fUCYfXEYxH1taSB9aRjEfEzISVQUBA1UEMgNVbwMBDwM/AwLvUf9RAkBRNThGQFElKEbPQFRQAUlGIB9IRjUfR0Y1H69GAd9G70YCgEYBFjIVVREBD1UQMg9VAgEAVQEAAR8fDz8PXw9/DwQPDy8PTw9vD48P3w//Dwc/D38P7w8DbwABgBYBBQG4AZCxVFMrK0u4B/9SS7AHUFuwAYiwJVOwAYiwQFFasAaIsABVWltYsQEBjlmFjY0AQh1LsDJTWLBgHVlLsGRTWLBAHVlLsIBTWLAQHbEWAEJZdHN0dSsrKysrAXN0dSsrKwB0Kytzc3UrKysBKysrACsrKysrKwErKwArKwErcysAdHN0dXN0cysBK3R1AHMrc3QBc3N0AHN0dHN0cwFec3N0c3MAcytzcwErACsBKwBzK3R1KysrKwErK3QrK15zKwArXnN0ASsrKwArc3Nec3NzAXNzcxheAAAA"};

function calendarAvailabilityPdfBytes(model) {
  // Only the anonymous export DTO is accepted. No student objects enter this writer.
  if (!model || model.days.length!==7 || model.days.some((day,index)=>
    day.dayName!==["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"][index] ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day.dateKey) || day.times.some(time=>!calendarAvailabilityStarts(index).includes(time))
  )) throw new Error("Uygun saatler çıktısı doğrulanamadı.");
  const font=CALENDAR_AVAILABILITY_PDF_FONT;
  const encoder=new TextEncoder();
  const encodeText=value=>Array.from(String(value)).map(character=>{
    const index=font.characters.indexOf(character);
    if (index<0) throw new Error("PDF karakteri desteklenmiyor.");
    return index.toString(16).padStart(2,"0");
  }).join("");
  const width=(value,size)=>Array.from(String(value)).reduce((sum,character)=>{
    const index=font.characters.indexOf(character);
    if (index<0) throw new Error("PDF karakteri desteklenmiyor.");
    return sum+font.widths[index]*size/1000;
  },0);
  const commands=[];
  const text=(value,x,y,size=12,color="0.13 0.16 0.22")=>commands.push("BT /F1 "+size+" Tf "+color+" rg 1 0 0 1 "+x.toFixed(2)+" "+y.toFixed(2)+" Tm <"+encodeText(value)+"> Tj ET");
  const centered=(value,x,y,size,color)=>text(value,x-width(value,size)/2,y,size,color);
  const rect=(x,y,w,h,color)=>commands.push(color+" rg "+[x,y,w,h].map(n=>n.toFixed(2)).join(" ")+" re f");
  const line=(x1,y1,x2,y2,color="0.88 0.90 0.93")=>commands.push(color+" RG 0.6 w "+x1+" "+y1+" m "+x2+" "+y2+" l S");
  const pageWidth=841.89,pageHeight=595.28,margin=32,columnWidth=(pageWidth-margin*2)/7;
  text("SONSUZ SANAT",margin,548,13,"0.36 0.24 0.77");
  text("Uygun Ders Saatleri",margin,513,27,"0.16 0.13 0.28");
  text(model.weekLabel,margin,487,13);
  text("45 dakikalık dersler",margin,464,11,"0.40 0.44 0.50");
  const count=model.days.reduce((sum,day)=>sum+day.times.length,0);
  text(count+" uygun saat",pageWidth-margin-width(count+" uygun saat",12),513,12,"0.10 0.43 0.29");
  rect(margin,100,pageWidth-margin*2,344,"0.985 0.987 0.992");
  rect(margin,390,pageWidth-margin*2,54,"0.95 0.93 0.99");
  for (let index=0;index<=7;index++) line(margin+columnWidth*index,100,margin+columnWidth*index,444);
  for (const y of [100,390,444]) line(margin,y,pageWidth-margin,y);
  model.days.forEach((day,index)=>{
    const x=margin+index*columnWidth,center=x+columnWidth/2;
    centered(day.dayName,center,423,12,"0.30 0.23 0.47");
    centered(day.dateLabel,center,404,10,"0.43 0.40 0.53");
    day.times.forEach((time,timeIndex)=>{
      const y=349-timeIndex*37;
      rect(x+12,y-10,columnWidth-24,29,"0.88 0.96 0.92");
      centered(time,center,y,14,"0.10 0.43 0.29");
    });
    if (!day.times.length) {
      centered("Uygun",center,340,11,"0.50 0.53 0.58");
      centered("saat yok",center,323,11,"0.50 0.53 0.58");
    }
  });
  text("Hazırlanma: "+model.generatedLabel,margin,73,9,"0.40 0.44 0.50");
  text("Saatler mevcut takvime göredir; rezervasyon değildir. Randevu öncesi tekrar kontrol edilir.",margin,52,9,"0.40 0.44 0.50");
  const fontBytes=Uint8Array.from(atob(font.font),character=>character.charCodeAt(0));
  const cmapEntries=Array.from(font.characters).map((character,index)=>"<"+index.toString(16).padStart(2,"0")+"> <"+character.codePointAt(0).toString(16).padStart(4,"0")+">");
  const cmap=["/CIDInit /ProcSet findresource begin","12 dict begin","begincmap","/CIDSystemInfo << /Registry (Sonsuz) /Ordering (Unicode) /Supplement 0 >> def","/CMapName /SonsuzAvailabilityUnicode def","/CMapType 2 def","1 begincodespacerange","<00> <FF>","endcodespacerange"];
  for(let index=0;index<cmapEntries.length;index+=100) {
    const batch=cmapEntries.slice(index,index+100);
    cmap.push(batch.length+" beginbfchar",...batch,"endbfchar");
  }
  cmap.push("endcmap","CMapName currentdict /CMap defineresource pop","end","end");
  const stream=(data,extra="")=>concatPdfBytes([encoder.encode("<< /Length "+data.length+extra+" >>\nstream\n"),data,encoder.encode("\nendstream")]);
  const objects=[
    encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    encoder.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    encoder.encode("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+pageWidth+" "+pageHeight+"] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"),
    stream(encoder.encode(commands.join("\n"))),
    encoder.encode("<< /Type /Font /Subtype /TrueType /BaseFont /SONSUZ+Availability /FirstChar 0 /LastChar "+(font.characters.length-1)+" /Widths ["+font.widths.join(" ")+"] /FontDescriptor 6 0 R /ToUnicode 8 0 R >>"),
    encoder.encode("<< /Type /FontDescriptor /FontName /SONSUZ+Availability /Flags 4 /FontBBox ["+font.bbox.join(" ")+"] /ItalicAngle 0 /Ascent "+font.ascent+" /Descent "+font.descent+" /CapHeight "+font.capHeight+" /StemV 80 /FontFile2 7 0 R >>"),
    stream(fontBytes," /Length1 "+fontBytes.length),
    stream(encoder.encode(cmap.join("\n"))),
  ];
  const parts=[encoder.encode("%PDF-1.4\n")],offsets=[0];
  let offset=parts[0].length;
  objects.forEach((object,index)=>{
    offsets.push(offset);
    const part=concatPdfBytes([encoder.encode((index+1)+" 0 obj\n"),object,encoder.encode("\nendobj\n")]);
    parts.push(part);offset+=part.length;
  });
  const xref=offset;
  parts.push(encoder.encode("xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n"+offsets.slice(1).map(value=>String(value).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF"));
  return concatPdfBytes(parts);
}

function CalendarAvailabilitySheet({days,intervals,invalid,moveReadState,onRetry,onClose}) {
  const dialogRef=useRef(null);
  const aliveRef=useRef(true);
  const exportBusyRef=useRef(false);
  const [feedback,setFeedback]=useState("");
  const [copyBusy,setCopyBusy]=useState(false);
  const blocked=invalid || ["loading","error"].includes(moveReadState);
  const model=blocked?null:calendarAvailabilityModel(days,intervals);
  const signature=JSON.stringify(model?.days || [moveReadState,invalid]);
  const currentSignatureRef=useRef(signature);
  currentSignatureRef.current=signature;
  useEffect(()=>{ setFeedback(""); },[signature]);
  useEffect(()=>{
    aliveRef.current=true;
    const previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    dialogRef.current?.querySelector("button")?.focus();
    const onKey=event=>{
      if (event.key==="Escape") { event.preventDefault();onClose();return; }
      if (event.key!=="Tab") return;
      const buttons=Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled)") || []);
      if (!buttons.length) return;
      const first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKey);
    return ()=>{ aliveRef.current=false;document.body.style.overflow=overflow;document.removeEventListener("keydown",onKey);if(previous?.isConnected)previous.focus(); };
  },[onClose]);
  const copy=async()=>{
    if (!model || exportBusyRef.current) return;
    const startedSignature=signature;
    exportBusyRef.current=true;setCopyBusy(true);setFeedback("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(calendarAvailabilityText(calendarAvailabilityModel(days,intervals)));
      if (aliveRef.current && currentSignatureRef.current===startedSignature) setFeedback("Metin kopyalandı.");
    } catch {
      if (aliveRef.current && currentSignatureRef.current===startedSignature) setFeedback("Kopyalama izni alınamadı. PDF'yi indirip gönderebilirsiniz.");
    } finally {
      exportBusyRef.current=false;if(aliveRef.current)setCopyBusy(false);
    }
  };
  const download=()=>{
    if (!model || exportBusyRef.current) return;
    let url="",link=null;
    try {
      const freshModel=calendarAvailabilityModel(days,intervals);
      const bytes=calendarAvailabilityPdfBytes(freshModel);
      url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
      link=document.createElement("a");link.href=url;
      link.download="Sonsuz-Sanat-Uygun-Saatler-"+freshModel.days[0].dateKey+".pdf";
      document.body.appendChild(link);link.click();setFeedback("PDF indirme başlatıldı.");
    } catch { setFeedback("PDF hazırlanamadı. Lütfen tekrar deneyin."); }
    finally { link?.remove();if(url)window.setTimeout(()=>URL.revokeObjectURL(url),10000); }
  };
  return <div className="crm-availability-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <style>{`
      .crm-availability-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(24,18,44,.45);padding:24px;display:flex;align-items:center;justify-content:center;}
      .crm-availability-dialog{width:100%;max-width:1060px;max-height:calc(100dvh - 48px);overflow:auto;background:#fff;border-radius:22px;padding:28px;box-shadow:0 24px 80px rgba(24,18,44,.25);color:#292438;}
      .crm-availability-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;}
      .crm-availability-brand{margin:0 0 7px;color:#6a46c9;font-size:11px;font-weight:800;letter-spacing:1.7px;}
      .crm-availability-title{margin:0;font-size:27px;line-height:1.2;}
      .crm-availability-subtitle{margin:9px 0 0;color:#716b7e;font-size:13px;line-height:1.6;}
      .crm-availability-close{border:0;border-radius:10px;background:#f3f0f8;color:#514563;width:36px;height:36px;font-size:23px;cursor:pointer;flex-shrink:0;}
      .crm-availability-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:24px 0 13px;font-size:12px;color:#777182;}
      .crm-availability-count{color:#217653;font-weight:700;}
      .crm-availability-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid #e8e3f0;border-radius:14px;overflow:hidden;}
      .crm-availability-day{min-width:0;border-right:1px solid #e8e3f0;background:#fcfbfe;}
      .crm-availability-day:last-child{border-right:0;}
      .crm-availability-day-head{background:#f2edfb;padding:16px 5px;text-align:center;min-height:75px;box-sizing:border-box;}
      .crm-availability-day-head h3{margin:0;font-size:12px;line-height:1.5;color:#4f3c72;}
      .crm-availability-date{display:block;margin-top:4px;font-size:11px;color:#8b7b9e;}
      .crm-availability-times{padding:14px 10px;min-height:290px;display:flex;flex-direction:column;gap:9px;box-sizing:border-box;}
      .crm-availability-time{display:block;background:#e4f5ed;color:#217653;border:1px solid #cfebdd;border-radius:9px;padding:9px 2px;text-align:center;font-size:14px;line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums;}
      .crm-availability-empty{font-size:12px;line-height:1.6;text-align:center;color:#9690a0;margin:10px 0;}
      .crm-availability-note{margin:17px 0 0;color:#817a8f;font-size:11px;line-height:1.7;}
      .crm-availability-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;}
      .crm-availability-actions button{padding:11px 18px;border:1px solid #ded6ec;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#fff;color:#60468c;}
      .crm-availability-actions .crm-availability-pdf{background:#6440d7;border-color:#6440d7;color:#fff;}
      .crm-availability-actions button:disabled{opacity:.45;cursor:not-allowed;}
      .crm-availability-feedback{min-height:18px;margin:12px 0 0;color:#635477;font-size:12px;text-align:right;}
      .crm-availability-warning{margin-top:24px;padding:20px;background:#fff7ed;color:#9a3412;border-radius:12px;font-size:13px;line-height:1.7;}
      .crm-availability-warning button{display:block;margin-top:12px;background:#fff;border:1px solid #fed7aa;border-radius:8px;padding:9px 12px;color:inherit;font:inherit;cursor:pointer;}
      @media(max-width:760px){
        .crm-availability-backdrop{padding:10px;}
        .crm-availability-dialog{padding:20px 15px;border-radius:16px;max-height:calc(100dvh - 20px);}
        .crm-availability-title{font-size:23px;}
        .crm-availability-grid{grid-template-columns:1fr;}
        .crm-availability-day{border-right:0;border-bottom:1px solid #e8e3f0;}
        .crm-availability-day:last-child{border-bottom:0;}
        .crm-availability-day-head{min-height:0;text-align:left;padding:12px 14px;}
        .crm-availability-day-head h3{font-size:13px;display:inline;}
        .crm-availability-date{display:inline;margin-left:9px;}
        .crm-availability-times{min-height:0;flex-direction:row;flex-wrap:wrap;padding:12px 14px;gap:8px;}
        .crm-availability-time{min-width:62px;padding:9px 8px;font-size:13px;}
        .crm-availability-empty{margin:0;}
        .crm-availability-summary{align-items:flex-start;}
        .crm-availability-actions button{flex:1;padding:11px 8px;font-size:12px;}
      }
    `}</style>
    <div ref={dialogRef} className="crm-availability-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-availability-title">
      <div className="crm-availability-header"><div><p className="crm-availability-brand">SONSUZ SANAT</p><h2 id="crm-availability-title" className="crm-availability-title">Uygun Ders Saatleri</h2><p className="crm-availability-subtitle">{days[0].toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"})} - {days[6].toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"})}</p></div><button className="crm-availability-close" onClick={onClose} aria-label="Uygun saatleri kapat">×</button></div>
      {model ? <>
        <div className="crm-availability-summary"><span>Her ders 45 dakika</span><span className="crm-availability-count">{model.days.reduce((sum,day)=>sum+day.times.length,0)} uygun saat</span></div>
        <div className="crm-availability-grid">{model.days.map(day=><section className="crm-availability-day" key={day.dateKey} aria-label={day.dayName+" "+day.dateLabel}><div className="crm-availability-day-head"><h3>{day.dayName}</h3><span className="crm-availability-date">{day.dateLabel}</span></div><div className="crm-availability-times">{day.times.length?day.times.map(time=><span key={time} className="crm-availability-time">{time}</span>):<p className="crm-availability-empty">Uygun saat yok</p>}</div></section>)}</div>
        <p className="crm-availability-note">Saatler mevcut takvime göredir; rezervasyon değildir. Randevu öncesi tekrar kontrol edilir. Paylaşımda öğrenci bilgileri yer almaz.</p>
      </> : <div className="crm-availability-warning" role="status">{invalid?"Takvimdeki bir dersin tarih, saat veya süresi doğrulanamadı. Yanlış boş saat önermemek için liste ve dışa aktarma kapalı.":moveReadState==="error"?"Taşınan derslerin konumları doğrulanamadı. Yanlış boş saat önermemek için liste ve dışa aktarma kapalı.":"Taşınan derslerin konumları kontrol ediliyor. Liste doğrulama tamamlanınca açılacak."}{moveReadState==="error"?<button onClick={onRetry}>Yalnız takvimi yeniden kontrol et</button>:null}</div>}
      <div className="crm-availability-actions"><button onClick={copy} disabled={!model || copyBusy}>{copyBusy?"Kopyalanıyor…":"Metni Kopyala"}</button><button className="crm-availability-pdf" onClick={download} disabled={!model || copyBusy}>PDF İndir</button></div>
      <p className="crm-availability-feedback" role="status">{feedback}</p>
    </div>
  </div>;
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

function ÖğretmenlerPaneli({ students, teachers, singleLessons=[], onStudentClick, onSingleLessonClick, onExtraLessonClick, calendarMoveReadScope=null }) {
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
        <WeekCal students={students} singleLessons={singleLessons} offset={teacherWeekOffset} setOffset={setTeacherWeekOffset} onStudentClick={onStudentClick} onSingleLessonClick={onSingleLessonClick} onExtraLessonClick={onExtraLessonClick} teacherName={selectedTeacher.name} calendarMoveReadScope={calendarMoveReadScope} />
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
      if (isTodayPlannedTelafi(record)) {
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

function todayExtraLessons(students) {
  const lessons = [];
  (students || []).forEach(student => {
    if (student.frozen || isStudentLeft(student) || isStudentDeleted(student)) return;
    (student.ek_dersler || []).forEach(extra => {
      if (!extra?.date || (extra.status || "planned") !== "planned" || !isToday(extra.date)) return;
      lessons.push({ student, extra, time:timeFromISO(extra.date) });
    });
  });
  return lessons.sort((a,b)=>a.time.localeCompare(b.time) || a.student.name.localeCompare(b.student.name,"tr"));
}

function BugünEkDersleri({ students, onWA, onReminderToggle, onOpen }) {
  const lessons = todayExtraLessons(students);
  if (!lessons.length) return null;
  return (
    <AçılırBugünBölümü title={`Bugünkü Ek Dersler (${lessons.length})`} color="#be185d" style={{ background:"#fdf2f8", border:"1.5px solid #f9a8d4", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      {lessons.map(({student,extra,time}) => {
        const sent = !!lessonReminderSentInfo(student,{ id:extraLessonReminderRef(extra) });
        return (
        <div key={student.id+"-"+(extra.id || extra.date)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"9px 0", borderBottom:"1px solid #fce7f3" }}>
          <div onClick={()=>onOpen(student,extra)} style={{ minWidth:0, cursor:"pointer" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}><p style={{ margin:0, fontWeight:750, fontSize:14, color:"#111" }}>{student.name}</p><TonePill tone="special">Ek Ders</TonePill></div>
            <p style={{ margin:"3px 0 0", fontSize:12, color:"#be185d", fontWeight:700 }}>{time} · {student.instrument} · {ekDersTypeLabel(extra.type)}</p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:sent?"#059669":"#64748b", fontWeight:700 }}>{sent?"Hatırlatma gönderildi":"Hatırlatma bekliyor"}</p>
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {student.phone ? <button onClick={()=>onWA(student,extra)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>WA</button> : null}
            <button onClick={()=>onReminderToggle(student.id,extra,!sent)} style={{ background:sent?"#dcfce7":"#fff", color:sent?"#166534":"#475569", border:"1px solid #f9a8d4", borderRadius:10, padding:"7px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{sent?"Geri Al":"İşaretle"}</button>
          </div>
        </div>
      );})}
    </AçılırBugünBölümü>
  );
}

function BugünTekDersleri({ lessons, onWA, onReminderToggle, onOpen }) {
  const todayLessons = (lessons || [])
    .filter(lesson=>!lesson.deleted_at && lesson.lesson_status==="planned" && isToday(lesson.starts_at))
    .sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at) || a.participant_name.localeCompare(b.participant_name,"tr"));
  if (!todayLessons.length) return null;
  return (
    <AçılırBugünBölümü title={`Bugünkü Tek Dersler (${todayLessons.length})`} color="#6d28d9" style={{ background:"#faf5ff", border:"1.5px solid #c4b5fd", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      {todayLessons.map(lesson=>{
        const sent = !!lesson.reminder_sent_at;
        const trial = isTrialSingleLesson(lesson);
        return <div key={lesson.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #ede9fe" }}>
          <div onClick={()=>onOpen(lesson)} style={{ cursor:"pointer", minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}><p style={{ margin:0, fontWeight:750, fontSize:14, color:"#111" }}>{lesson.participant_name}</p><TonePill tone="special">{singleLessonTypeLabel(lesson)}</TonePill>{lesson.participant_kind==="guest" && !trial?<TonePill>Misafir</TonePill>:null}</div>
            <p style={{ margin:"3px 0 0", fontSize:12, color:"#6d28d9", fontWeight:700 }}>{timeFromISO(lesson.starts_at)} · {lesson.instrument} · {lesson.lesson_mode==="online"?"Online":"Fiziki"}</p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:sent?"#059669":"#64748b", fontWeight:700 }}>{sent?"Hatırlatma gönderildi":"Hatırlatma bekliyor"} · {singleLessonBillingLabel(lesson.billing_status)}</p>
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {lesson.participant_phone ? <button onClick={()=>onWA(lesson)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:700, cursor:"pointer" }}>WA</button> : null}
            <button onClick={()=>onReminderToggle(lesson,!sent)} style={{ background:sent?"#dcfce7":"#fff", color:sent?"#166534":"#475569", border:"1px solid #ddd6fe", borderRadius:10, padding:"7px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>{sent?"Geri Al":"İşaretle"}</button>
          </div>
        </div>;
      })}
    </AçılırBugünBölümü>
  );
}

function singleLessonTurkeyDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/Istanbul", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const part = type => parts.find(item=>item.type===type)?.value;
  return part("year")+"-"+part("month")+"-"+part("day");
}

function pendingSingleLessonResults(lessons, now = new Date()) {
  const today = singleLessonTurkeyDay(now);
  if (!today) return [];
  return (lessons || []).filter(lesson=>{
    if (!lesson || lesson.deleted_at || lesson.lesson_status!=="planned") return false;
    const day = singleLessonTurkeyDay(lesson.starts_at);
    return !!day && day < today;
  }).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at) || String(a.id).localeCompare(String(b.id)));
}

function singleLessonTransitionError(lesson, changes) {
  const nextStatus = changes.lesson_status ?? lesson.lesson_status;
  const nextBilling = changes.billing_status ?? lesson.billing_status;
  const changed = nextStatus!==lesson.lesson_status || nextBilling!==lesson.billing_status;
  if (changed && nextBilling==="paid" && ["no_show","cancelled"].includes(nextStatus)) {
    return lesson.billing_status==="paid"
      ? "Ödenmiş ders Gelmedi veya İptal yapılamaz. Önce Tek Ders ekranından ödemeyi geri alın."
      : "Gelmedi veya İptal durumundaki ders için ödeme alınamaz. Ders sonucunu kontrol edin.";
  }
  return "";
}

function SonuçBekleyenTekDersler({ lessons, busyIds={}, onStatus, onOpen, onManage }) {
  if (!lessons.length) return null;
  return <AçılırBugünBölümü title={`Sonuç Bekleyen Tek Dersler (${lessons.length})`} color="#b45309" style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
    <p style={{ margin:"0 0 10px", fontSize:12, color:"#92400e" }}>Önceki günlerden kalan derslerin sonucunu işaretleyin. Ücretsiz ve deneme dersleri de dahildir.</p>
    {lessons.map(lesson=>{
      const busy = !!busyIds[lesson.id];
      const paid = lesson.billing_status==="paid";
      return <div key={lesson.id} style={{ padding:"12px 0", borderTop:"1px solid #fde68a", opacity:busy?.65:1 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}><strong style={{ fontSize:14, overflowWrap:"anywhere" }}>{lesson.participant_name}</strong><TonePill tone="special">{singleLessonTypeLabel(lesson)}</TonePill><TonePill>{singleLessonBillingLabel(lesson.billing_status)}</TonePill></div>
        <p style={{ margin:"5px 0", fontSize:12, color:"#92400e" }}>{new Date(lesson.starts_at).toLocaleString("tr-TR", { timeZone:"Europe/Istanbul", day:"numeric", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" })} · {lesson.lesson_mode==="online"?"Online":"Fiziki"}</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:8 }}>
          {[ ["completed","Yapıldı","#dcfce7","#166534"], ["no_show","Gelmedi","#fee2e2","#991b1b"], ["cancelled","İptal","#f3f4f6","#475569"] ].map(([status,label,bg,color])=><button key={status} disabled={busy || (paid && status!=="completed")} onClick={()=>onStatus(lesson,status)} style={{ border:0, borderRadius:9, padding:"9px 12px", background:bg, color, fontWeight:800, cursor:"pointer", opacity:paid && status!=="completed"?.5:1 }}>{label}</button>)}
          <button disabled={busy} onClick={()=>onOpen(lesson)} style={{ border:"1px solid #ddd6fe", borderRadius:9, padding:"9px 12px", background:"#fff", color:"#6d28d9", fontWeight:750 }}>Dersi Aç</button>
        </div>
        {busy ? <p role="status" style={{ fontSize:12, color:"#92400e" }}>İşlem doğrulanıyor...</p> : null}
        {paid ? <p style={{ fontSize:12, color:"#92400e", margin:"8px 0 0" }}>Gelmedi veya İptal için önce ödemeyi geri alın. <button disabled={busy} onClick={onManage} style={{ border:0, background:"transparent", color:"#6d28d9", textDecoration:"underline", cursor:"pointer" }}>Tek Ders ekranına git</button></p> : null}
      </div>;
    })}
    <p style={{ margin:"10px 0 0", fontSize:12, color:"#92400e" }}>Yanlış sonucu Tek Ders → Tüm Kayıtlar → Planlandıya Geri Al ile düzeltebilirsiniz.</p>
  </AçılırBugünBölümü>;
}

function overdueSingleLessonPayments(lessons, now = new Date()) {
  const today = singleLessonTurkeyDay(now);
  if (!today) return [];
  return (lessons || []).filter(lesson=>{
    if (!lesson || lesson.deleted_at || lesson.lesson_status!=="completed" || lesson.billing_status!=="unpaid" || isTrialSingleLesson(lesson)) return false;
    const fee = Number(lesson.fee);
    if (!Number.isFinite(fee) || fee<=0) return false;
    const day = singleLessonTurkeyDay(lesson.starts_at);
    return !!day && day < today;
  }).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at) || String(a.id).localeCompare(String(b.id)));
}

function GecikenTekDersÖdemeleri({ lessons, now, busyIds={}, onPayment, onOpen }) {
  if (!lessons.length) return null;
  const today = singleLessonTurkeyDay(now);
  return <AçılırBugünBölümü title={`Geciken Tek Ders Ödemeleri (${lessons.length})`} color="#b91c1c" style={{ background:"#fff1f2", border:"1.5px solid #fda4af", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
    <p style={{ margin:"0 0 10px", fontSize:12, color:"#9f1239" }}>Önceki günlerde yapılmış ve ücreti henüz alınmamış Tek Dersler.</p>
    {lessons.map(lesson=>{
      const busy = !!busyIds[lesson.id];
      const day = singleLessonTurkeyDay(lesson.starts_at);
      const elapsed = Math.round((Date.parse(today+"T00:00:00Z")-Date.parse(day+"T00:00:00Z"))/86400000);
      return <div key={lesson.id} style={{ padding:"12px 0", borderTop:"1px solid #fecdd3", opacity:busy?.65:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}><strong style={{ fontSize:14, overflowWrap:"anywhere" }}>{lesson.participant_name}</strong><TonePill tone="special">Tek Ders</TonePill><TonePill tone="good">Yapıldı</TonePill></div>
        <p style={{ margin:"6px 0 0", fontSize:12, color:"#9f1239" }}>{new Date(lesson.starts_at).toLocaleString("tr-TR", { timeZone:"Europe/Istanbul", day:"numeric", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" })} · {lesson.lesson_mode==="online"?"Online":"Fiziki"}</p>
        <p style={{ margin:"5px 0 9px", fontSize:12, color:"#9f1239" }}>Ders tarihinden beri {elapsed} gün · <strong>{Number(lesson.fee).toLocaleString("tr-TR")} TL</strong></p>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          <button disabled={busy} onClick={()=>onPayment(lesson,"paid")} style={{ border:0, borderRadius:9, padding:"9px 12px", background:"#10b981", color:"#fff", fontWeight:800, cursor:busy?"wait":"pointer" }}>{busy?"İşlem doğrulanıyor...":"Ödeme Al"}</button>
          <button disabled={busy} onClick={()=>onOpen(lesson)} style={{ border:"1px solid #ddd6fe", borderRadius:9, padding:"9px 12px", background:"#fff", color:"#6d28d9", fontWeight:750 }}>Dersi Aç</button>
        </div>
      </div>;
    })}
    <p style={{ margin:"10px 0 0", fontSize:12, color:"#9f1239" }}>Ödeme alındığında bu listeden çıkar ve tahsil edildiği ayın Finans gelirine eklenir.</p>
  </AçılırBugünBölümü>;
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

function BugünÖdemeleri({ students, onÖdemeAl, paymentSavingId="", onMesaj, onStudentClick }) {
  const todayMid = midday();
  const [odemeModal, setÖdemeModal] = useState(null);
  const [odemeDate, setÖdemeDate] = useState(turkeyDateKey());

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
                <button onClick={() => { setÖdemeDate(turkeyDateKey()); setÖdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Yapıldı</button>
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
                  <button onClick={() => { setÖdemeDate(turkeyDateKey()); setÖdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Yapıldı</button>
                </div>
              </div>
            );
          })}
        </AçılırBugünBölümü>
      ) : null}
    </div>
    {odemeModal ? (
      <Sheet title="Ödeme Alındı" subtitle={odemeModal.name} onClose={() => { if(paymentSavingId!==odemeModal.id) setÖdemeModal(null); }}>
        <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Ödeme tarihi:</p>
        <input style={INP} type="date" value={odemeDate} disabled={paymentSavingId===odemeModal.id} onChange={e=>setÖdemeDate(e.target.value)} />
        <div style={{ marginTop:16 }}>
          <Btn bg="#10b981" disabled={paymentSavingId===odemeModal.id} onClick={async() => { if(await onÖdemeAl(odemeModal.id, odemeDate)) setÖdemeModal(null); }}>{paymentSavingId===odemeModal.id ? "Kaydediliyor…" : "Kaydet"}</Btn>
          <Btn bg="#111" outline disabled={paymentSavingId===odemeModal.id} onClick={() => setÖdemeModal(null)}>İptal</Btn>
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

function buildMonthlyInstitutionReport(students, teachers, expenses, targetMonth, branch, singleLessons=[]) {
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
      if (log.evaluation.pieceName) pieces.push({ student:student.name, name:log.evaluation.pieceName, result:displayPieceResult(log.evaluation.pieceResult, log.evaluation.pieceLabel, "") });
    });
  });

  const monthExpenses = (expenses || []).filter(expense=>expenseAppliesToMonth(expense,targetMonth));
  const expenseCategories = monthExpenses.reduce((acc,expense) => {
    const category = expense.category || "Diğer";
    acc[category] = (acc[category] || 0) + (Number(expense.amount) || 0);
    return acc;
  },{});
  const studentRevenue = payments.reduce((sum,payment)=>sum+payment.amount,0);
  const singleLessonPayments = singleLessonPaymentsForMonth(singleLessons,targetMonth);
  const singleLessonRevenue = singleLessonPayments.reduce((sum,payment)=>sum+(Number(payment.tutar)||0),0);
  const revenue = studentRevenue+singleLessonRevenue;
  const expenseTotal = monthExpenses.reduce((sum,expense)=>sum+(Number(expense.amount)||0),0);
  const operational = (students || []).filter(student=>!isStudentDeleted(student));
  const activeStudents = operational.filter(student=>studentWasActiveAt(student,monthEnd));
  const newStudents = operational.filter(student=>inMonth(student.lesson_start_date || student.lessonStartDate,targetMonth));
  const lessonAverage = lessonScores.length ? roundedScore(lessonScores.reduce((sum,score)=>sum+score,0)/lessonScores.length) : null;
  const periodAverage = periodEvaluations.length ? roundedScore(periodEvaluations.reduce((sum,evaluation)=>sum+(Number(evaluation.periodScore)||0),0)/periodEvaluations.length) : null;

  return {
    schemaVersion:2,
    branchCode:branch?.code || CURRENT_BRANCH_CODE,
    branchName:branch?.name || "Bodrum Sonsuz Sanat",
    key:monthReportKey(targetMonth),
    label:monthReportLabel(targetMonth),
    periodStart:monthReportDate(targetMonth),
    periodEnd:localDateKey(monthEnd),
    generatedAt:new Date().toISOString(),
    revenue,
    studentRevenue,
    singleLessonRevenue,
    expenseTotal,
    netProfit:revenue-expenseTotal,
    paymentCount:payments.length+singleLessonPayments.length,
    studentPaymentCount:payments.length,
    singleLessonPaymentCount:singleLessonPayments.length,
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
  return { ...(row?.report_data || {}), id:row?.id, branchId:row?.branch_id || "", reportMonth:row?.report_month, downloadedAt:row?.downloaded_at || null };
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
    ...(Number(report.schemaVersion)>=2 ? [`Paket ve Ek Ders: ${(Number(report.studentRevenue)||0).toLocaleString("tr-TR")} TL · Tek Ders: ${(Number(report.singleLessonRevenue)||0).toLocaleString("tr-TR")} TL`] : []),
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
    {Number(report.schemaVersion)>=2 ? <div style={{ ...SECTION, padding:"13px 14px" }}><p style={{ margin:"0 0 7px", fontSize:12, fontWeight:800 }}>Gelir Dağılımı</p><p style={{ margin:0, fontSize:12, color:"#64748b", lineHeight:1.6 }}>Paket ve Ek Ders: {(Number(report.studentRevenue)||0).toLocaleString("tr-TR")} TL · Tek Ders: {(Number(report.singleLessonRevenue)||0).toLocaleString("tr-TR")} TL</p></div> : null}
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

function singleLessonPaymentsForMonth(singleLessons, targetMonth) {
  return (singleLessons || [])
    .filter(lesson=>!lesson.deleted_at && lesson.billing_status==="paid" && lesson.paid_on)
    .filter(lesson=>{
      const paymentDate = new Date(lesson.paid_on+"T12:00:00");
      return !isNaN(paymentDate.getTime()) && paymentDate.getFullYear()===targetMonth.getFullYear() && paymentDate.getMonth()===targetMonth.getMonth();
    })
    .map(lesson=>({
      id:"single-lesson-"+lesson.id,
      tarih:lesson.paid_on,
      tutar:Number(lesson.fee) || 0,
      paketUcret:0,
      ekTutar:0,
      tekDersTutar:Number(lesson.fee) || 0,
      ogrenci:lesson.participant_name,
      ödemeTürü:"Tek Ders",
    }));
}

function FinansRaporu({ students, expenses, singleLessons=[], onExpenseAdd, onExpenseRemove }) {
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
  ayÖdemeleri.push(...singleLessonPaymentsForMonth(singleLessons,hedefAy));
  const toplamGelir = ayÖdemeleri.reduce((sum, o) => sum + o.tutar, 0);
  const paketGeliri = ayÖdemeleri.reduce((sum, o) => sum + (o.paketUcret || 0), 0);
  const ekGeliri = ayÖdemeleri.reduce((sum, o) => sum + (o.ekTutar || 0), 0);
  const tekDersGeliri = ayÖdemeleri.reduce((sum, o) => sum + (o.tekDersTutar || 0), 0);
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

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:8, marginBottom:14 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:"14px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600, letterSpacing:1 }}>Paket Geliri</p>
          <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:"#111" }}>{paketGeliri.toLocaleString("tr-TR")} TL</p>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:"14px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600, letterSpacing:1 }}>Ek Ders Geliri</p>
          <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:"#5b21b6" }}>{ekGeliri.toLocaleString("tr-TR")} TL</p>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:"14px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600, letterSpacing:1 }}>Tek Ders Geliri</p>
          <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:"#6d28d9" }}>{tekDersGeliri.toLocaleString("tr-TR")} TL</p>
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
              <div key={o.id || i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: i < ayÖdemeleri.length-1 ? "1px solid #f0f0f0" : "none" }}>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111" }}>{o.ogrenci}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#888" }}>{fmtMed(o.tarih)}{o.ekDersSayisi > 0 ? " +" + o.ekDersSayisi + " ek ders" : ""}{o.ödemeTürü ? " · "+o.ödemeTürü : ""}</p>
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

function isTrialSingleLesson(lesson) {
  return lesson?.lesson_purpose === "trial";
}

function singleLessonTypeLabel(lesson) {
  return isTrialSingleLesson(lesson) ? "Deneme Dersi" : "Tek Ders";
}

function singleLessonStatusLabel(status) {
  return ({ planned:"Planlandı", completed:"Yapıldı", no_show:"Gelmedi", cancelled:"İptal" })[status] || "Planlandı";
}

function singleLessonBillingLabel(status) {
  return ({ unpaid:"Ödeme Bekliyor", paid:"Ödendi", free:"Ücretsiz" })[status] || "Ödeme Bekliyor";
}

function singleLessonDateTimeParts(value) {
  const date = value ? new Date(value) : new Date();
  const safe = isNaN(date.getTime()) ? new Date() : date;
  return { date:localDateKey(safe), time:String(safe.getHours()).padStart(2,"0")+":"+String(safe.getMinutes()).padStart(2,"0") };
}

function SingleLessonSheet({ lesson=null, students, teachers, onClose, onSave, saving=false }) {
  const initialParts = singleLessonDateTimeParts(lesson?.starts_at);
  const [participantKind, setParticipantKind] = useState(isTrialSingleLesson(lesson) ? "trial" : (lesson?.participant_kind || "guest"));
  const [participantChoiceChanged, setParticipantChoiceChanged] = useState(false);
  const [studentId, setStudentId] = useState(lesson?.student_id || "");
  const [participantName, setParticipantName] = useState(lesson?.participant_name || "");
  const [participantPhone, setParticipantPhone] = useState(lesson?.participant_phone || "");
  const [teacherId, setTeacherId] = useState(lesson?.teacher_id || teachers.find(t=>t.active)?.id || teachers[0]?.id || "");
  const [instrument, setInstrument] = useState(lesson?.instrument || "");
  const [date, setDate] = useState(initialParts.date);
  const [time, setTime] = useState(initialParts.time || "10:00");
  const [duration, setDuration] = useState(lesson?.duration_minutes || 45);
  const [lessonMode, setLessonMode] = useState(lesson?.lesson_mode || "physical");
  const [billingStatus, setBillingStatus] = useState(lesson?.billing_status || "unpaid");
  const [fee, setFee] = useState(lesson?.fee !== undefined ? String(lesson.fee) : "");
  const [note, setNote] = useState(lesson?.note || "");
  const [error, setError] = useState("");
  const selectableStudents = students.filter(student=>!isStudentDeleted(student)).sort((a,b)=>a.name.localeCompare(b.name,"tr"));
  const selectedStudent = selectableStudents.find(student=>student.id===studentId);
  const paidRecord = lesson?.billing_status === "paid";
  const trialSelection = participantKind === "trial";

  const chooseStudent = id => {
    setStudentId(id);
    setError("");
    const student = selectableStudents.find(item=>item.id===id);
    if (!student) return;
    setParticipantName(student.name || "");
    setParticipantPhone(student.phone || "");
    setInstrument(student.instrument || "");
    const linkedTeacher = teachers.find(teacher=>teacher.id===student.teacher_id)
      || teachers.find(teacher=>teacher.name===studentTeacherName(student));
    if (linkedTeacher) setTeacherId(linkedTeacher.id);
    if (!lesson && !fee) setFee(String(ekDersFee(student)));
  };

  const submit = () => {
    const linkedStudent = participantKind === "student";
    const cleanName = linkedStudent ? String(selectedStudent?.name || participantName).trim() : participantName.trim();
    const teacher = teachers.find(item=>item.id===teacherId);
    const effectiveBillingStatus = trialSelection ? "free" : (paidRecord ? "paid" : billingStatus);
    const amount = effectiveBillingStatus === "free" ? 0 : (paidRecord ? Number(lesson.fee) : Number(fee));
    const lessonPurpose = trialSelection ? "trial" : (!lesson || participantChoiceChanged ? "single" : (lesson.lesson_purpose || null));
    const startsAt = new Date(date+"T"+time+":00");
    if (linkedStudent && !selectedStudent) return setError("Kayıtlı öğrenciyi seçin.");
    if (trialSelection && paidRecord) return setError("Deneme dersine çevirmeden önce alınmış ödemeyi geri alın.");
    if (!cleanName) return setError("Derse katılacak kişinin adını yazın.");
    if (!teacher) return setError("Öğretmeni seçin.");
    if (!instrument.trim()) return setError("Enstrümanı yazın.");
    if (!date || !time || isNaN(startsAt.getTime())) return setError("Geçerli tarih ve saat seçin.");
    if (effectiveBillingStatus !== "free" && (!Number.isFinite(amount) || amount <= 0)) return setError("Ücretli ders için sıfırdan büyük bir tutar yazın.");
    onSave({
      participant_kind:linkedStudent ? "student" : "guest",
      lesson_purpose:lessonPurpose,
      student_id:linkedStudent ? selectedStudent.id : null,
      participant_name:cleanName,
      participant_phone:linkedStudent ? (selectedStudent.phone || "") : participantPhone.trim(),
      teacher_id:teacher.id,
      teacher_name:teacher.name,
      instrument:instrument.trim(),
      starts_at:startsAt.toISOString(),
      duration_minutes:Number(duration) || 45,
      lesson_mode:lessonMode,
      lesson_status:lesson?.lesson_status || "planned",
      billing_status:effectiveBillingStatus,
      fee:amount,
      paid_on:paidRecord ? lesson.paid_on : null,
      payment_recorded_at:paidRecord ? lesson.payment_recorded_at : null,
      note:note.trim(),
    }, lesson);
  };

  return (
    <Sheet title={lesson ? "Tek Dersi Düzenle" : "Tek Ders Ekle"} subtitle="Paketlerden ve mevcut Ek Ders kayıtlarından bağımsız" onClose={()=>{ if(!saving) onClose(); }}>
      <div style={{ background:"#faf5ff", border:"1px solid #ddd6fe", borderRadius:11, padding:"10px 12px", color:"#5b21b6", fontSize:12, fontWeight:700, lineHeight:1.5 }}>
        Bu kayıt öğrencinin paketini, kalan dersini, telafi hakkını veya puanlarını değiştirmez.
      </div>
      <label style={LBL}>Katılımcı</label>
      <select style={INP} value={participantKind} onChange={event=>{ const value=event.target.value; setParticipantKind(value); setParticipantChoiceChanged(true); if(value==="trial"){ setBillingStatus("free"); setFee("0"); } setError(""); }} disabled={saving}>
        <option value="guest">Kayıtsız / Misafir</option>
        <option value="student">Kayıtlı Öğrenci</option>
        <option value="trial" disabled={paidRecord}>Deneme Dersi</option>
      </select>
      {participantKind === "student" ? (
        <>
          <label style={LBL}>Öğrenci</label>
          <select style={INP} value={studentId} onChange={event=>chooseStudent(event.target.value)} disabled={saving}>
            <option value="">Öğrenci seçin</option>
            {selectableStudents.map(student=><option key={student.id} value={student.id}>{student.name}</option>)}
          </select>
        </>
      ) : (
        <>
          <label style={LBL}>Ad Soyad</label>
          <input style={INP} value={participantName} maxLength={160} onChange={event=>{ setParticipantName(event.target.value); setError(""); }} placeholder="Derse katılacak kişi" disabled={saving} />
          <label style={LBL}>Telefon (opsiyonel)</label>
          <input style={INP} type="tel" value={participantPhone} onChange={event=>setParticipantPhone(event.target.value)} placeholder="905xxxxxxxxx" disabled={saving} />
        </>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={LBL}>Öğretmen</label><select style={INP} value={teacherId} onChange={event=>setTeacherId(event.target.value)} disabled={saving}><option value="">Öğretmen seçin</option>{teachers.map(teacher=><option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.active===false?" · Pasif":""}</option>)}</select></div>
        <div><label style={LBL}>Enstrüman</label><input style={INP} value={instrument} maxLength={120} onChange={event=>setInstrument(event.target.value)} placeholder="Örn. Piyano" disabled={saving} /></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={LBL}>Tarih</label><input style={INP} type="date" value={date} onChange={event=>setDate(event.target.value)} disabled={saving} /></div>
        <div><label style={LBL}>Saat</label><input style={INP} type="time" step={900} value={time} onChange={event=>setTime(event.target.value)} disabled={saving} /></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={LBL}>Ders Süresi</label><select style={INP} value={duration} onChange={event=>setDuration(Number(event.target.value))} disabled={saving}><option value={30}>30 dakika</option><option value={45}>45 dakika</option><option value={60}>60 dakika</option><option value={90}>90 dakika</option></select></div>
        <div><label style={LBL}>Ders Türü</label><select style={INP} value={lessonMode} onChange={event=>setLessonMode(event.target.value)} disabled={saving}><option value="physical">Fiziki</option><option value="online">Online</option></select></div>
      </div>
      <label style={LBL}>Ücretlendirme</label>
      {trialSelection ? (
        <div style={{ background:"#faf5ff", border:"1px solid #ddd6fe", borderRadius:11, padding:"11px 12px", color:"#5b21b6", fontSize:12, fontWeight:800 }}>Deneme dersi ücretsiz olarak kaydedilir ve Finans hesabına girmez.</div>
      ) : paidRecord ? (
        <div style={{ background:"#ecfdf5", border:"1px solid #bbf7d0", borderRadius:11, padding:"11px 12px", color:"#166534", fontSize:12, fontWeight:800 }}>Bu dersin ödemesi alınmış. Ücret bilgisi için önce karttan “Ödemeyi Geri Al” işlemini kullanın.</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <select style={INP} value={billingStatus} onChange={event=>{ const value=event.target.value; setBillingStatus(value); if(value==="free") setFee("0"); setError(""); }} disabled={saving}><option value="unpaid">Ücretli</option><option value="free">Ücretsiz</option></select>
          <input style={INP} type="number" min={0} step="0.01" value={billingStatus==="free"?"0":fee} onChange={event=>setFee(event.target.value)} disabled={saving || billingStatus==="free"} placeholder="Ders ücreti" />
        </div>
      )}
      <label style={LBL}>Not (opsiyonel)</label>
      <input style={INP} value={note} onChange={event=>setNote(event.target.value)} placeholder="Dersle ilgili kısa not" disabled={saving} />
      {error ? <p style={{ margin:"12px 0 0", color:"#b91c1c", fontSize:12, fontWeight:800 }}>{error}</p> : null}
      <div style={{ marginTop:18 }}>
        <button disabled={saving} onClick={submit} style={{ width:"100%", border:"none", borderRadius:14, padding:"13px 16px", marginBottom:8, background:"#6d28d9", color:"#fff", fontWeight:800, cursor:saving?"wait":"pointer", opacity:saving?.7:1 }}>{saving ? "Kaydediliyor..." : lesson ? "Değişiklikleri Kaydet" : "Tek Dersi Kaydet"}</button>
        <Btn bg="#111" outline onClick={()=>{ if(!saving) onClose(); }}>İptal</Btn>
      </div>
    </Sheet>
  );
}

function isPayableSingleLesson(lesson) {
  if (!lesson || lesson.deleted_at || lesson.billing_status !== "unpaid" || isTrialSingleLesson(lesson)) return false;
  if (!["planned","completed"].includes(lesson.lesson_status)) return false;
  const fee = Number(lesson.fee);
  return Number.isFinite(fee) && fee > 0;
}

function SingleLessonsPanel({ lessons, loading, onAdd, onEdit, onStatus, onPayment, onDelete, busyIds={} }) {
  const [filter, setFilter] = useState("active");
  const visible = lessons
    .filter(lesson=>!lesson.deleted_at)
    .filter(lesson=>filter==="all" || (filter==="active" && lesson.lesson_status==="planned") || (filter==="unpaid" && isPayableSingleLesson(lesson)))
    .sort((a,b)=>filter==="all" ? new Date(b.starts_at)-new Date(a.starts_at) : new Date(a.starts_at)-new Date(b.starts_at));
  const activeCount = lessons.filter(lesson=>!lesson.deleted_at && lesson.lesson_status==="planned").length;
  const unpaidCount = lessons.filter(isPayableSingleLesson).length;
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
        {[{key:"active",label:"Planlanan",value:activeCount,color:"#6d28d9"},{key:"unpaid",label:"Ödeme Bekleyen",value:unpaidCount,color:"#c2410c"},{key:"all",label:"Tüm Kayıtlar",value:lessons.filter(item=>!item.deleted_at).length,color:"#111827"}].map(item=><button key={item.key} onClick={()=>setFilter(item.key)} style={{ border:filter===item.key?"2px solid "+item.color:"2px solid transparent", borderRadius:13, padding:"10px 8px", background:"#fff", cursor:"pointer" }}><strong style={{ display:"block", fontSize:22, color:item.color }}>{item.value}</strong><span style={{ fontSize:10, color:"#64748b", fontWeight:800 }}>{item.label}</span></button>)}
      </div>
      <button onClick={onAdd} style={{ width:"100%", border:"none", borderRadius:13, padding:"12px 15px", marginBottom:14, background:"#6d28d9", color:"#fff", fontWeight:850, cursor:"pointer" }}>＋ Tek Ders Ekle</button>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#94a3b8", fontWeight:700 }}>Tek ders kayıtları yükleniyor...</div> : null}
      {!loading && visible.length===0 ? <div style={{ ...CARD, padding:"38px 20px", textAlign:"center", color:"#94a3b8" }}><p style={{ margin:"0 0 5px", fontSize:30 }}>◇</p><p style={{ margin:0, fontWeight:750 }}>Bu görünümde tek ders kaydı yok.</p></div> : null}
      <div style={{ display:"grid", gap:10 }}>
        {visible.map(lesson=>{
          const busy = !!busyIds[lesson.id];
          const paid = lesson.billing_status==="paid";
          const trial = isTrialSingleLesson(lesson);
          const payable = isPayableSingleLesson(lesson);
          return <div key={lesson.id} style={{ ...CARD, padding:"15px 16px", borderLeft:"5px solid #7c3aed", opacity:busy?.65:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}><p style={{ margin:0, fontSize:15, fontWeight:850, color:"#111" }}>{lesson.participant_name}</p><TonePill tone="special">{singleLessonTypeLabel(lesson)}</TonePill>{lesson.participant_kind==="student"?<TonePill tone="info">Kayıtlı</TonePill>:!trial?<TonePill>Misafir</TonePill>:null}</div>
                <p style={{ margin:"6px 0 0", fontSize:13, color:"#475569", fontWeight:700 }}>{fmtDate(lesson.starts_at)} · {timeFromISO(lesson.starts_at)} · {lesson.duration_minutes} dk</p>
                <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b" }}>{lesson.instrument} · {lesson.teacher_name} · {lesson.lesson_mode==="online"?"Online":"Fiziki"}</p>
                {lesson.note ? <p style={{ margin:"7px 0 0", padding:"7px 9px", background:"#f8fafc", borderRadius:8, fontSize:12, color:"#475569", fontStyle:"italic" }}>{lesson.note}</p> : null}
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}><TonePill tone={lesson.lesson_status==="planned"?"info":lesson.lesson_status==="completed"?"good":lesson.lesson_status==="no_show"?"danger":"neutral"}>{singleLessonStatusLabel(lesson.lesson_status)}</TonePill>{payable || paid || lesson.billing_status==="free" ? <TonePill tone={paid?"good":lesson.billing_status==="free"?"special":"warn"}>{singleLessonBillingLabel(lesson.billing_status)}</TonePill> : null}<strong style={{ fontSize:13, color:lesson.billing_status==="free"?"#6d28d9":"#111" }}>{lesson.billing_status==="free"?"0 TL":Number(lesson.fee).toLocaleString("tr-TR")+" TL"}</strong></div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:13 }}>
              <button disabled={busy} onClick={()=>onEdit(lesson)} style={{ border:"1px solid #ddd6fe", background:"#faf5ff", color:"#6d28d9", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>Düzenle</button>
              {lesson.lesson_status==="planned" ? <><button disabled={busy} onClick={()=>onStatus(lesson,"completed")} style={{ border:"none", background:"#dcfce7", color:"#166534", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>Yapıldı</button><button disabled={busy} onClick={()=>onStatus(lesson,"no_show")} style={{ border:"none", background:"#fee2e2", color:"#991b1b", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>Gelmedi</button><button disabled={busy} onClick={()=>onStatus(lesson,"cancelled")} style={{ border:"none", background:"#f3f4f6", color:"#475569", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>İptal</button></> : <button disabled={busy} onClick={()=>onStatus(lesson,"planned")} style={{ border:"none", background:"#dbeafe", color:"#1d4ed8", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>Planlandıya Geri Al</button>}
              {payable ? <button disabled={busy} onClick={()=>onPayment(lesson,"paid")} style={{ border:"none", background:"#10b981", color:"#fff", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>Ödeme Al</button> : paid ? <button disabled={busy} onClick={()=>onPayment(lesson,"unpaid")} style={{ border:"1px solid #fca5a5", background:"#fff", color:"#b91c1c", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>Ödemeyi Geri Al</button> : null}
              <button disabled={busy} onClick={()=>onDelete(lesson)} style={{ marginLeft:"auto", border:"none", background:"#fff1f2", color:"#be123c", borderRadius:9, padding:"7px 10px", fontSize:11, fontWeight:800, cursor:"pointer" }}>Sil</button>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [giris, setGiris] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState(() => isPasswordSetupLink() ? "set-password" : "supabase");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordAgain, setAuthPasswordAgain] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnrollment, setMfaEnrollment] = useState(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showSecurityMenu, setShowSecurityMenu] = useState(false);
  const [authError, setAuthError] = useState(() => {
    const params = authHashParams();
    return params.get("error") ? authErrorMessage(params.get("error_description") || params.get("error")) : "";
  });
  const [authNotice, setAuthNotice] = useState("");
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [singleLessons, setSingleLessons] = useState([]);
  const [singleLessonsLoading, setSingleLessonsLoading] = useState(false);
  const [singleLessonsLoaded, setSingleLessonsLoaded] = useState(false);
  const [singleLessonSheet, setSingleLessonSheet] = useState(null);
  const [singleLessonSaving, setSingleLessonSaving] = useState(false);
  const [singleLessonBusyIds, setSingleLessonBusyIds] = useState({});
  const [singleLessonIssue, setSingleLessonIssue] = useState(() => readSingleLessonIssue());
  const [singleLessonIssueChecking, setSingleLessonIssueChecking] = useState(false);
  const [singleLessonSecurityReady, setSingleLessonSecurityReady] = useState(false);
  const [extraLessonPaymentIssue, setExtraLessonPaymentIssue] = useState(() => readExtraLessonPaymentIssue());
  const [extraLessonPaymentIssueChecking, setExtraLessonPaymentIssueChecking] = useState(false);
  const [packagePaymentIssue, setPackagePaymentIssue] = useState(() => readPackagePaymentIssue());
  const [packagePaymentIssueChecking, setPackagePaymentIssueChecking] = useState(false);
  const [normalLessonEvaluationIssue, setNormalLessonEvaluationIssue] = useState(null);
  const [normalLessonEvaluationIssueChecking, setNormalLessonEvaluationIssueChecking] = useState(false);
  const [normalLessonEvaluationBusyId, setNormalLessonEvaluationBusyId] = useState("");
  const [normalLessonMakeupIssue, setNormalLessonMakeupIssue] = useState(null);
  const [normalLessonMakeupIssueChecking, setNormalLessonMakeupIssueChecking] = useState(false);
  const [normalLessonMakeupBusyId, setNormalLessonMakeupBusyId] = useState("");
  const [normalLessonMakeupPlanIssue, setNormalLessonMakeupPlanIssue] = useState(null);
  const [normalLessonMakeupPlanIssueChecking, setNormalLessonMakeupPlanIssueChecking] = useState(false);
  const [normalLessonMakeupCompletionIssue, setNormalLessonMakeupCompletionIssue] = useState(null);
  const [normalLessonMakeupCompletionIssueChecking, setNormalLessonMakeupCompletionIssueChecking] = useState(false);
  const [singleLessonMoveIssue, setSingleLessonMoveIssue] = useState(null);
  const [singleLessonMoveChecking, setSingleLessonMoveChecking] = useState(false);
  const singleLessonMoveIssueRef = useRef(null);
  const singleLessonMoveWritingRef = useRef(false);
  const singleLessonMoveCheckingRef = useRef(false);
  const singleLessonMoveAutoCheckRef = useRef("");
  const singleLessonMoveActorRef = useRef("");
  singleLessonMoveActorRef.current = authSession?.user?.id || "";
  const [paymentSavingId, setPaymentSavingId] = useState("");
  const [browserOnline, setBrowserOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [connectionRevalidationRequired, setConnectionRevalidationRequired] = useState(false);
  const singleLessonBusyIdsRef = useRef({});
  const singleLessonIssueRef = useRef(singleLessonIssue);
  const singleLessonLoadSequenceRef = useRef(0);
  const singleLessonSavingRef = useRef(false);
  const pendingSingleLessonCreateRef = useRef(null);
  const extraLessonPaymentIssueRef = useRef(extraLessonPaymentIssue);
  const extraLessonPaymentWritingRef = useRef(false);
  const extraLessonPaymentCheckingRef = useRef(false);
  const extraLessonPaymentAutoCheckRef = useRef("");
  const packagePaymentIssueRef = useRef(packagePaymentIssue);
  const packagePaymentWritingRef = useRef(false);
  const packagePaymentCheckingRef = useRef(false);
  const packagePaymentAutoCheckRef = useRef("");
  const normalLessonEvaluationIssueRef = useRef(null);
  const normalLessonEvaluationWritingRef = useRef(false);
  const normalLessonEvaluationCheckingRef = useRef(false);
  const normalLessonEvaluationAutoCheckRef = useRef("");
  const normalLessonMakeupIssueRef = useRef(null);
  const normalLessonMakeupWritingRef = useRef(false);
  const normalLessonMakeupCheckingRef = useRef(false);
  const normalLessonMakeupAutoCheckRef = useRef("");
  const normalLessonMakeupPlanIssueRef = useRef(null);
  const normalLessonMakeupPlanWritingRef = useRef(false);
  const normalLessonMakeupPlanCheckingRef = useRef(false);
  const normalLessonMakeupPlanAutoCheckRef = useRef("");
  const normalLessonMakeupCompletionIssueRef = useRef(null);
  const normalLessonMakeupCompletionWritingRef = useRef(false);
  const normalLessonMakeupCompletionCheckingRef = useRef(false);
  const normalLessonMakeupCompletionAutoCheckRef = useRef("");
  const connectionAutoRetryRef = useRef(false);
  const protectedDataLoadGenerationRef = useRef(0);
  const accessContextLoadSequenceRef = useRef(0);
  const monthlyReportLoadSequenceRef = useRef(0);
  const branchScopedWriteCountRef = useRef(0);
  const branchLifecycleWritingRef = useRef(false);
  const branchLifecycleAutoCheckRef = useRef("");
  const staffInvitationWritingRef = useRef(false);
  const staffInvitationAutoCheckRef = useRef("");
  const staffActivationWritingRef = useRef(false);
  const staffActivationAutoCheckRef = useRef("");
  const staffAssignmentWritingRef = useRef(false);
  const staffAssignmentAutoCheckRef = useRef("");
  const staffDeactivationWritingRef = useRef(false);
  const staffDeactivationAutoCheckRef = useRef("");
  const staffAccessRevalidationRef = useRef(false);
  const staffManagementLoadSequenceRef = useRef(0);
  const [accessContext, setAccessContext] = useState(null);
  const [accessContextLoading, setAccessContextLoading] = useState(false);
  const [accessContextError, setAccessContextError] = useState("");
  const [activeOrganization, setActiveOrganization] = useState(null);
  const [currentBranch, setCurrentBranch] = useState(null);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showBranchCreate, setShowBranchCreate] = useState(false);
  const [branchCreateName, setBranchCreateName] = useState("");
  const [branchCreateCode, setBranchCreateCode] = useState("");
  const [branchCreateCodeEdited, setBranchCreateCodeEdited] = useState(false);
  const [branchLifecycleBusyId, setBranchLifecycleBusyId] = useState("");
  const [branchLifecycleIssue, setBranchLifecycleIssue] = useState(() => readBranchLifecycleIssue());
  const [branchLifecycleIssueChecking, setBranchLifecycleIssueChecking] = useState(false);
  const [staffInvitations, setStaffInvitations] = useState([]);
  const [staffActivations, setStaffActivations] = useState([]);
  const [staffBranchMemberships, setStaffBranchMemberships] = useState([]);
  const [staffOrganizationMemberships, setStaffOrganizationMemberships] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [staffDeactivations, setStaffDeactivations] = useState([]);
  const [staffManagementLoading, setStaffManagementLoading] = useState(false);
  const [staffManagementError, setStaffManagementError] = useState("");
  const [showStaffInvite, setShowStaffInvite] = useState(false);
  const [staffInviteName, setStaffInviteName] = useState("");
  const [staffInviteEmail, setStaffInviteEmail] = useState("");
  const [staffInviteRole, setStaffInviteRole] = useState("teacher");
  const [staffInvitationBusy, setStaffInvitationBusy] = useState(false);
  const [staffActivationBusyId, setStaffActivationBusyId] = useState("");
  const [staffBranchSelections, setStaffBranchSelections] = useState({});
  const [staffInvitationIssue, setStaffInvitationIssue] = useState(null);
  const [staffInvitationIssueChecking, setStaffInvitationIssueChecking] = useState(false);
  const [staffActivationIssue, setStaffActivationIssue] = useState(null);
  const [staffActivationIssueChecking, setStaffActivationIssueChecking] = useState(false);
  const [staffAssignmentIssue, setStaffAssignmentIssue] = useState(null);
  const [staffAssignmentIssueChecking, setStaffAssignmentIssueChecking] = useState(false);
  const [staffAssignmentBusyId, setStaffAssignmentBusyId] = useState("");
  const [staffAssignmentEditingId, setStaffAssignmentEditingId] = useState("");
  const [staffAssignmentSelections, setStaffAssignmentSelections] = useState({});
  const [staffDeactivationIssue, setStaffDeactivationIssue] = useState(null);
  const [staffDeactivationIssueChecking, setStaffDeactivationIssueChecking] = useState(false);
  const [staffDeactivationBusyId, setStaffDeactivationBusyId] = useState("");
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const [loadedSources, setLoadedSources] = useState({ students:false, teachers:false, expenses:false });
  const [protectedDataLoadIssues, setProtectedDataLoadIssues] = useState({ students:false, teachers:false, expenses:false });
  const [protectedDataRetrying, setProtectedDataRetrying] = useState(false);
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
  const [singleLessonResultClock, setSingleLessonResultClock] = useState(()=>new Date());
  useEffect(()=>{
    if (mainTab!=="bugün") return;
    const refresh = ()=>setSingleLessonResultClock(new Date());
    refresh();
    const timer = window.setInterval(refresh,60000);
    window.addEventListener("focus",refresh);
    return ()=>{ window.clearInterval(timer); window.removeEventListener("focus",refresh); };
  },[mainTab]);
  const pendingSingleResults = pendingSingleLessonResults(singleLessons,singleLessonResultClock);
  const overdueSinglePayments = overdueSingleLessonPayments(singleLessons,singleLessonResultClock);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCalendarAvailability, setShowCalendarAvailability] = useState(false);
  useEffect(()=>{ if (mainTab!=="takvim") setShowCalendarAvailability(false); },[mainTab]);
  const [toast, setToast] = useState(null);
  const [mesajSt, setMesajSt] = useState(null);
  const [mesajInitialKey, setMesajInitialKey] = useState("");
  const [summaryOpeningId, setSummaryOpeningId] = useState(null);
  const [odemeSt, setÖdemeSt] = useState(null);
  const [odemeKaydetModal, setÖdemeKaydetModal] = useState(null);
  const [odemeKaydetDate, setÖdemeKaydetDate] = useState(turkeyDateKey());
  const [search, setSearch] = useState("");
  const [failedOps, setFailedOps] = useState(() => readFailedOps());
  const [retryingOps, setRetryingOps] = useState({});

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const online = () => setBrowserOnline(true);
    const offline = () => {
      setBrowserOnline(false);
      setConnectionRevalidationRequired(true);
      connectionAutoRetryRef.current = false;
      protectedDataLoadGenerationRef.current += 1;
      singleLessonLoadSequenceRef.current += 1;
      staffManagementLoadSequenceRef.current += 1;
      setLoading(false);
      setDetailSt(null);
      setActionModal(null);
      setMesajSt(null);
      setÖdemeSt(null);
      setÖdemeKaydetModal(null);
      setSingleLessonSheet(null);
      setShowAdd(false);
      setShowBranchCreate(false);
      setShowCalendarAvailability(false);
      setShowStaffInvite(false);
      setStaffAssignmentEditingId("");
      pendingSingleLessonCreateRef.current = null;
    };
    window.addEventListener("online",online);
    window.addEventListener("offline",offline);
    return () => {
      window.removeEventListener("online",online);
      window.removeEventListener("offline",offline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const warnWhilePaymentIsWriting = event => {
      if (!singleLessonMoveWritingRef.current && !extraLessonPaymentWritingRef.current && !packagePaymentWritingRef.current && !normalLessonEvaluationWritingRef.current && !normalLessonMakeupWritingRef.current && !normalLessonMakeupPlanWritingRef.current && !normalLessonMakeupCompletionWritingRef.current && !branchLifecycleWritingRef.current && !staffInvitationWritingRef.current && !staffActivationWritingRef.current && !staffAssignmentWritingRef.current && !staffDeactivationWritingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload",warnWhilePaymentIsWriting);
    return () => window.removeEventListener("beforeunload",warnWhilePaymentIsWriting);
  }, []);

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
        await routeStaffMfa(session);
      } else if (!session) {
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

  const authorizeStaffSession = async (session, trustedDevice = false) => {
    const { data:assurance, error:assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!trustedDevice && (assuranceError || assurance?.currentLevel !== "aal2")) {
      setGiris(false);
      setAuthError("CRM'e girmek için iki adımlı doğrulamayı tamamlayın.");
      return false;
    }
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

  const routeStaffMfa = async session => {
    const profile = await activeStaffProfile(session?.user?.id);
    if (!profile) {
      await supabase.auth.signOut();
      setAuthSession(null);
      setGiris(false);
      setAuthError("Bu hesabın aktif CRM yönetici veya öğretmen yetkisi yok.");
      return false;
    }
    setAuthSession(session);
    setGiris(false);
    const { data:assurance, error:assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
      setAuthError(authErrorMessage(assuranceError));
      return false;
    }
    if (assurance?.currentLevel === "aal2") return authorizeStaffSession(session);

    const { data:factors, error:factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setAuthError(authErrorMessage(factorsError));
      return false;
    }
    const verifiedTotp = (factors?.totp || []).find(factor => factor.status === "verified") || factors?.totp?.[0];
    const trustedResult = verifiedTotp?.id
      ? await trustedDeviceRequest(session, "check")
      : { trusted:false, unavailable:false };
    if (trustedResult.trusted) return authorizeStaffSession(session, true);

    setMfaCode("");
    setMfaEnrollment(null);
    setRememberDevice(true);
    if (verifiedTotp?.id) {
      setMfaFactorId(verifiedTotp.id);
      setAuthMode("mfa-challenge");
    } else {
      setMfaFactorId("");
      setAuthMode("mfa-enroll");
    }
    if (trustedResult.unavailable) {
      setAuthNotice("Güvenilen cihaz kontrolü yapılamadı; güvenliğiniz için doğrulama kodu isteniyor.");
    }
    setAuthReady(true);
    return false;
  };

  const handleSupabaseLogin = async () => {
    if (authBusy) return;
    if (!authEmail.trim() || !authPassword) {
      setAuthError("E-posta ve parola alanlarını doldurun.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email:authEmail.trim(),
      password:authPassword,
    });
    if (error || !data?.session) setAuthError(authErrorMessage(error));
    else await routeStaffMfa(data.session);
    setAuthBusy(false);
  };

  const handlePasswordRecovery = async () => {
    if (authBusy) return;
    if (!authEmail.trim()) {
      setAuthError("Parola yenileme bağlantısı için e-posta adresinizi yazın.");
      setAuthNotice("");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim());
    if (error) setAuthError(authErrorMessage(error));
    else setAuthNotice("E-posta kayıtlıysa parola yenileme bağlantısı gönderildi.");
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
    const session = sessionData?.session;
    if (session && typeof window !== "undefined") {
      sessionStorage.removeItem(CRM_PASSWORD_SETUP_PENDING_KEY);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
    if (session) await routeStaffMfa(session);
    setAuthBusy(false);
  };

  const handleMfaEnrollmentStart = async () => {
    if (authBusy || !authSession?.user) return;
    setAuthBusy(true);
    setAuthError("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType:"totp",
      friendlyName:"Sonsuz CRM",
    });
    if (error || !data?.id || !data?.totp?.qr_code) setAuthError(authErrorMessage(error));
    else {
      setMfaFactorId(data.id);
      setMfaEnrollment({ id:data.id, qrCode:data.totp.qr_code, secret:data.totp.secret || "" });
      setMfaCode("");
    }
    setAuthBusy(false);
  };

  const handleMfaVerify = async () => {
    if (authBusy) return;
    const factorId = mfaEnrollment?.id || mfaFactorId;
    if (!factorId || !/^\d{6}$/.test(mfaCode)) {
      setAuthError("Doğrulama uygulamasındaki 6 haneli kodu girin.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { data:verifiedSession, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code:mfaCode });
    if (error || !verifiedSession?.access_token || !verifiedSession?.refresh_token) {
      setAuthError("Kod doğrulanamadı. Uygulamadaki güncel kodu tekrar girin.");
      setAuthBusy(false);
      return;
    }
    const { data:sessionData, error:sessionError } = await supabase.auth.setSession({
      access_token:verifiedSession.access_token,
      refresh_token:verifiedSession.refresh_token,
    });
    if (sessionError || !sessionData?.session) {
      setAuthError("Doğrulanmış oturum bu tarayıcıya kaydedilemedi. Tekrar deneyin.");
      setAuthBusy(false);
      return;
    }
    let deviceNotice = "";
    if (rememberDevice) {
      const trustResult = await trustedDeviceRequest(sessionData.session, "issue");
      if (!trustResult.trusted) deviceNotice = "Giriş doğrulandı fakat bu tarayıcı güvenilen cihaz olarak kaydedilemedi.";
    }
    await authorizeStaffSession(sessionData.session);
    if (deviceNotice) pop(deviceNotice, 6000);
    setMfaCode("");
    setMfaEnrollment(null);
    setAuthBusy(false);
  };

  const handleSecureLogout = async (forgetDevice = false) => {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    const supabaseLogin = sessionStorage.getItem(CRM_AUTH_METHOD_KEY) === "supabase" || !!authSession;
    if (supabaseLogin) {
      if (forgetDevice && authSession) {
        const revokeResult = await trustedDeviceRequest(authSession, "revoke");
        if (revokeResult.unavailable) {
          setAuthError("Bu cihazın güven kaydı kaldırılamadı. Tekrar deneyin.");
          pop("Cihaz güveni kaldırılamadı. Tekrar deneyin.", 6000);
          setAuthBusy(false);
          return;
        }
      }
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
    setMfaFactorId("");
    setMfaCode("");
    setMfaEnrollment(null);
    setRememberDevice(true);
    setShowSecurityMenu(false);
    accessContextLoadSequenceRef.current += 1;
    protectedDataLoadGenerationRef.current += 1;
    singleLessonLoadSequenceRef.current += 1;
    monthlyReportLoadSequenceRef.current += 1;
    staffManagementLoadSequenceRef.current += 1;
    setAccessContext(null);
    setAccessContextLoading(false);
    setAccessContextError("");
    setActiveOrganization(null);
    setCurrentBranch(null);
    setShowBranchMenu(false);
    setShowBranchCreate(false);
    setShowStaffInvite(false);
    setStaffInvitations([]);
    setStaffActivations([]);
    setStaffBranchMemberships([]);
    setStaffOrganizationMemberships([]);
    setStaffProfiles([]);
    setStaffDeactivations([]);
    setStaffManagementLoading(false);
    setStaffManagementError("");
    setStaffBranchSelections({});
    setStaffAssignmentEditingId("");
    setStaffAssignmentSelections({});
    setGiris(false);
    setAuthBusy(false);
  };

  const pop = (msg, ms=3000) => { setToast(msg); setTimeout(()=>setToast(null), ms); };

  const runBranchScopedWrite = async task => {
    // Do not let a legacy full-row writer race an unresolved single move.
    if (singleLessonMoveIssueRef.current || singleLessonMoveWritingRef.current || readSingleLessonMoveIssue(singleLessonMoveActorRef.current)) throw new Error("SINGLE_LESSON_MOVE_PENDING");
    branchScopedWriteCountRef.current += 1;
    try {
      return await task();
    } finally {
      branchScopedWriteCountRef.current = Math.max(0,branchScopedWriteCountRef.current - 1);
    }
  };

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
      branchId: operation.branchId || currentBranch?.id || "",
      failedAt: new Date().toISOString(),
      attempts: operation.attempts || MAX_SAVE_RETRIES,
      error: error?.message || "Kayıt doğrulanamadı",
    };
    persistFailedOps([nextOp, ...failedOps.filter(op => op.id !== nextOp.id)]);
  };

  const protectedSourceLabel = source => ({
    students:"öğrenci kayıtları",
    teachers:"öğretmen listesi",
    expenses:"gider kayıtları",
  })[source] || "gerekli kayıtlar";

  const requireProtectedSources = (sources, actionLabel="Bu işlem") => {
    const missing = sources.filter(source=>!loadedSources[source]);
    if (!missing.length) return true;
    pop(actionLabel+", "+missing.map(protectedSourceLabel).join(" ve ")+" Supabase'den doğrulanmadan yapılamaz. Üstteki Yeniden Kontrol Et düğmesini kullanın.",8000);
    return false;
  };

  const loadStudents = async (expectedGeneration=protectedDataLoadGenerationRef.current, branchId=currentBranch?.id) => {
    let data = null;
    let error = null;
    try {
      if (!branchId) throw new Error("ACTIVE_BRANCH_REQUIRED");
      const result = await timedSingleLessonRequest(() => supabase.from("students").select("*").eq("branch_id",branchId).order("created_at"));
      data = result.data;
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    if (expectedGeneration !== protectedDataLoadGenerationRef.current) return { ok:false, superseded:true };
    if (!error && Array.isArray(data)) {
      setStudents(data.map(s => ({ ...s, record_version: typeof s.record_version === "number" ? s.record_version : 0 })));
      setLoadedSources(current=>({ ...current, students:true }));
      setProtectedDataLoadIssues(current=>({ ...current, students:false }));
    } else {
      setStudents([]);
      setDetailSt(null);
      setActionModal(null);
      setÖdemeSt(null);
      setÖdemeKaydetModal(null);
      setShowAdd(false);
      setLoadedSources(current=>({ ...current, students:false }));
      setShowCalendarAvailability(false);
      setProtectedDataLoadIssues(current=>({ ...current, students:true }));
      console.error("Veri yükleme hatası:", error);
      pop("Veriler yüklenemedi. Bağlantı veya Supabase yetkisini kontrol et.", 6000);
    }
    return { ok:!error && Array.isArray(data), data:data || [], error:error || null };
  };

  const loadTeachers = async (expectedGeneration=protectedDataLoadGenerationRef.current, organizationId=activeOrganization?.id) => {
    let data = null;
    let error = null;
    try {
      if (!organizationId) throw new Error("ACTIVE_ORGANIZATION_REQUIRED");
      const result = await timedSingleLessonRequest(() => supabase.from("teachers").select("*").eq("organization_id",organizationId).order("name"));
      data = result.data;
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    if (expectedGeneration !== protectedDataLoadGenerationRef.current) return { ok:false, superseded:true };
    if (!error && Array.isArray(data)) {
      setTeachers(data);
      setLoadedSources(current=>({ ...current, teachers:true }));
      setProtectedDataLoadIssues(current=>({ ...current, teachers:false }));
    } else {
      setTeachers([]);
      setLoadedSources(current=>({ ...current, teachers:false }));
      setProtectedDataLoadIssues(current=>({ ...current, teachers:true }));
      console.error("Öğretmen listesi yükleme hatası:", error);
      pop("Öğretmen listesi yüklenemedi. v58 Supabase SQL dosyasını kontrol edin.", 8000);
    }
    return { ok:!error && Array.isArray(data), data:data || [], error:error || null };
  };

  const loadExpenses = async (expectedGeneration=protectedDataLoadGenerationRef.current, branchId=currentBranch?.id) => {
    let data = null;
    let error = null;
    try {
      if (!branchId) throw new Error("ACTIVE_BRANCH_REQUIRED");
      const result = await timedSingleLessonRequest(() => supabase.from("expenses").select("*").eq("branch_id",branchId).order("expense_date"));
      data = result.data;
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    if (expectedGeneration !== protectedDataLoadGenerationRef.current) return { ok:false, superseded:true };
    if (!error && Array.isArray(data)) {
      setExpenses(data);
      setLoadedSources(current=>({ ...current, expenses:true }));
      setProtectedDataLoadIssues(current=>({ ...current, expenses:false }));
    } else {
      setExpenses([]);
      setLoadedSources(current=>({ ...current, expenses:false }));
      setProtectedDataLoadIssues(current=>({ ...current, expenses:true }));
      console.error("Gider listesi yükleme hatası:", error);
      pop("Giderler yüklenemedi. v61 Supabase SQL dosyasını çalıştırdığınızdan emin olun.", 8000);
    }
    return { ok:!error && Array.isArray(data), data:data || [], error:error || null };
  };

  const handleProtectedDataRetry = async (forceAll=false) => {
    if (protectedDataRetrying || !browserOnline) return;
    let retryBranch = currentBranch;
    let retryOrganization = activeOrganization;
    if (forceAll) {
      const contextResult = await loadAccessContext({ preserveSelection:true, applySelection:false });
      if (!contextResult.ok || !contextResult.selectedOption) return;
      retryBranch = {
        ...contextResult.selectedOption.branch,
        id:contextResult.selectedOption.branchId,
        name:contextResult.selectedOption.branchName,
        organization_id:contextResult.selectedOption.organizationId,
      };
      retryOrganization = contextResult.selectedOption.organization;
    }
    if (!retryBranch?.id || !retryOrganization?.id) return;
    const sources = forceAll
      ? Object.keys(loadedSources)
      : Object.keys(loadedSources).filter(source=>protectedDataLoadIssues[source] || !loadedSources[source]);
    const singleLessonLoadBlocked = !singleLessonsLoaded || !singleLessonSecurityReady || ["load","setup","security"].includes(singleLessonIssueRef.current?.kind);
    if (!sources.length && !singleLessonLoadBlocked && !forceAll) return;
    const generation = protectedDataLoadGenerationRef.current + 1;
    protectedDataLoadGenerationRef.current = generation;
    setProtectedDataRetrying(true);
    try {
      const retryLoads = [];
      if (sources.includes("students")) retryLoads.push(loadStudents(generation,retryBranch.id));
      if (sources.includes("teachers")) retryLoads.push(loadTeachers(generation,retryOrganization.id));
      if (sources.includes("expenses")) retryLoads.push(loadExpenses(generation,retryBranch.id));
      if (singleLessonLoadBlocked || forceAll) retryLoads.push(loadSingleLessons({ branch:retryBranch }));
      const results = await Promise.all(retryLoads);
      if (results.length && results.every(result=>result.ok)) {
        setConnectionRevalidationRequired(false);
        pop("CRM verileri Supabase'den yeniden yüklendi.",6000);
      }
    } finally {
      setProtectedDataRetrying(false);
    }
  };

  useEffect(() => {
    if (!giris || !currentBranch?.id || !activeOrganization?.id || loading || !browserOnline || !connectionRevalidationRequired || protectedDataRetrying || connectionAutoRetryRef.current) return;
    connectionAutoRetryRef.current = true;
    handleProtectedDataRetry(true);
  }, [giris,currentBranch?.id,activeOrganization?.id,loading,browserOnline,connectionRevalidationRequired,protectedDataRetrying]);

  const rememberSingleLessonIssue = issue => {
    const stored = {
      kind:issue.kind || "load",
      state:issue.state || "unknown",
      operationType:issue.operationType || "",
      operationId:issue.operationId || "",
      lessonId:issue.lessonId || "",
      branchId:issue.branchId || "",
      label:issue.label || "",
      createdAt:issue.createdAt || new Date().toISOString(),
    };
    singleLessonIssueRef.current = stored;
    setSingleLessonIssue(stored);
    writeSingleLessonIssue(stored);
    return stored;
  };

  const clearSingleLessonIssue = predicate => {
    const current = singleLessonIssueRef.current;
    if (!current || (predicate && !predicate(current))) return;
    singleLessonIssueRef.current = null;
    setSingleLessonIssue(null);
    writeSingleLessonIssue(null);
  };

  const rememberExtraLessonPaymentIssue = issue => {
    const stored = {
      operationId:issue.operationId,
      branchId:issue.branchId || currentBranch?.id || "",
      studentId:issue.studentId || "",
      studentName:issue.studentName || "Öğrenci",
      extraRef:issue.extraRef || "",
      extraDate:issue.extraDate || "",
      paidOn:issue.paidOn || "",
      amount:Number(issue.amount) || 0,
      state:issue.state || "unknown",
      createdAt:issue.createdAt || new Date().toISOString(),
    };
    if (!writeExtraLessonPaymentIssue(stored)) return false;
    extraLessonPaymentIssueRef.current = stored;
    setExtraLessonPaymentIssue(stored);
    return true;
  };

  const clearExtraLessonPaymentIssue = operationId => {
    const current = extraLessonPaymentIssueRef.current;
    if (operationId && current?.operationId !== operationId) return;
    writeExtraLessonPaymentIssue(null);
    extraLessonPaymentIssueRef.current = null;
    setExtraLessonPaymentIssue(null);
  };

  const rememberPackagePaymentIssue = issue => {
    const stored = {
      operationId:issue.operationId,
      branchId:issue.branchId || currentBranch?.id || "",
      studentId:issue.studentId || "",
      studentName:issue.studentName || "Öğrenci",
      packageRef:issue.packageRef || "",
      paidOn:issue.paidOn || "",
      state:issue.state || "unknown",
      createdAt:issue.createdAt || new Date().toISOString(),
    };
    if (!writePackagePaymentIssue(stored)) return false;
    packagePaymentIssueRef.current = stored;
    setPackagePaymentIssue(stored);
    return true;
  };

  const clearPackagePaymentIssue = operationId => {
    const current = packagePaymentIssueRef.current;
    if (operationId && current?.operationId !== operationId) return;
    writePackagePaymentIssue(null);
    packagePaymentIssueRef.current = null;
    setPackagePaymentIssue(null);
  };

  const persistNormalLessonEvaluationIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const current = normalLessonEvaluationIssueRef.current;
    if (issue?.operationId && current?.operationId && current.operationId !== issue.operationId) return false;
    const stored = issue ? {
      operationId:String(issue.operationId || ""),
      actorUserId,
      branchId:String(issue.branchId || currentBranch?.id || ""),
      studentId:String(issue.studentId || ""),
      studentName:String(issue.studentName || "Öğrenci"),
      lessonId:String(issue.lessonId || ""),
      expectedRecordVersion:Number(issue.expectedRecordVersion) || 0,
      expectedOperationKind:issue.expectedOperationKind === "corrected" ? "corrected" : "recorded",
      requestSignature:String(issue.requestSignature || ""),
      label:String(issue.label || "Ders değerlendirmesi"),
      state:String(issue.state || "unknown"),
      createdAt:issue.createdAt || new Date().toISOString(),
      ...(issue.notFoundSince ? { notFoundSince:issue.notFoundSince } : {}),
    } : null;
    if (!writeNormalLessonEvaluationIssue(actorUserId,stored,current?.operationId || "")) return false;
    normalLessonEvaluationIssueRef.current = stored;
    setNormalLessonEvaluationIssue(stored);
    return true;
  };

  const clearNormalLessonEvaluationIssue = operationId => {
    const current = normalLessonEvaluationIssueRef.current;
    if (operationId && current?.operationId !== operationId) return false;
    const actorUserId = String(authSession?.user?.id || current?.actorUserId || "");
    if (!actorUserId || !writeNormalLessonEvaluationIssue(actorUserId,null,operationId || current?.operationId || "")) return false;
    normalLessonEvaluationIssueRef.current = null;
    setNormalLessonEvaluationIssue(null);
    normalLessonEvaluationAutoCheckRef.current = "";
    return true;
  };

  const persistNormalLessonMakeupIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const current = normalLessonMakeupIssueRef.current;
    if (issue?.operationId && current?.operationId && current.operationId !== issue.operationId) return false;
    const stored = issue ? {
      operationId:String(issue.operationId || ""),
      actorUserId,
      branchId:String(issue.branchId || currentBranch?.id || ""),
      studentId:String(issue.studentId || ""),
      studentName:String(issue.studentName || "Öğrenci"),
      lessonId:String(issue.lessonId || ""),
      actionKind:issue.actionKind === "lm-telafi" ? "lm-telafi" : "telafi",
      expectedRecordVersion:Number(issue.expectedRecordVersion) || 0,
      expectedOperationKind:issue.expectedOperationKind === "corrected" ? "corrected" : "created",
      requestSignature:String(issue.requestSignature || ""),
      label:String(issue.label || "Telafi hakkı"),
      state:String(issue.state || "unknown"),
      createdAt:issue.createdAt || new Date().toISOString(),
      ...(issue.notFoundSince ? { notFoundSince:issue.notFoundSince } : {}),
    } : null;
    if (!writeNormalLessonMakeupIssue(actorUserId,stored,current?.operationId || "")) return false;
    normalLessonMakeupIssueRef.current = stored;
    setNormalLessonMakeupIssue(stored);
    return true;
  };

  const clearNormalLessonMakeupIssue = operationId => {
    const current = normalLessonMakeupIssueRef.current;
    if (operationId && current?.operationId !== operationId) return false;
    const actorUserId = String(authSession?.user?.id || current?.actorUserId || "");
    if (!actorUserId || !writeNormalLessonMakeupIssue(actorUserId,null,operationId || current?.operationId || "")) return false;
    normalLessonMakeupIssueRef.current = null;
    setNormalLessonMakeupIssue(null);
    normalLessonMakeupAutoCheckRef.current = "";
    return true;
  };

  const persistNormalLessonMakeupPlanIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const current = normalLessonMakeupPlanIssueRef.current;
    if (issue?.operationId && current?.operationId && current.operationId !== issue.operationId) return false;
    const stored = issue ? {
      operationId:String(issue.operationId || ""),
      actorUserId,
      branchId:String(issue.branchId || currentBranch?.id || ""),
      studentId:String(issue.studentId || ""),
      studentName:String(issue.studentName || "Öğrenci"),
      makeupRecordId:String(issue.makeupRecordId || ""),
      expectedRecordVersion:Number(issue.expectedRecordVersion) || 0,
      expectedOperationKind:issue.expectedOperationKind === "rescheduled" ? "rescheduled" : "planned",
      plannedAt:String(issue.plannedAt || ""),
      plannedDurationMinutes:Number(issue.plannedDurationMinutes) || 0,
      plannedNote:String(issue.plannedNote || ""),
      requestSignature:String(issue.requestSignature || ""),
      label:String(issue.label || "Telafi planı"),
      state:String(issue.state || "unknown"),
      createdAt:issue.createdAt || new Date().toISOString(),
      ...(issue.notFoundSince ? { notFoundSince:issue.notFoundSince } : {}),
    } : null;
    if (!writeNormalLessonMakeupPlanIssue(actorUserId,stored,current?.operationId || "")) return false;
    normalLessonMakeupPlanIssueRef.current = stored;
    setNormalLessonMakeupPlanIssue(stored);
    return true;
  };

  const clearNormalLessonMakeupPlanIssue = operationId => {
    const current = normalLessonMakeupPlanIssueRef.current;
    if (operationId && current?.operationId !== operationId) return false;
    const actorUserId = String(authSession?.user?.id || current?.actorUserId || "");
    if (!actorUserId || !writeNormalLessonMakeupPlanIssue(actorUserId,null,operationId || current?.operationId || "")) return false;
    normalLessonMakeupPlanIssueRef.current = null;
    setNormalLessonMakeupPlanIssue(null);
    normalLessonMakeupPlanAutoCheckRef.current = "";
    return true;
  };

  const persistNormalLessonMakeupCompletionIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const current = normalLessonMakeupCompletionIssueRef.current;
    if (issue?.operationId && current?.operationId && current.operationId !== issue.operationId) return false;
    const stored = issue ? {
      operationId:String(issue.operationId || ""),
      actorUserId,
      branchId:String(issue.branchId || currentBranch?.id || ""),
      studentId:String(issue.studentId || ""),
      studentName:String(issue.studentName || "Öğrenci"),
      makeupRecordId:String(issue.makeupRecordId || ""),
      actionKind:issue.actionKind === "counted" ? "counted" : "attended",
      expectedRecordVersion:Number(issue.expectedRecordVersion) || 0,
      expectedOperationKind:issue.expectedOperationKind === "corrected" ? "corrected" : "completed",
      doneAt:String(issue.doneAt || ""),
      requestSignature:String(issue.requestSignature || ""),
      label:String(issue.label || "Telafi tamamlama"),
      state:String(issue.state || "unknown"),
      createdAt:issue.createdAt || new Date().toISOString(),
      ...(issue.notFoundSince ? { notFoundSince:issue.notFoundSince } : {}),
    } : null;
    if (!writeNormalLessonMakeupCompletionIssue(actorUserId,stored,current?.operationId || "")) return false;
    normalLessonMakeupCompletionIssueRef.current = stored;
    setNormalLessonMakeupCompletionIssue(stored);
    return true;
  };

  const clearNormalLessonMakeupCompletionIssue = operationId => {
    const current = normalLessonMakeupCompletionIssueRef.current;
    if (operationId && current?.operationId !== operationId) return false;
    const actorUserId = String(authSession?.user?.id || current?.actorUserId || "");
    if (!actorUserId || !writeNormalLessonMakeupCompletionIssue(actorUserId,null,operationId || current?.operationId || "")) return false;
    normalLessonMakeupCompletionIssueRef.current = null;
    setNormalLessonMakeupCompletionIssue(null);
    normalLessonMakeupCompletionAutoCheckRef.current = "";
    return true;
  };

  const setSingleLessonRecordBusy = (lessonId, busy) => {
    if (!lessonId) return;
    const next = { ...singleLessonBusyIdsRef.current };
    if (busy) next[lessonId] = true;
    else delete next[lessonId];
    singleLessonBusyIdsRef.current = next;
    setSingleLessonBusyIds(next);
  };

  const loadSingleLessons = async (options={}) => {
    const preserveIssue = options.preserveIssue === true;
    const branch = options.branch || currentBranch;
    const loadSequence = singleLessonLoadSequenceRef.current + 1;
    singleLessonLoadSequenceRef.current = loadSequence;
    setSingleLessonsLoading(true);
    setSingleLessonsLoaded(false);
    if (!branch?.id) {
      const branchError = new Error("ACTIVE_BRANCH_REQUIRED");
      console.error("Tek Ders şube bağlamı hazır değil:",branchError);
      setSingleLessonSecurityReady(false);
      rememberSingleLessonIssue({ kind:"load", state:"failed" });
      setSingleLessonsLoading(false);
      return { ok:false, error:branchError };
    }
    const [lessonResult, operationResult] = await Promise.all([
      timedSingleLessonRequest(() => supabase.from("single_lessons").select("*").eq("branch_id",branch.id).order("starts_at",{ ascending:true })),
      timedSingleLessonRequest(() => supabase.from("single_lesson_operations").select("operation_id").eq("branch_id",branch.id).limit(1)),
    ]);
    if (loadSequence !== singleLessonLoadSequenceRef.current) return { ok:false, superseded:true };
    if (lessonResult.error) {
      console.error("Tek Ders kayıtları yüklenemedi:",lessonResult.error);
      setSingleLessonSecurityReady(false);
      rememberSingleLessonIssue({ kind:"load", state:lessonResult.timedOut?"timeout":"failed" });
      setSingleLessonsLoading(false);
      return { ok:false, error:lessonResult.error };
    }
    setSingleLessons(lessonResult.data || []);
    setSingleLessonsLoaded(true);
    if (operationResult.error) {
      console.error("Tek Ders işlem güvenliği doğrulanamadı:",operationResult.error);
      setSingleLessonSecurityReady(false);
      rememberSingleLessonIssue({ kind:operationResult.error?.code === "42P01" ? "setup" : "security", state:operationResult.timedOut?"timeout":"failed" });
      setSingleLessonsLoading(false);
      return { ok:false, error:operationResult.error, lessonsLoaded:true };
    }
    setSingleLessonSecurityReady(true);
    if (!preserveIssue) clearSingleLessonIssue(issue=>issue.kind === "load" || issue.kind === "setup" || issue.kind === "security");
    setSingleLessonsLoading(false);
    return { ok:true, data:lessonResult.data || [] };
  };

  const pendingBranchIds = () => [...new Set([
    singleLessonMoveIssueRef.current?.branchId,
    packagePaymentIssueRef.current?.branchId,
    extraLessonPaymentIssueRef.current?.branchId,
    normalLessonEvaluationIssueRef.current?.branchId,
    normalLessonMakeupIssueRef.current?.branchId,
    normalLessonMakeupPlanIssueRef.current?.branchId,
    normalLessonMakeupCompletionIssueRef.current?.branchId,
    singleLessonIssueRef.current?.kind === "operation" ? singleLessonIssueRef.current?.branchId : "",
    ...failedOps.map(operation=>operation.branchId || ""),
  ].filter(Boolean))];

  const selectBranchContext = (option, options={}) => {
    if (!option?.selectable || !option.branchId || !option.organizationId) {
      pop("Bu şube etkin veya hesabınıza atanmış değil.",7000);
      return false;
    }
    const changingBranch = !!currentBranch?.id && currentBranch.id !== option.branchId;
    const changingOrganization = !!activeOrganization?.id && activeOrganization.id !== option.organizationId;
    const pendingDeactivationOrganizationId = staffDeactivationIssue
      && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id)
      ? staffDeactivationIssue.organizationId
      : "";
    const requiredBranches = pendingBranchIds();
    const currentBranchHasUnresolvedWrite = !!currentBranch?.id && requiredBranches.includes(currentBranch.id);
    const activeWrite = packagePaymentWritingRef.current
      || singleLessonMoveWritingRef.current
      || extraLessonPaymentWritingRef.current
      || normalLessonEvaluationWritingRef.current
      || normalLessonMakeupWritingRef.current
      || normalLessonMakeupPlanWritingRef.current
      || normalLessonMakeupCompletionWritingRef.current
      || singleLessonSavingRef.current
      || Object.keys(singleLessonBusyIdsRef.current).length > 0
      || branchScopedWriteCountRef.current > 0
      || branchLifecycleWritingRef.current
      || staffInvitationWritingRef.current
      || staffActivationWritingRef.current
      || staffAssignmentWritingRef.current
      || staffDeactivationWritingRef.current
      || !!downloadingReportId;
    if (changingBranch && (currentBranchHasUnresolvedWrite || activeWrite)) {
      pop("Devam eden veya sonucu kontrol edilmesi gereken işlem varken şube değiştirilemez. Önce mevcut uyarıyı sonuçlandırın.",9000);
      return false;
    }
    if (changingBranch && requiredBranches.length > 0 && !currentBranchHasUnresolvedWrite && !requiredBranches.includes(option.branchId)) {
      pop("Önce sonuç bekleyen işlemin ait olduğu şubeye geçin.",9000);
      return false;
    }
    if (!currentBranch?.id && requiredBranches.length > 0 && !requiredBranches.includes(option.branchId)) {
      pop("Bekleyen işlemin ait olduğu şube açılmadan başka şube seçilemez.",9000);
      return false;
    }
    if (pendingDeactivationOrganizationId && option.organizationId !== pendingDeactivationOrganizationId) {
      pop("Önce personel pasifleştirme sonucunun ait olduğu kuruma geçip uyarıyı sonuçlandırın.",9000);
      return false;
    }

    protectedDataLoadGenerationRef.current += 1;
    singleLessonLoadSequenceRef.current += 1;
    monthlyReportLoadSequenceRef.current += 1;
    reportInitializationRef.current = false;
    setStudents([]);
    setTeachers([]);
    setExpenses([]);
    setSingleLessons([]);
    setMonthlyReports([]);
    setLoadedSources({ students:false, teachers:false, expenses:false });
    setProtectedDataLoadIssues({ students:false, teachers:false, expenses:false });
    setSingleLessonsLoaded(false);
    setSingleLessonsLoading(false);
    setSingleLessonSecurityReady(false);
    setDetailSt(null);
    setActionModal(null);
    setMesajSt(null);
    setÖdemeSt(null);
    setÖdemeKaydetModal(null);
    setSingleLessonSheet(null);
    setShowAdd(false);
    setShowSecurityMenu(false);
    setShowCalendarAvailability(false);
    setShowBranchMenu(false);
    setShowBranchCreate(false);
    setShowStaffInvite(false);
    setStaffAssignmentEditingId("");
    setStaffAssignmentSelections({});
    if (changingOrganization) {
      staffManagementLoadSequenceRef.current += 1;
      setStaffInvitations([]);
      setStaffActivations([]);
      setStaffBranchMemberships([]);
      setStaffOrganizationMemberships([]);
      setStaffProfiles([]);
      setStaffDeactivations([]);
      setStaffManagementLoading(false);
      setStaffManagementError("");
      setStaffBranchSelections({});
    }
    pendingSingleLessonCreateRef.current = null;
    clearSingleLessonIssue(issue=>issue.kind !== "operation");
    setActiveOrganization(option.organization);
    setCurrentBranch({
      ...option.branch,
      id:option.branchId,
      name:option.branchName,
      organization_id:option.organizationId,
      organizationName:option.organizationName,
    });
    setLoading(true);
    if (!options.initial) pop(option.branchName+" şubesine geçiliyor.",5000);
    return true;
  };

  const loadAccessContext = async (options={}) => {
    const sequence = accessContextLoadSequenceRef.current + 1;
    accessContextLoadSequenceRef.current = sequence;
    setAccessContextLoading(true);
    setAccessContextError("");
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("get_my_access_context"));
      if (sequence !== accessContextLoadSequenceRef.current) return { ok:false, superseded:true };
      if (result.error || !result.data || !Array.isArray(result.data.organizations)) {
        const error = result.error || new Error("ACCESS_CONTEXT_INVALID");
        setAccessContext(null);
        setActiveOrganization(null);
        setCurrentBranch(null);
        setAccessContextError("Kurum ve şube yetkileri Supabase'den doğrulanamadı.");
        console.error("Kurum/şube yetkisi yüklenemedi:",error);
        return { ok:false, error };
      }
      const availableOptions = accessBranchOptions(result.data);
      const selectable = availableOptions.filter(option=>option.selectable);
      setAccessContext(result.data);
      if (!selectable.length) {
        setActiveOrganization(null);
        setCurrentBranch(null);
        setAccessContextError("Bu hesap için kullanılabilir aktif şube bulunamadı.");
        return { ok:false, error:new Error("ACCESS_CONTEXT_NO_SELECTABLE_BRANCH") };
      }
      const requiredBranches = pendingBranchIds();
      const unavailablePendingBranches = requiredBranches.filter(branchId=>!selectable.some(option=>option.branchId===branchId));
      if (unavailablePendingBranches.length) {
        setActiveOrganization(null);
        setCurrentBranch(null);
        setAccessContextError("Sonucu bekleyen bir işlemin şubesine artık erişilemiyor. Yetki düzeltilmeden işlem güvenle kontrol edilemez.");
        return { ok:false, error:new Error("ACCESS_CONTEXT_PENDING_BRANCH_UNAVAILABLE") };
      }
      const pendingOption = requiredBranches.length === 1
        ? selectable.find(option=>option.branchId===requiredBranches[0])
        : null;
      const preservedOption = options.preserveSelection && currentBranch?.id
        ? selectable.find(option=>option.branchId===currentBranch.id)
        : null;
      const selectedOption = pendingOption || preservedOption || (selectable.length === 1 ? selectable[0] : null);
      if (selectedOption && options.applySelection !== false) {
        selectBranchContext(selectedOption,{ initial:true });
      } else if (!selectedOption) {
        setActiveOrganization(null);
        setCurrentBranch(null);
        setLoading(false);
      }
      return { ok:true, data:result.data, selectedOption };
    } finally {
      if (sequence === accessContextLoadSequenceRef.current) setAccessContextLoading(false);
    }
  };

  const revalidateCurrentAccess = async () => {
    const organizationId = activeOrganization?.id;
    const branchId = currentBranch?.id;
    if (!organizationId || !branchId) return { ok:false, skipped:true };

    const result = await timedSingleLessonRequest(() => supabase.rpc("get_my_access_context"));
    if (result.error || !result.data || !Array.isArray(result.data.organizations)) {
      const error = result.error || new Error("ACCESS_CONTEXT_INVALID");
      console.error("Kurum/şube yetkisi arka planda doğrulanamadı:",error);
      return { ok:false, error };
    }

    const selectable = accessBranchOptions(result.data).filter(option=>option.selectable);
    if (!selectable.length) {
      return {
        ok:false,
        accessState:"no_selectable_branch",
        data:result.data,
        error:new Error("ACCESS_CONTEXT_NO_SELECTABLE_BRANCH"),
      };
    }

    const requiredBranches = pendingBranchIds();
    const unavailablePendingBranches = requiredBranches.filter(requiredBranchId=>!selectable.some(option=>option.branchId===requiredBranchId));
    if (unavailablePendingBranches.length) {
      return {
        ok:false,
        accessState:"pending_branch_unavailable",
        data:result.data,
        error:new Error("ACCESS_CONTEXT_PENDING_BRANCH_UNAVAILABLE"),
      };
    }

    const selectedOption = selectable.find(option=>option.organizationId===organizationId && option.branchId===branchId) || null;
    if (!selectedOption) {
      return {
        ok:false,
        accessState:"current_branch_unavailable",
        data:result.data,
        error:new Error("ACCESS_CONTEXT_CURRENT_BRANCH_UNAVAILABLE"),
      };
    }

    return { ok:true, data:result.data, selectedOption };
  };

  const persistBranchLifecycleIssue = issue => {
    const stored = issue ? {
      ...issue,
      state:issue.state || "unknown",
      createdAt:issue.createdAt || new Date().toISOString(),
    } : null;
    if (!writeBranchLifecycleIssue(stored)) return false;
    setBranchLifecycleIssue(stored);
    return true;
  };

  const clearBranchLifecycleIssue = operationId => {
    if (operationId && branchLifecycleIssue?.operationId && branchLifecycleIssue.operationId !== operationId) return;
    writeBranchLifecycleIssue(null);
    setBranchLifecycleIssue(null);
  };

  const branchOperationMatches = (issue,row) => {
    if (!issue || !row) return false;
    if (row.operation_id !== issue.operationId || row.organization_id !== issue.organizationId) return false;
    if (row.operation_kind !== issue.operationKind || row.requested_active !== issue.requestedActive) return false;
    if (String(row.requested_local_code || "") !== String(issue.requestedLocalCode || "")) return false;
    if (String(row.requested_name || "") !== String(issue.requestedName || "")) return false;
    if (issue.branchId && row.branch_id !== issue.branchId) return false;
    return true;
  };

  const checkBranchLifecycleOperation = async (issue=branchLifecycleIssue, options={}) => {
    if (!issue?.operationId || branchLifecycleIssueChecking) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    setBranchLifecycleIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("branch_lifecycle_operations")
        .select("operation_id,organization_id,branch_id,operation_kind,requested_local_code,requested_name,requested_active,resulting_state,actor_user_id")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistBranchLifecycleIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Şube işleminin sonucu henüz doğrulanamadı. Uyarı ekranda kalacak.",8000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        persistBranchLifecycleIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Şube işlemi Supabase'de bulunamadı; değişiklik oluşmadı.",7000);
        return { ok:true, applied:false };
      }
      if (!branchOperationMatches(issue,result.data) || result.data.actor_user_id !== authSession?.user?.id) {
        persistBranchLifecycleIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Şube işlem kaydı beklenen bilgilerle eşleşmedi. Yeni işlem göndermeyin.",9000);
        return { ok:false, conflict:true };
      }
      const refreshed = await loadAccessContext({ preserveSelection:true });
      if (!refreshed.ok) {
        persistBranchLifecycleIssue({ ...issue, state:"applied_pending_refresh", branchId:result.data.branch_id });
        if (options.notify !== false) pop("Şube işlemi kaydedildi; güncel liste henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      clearBranchLifecycleIssue(issue.operationId);
      if (options.notify !== false) pop(issue.operationKind === "branch_create" ? "Şube oluşturuldu." : "Şube durumu güncellendi.",6000);
      return { ok:true, applied:true, row:result.data };
    } finally {
      setBranchLifecycleIssueChecking(false);
    }
  };

  const branchLifecycleErrorText = error => {
    const message = String(error?.message || error || "");
    if (message.includes("BRANCH_LOCAL_CODE_ALREADY_EXISTS")) return "Bu kısa kodla daha önce bir şube oluşturulmuş.";
    if (message.includes("BRANCH_ACTIVE_MEMBERSHIPS_MUST_BE_CLOSED_FIRST")) return "Bu şubede aktif personel ataması var. Şube pasife alınmadan önce personel yetkileri kapatılmalı.";
    if (message.includes("NOT_AUTHORIZED")) return "Bu işlemi yalnız kurum sahibi yapabilir.";
    if (message.includes("INVALID_INPUT")) return "Şube adı veya kısa kodu geçerli değil.";
    return "Şube işlemi tamamlanamadı. Sonuç Supabase'den kontrol edilecek.";
  };

  const openBranchCreate = () => {
    const blockingIssue = branchLifecycleIssue && (!branchLifecycleIssue.actorUserId || branchLifecycleIssue.actorUserId === authSession?.user?.id);
    if (blockingIssue) {
      pop("Önce bekleyen şube işlemi uyarısını sonuçlandırın.",7000);
      return;
    }
    setBranchCreateName("");
    setBranchCreateCode("");
    setBranchCreateCodeEdited(false);
    setShowBranchCreate(true);
  };

  const handleBranchCreate = async () => {
    const name = branchCreateName.trim();
    const localCode = branchCreateCode.trim();
    if (!activeOrganization?.id || activeOrganization.canCreateBranches !== true) {
      pop("Şube oluşturma yetkisi doğrulanamadı.",7000);
      return false;
    }
    const blockingIssue = branchLifecycleIssue && (!branchLifecycleIssue.actorUserId || branchLifecycleIssue.actorUserId === authSession?.user?.id);
    if (!browserOnline || branchLifecycleWritingRef.current || blockingIssue) {
      pop(blockingIssue ? "Önce bekleyen şube işlemi uyarısını sonuçlandırın." : "İnternet bağlantısı olmadan şube oluşturulamaz.",8000);
      return false;
    }
    if (!name || name.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(localCode) || localCode.length < 2 || localCode.length > 60) {
      pop("Şube adını ve yalnız küçük harf, rakam, tire içeren kısa kodu kontrol edin.",7000);
      return false;
    }
    const issue = {
      operationId:uid(),
      actorUserId:authSession?.user?.id || "",
      organizationId:activeOrganization.id,
      branchId:"",
      operationKind:"branch_create",
      requestedLocalCode:localCode,
      requestedName:name,
      requestedActive:true,
      label:name+" şubesini oluştur",
      state:"writing",
    };
    if (!persistBranchLifecycleIssue(issue)) {
      pop("Şube işlem güvenliği tarayıcıda hazırlanamadı; işlem gönderilmedi.",8000);
      return false;
    }
    branchLifecycleWritingRef.current = true;
    setBranchLifecycleBusyId("create");
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("create_organization_branch",{
        p_organization_id:issue.organizationId,
        p_local_code:issue.requestedLocalCode,
        p_name:issue.requestedName,
        p_operation_id:issue.operationId,
      }));
      branchLifecycleWritingRef.current = false;
      if (result.error || !result.data?.branch?.id) {
        persistBranchLifecycleIssue({ ...issue, state:"unknown" });
        const checked = await checkBranchLifecycleOperation({ ...issue, state:"unknown" },{ notify:false });
        if (!checked.applied) pop(branchLifecycleErrorText(result.error),9000);
        return checked.applied === true;
      }
      const branch = result.data.branch;
      if (branch.organization_id !== issue.organizationId || branch.local_code !== localCode || branch.name !== name || branch.active !== true) {
        persistBranchLifecycleIssue({ ...issue, branchId:branch.id, state:"conflict" });
        pop("Oluşturulan şube beklenen bilgilerle eşleşmedi. Yeni işlem göndermeyin.",9000);
        return false;
      }
      const refreshed = await loadAccessContext({ preserveSelection:true });
      if (!refreshed.ok) {
        persistBranchLifecycleIssue({ ...issue, branchId:branch.id, state:"applied_pending_refresh" });
        pop("Şube oluşturuldu; güncel liste henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return false;
      }
      clearBranchLifecycleIssue(issue.operationId);
      setShowBranchCreate(false);
      pop("Şube oluşturuldu.",6000);
      return true;
    } finally {
      branchLifecycleWritingRef.current = false;
      setBranchLifecycleBusyId("");
    }
  };

  const handleBranchActiveChange = async branch => {
    if (!branch?.id || !activeOrganization?.id || activeOrganization.canCreateBranches !== true) return false;
    const blockingIssue = branchLifecycleIssue && (!branchLifecycleIssue.actorUserId || branchLifecycleIssue.actorUserId === authSession?.user?.id);
    if (!browserOnline || branchLifecycleWritingRef.current || blockingIssue) {
      pop(blockingIssue ? "Önce bekleyen şube işlemi uyarısını sonuçlandırın." : "İnternet bağlantısı olmadan şube durumu değiştirilemez.",8000);
      return false;
    }
    const requestedActive = branch.active === false;
    const activeBranchCount = (Array.isArray(activeOrganization.branches) ? activeOrganization.branches : []).filter(item=>item.active !== false).length;
    if (!requestedActive && activeBranchCount <= 1) {
      pop("Kurumun son aktif şubesi pasife alınamaz. Önce başka bir şube oluşturup etkin bırakın.",8000);
      return false;
    }
    const verb = requestedActive ? "yeniden aktif etmek" : "pasife almak";
    if (!window.confirm(branch.name+" şubesini "+verb+" istediğinize emin misiniz? Şube fiziksel olarak silinmeyecek.")) return false;
    const issue = {
      operationId:uid(),
      actorUserId:authSession?.user?.id || "",
      organizationId:activeOrganization.id,
      branchId:branch.id,
      operationKind:"branch_active_set",
      requestedLocalCode:String(branch.code || ""),
      requestedName:String(branch.name || ""),
      requestedActive,
      label:branch.name+" şubesini "+(requestedActive?"aktif et":"pasife al"),
      state:"writing",
    };
    if (!persistBranchLifecycleIssue(issue)) {
      pop("Şube işlem güvenliği tarayıcıda hazırlanamadı; işlem gönderilmedi.",8000);
      return false;
    }
    branchLifecycleWritingRef.current = true;
    setBranchLifecycleBusyId(branch.id);
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("set_organization_branch_active",{
        p_organization_id:issue.organizationId,
        p_branch_id:issue.branchId,
        p_active:issue.requestedActive,
        p_operation_id:issue.operationId,
      }));
      branchLifecycleWritingRef.current = false;
      if (result.error || !result.data?.branch?.id) {
        persistBranchLifecycleIssue({ ...issue, state:"unknown" });
        const checked = await checkBranchLifecycleOperation({ ...issue, state:"unknown" },{ notify:false });
        if (!checked.applied) pop(branchLifecycleErrorText(result.error),9000);
        return checked.applied === true;
      }
      const updated = result.data.branch;
      if (updated.id !== branch.id || updated.organization_id !== issue.organizationId || updated.active !== requestedActive) {
        persistBranchLifecycleIssue({ ...issue, state:"conflict" });
        pop("Şube durumu beklenen sonuçla eşleşmedi. Yeni işlem göndermeyin.",9000);
        return false;
      }
      const refreshed = await loadAccessContext({ preserveSelection:true });
      if (!refreshed.ok) {
        persistBranchLifecycleIssue({ ...issue, state:"applied_pending_refresh" });
        pop("Şube durumu kaydedildi; güncel liste henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return false;
      }
      clearBranchLifecycleIssue(issue.operationId);
      pop(requestedActive ? "Şube yeniden aktif edildi." : "Şube pasife alındı.",6000);
      return true;
    } finally {
      branchLifecycleWritingRef.current = false;
      setBranchLifecycleBusyId("");
    }
  };

  const persistStaffInvitationIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const stored = issue ? {
      ...issue,
      actorUserId,
      state:issue.state || "unknown",
      createdAt:issue.createdAt || new Date().toISOString(),
    } : null;
    if (!writeStaffIssue(STAFF_INVITATION_ISSUE_KEY,actorUserId,stored)) return false;
    setStaffInvitationIssue(stored);
    return true;
  };

  const clearStaffInvitationIssue = operationId => {
    const actorUserId = String(authSession?.user?.id || staffInvitationIssue?.actorUserId || "");
    if (!actorUserId || !writeStaffIssue(STAFF_INVITATION_ISSUE_KEY,actorUserId,null,operationId || staffInvitationIssue?.operationId || "")) return;
    setStaffInvitationIssue(previous=>!operationId || previous?.operationId === operationId ? null : previous);
  };

  const persistStaffActivationIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const stored = issue ? {
      ...issue,
      actorUserId,
      branchIds:canonicalStaffBranchIds(issue.branchIds),
      state:issue.state || "unknown",
      createdAt:issue.createdAt || new Date().toISOString(),
    } : null;
    if (!writeStaffIssue(STAFF_ACTIVATION_ISSUE_KEY,actorUserId,stored)) return false;
    setStaffActivationIssue(stored);
    return true;
  };

  const clearStaffActivationIssue = operationId => {
    const actorUserId = String(authSession?.user?.id || staffActivationIssue?.actorUserId || "");
    if (!actorUserId || !writeStaffIssue(STAFF_ACTIVATION_ISSUE_KEY,actorUserId,null,operationId || staffActivationIssue?.operationId || "")) return;
    setStaffActivationIssue(previous=>!operationId || previous?.operationId === operationId ? null : previous);
  };

  const persistStaffAssignmentIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const stored = issue ? {
      ...issue,
      actorUserId,
      branchIds:canonicalStaffBranchIds(issue.branchIds),
      state:issue.state || "unknown",
      createdAt:issue.createdAt || new Date().toISOString(),
    } : null;
    if (!writeStaffIssue(STAFF_ASSIGNMENT_ISSUE_KEY,actorUserId,stored)) return false;
    setStaffAssignmentIssue(stored);
    return true;
  };

  const clearStaffAssignmentIssue = operationId => {
    const actorUserId = String(authSession?.user?.id || staffAssignmentIssue?.actorUserId || "");
    if (!actorUserId || !writeStaffIssue(STAFF_ASSIGNMENT_ISSUE_KEY,actorUserId,null,operationId || staffAssignmentIssue?.operationId || "")) return;
    setStaffAssignmentIssue(previous=>!operationId || previous?.operationId === operationId ? null : previous);
  };

  const persistStaffDeactivationIssue = issue => {
    const actorUserId = String(issue?.actorUserId || authSession?.user?.id || "");
    if (!actorUserId) return false;
    const stored = issue ? {
      ...issue,
      actorUserId,
      state:issue.state || "unknown",
      createdAt:issue.createdAt || new Date().toISOString(),
    } : null;
    if (!writeStaffIssue(STAFF_DEACTIVATION_ISSUE_KEY,actorUserId,stored)) return false;
    setStaffDeactivationIssue(stored);
    return true;
  };

  const clearStaffDeactivationIssue = operationId => {
    const actorUserId = String(authSession?.user?.id || staffDeactivationIssue?.actorUserId || "");
    if (!actorUserId || !writeStaffIssue(STAFF_DEACTIVATION_ISSUE_KEY,actorUserId,null,operationId || staffDeactivationIssue?.operationId || "")) return;
    setStaffDeactivationIssue(previous=>!operationId || previous?.operationId === operationId ? null : previous);
  };

  const loadStaffManagement = async (organizationId=activeOrganization?.id) => {
    const ownerAuthorized = organizationId
      && activeOrganization?.id === organizationId
      && activeOrganization?.role === "owner"
      && accessContext?.profileRole === "admin";
    if (!ownerAuthorized) {
      setStaffInvitations([]);
      setStaffActivations([]);
      setStaffBranchMemberships([]);
      setStaffOrganizationMemberships([]);
      setStaffProfiles([]);
      setStaffDeactivations([]);
      setStaffManagementError("Personel yönetimi yalnız aktif kurum sahibine açıktır.");
      return { ok:false, unauthorized:true };
    }
    const sequence = staffManagementLoadSequenceRef.current + 1;
    staffManagementLoadSequenceRef.current = sequence;
    setStaffManagementLoading(true);
    setStaffManagementError("");
    try {
      const [invitationResult,activationResult,membershipResult,organizationMembershipResult,deactivationResult] = await Promise.all([
        timedSingleLessonRequest(() => supabase
          .from("staff_invitations")
          .select("id,operation_id,organization_id,normalized_email,display_name,requested_app_role,status,target_user_id,actor_user_id,prepared_at,sent_at")
          .eq("organization_id",organizationId)
          .order("prepared_at",{ ascending:false })),
        timedSingleLessonRequest(() => supabase
          .from("staff_access_activation_operations")
          .select("operation_id,invitation_id,organization_id,target_user_id,requested_app_role,requested_branch_ids,actor_user_id,created_at")
          .eq("organization_id",organizationId)
          .order("created_at",{ ascending:false })),
        timedSingleLessonRequest(() => supabase
          .from("branch_memberships")
          .select("organization_id,branch_id,user_id,role,active,updated_at")
          .eq("organization_id",organizationId)),
        timedSingleLessonRequest(() => supabase
          .from("organization_memberships")
          .select("organization_id,user_id,role,active,updated_at")
          .eq("organization_id",organizationId)),
        timedSingleLessonRequest(() => supabase
          .from("staff_deactivation_operations")
          .select("operation_id,organization_id,target_user_id,requested_app_role,resulting_state,revoked_trusted_device_count,actor_user_id,created_at")
          .eq("organization_id",organizationId)
          .order("created_at",{ ascending:false })),
      ]);
      if (sequence !== staffManagementLoadSequenceRef.current) return { ok:false, superseded:true };
      if (invitationResult.error || activationResult.error || membershipResult.error || organizationMembershipResult.error || deactivationResult.error) {
        setStaffInvitations([]);
        setStaffActivations([]);
        setStaffBranchMemberships([]);
        setStaffOrganizationMemberships([]);
        setStaffProfiles([]);
        setStaffDeactivations([]);
        setStaffManagementError("Personel listesi Supabase'den bütünüyle doğrulanamadı. Eksik listeyle işlem yapılmayacak.");
        console.error("Personel yönetimi yüklenemedi:",invitationResult.error || activationResult.error || membershipResult.error || organizationMembershipResult.error || deactivationResult.error);
        return { ok:false, error:invitationResult.error || activationResult.error || membershipResult.error || organizationMembershipResult.error || deactivationResult.error };
      }
      const targetUserIds = canonicalStaffBranchIds((invitationResult.data || []).map(invitation=>invitation.target_user_id));
      const profileResult = targetUserIds.length
        ? await timedSingleLessonRequest(() => supabase
          .from("app_profiles")
          .select("user_id,role,display_name,active,updated_at")
          .in("user_id",targetUserIds))
        : { data:[], error:null };
      if (sequence !== staffManagementLoadSequenceRef.current) return { ok:false, superseded:true };
      if (profileResult.error) {
        setStaffInvitations([]);
        setStaffActivations([]);
        setStaffBranchMemberships([]);
        setStaffOrganizationMemberships([]);
        setStaffProfiles([]);
        setStaffDeactivations([]);
        setStaffManagementError("Personel profilleri Supabase'den doğrulanamadı. Eksik listeyle işlem yapılmayacak.");
        console.error("Personel profilleri yüklenemedi:",profileResult.error);
        return { ok:false, error:profileResult.error };
      }
      setStaffInvitations(invitationResult.data || []);
      setStaffActivations(activationResult.data || []);
      setStaffBranchMemberships(membershipResult.data || []);
      setStaffOrganizationMemberships(organizationMembershipResult.data || []);
      setStaffProfiles(profileResult.data || []);
      setStaffDeactivations(deactivationResult.data || []);
      return {
        ok:true,
        invitations:invitationResult.data || [],
        activations:activationResult.data || [],
        branchMemberships:membershipResult.data || [],
        organizationMemberships:organizationMembershipResult.data || [],
        profiles:profileResult.data || [],
        deactivations:deactivationResult.data || [],
      };
    } finally {
      if (sequence === staffManagementLoadSequenceRef.current) setStaffManagementLoading(false);
    }
  };

  const checkStaffInvitationOperation = async (issue=staffInvitationIssue, options={}) => {
    if (!issue?.operationId || staffInvitationIssueChecking) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    setStaffInvitationIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("staff_invitations")
        .select("id,operation_id,organization_id,normalized_email,display_name,requested_app_role,status,target_user_id,actor_user_id,prepared_at,sent_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistStaffInvitationIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Personel davetinin sonucu henüz doğrulanamadı. Uyarı ekranda kalacak.",8000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const notFoundSince = issue.notFoundSince || new Date().toISOString();
        const waitedLongEnough = issue.notFoundSince && Date.now() - new Date(issue.notFoundSince).getTime() >= 10000;
        if (!waitedLongEnough) {
          persistStaffInvitationIssue({ ...issue, state:"unknown", notFoundSince });
          if (options.notify !== false) pop("Davet kanıtı henüz görünmüyor. Güvenlik için biraz sonra yeniden kontrol edin; yeni davet göndermeyin.",8000);
          return { ok:false, applied:false, uncertain:true };
        }
        persistStaffInvitationIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Personel daveti Supabase'de bulunamadı; davet oluşmadı.",7000);
        return { ok:true, applied:false };
      }
      const row = result.data;
      const exactIntent = !!issue.displayName
        && !!issue.normalizedEmail
        && ["admin","teacher"].includes(issue.appRole)
        && row.display_name === issue.displayName
        && row.normalized_email === issue.normalizedEmail
        && row.requested_app_role === issue.appRole;
      if (row.operation_id !== issue.operationId || row.organization_id !== issue.organizationId || row.actor_user_id !== authSession?.user?.id || !exactIntent) {
        persistStaffInvitationIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Personel davet kanıtı beklenen bilgilerle eşleşmedi. Yeni davet göndermeyin.",9000);
        return { ok:false, conflict:true };
      }
      if (row.status !== "sent" || !row.target_user_id) {
        persistStaffInvitationIssue({ ...issue, invitationId:row.id, state:"prepared" });
        await loadStaffManagement(issue.organizationId);
        if (options.notify !== false) pop("Davet hazırlığı bulundu; e-posta ve pasif profil henüz tamamlanmadı.",8000);
        return { ok:true, applied:false, prepared:true, row };
      }
      const refreshed = await loadStaffManagement(issue.organizationId);
      if (!refreshed.ok) {
        persistStaffInvitationIssue({ ...issue, invitationId:row.id, targetUserId:row.target_user_id, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Personel daveti tamamlandı; güncel liste henüz yüklenemedi. Daveti tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      clearStaffInvitationIssue(issue.operationId);
      if (options.notify !== false) pop("Personel daveti Supabase'de doğrulandı.",6000);
      return { ok:true, applied:true, row };
    } finally {
      setStaffInvitationIssueChecking(false);
    }
  };

  const staffInvitationErrorText = code => ({
    email_already_registered:"Bu e-posta daha önce kayıtlı. Mevcut hesabı sessizce personele çevirmiyoruz.",
    invitation_already_pending:"Bu e-posta için tamamlanmamış bir personel daveti zaten var.",
    not_authorized:"Personel davetini yalnız kurum sahibi gönderebilir.",
    invalid_input:"Ad, e-posta veya rol bilgisi geçerli değil.",
    server_secret_not_configured:"Sunucu davet anahtarı hazır değil; hiçbir hesap oluşturulmadı.",
    invite_rate_limited:"Supabase kısa süre içinde çok fazla davet denemesi algıladı. Bekleyip aynı işlemi yeniden tamamlayın.",
    invite_send_failed:"Davet e-postası gönderilemedi. İşlemin durumu Supabase'den kontrol edildi.",
    invite_sent_finalize_pending:"Davet e-postası gönderilmiş olabilir fakat pasif profil tamamlanamadı. Aynı işlem kimliğiyle tamamlanmalıdır.",
    invitation_identity_conflict:"Davet kimliği beklenen kullanıcıyla eşleşmedi. Yeni işlem göndermeyin.",
  }[code] || "Personel daveti tamamlanamadı. Sonuç Supabase'den kontrol edildi.");

  const sendStaffInvitation = async payload => {
    const organizationId = String(payload.organizationId || activeOrganization?.id || "");
    const displayName = String(payload.displayName || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const appRole = String(payload.appRole || "");
    const operationId = String(payload.operationId || uid());
    const ownerAuthorized = activeOrganization?.id === organizationId && activeOrganization?.role === "owner" && accessContext?.profileRole === "admin";
    const blockingIssue = (staffInvitationIssue && (!staffInvitationIssue.actorUserId || staffInvitationIssue.actorUserId === authSession?.user?.id) && staffInvitationIssue.operationId !== operationId)
      || (staffDeactivationIssue && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id));
    if (!ownerAuthorized) {
      pop("Personel davet yetkisi doğrulanamadı.",7000);
      return false;
    }
    if (!browserOnline || staffInvitationWritingRef.current || staffDeactivationWritingRef.current || blockingIssue) {
      pop(blockingIssue ? "Önce bekleyen personel daveti uyarısını sonuçlandırın." : "İnternet bağlantısı olmadan personel daveti gönderilemez.",8000);
      return false;
    }
    if (!displayName || displayName.length > 120 || email.length < 3 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["admin","teacher"].includes(appRole)) {
      pop("Ad, e-posta ve rol bilgilerini kontrol edin.",7000);
      return false;
    }
    const issue = {
      operationId,
      actorUserId:authSession?.user?.id || "",
      organizationId,
      displayName,
      normalizedEmail:email,
      appRole,
      label:displayName+" · "+staffRoleLabel(appRole)+" daveti",
      state:"writing",
    };
    if (!persistStaffInvitationIssue(issue)) {
      pop("Davet işlem güvenliği tarayıcıda hazırlanamadı; davet gönderilmedi.",8000);
      return false;
    }
    staffInvitationWritingRef.current = true;
    setStaffInvitationBusy(true);
    try {
      const request = await timedSingleLessonRequest(signal => fetch("/api/staff-invite",{
        method:"POST",
        signal,
        headers:{
          Authorization:"Bearer "+String(authSession?.access_token || ""),
          "Content-Type":"application/json",
        },
        body:JSON.stringify({ organizationId, operationId, email, displayName, appRole }),
      }).then(async response => {
        let data = null;
        try { data = await response.json(); } catch { data = null; }
        return { response, data };
      }));
      staffInvitationWritingRef.current = false;
      if (request.error || !request.response?.ok || request.data?.ok !== true) {
        persistStaffInvitationIssue({ ...issue, state:"unknown" });
        const checked = await checkStaffInvitationOperation({ ...issue, state:"unknown" },{ notify:false });
        if (!checked.applied) pop(staffInvitationErrorText(request.data?.code),9000);
        return checked.applied === true;
      }
      if (request.data.operationId !== operationId || !request.data.invitationId || !request.data.targetUserId || request.data.profileActive !== false) {
        persistStaffInvitationIssue({ ...issue, state:"conflict" });
        pop("Davet yanıtı beklenen güvenlik bilgileriyle eşleşmedi. Yeni davet göndermeyin.",9000);
        return false;
      }
      const refreshed = await loadStaffManagement(organizationId);
      if (!refreshed.ok) {
        persistStaffInvitationIssue({ ...issue, invitationId:request.data.invitationId, targetUserId:request.data.targetUserId, state:"applied_pending_refresh" });
        pop("Davet tamamlandı; personel listesi henüz yenilenemedi. Daveti tekrarlamayın.",9000);
        return false;
      }
      clearStaffInvitationIssue(operationId);
      setShowStaffInvite(false);
      setStaffInviteName("");
      setStaffInviteEmail("");
      setStaffInviteRole("teacher");
      pop("Personel daveti gönderildi. Şube erişimi siz atayana kadar kapalıdır.",7000);
      return true;
    } finally {
      staffInvitationWritingRef.current = false;
      setStaffInvitationBusy(false);
    }
  };

  const handleStaffInvite = () => sendStaffInvitation({
    displayName:staffInviteName,
    email:staffInviteEmail,
    appRole:staffInviteRole,
  });

  const retryPreparedStaffInvitation = async invitation => {
    if (!invitation?.operation_id || invitation.status !== "prepared") return false;
    if (!window.confirm(invitation.display_name+" için yarım kalan daveti aynı işlem kimliğiyle tamamlamak istiyor musunuz?")) return false;
    return sendStaffInvitation({
      organizationId:invitation.organization_id,
      operationId:invitation.operation_id,
      displayName:invitation.display_name,
      email:invitation.normalized_email,
      appRole:invitation.requested_app_role,
    });
  };

  const staffActivationMatches = (issue,row) => {
    if (!issue || !row) return false;
    return row.operation_id === issue.operationId
      && row.invitation_id === issue.invitationId
      && row.organization_id === issue.organizationId
      && row.target_user_id === issue.targetUserId
      && row.requested_app_role === issue.appRole
      && row.actor_user_id === authSession?.user?.id
      && JSON.stringify(canonicalStaffBranchIds(row.requested_branch_ids)) === JSON.stringify(canonicalStaffBranchIds(issue.branchIds));
  };

  const checkStaffActivationOperation = async (issue=staffActivationIssue, options={}) => {
    if (!issue?.operationId || staffActivationIssueChecking) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    setStaffActivationIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("staff_access_activation_operations")
        .select("operation_id,invitation_id,organization_id,target_user_id,requested_app_role,requested_branch_ids,actor_user_id,created_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistStaffActivationIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Personel şube atamasının sonucu henüz doğrulanamadı. Uyarı ekranda kalacak.",8000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const notFoundSince = issue.notFoundSince || new Date().toISOString();
        const waitedLongEnough = issue.notFoundSince && Date.now() - new Date(issue.notFoundSince).getTime() >= 10000;
        if (!waitedLongEnough) {
          persistStaffActivationIssue({ ...issue, state:"unknown", notFoundSince });
          if (options.notify !== false) pop("Erişim kanıtı henüz görünmüyor. Güvenlik için biraz sonra yeniden kontrol edin; yeni atama göndermeyin.",8000);
          return { ok:false, applied:false, uncertain:true };
        }
        persistStaffActivationIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Personel şube ataması Supabase'de bulunamadı; yetki verilmedi.",7000);
        return { ok:true, applied:false };
      }
      if (!staffActivationMatches(issue,result.data)) {
        persistStaffActivationIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Personel erişim kanıtı beklenen bilgilerle eşleşmedi. Yeni atama göndermeyin.",9000);
        return { ok:false, conflict:true };
      }
      const refreshed = await loadStaffManagement(issue.organizationId);
      if (!refreshed.ok) {
        persistStaffActivationIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Personel erişimi kaydedildi; güncel liste henüz yüklenemedi. Atamayı tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      clearStaffActivationIssue(issue.operationId);
      if (options.notify !== false) pop("Personel şube erişimi Supabase'de doğrulandı.",6000);
      return { ok:true, applied:true, row:result.data };
    } finally {
      setStaffActivationIssueChecking(false);
    }
  };

  const staffActivationErrorText = error => {
    const message = String(error?.message || error || "");
    if (message.includes("BRANCH_NOT_FOUND_OR_WRONG_TENANT")) return "Seçilen şubelerden biri pasif, bulunamadı veya başka kuruma ait. Hiçbir yetki verilmedi.";
    if (message.includes("INVITATION_ALREADY_USED")) return "Bu davetin ilk erişimi daha önce etkinleştirilmiş.";
    if (message.includes("TARGET_ALREADY_ASSIGNED")) return "Bu kullanıcıya daha önce kurum veya şube yetkisi atanmış. Sessizce değiştirmiyoruz.";
    if (message.includes("PROFILE_INCOMPATIBLE")) return "Davet edilen pasif profil beklenen rolle eşleşmiyor. Hiçbir yetki verilmedi.";
    if (message.includes("NOT_AUTHORIZED")) return "Personel erişimini yalnız kurum sahibi etkinleştirebilir.";
    return "Personel şube erişimi tamamlanamadı. Sonuç Supabase'den kontrol edildi.";
  };

  const handleStaffActivation = async invitation => {
    if (!invitation?.id || invitation.status !== "sent" || !invitation.target_user_id) return false;
    const organizationId = invitation.organization_id;
    const branchIds = canonicalStaffBranchIds(staffBranchSelections[invitation.id]);
    const activeBranchIds = new Set((Array.isArray(activeOrganization?.branches) ? activeOrganization.branches : []).filter(branch=>branch.active !== false).map(branch=>branch.id));
    const ownerAuthorized = activeOrganization?.id === organizationId && activeOrganization?.role === "owner" && accessContext?.profileRole === "admin";
    const blockingIssue = (staffActivationIssue && (!staffActivationIssue.actorUserId || staffActivationIssue.actorUserId === authSession?.user?.id))
      || (staffDeactivationIssue && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id));
    if (!ownerAuthorized) {
      pop("Personel şube atama yetkisi doğrulanamadı.",7000);
      return false;
    }
    if (!browserOnline || staffActivationWritingRef.current || staffDeactivationWritingRef.current || blockingIssue) {
      pop(blockingIssue ? "Önce bekleyen personel erişim uyarısını sonuçlandırın." : "İnternet bağlantısı olmadan personel erişimi etkinleştirilemez.",8000);
      return false;
    }
    if (!branchIds.length || branchIds.length > 100 || branchIds.some(branchId=>!activeBranchIds.has(branchId))) {
      pop("En az bir aktif şube seçin.",7000);
      return false;
    }
    const branchNames = (activeOrganization.branches || []).filter(branch=>branchIds.includes(branch.id)).map(branch=>branch.name).join(", ");
    if (!window.confirm(invitation.display_name+" için "+branchNames+" şube erişimini etkinleştirmek istiyor musunuz?")) return false;
    const issue = {
      operationId:uid(),
      actorUserId:authSession?.user?.id || "",
      invitationId:invitation.id,
      organizationId,
      targetUserId:invitation.target_user_id,
      appRole:invitation.requested_app_role,
      branchIds,
      label:invitation.display_name+" · "+branchNames,
      state:"writing",
    };
    if (!persistStaffActivationIssue(issue)) {
      pop("Personel erişim güvenliği tarayıcıda hazırlanamadı; atama gönderilmedi.",8000);
      return false;
    }
    staffActivationWritingRef.current = true;
    setStaffActivationBusyId(invitation.id);
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("activate_invited_staff_access",{
        p_organization_id:organizationId,
        p_target_user_id:invitation.target_user_id,
        p_branch_ids:branchIds,
        p_operation_id:issue.operationId,
      }));
      staffActivationWritingRef.current = false;
      if (result.error || !["applied","replayed"].includes(result.data?.operationState)) {
        persistStaffActivationIssue({ ...issue, state:"unknown" });
        const checked = await checkStaffActivationOperation({ ...issue, state:"unknown" },{ notify:false });
        if (!checked.applied) pop(staffActivationErrorText(result.error),9000);
        return checked.applied === true;
      }
      const access = result.data?.access || {};
      const expectedRole = invitation.requested_app_role === "admin" ? "branch_manager" : "teacher";
      const resultBranches = canonicalStaffBranchIds((access.branchMemberships || []).filter(item=>item.active && item.role===expectedRole).map(item=>item.branch_id));
      const exactResult = access.profile?.user_id === invitation.target_user_id
        && access.profile?.active === true
        && access.profile?.role === invitation.requested_app_role
        && access.organizationMembership?.organization_id === organizationId
        && access.organizationMembership?.user_id === invitation.target_user_id
        && access.organizationMembership?.role === "member"
        && access.organizationMembership?.active === true
        && JSON.stringify(resultBranches) === JSON.stringify(branchIds);
      if (!exactResult) {
        persistStaffActivationIssue({ ...issue, state:"conflict" });
        pop("Personel erişim yanıtı beklenen rol ve şubelerle eşleşmedi. Yeni atama göndermeyin.",9000);
        return false;
      }
      const refreshed = await loadStaffManagement(organizationId);
      if (!refreshed.ok) {
        persistStaffActivationIssue({ ...issue, state:"applied_pending_refresh" });
        pop("Personel erişimi etkinleştirildi; liste henüz yenilenemedi. Atamayı tekrarlamayın.",9000);
        return false;
      }
      clearStaffActivationIssue(issue.operationId);
      setStaffBranchSelections(previous=>({ ...previous, [invitation.id]:[] }));
      pop("Personel erişimi seçilen şubelerde etkinleştirildi.",7000);
      return true;
    } finally {
      staffActivationWritingRef.current = false;
      setStaffActivationBusyId("");
    }
  };

  const staffAssignmentMatches = (issue,row) => {
    if (!issue || !row) return false;
    const expectedBranchRole = issue.appRole === "admin" ? "branch_manager" : "teacher";
    return row.operation_id === issue.operationId
      && row.organization_id === issue.organizationId
      && row.target_user_id === issue.targetUserId
      && row.requested_app_role === issue.appRole
      && row.requested_branch_role === expectedBranchRole
      && row.actor_user_id === authSession?.user?.id
      && JSON.stringify(canonicalStaffBranchIds(row.requested_branch_ids)) === JSON.stringify(canonicalStaffBranchIds(issue.branchIds));
  };

  const checkStaffAssignmentOperation = async (issue=staffAssignmentIssue, options={}) => {
    if (!issue?.operationId || staffAssignmentIssueChecking) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    setStaffAssignmentIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("staff_branch_assignment_operations")
        .select("operation_id,organization_id,target_user_id,requested_app_role,requested_branch_role,requested_branch_ids,actor_user_id,created_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistStaffAssignmentIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Personel şube değişikliğinin sonucu henüz doğrulanamadı. Uyarı ekranda kalacak.",8000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const notFoundSince = issue.notFoundSince || new Date().toISOString();
        const waitedLongEnough = issue.notFoundSince && Date.now() - new Date(issue.notFoundSince).getTime() >= 10000;
        if (!waitedLongEnough) {
          persistStaffAssignmentIssue({ ...issue, state:"unknown", notFoundSince });
          if (options.notify !== false) pop("Şube değişikliği kanıtı henüz görünmüyor. Biraz sonra yeniden kontrol edin; değişikliği tekrar göndermeyin.",8000);
          return { ok:false, applied:false, uncertain:true };
        }
        persistStaffAssignmentIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Personel şube değişikliği Supabase'de bulunamadı; erişim değişmedi.",7000);
        return { ok:true, applied:false };
      }
      if (!staffAssignmentMatches(issue,result.data)) {
        persistStaffAssignmentIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Personel şube değişikliği kanıtı beklenen bilgilerle eşleşmedi. Yeni işlem göndermeyin.",9000);
        return { ok:false, conflict:true };
      }
      const refreshed = await loadStaffManagement(issue.organizationId);
      if (!refreshed.ok) {
        persistStaffAssignmentIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Şube değişikliği kaydedildi; güncel üyelikler henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      const currentBranchIds = currentStaffBranchIds(refreshed.branchMemberships,issue.targetUserId,issue.appRole);
      if (JSON.stringify(currentBranchIds) !== JSON.stringify(canonicalStaffBranchIds(issue.branchIds))) {
        persistStaffAssignmentIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("İşlem kanıtı bulundu fakat güncel şube erişimi beklenen kümeyle eşleşmiyor. Yeni işlem göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      clearStaffAssignmentIssue(issue.operationId);
      setStaffAssignmentEditingId("");
      setStaffAssignmentSelections(previous=>({ ...previous, [issue.targetUserId]:[] }));
      if (options.notify !== false) pop("Personel şube değişikliği Supabase'de doğrulandı.",6000);
      return { ok:true, applied:true, row:result.data };
    } finally {
      setStaffAssignmentIssueChecking(false);
    }
  };

  const staffAssignmentErrorText = error => {
    const message = String(error?.message || error || "");
    if (message.includes("BRANCH_NOT_FOUND_OR_WRONG_TENANT")) return "Seçilen şubelerden biri pasif, bulunamadı veya başka kuruma ait. Hiçbir erişim değişmedi.";
    if (message.includes("PROFILE_INCOMPATIBLE") || message.includes("TARGET_NOT_MANAGEABLE")) return "Personelin aktif rolü veya kurum üyeliği bu işlemle uyumlu değil. Hiçbir erişim değişmedi.";
    if (message.includes("ROLE_CONFLICT")) return "Personelin mevcut şube rolü beklenen rolle çakışıyor. Hiçbir erişim değişmedi.";
    if (message.includes("NOT_AUTHORIZED")) return "Personel şubelerini yalnız kurum sahibi değiştirebilir.";
    if (message.includes("DUPLICATE_BRANCH") || message.includes("INVALID_INPUT")) return "Şube seçimi geçerli değil. En az bir aktif şube seçin.";
    return "Personel şube değişikliği tamamlanamadı. Sonuç Supabase'den kontrol edildi.";
  };

  const openStaffAssignmentEditor = invitation => {
    if (!invitation?.target_user_id || !staffActivationByInvitation.get(invitation.id)) return;
    const blockingIssue = (staffAssignmentIssue && (!staffAssignmentIssue.actorUserId || staffAssignmentIssue.actorUserId === authSession?.user?.id))
      || (staffDeactivationIssue && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id));
    if (blockingIssue || staffDeactivationWritingRef.current) {
      pop("Önce bekleyen personel şube değişikliği uyarısını sonuçlandırın.",7000);
      return;
    }
    const currentBranchIds = currentStaffBranchIds(staffBranchMemberships,invitation.target_user_id,invitation.requested_app_role);
    if (!currentBranchIds.length) {
      pop("Personelin güncel aktif şube erişimi doğrulanamadı. Listeyi yeniden yükleyin.",8000);
      return;
    }
    setStaffAssignmentSelections(previous=>({ ...previous, [invitation.target_user_id]:currentBranchIds }));
    setStaffAssignmentEditingId(invitation.id);
  };

  const handleStaffAssignment = async invitation => {
    if (!invitation?.id || !invitation.target_user_id || !staffActivationByInvitation.get(invitation.id)) return false;
    const organizationId = invitation.organization_id;
    const branchIds = canonicalStaffBranchIds(staffAssignmentSelections[invitation.target_user_id]);
    const currentBranchIds = currentStaffBranchIds(staffBranchMemberships,invitation.target_user_id,invitation.requested_app_role);
    const activeBranchIds = new Set((Array.isArray(activeOrganization?.branches) ? activeOrganization.branches : []).filter(branch=>branch.active !== false).map(branch=>branch.id));
    const ownerAuthorized = activeOrganization?.id === organizationId && activeOrganization?.role === "owner" && accessContext?.profileRole === "admin";
    const blockingIssue = (staffAssignmentIssue && (!staffAssignmentIssue.actorUserId || staffAssignmentIssue.actorUserId === authSession?.user?.id))
      || (staffDeactivationIssue && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id));
    if (!ownerAuthorized) {
      pop("Personel şube değiştirme yetkisi doğrulanamadı.",7000);
      return false;
    }
    if (!browserOnline || staffAssignmentWritingRef.current || staffDeactivationWritingRef.current || blockingIssue) {
      pop(blockingIssue ? "Önce bekleyen personel şube değişikliği uyarısını sonuçlandırın." : "İnternet bağlantısı olmadan personel şubeleri değiştirilemez.",8000);
      return false;
    }
    if (!branchIds.length || branchIds.length > 100 || branchIds.some(branchId=>!activeBranchIds.has(branchId))) {
      pop("En az bir aktif şube seçin.",7000);
      return false;
    }
    if (JSON.stringify(branchIds) === JSON.stringify(currentBranchIds)) {
      setStaffAssignmentEditingId("");
      pop("Şube seçimi zaten güncel.",5000);
      return true;
    }
    const branchNames = (activeOrganization.branches || []).filter(branch=>branchIds.includes(branch.id)).map(branch=>branch.name).join(", ");
    if (!window.confirm(invitation.display_name+" için güncel şube erişimini "+branchNames+" olarak değiştirmek istiyor musunuz? Rol değişmeyecek.")) return false;
    const issue = {
      operationId:uid(),
      actorUserId:authSession?.user?.id || "",
      organizationId,
      targetUserId:invitation.target_user_id,
      appRole:invitation.requested_app_role,
      branchIds,
      label:invitation.display_name+" · "+branchNames,
      state:"writing",
    };
    if (!persistStaffAssignmentIssue(issue)) {
      pop("Şube değişikliği güvenliği tarayıcıda hazırlanamadı; işlem gönderilmedi.",8000);
      return false;
    }
    staffAssignmentWritingRef.current = true;
    setStaffAssignmentBusyId(invitation.id);
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("set_staff_branch_assignments",{
        p_organization_id:organizationId,
        p_target_user_id:invitation.target_user_id,
        p_expected_app_role:invitation.requested_app_role,
        p_branch_ids:branchIds,
        p_operation_id:issue.operationId,
      }));
      staffAssignmentWritingRef.current = false;
      if (result.error || !["applied","replayed"].includes(result.data?.operationState)) {
        persistStaffAssignmentIssue({ ...issue, state:"unknown" });
        const checked = await checkStaffAssignmentOperation({ ...issue, state:"unknown" },{ notify:false });
        if (!checked.applied) pop(staffAssignmentErrorText(result.error),9000);
        return checked.applied === true;
      }
      const assignments = result.data?.assignments || {};
      const expectedBranchRole = invitation.requested_app_role === "admin" ? "branch_manager" : "teacher";
      const resultBranchIds = canonicalStaffBranchIds((assignments.branchMemberships || []).filter(item=>item.active && item.role===expectedBranchRole).map(item=>item.branch_id));
      const exactResult = assignments.profileRole === invitation.requested_app_role
        && assignments.organizationMembership?.organization_id === organizationId
        && assignments.organizationMembership?.user_id === invitation.target_user_id
        && assignments.organizationMembership?.role === "member"
        && assignments.organizationMembership?.active === true
        && JSON.stringify(resultBranchIds) === JSON.stringify(branchIds);
      if (!exactResult) {
        persistStaffAssignmentIssue({ ...issue, state:"conflict" });
        pop("Şube değişikliği yanıtı beklenen kullanıcı, rol ve şubelerle eşleşmedi. Yeni işlem göndermeyin.",9000);
        return false;
      }
      const refreshed = await loadStaffManagement(organizationId);
      if (!refreshed.ok) {
        persistStaffAssignmentIssue({ ...issue, state:"applied_pending_refresh" });
        pop("Şube değişikliği kaydedildi; güncel personel listesi henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return false;
      }
      const refreshedBranchIds = currentStaffBranchIds(refreshed.branchMemberships,invitation.target_user_id,invitation.requested_app_role);
      if (JSON.stringify(refreshedBranchIds) !== JSON.stringify(branchIds)) {
        persistStaffAssignmentIssue({ ...issue, state:"conflict" });
        pop("Şube değişikliği kaydedildi fakat güncel üyelikler beklenen sonuçla eşleşmedi. Yeni işlem göndermeyin.",9000);
        return false;
      }
      clearStaffAssignmentIssue(issue.operationId);
      setStaffAssignmentEditingId("");
      setStaffAssignmentSelections(previous=>({ ...previous, [invitation.target_user_id]:[] }));
      pop("Personelin şube erişimi güncellendi; rolü değişmedi.",7000);
      return true;
    } finally {
      staffAssignmentWritingRef.current = false;
      setStaffAssignmentBusyId("");
    }
  };

  const staffDeactivationMatches = (issue,row) => {
    if (!issue || !row) return false;
    const resulting = row.resulting_state || {};
    return row.operation_id === issue.operationId
      && row.organization_id === issue.organizationId
      && row.target_user_id === issue.targetUserId
      && row.requested_app_role === issue.appRole
      && row.actor_user_id === authSession?.user?.id
      && resulting.targetUserId === issue.targetUserId
      && resulting.organizationId === issue.organizationId
      && resulting.profileRole === issue.appRole
      && resulting.profileActive === false
      && resulting.organizationMembershipActive === false
      && Number(resulting.activeBranchMembershipCount) === 0;
  };

  const checkStaffDeactivationOperation = async (issue=staffDeactivationIssue, options={}) => {
    if (!issue?.operationId || staffDeactivationIssueChecking) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    setStaffDeactivationIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("staff_deactivation_operations")
        .select("operation_id,organization_id,target_user_id,requested_app_role,resulting_state,revoked_trusted_device_count,actor_user_id,created_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistStaffDeactivationIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Personel pasifleştirme sonucu henüz doğrulanamadı. Uyarı ekranda kalacak.",8000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const notFoundSince = issue.notFoundSince || new Date().toISOString();
        const waitedLongEnough = issue.notFoundSince && Date.now() - new Date(issue.notFoundSince).getTime() >= 10000;
        if (!waitedLongEnough) {
          persistStaffDeactivationIssue({ ...issue, state:"unknown", notFoundSince });
          if (options.notify !== false) pop("Pasifleştirme kanıtı henüz görünmüyor. Biraz sonra yeniden kontrol edin; işlemi tekrar göndermeyin.",8000);
          return { ok:false, applied:false, uncertain:true };
        }
        persistStaffDeactivationIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Personel pasifleştirme işlemi Supabase'de bulunamadı; erişim değişmedi.",7000);
        return { ok:true, applied:false };
      }
      if (!staffDeactivationMatches(issue,result.data)) {
        persistStaffDeactivationIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Personel pasifleştirme kanıtı beklenen bilgilerle eşleşmedi. Yeni işlem göndermeyin.",9000);
        return { ok:false, conflict:true };
      }
      const refreshed = await loadStaffManagement(issue.organizationId);
      if (!refreshed.ok) {
        persistStaffDeactivationIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Personel erişimi pasife alındı; güncel liste henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      const facts = staffAccessFacts(
        refreshed.profiles,
        refreshed.organizationMemberships,
        refreshed.branchMemberships,
        refreshed.deactivations,
        issue.targetUserId,
        issue.appRole,
      );
      if (!facts.deactivated) {
        persistStaffDeactivationIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("İşlem kanıtı bulundu fakat canlı erişim durumu pasif olarak doğrulanamadı. Yeni işlem göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      clearStaffDeactivationIssue(issue.operationId);
      setStaffAssignmentEditingId("");
      if (options.notify !== false) pop("Personel erişiminin pasif olduğu Supabase'de doğrulandı.",6000);
      return { ok:true, applied:true, row:result.data };
    } finally {
      setStaffDeactivationIssueChecking(false);
    }
  };

  const staffDeactivationErrorText = error => {
    const message = String(error?.message || error || "");
    if (message.includes("OTHER_ACTIVE_ORGANIZATION")) return "Bu personelin başka bir kurumda aktif erişimi var. Hesap genelindeki erişim sessizce kapatılmadı.";
    if (message.includes("PROFILE_INCOMPATIBLE") || message.includes("TARGET_NOT_MANAGEABLE") || message.includes("ACTIVE_BRANCH_REQUIRED")) return "Personelin canlı profil veya üyelik durumu bu işlemle uyumlu değil. Hiçbir erişim değişmedi.";
    if (message.includes("SELF_NOT_ALLOWED")) return "Kurum sahibi kendi erişimini bu ekrandan pasife alamaz.";
    if (message.includes("NOT_AUTHORIZED")) return "Personel erişimini yalnız kurum sahibi pasife alabilir.";
    if (message.includes("ROLE_CONFLICT")) return "Personelin şube rolü beklenen rolle uyuşmuyor. Hiçbir erişim değişmedi.";
    return "Personel erişimi pasife alınamadı. Sonuç Supabase'den kontrol edildi.";
  };

  const handleStaffDeactivation = async invitation => {
    if (!invitation?.id || !invitation.target_user_id || !staffActivationByInvitation.get(invitation.id)) return false;
    const organizationId = invitation.organization_id;
    const ownerAuthorized = activeOrganization?.id === organizationId && activeOrganization?.role === "owner" && accessContext?.profileRole === "admin";
    const facts = staffAccessFacts(staffProfiles,staffOrganizationMemberships,staffBranchMemberships,staffDeactivations,invitation.target_user_id,invitation.requested_app_role);
    const blockingIssue = staffDeactivationIssue && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id);
    const otherStaffWriteOrIssue = staffInvitationWritingRef.current || staffActivationWritingRef.current || staffAssignmentWritingRef.current
      || !!staffInvitationIssue || !!staffActivationIssue || !!staffAssignmentIssue;
    if (!ownerAuthorized || invitation.target_user_id === authSession?.user?.id) {
      pop("Personel pasifleştirme yetkisi doğrulanamadı.",7000);
      return false;
    }
    if (!facts.active) {
      pop("Personelin canlı erişimi aktif olarak doğrulanamadı. Listeyi yeniden yükleyin.",8000);
      return false;
    }
    if (!browserOnline || staffDeactivationWritingRef.current || blockingIssue || otherStaffWriteOrIssue) {
      pop(blockingIssue || otherStaffWriteOrIssue ? "Önce bekleyen personel işlemi uyarısını sonuçlandırın." : "İnternet bağlantısı olmadan personel erişimi pasife alınamaz.",8000);
      return false;
    }
    const branchNames = facts.branchIds.map(branchId=>organizationBranches.find(branch=>branch.id===branchId)?.name || "Bilinmeyen şube").join(", ");
    if (!window.confirm(invitation.display_name+" için "+branchNames+" erişimini pasife almak istiyor musunuz? Geçmiş kayıtlar ve hesap kimliği silinmez; yeniden etkinleştirme ayrı bir işlem olacaktır.")) return false;
    const issue = {
      operationId:uid(),
      actorUserId:authSession?.user?.id || "",
      organizationId,
      targetUserId:invitation.target_user_id,
      appRole:invitation.requested_app_role,
      label:invitation.display_name+" · erişimi pasife al",
      state:"writing",
    };
    if (!persistStaffDeactivationIssue(issue)) {
      pop("Pasifleştirme işlem güvenliği tarayıcıda hazırlanamadı; işlem gönderilmedi.",8000);
      return false;
    }
    staffDeactivationWritingRef.current = true;
    setStaffDeactivationBusyId(invitation.id);
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("deactivate_staff_access",{
        p_organization_id:organizationId,
        p_target_user_id:invitation.target_user_id,
        p_expected_app_role:invitation.requested_app_role,
        p_operation_id:issue.operationId,
      }));
      staffDeactivationWritingRef.current = false;
      if (result.error || !["applied","replayed"].includes(result.data?.operationState)) {
        persistStaffDeactivationIssue({ ...issue, state:"unknown" });
        const checked = await checkStaffDeactivationOperation({ ...issue, state:"unknown" },{ notify:false });
        if (!checked.applied) pop(staffDeactivationErrorText(result.error),9000);
        return checked.applied === true;
      }
      const deactivation = result.data?.deactivation || {};
      const exactResult = deactivation.targetUserId === invitation.target_user_id
        && deactivation.organizationId === organizationId
        && deactivation.profileRole === invitation.requested_app_role
        && deactivation.profileActive === false
        && deactivation.organizationMembershipActive === false
        && Number(deactivation.activeBranchMembershipCount) === 0;
      if (!exactResult) {
        persistStaffDeactivationIssue({ ...issue, state:"conflict" });
        pop("Pasifleştirme yanıtı beklenen kullanıcı, kurum ve rolle eşleşmedi. Yeni işlem göndermeyin.",9000);
        return false;
      }
      const refreshed = await loadStaffManagement(organizationId);
      if (!refreshed.ok) {
        persistStaffDeactivationIssue({ ...issue, state:"applied_pending_refresh" });
        pop("Personel erişimi pasife alındı; güncel liste henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return false;
      }
      const refreshedFacts = staffAccessFacts(refreshed.profiles,refreshed.organizationMemberships,refreshed.branchMemberships,refreshed.deactivations,invitation.target_user_id,invitation.requested_app_role);
      if (!refreshedFacts.deactivated) {
        persistStaffDeactivationIssue({ ...issue, state:"conflict" });
        pop("İşlem kaydedildi fakat canlı erişim durumu pasif olarak doğrulanamadı. Yeni işlem göndermeyin.",9000);
        return false;
      }
      clearStaffDeactivationIssue(issue.operationId);
      setStaffAssignmentEditingId("");
      pop("Personel erişimi pasife alındı. Geçmiş kayıtlar korundu.",7000);
      return true;
    } finally {
      staffDeactivationWritingRef.current = false;
      setStaffDeactivationBusyId("");
    }
  };

  const checkStaffDeactivationFromEffect = useEffectEvent((issue,options) => (
    checkStaffDeactivationOperation(issue,options)
  ));

  const revalidateCurrentAccessFromEffect = useEffectEvent(() => revalidateCurrentAccess());

  const openStaffInvite = () => {
    const blockingIssue = (staffInvitationIssue && (!staffInvitationIssue.actorUserId || staffInvitationIssue.actorUserId === authSession?.user?.id))
      || (staffDeactivationIssue && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id));
    if (blockingIssue || staffDeactivationWritingRef.current) {
      pop("Önce bekleyen personel daveti uyarısını sonuçlandırın.",7000);
      return;
    }
    setStaffInviteName("");
    setStaffInviteEmail("");
    setStaffInviteRole("teacher");
    setShowStaffInvite(true);
  };

  useEffect(() => { document.title = "Sonsuz Sanat CRM"; }, []);
  useEffect(() => {
    const actorUserId = String(authSession?.user?.id || "");
    staffInvitationAutoCheckRef.current = "";
    staffActivationAutoCheckRef.current = "";
    staffAssignmentAutoCheckRef.current = "";
    staffDeactivationAutoCheckRef.current = "";
    normalLessonEvaluationAutoCheckRef.current = "";
    normalLessonMakeupAutoCheckRef.current = "";
    normalLessonMakeupPlanAutoCheckRef.current = "";
    normalLessonMakeupCompletionAutoCheckRef.current = "";
    const savedNormalLessonEvaluationIssue = actorUserId ? readNormalLessonEvaluationIssue(actorUserId) : null;
    normalLessonEvaluationIssueRef.current = savedNormalLessonEvaluationIssue;
    setNormalLessonEvaluationIssue(savedNormalLessonEvaluationIssue);
    const savedNormalLessonMakeupIssue = actorUserId ? readNormalLessonMakeupIssue(actorUserId) : null;
    normalLessonMakeupIssueRef.current = savedNormalLessonMakeupIssue;
    setNormalLessonMakeupIssue(savedNormalLessonMakeupIssue);
    const savedNormalLessonMakeupPlanIssue = actorUserId ? readNormalLessonMakeupPlanIssue(actorUserId) : null;
    normalLessonMakeupPlanIssueRef.current = savedNormalLessonMakeupPlanIssue;
    setNormalLessonMakeupPlanIssue(savedNormalLessonMakeupPlanIssue);
    const savedNormalLessonMakeupCompletionIssue = actorUserId ? readNormalLessonMakeupCompletionIssue(actorUserId) : null;
    normalLessonMakeupCompletionIssueRef.current = savedNormalLessonMakeupCompletionIssue;
    setNormalLessonMakeupCompletionIssue(savedNormalLessonMakeupCompletionIssue);
    setStaffInvitationIssue(actorUserId ? readStaffIssue(STAFF_INVITATION_ISSUE_KEY,actorUserId) : null);
    setStaffActivationIssue(actorUserId ? readStaffIssue(STAFF_ACTIVATION_ISSUE_KEY,actorUserId) : null);
    setStaffAssignmentIssue(actorUserId ? readStaffIssue(STAFF_ASSIGNMENT_ISSUE_KEY,actorUserId) : null);
    setStaffDeactivationIssue(actorUserId ? readStaffIssue(STAFF_DEACTIVATION_ISSUE_KEY,actorUserId) : null);
  },[authSession?.user?.id]);
  useEffect(() => {
    if (!giris || !browserOnline || !accessContext || !branchLifecycleIssue?.operationId) return;
    if (branchLifecycleIssue.actorUserId && branchLifecycleIssue.actorUserId !== authSession?.user?.id) return;
    if (branchLifecycleIssue.state === "not_applied" || branchLifecycleIssue.state === "conflict") return;
    if (branchLifecycleAutoCheckRef.current === branchLifecycleIssue.operationId) return;
    branchLifecycleAutoCheckRef.current = branchLifecycleIssue.operationId;
    void checkBranchLifecycleOperation(branchLifecycleIssue,{ notify:false });
  },[giris,browserOnline,accessContext,branchLifecycleIssue?.operationId,authSession?.user?.id]);
  useEffect(() => {
    if (!giris || !browserOnline || !accessContext || !staffInvitationIssue?.operationId) return;
    if (staffInvitationIssue.actorUserId && staffInvitationIssue.actorUserId !== authSession?.user?.id) return;
    if (["not_applied","prepared","conflict"].includes(staffInvitationIssue.state)) return;
    if (staffInvitationIssue.state === "writing" && staffInvitationWritingRef.current) return;
    if (staffInvitationAutoCheckRef.current === staffInvitationIssue.operationId) return;
    staffInvitationAutoCheckRef.current = staffInvitationIssue.operationId;
    void checkStaffInvitationOperation(staffInvitationIssue,{ notify:false });
  },[giris,browserOnline,accessContext,staffInvitationIssue?.operationId,authSession?.user?.id]);
  useEffect(() => {
    if (!giris || !browserOnline || !accessContext || !staffActivationIssue?.operationId) return;
    if (staffActivationIssue.actorUserId && staffActivationIssue.actorUserId !== authSession?.user?.id) return;
    if (["not_applied","conflict"].includes(staffActivationIssue.state)) return;
    if (staffActivationIssue.state === "writing" && staffActivationWritingRef.current) return;
    if (staffActivationAutoCheckRef.current === staffActivationIssue.operationId) return;
    staffActivationAutoCheckRef.current = staffActivationIssue.operationId;
    void checkStaffActivationOperation(staffActivationIssue,{ notify:false });
  },[giris,browserOnline,accessContext,staffActivationIssue?.operationId,authSession?.user?.id]);
  useEffect(() => {
    if (!giris || !browserOnline || !accessContext || !staffAssignmentIssue?.operationId) return;
    if (staffAssignmentIssue.actorUserId && staffAssignmentIssue.actorUserId !== authSession?.user?.id) return;
    if (["not_applied","conflict"].includes(staffAssignmentIssue.state)) return;
    if (staffAssignmentIssue.state === "writing" && staffAssignmentWritingRef.current) return;
    if (staffAssignmentAutoCheckRef.current === staffAssignmentIssue.operationId) return;
    staffAssignmentAutoCheckRef.current = staffAssignmentIssue.operationId;
    void checkStaffAssignmentOperation(staffAssignmentIssue,{ notify:false });
  },[giris,browserOnline,accessContext,staffAssignmentIssue?.operationId,authSession?.user?.id]);
  useEffect(() => {
    if (!giris || !browserOnline || !accessContext || !staffDeactivationIssue?.operationId) return;
    if (staffDeactivationIssue.actorUserId && staffDeactivationIssue.actorUserId !== authSession?.user?.id) return;
    if (["not_applied","conflict"].includes(staffDeactivationIssue.state)) return;
    if (staffDeactivationIssue.state === "writing" && staffDeactivationWritingRef.current) return;
    if (staffDeactivationAutoCheckRef.current === staffDeactivationIssue.operationId) return;
    staffDeactivationAutoCheckRef.current = staffDeactivationIssue.operationId;
    void checkStaffDeactivationFromEffect(staffDeactivationIssue,{ notify:false });
  },[giris,browserOnline,accessContext,staffDeactivationIssue,authSession?.user?.id]);
  useEffect(() => {
    if (!giris) {
      accessContextLoadSequenceRef.current += 1;
      setAccessContext(null);
      setAccessContextLoading(false);
      setAccessContextError("");
      setActiveOrganization(null);
      setCurrentBranch(null);
      setShowBranchMenu(false);
      setShowBranchCreate(false);
      setShowStaffInvite(false);
      setStaffInvitations([]);
      setStaffActivations([]);
      setStaffBranchMemberships([]);
      setStaffOrganizationMemberships([]);
      setStaffProfiles([]);
      setStaffDeactivations([]);
      setStaffManagementError("");
      setStaffAssignmentEditingId("");
      setStaffAssignmentSelections({});
      return;
    }
    void loadAccessContext();
  }, [giris,authSession?.user?.id]);

  useEffect(() => {
    if (!giris || !browserOnline || !authSession?.user?.id || !accessContext || accessContextLoading || !activeOrganization?.id || !currentBranch?.id || typeof window === "undefined") return undefined;
    let cancelled = false;
    const revalidateAccess = async () => {
      if (cancelled || staffAccessRevalidationRef.current) return;
      staffAccessRevalidationRef.current = true;
      try {
        const result = await revalidateCurrentAccessFromEffect();
        if (cancelled) return;
        const message = String(result?.error?.message || result?.error || "");
        if (!result.ok && message.includes("ACCESS_CONTEXT_ACTIVE_STAFF_REQUIRED")) {
          sessionStorage.removeItem(CRM_AUTH_KEY);
          sessionStorage.removeItem(CRM_AUTH_METHOD_KEY);
          sessionStorage.removeItem(CRM_PASSWORD_SETUP_PENDING_KEY);
          await supabase.auth.signOut({ scope:"local" }).catch(()=>{});
          if (!cancelled) {
            setAuthSession(null);
            setGiris(false);
            setAuthError("Personel erişiminiz pasife alındı. Yeniden erişim için kurum sahibiyle görüşün.");
          }
        } else if (!result.ok && !result.accessState) {
          setAccessContext(null);
          setActiveOrganization(null);
          setCurrentBranch(null);
          setAccessContextError("Kurum ve şube yetkileri Supabase'den doğrulanamadı.");
        } else if (!result.ok && result.accessState === "no_selectable_branch") {
          setAccessContext(result.data);
          setActiveOrganization(null);
          setCurrentBranch(null);
          setAccessContextError("Bu hesap için kullanılabilir aktif şube bulunamadı.");
        } else if (!result.ok && result.accessState === "pending_branch_unavailable") {
          setAccessContext(result.data);
          setActiveOrganization(null);
          setCurrentBranch(null);
          setAccessContextError("Sonucu bekleyen bir işlemin şubesine artık erişilemiyor. Yetki düzeltilmeden işlem güvenle kontrol edilemez.");
        } else if (!result.ok && result.accessState === "current_branch_unavailable") {
          setAccessContext(result.data);
          setActiveOrganization(null);
          setCurrentBranch(null);
          setAccessContextError("");
        } else if (result.ok && result.selectedOption) {
          setAccessContext(result.data);
          setAccessContextError("");
          setActiveOrganization(result.selectedOption.organization);
          setCurrentBranch({
            ...result.selectedOption.branch,
            id:result.selectedOption.branchId,
            name:result.selectedOption.branchName,
            organization_id:result.selectedOption.organizationId,
            organizationName:result.selectedOption.organizationName,
          });
        }
      } finally {
        staffAccessRevalidationRef.current = false;
      }
    };
    const onFocus = () => { void revalidateAccess(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void revalidateAccess(); };
    const intervalId = window.setInterval(()=>{ if (document.visibilityState === "visible") void revalidateAccess(); },300000);
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[giris,browserOnline,authSession?.user?.id,accessContext,accessContextLoading,activeOrganization?.id,currentBranch?.id]);

  useEffect(() => {
    if (mainTab === "subeler" && activeOrganization && activeOrganization.canCreateBranches !== true) setMainTab("bugün");
  },[mainTab,activeOrganization?.id,activeOrganization?.canCreateBranches]);

  useEffect(() => {
    const canManageStaff = activeOrganization?.role === "owner" && accessContext?.profileRole === "admin";
    if (mainTab === "personel" && activeOrganization && !canManageStaff) {
      setMainTab("bugün");
      return;
    }
    if (mainTab === "personel" && canManageStaff && activeOrganization?.id && browserOnline) {
      void loadStaffManagement(activeOrganization.id);
    }
  },[mainTab,activeOrganization?.id,activeOrganization?.role,accessContext?.profileRole,browserOnline]);

  useEffect(() => {
    const generation = protectedDataLoadGenerationRef.current + 1;
    protectedDataLoadGenerationRef.current = generation;
    if (!giris || !activeOrganization?.id || !currentBranch?.id) {
      singleLessonLoadSequenceRef.current += 1;
      monthlyReportLoadSequenceRef.current += 1;
      reportInitializationRef.current = false;
      setStudents([]);
      setTeachers([]);
      setExpenses([]);
      setSingleLessons([]);
      setSingleLessonsLoaded(false);
      setSingleLessonsLoading(false);
      setSingleLessonSecurityReady(false);
      setMonthlyReports([]);
      setLoadedSources({ students:false, teachers:false, expenses:false });
      setProtectedDataLoadIssues({ students:false, teachers:false, expenses:false });
      setProtectedDataRetrying(false);
      setConnectionRevalidationRequired(giris ? false : !browserOnline);
      connectionAutoRetryRef.current = false;
      setLoading(giris && accessContextLoading);
      setDetailSt(null);
      setActionModal(null);
      setMesajSt(null);
      setÖdemeSt(null);
      setÖdemeKaydetModal(null);
      setSingleLessonSheet(null);
      return;
    }
    setLoading(true);
    setConnectionRevalidationRequired(!browserOnline);
    connectionAutoRetryRef.current = false;
    setLoadedSources({ students:false, teachers:false, expenses:false });
    setProtectedDataLoadIssues({ students:false, teachers:false, expenses:false });
    setProtectedDataRetrying(false);
    Promise.all([
      loadStudents(generation,currentBranch.id),
      loadTeachers(generation,activeOrganization.id),
      loadExpenses(generation,currentBranch.id),
      loadSingleLessons({ branch:currentBranch }),
    ]).then(results=>{
      if (generation === protectedDataLoadGenerationRef.current && results.every(result=>result.ok)) {
        setConnectionRevalidationRequired(false);
        connectionAutoRetryRef.current = true;
      }
    }).finally(()=>{
      if (generation === protectedDataLoadGenerationRef.current) setLoading(false);
    });
  }, [giris,activeOrganization?.id,currentBranch?.id]);

  const reconcileSingleLessonOperation = async (operation, attempts=1) => {
    if (!operation?.operationId) return { state:"unknown", data:null };
    const operationBranchId = operation.branchId || currentBranch?.id;
    if (!operationBranchId) {
      rememberSingleLessonIssue({ ...operation, kind:"operation", state:"unknown" });
      return { state:"unknown", data:null, error:new Error("SINGLE_LESSON_BRANCH_NOT_READY") };
    }
    setSingleLessonIssueChecking(true);
    let lastError = null;
    try {
      for (let attempt=0; attempt<attempts; attempt+=1) {
        if (attempt > 0) await waitMilliseconds(attempt === 1 ? 1500 : 4000);
        const operationResult = await timedSingleLessonRequest(() => supabase
          .from("single_lesson_operations")
          .select("operation_id,single_lesson_id,resulting_record_version")
          .eq("operation_id",operation.operationId)
          .eq("branch_id",operationBranchId)
          .maybeSingle());
        if (operationResult.error) {
          lastError = operationResult.error;
          continue;
        }
        lastError = null;
        if (!operationResult.data?.single_lesson_id) continue;
        const lessonResult = await timedSingleLessonRequest(() => supabase
          .from("single_lessons")
          .select("*")
          .eq("id",operationResult.data.single_lesson_id)
          .eq("branch_id",operationBranchId)
          .single());
        if (lessonResult.error || !lessonResult.data?.id) {
          lastError = lessonResult.error || new Error("SINGLE_LESSON_RECONCILIATION_ROW_MISSING");
          continue;
        }
        setSingleLessons(current => {
          const exists = current.some(item=>item.id===lessonResult.data.id);
          return exists ? current.map(item=>item.id===lessonResult.data.id?lessonResult.data:item) : [...current,lessonResult.data];
        });
        clearSingleLessonIssue(issue=>issue.kind === "operation" && issue.operationId === operation.operationId);
        pop("Tek Ders işlemi Supabase kaydından doğrulandı.",6000);
        return { state:"applied", data:lessonResult.data };
      }
      const refreshed = await loadSingleLessons({ preserveIssue:true });
      if (refreshed.ok && !lastError) {
        rememberSingleLessonIssue({ ...operation, kind:"operation", state:"not_applied" });
        return { state:"not_applied", data:null };
      }
      rememberSingleLessonIssue({ ...operation, kind:"operation", state:"unknown" });
      return { state:"unknown", data:null, error:lastError || refreshed.error };
    } finally {
      setSingleLessonIssueChecking(false);
    }
  };

  const persistSingleLessonUpdate = async (lesson, changes, successMessage) => {
    if (!lesson?.id) return null;
    const branchId = currentBranch?.id;
    if (!branchId || lesson.branch_id !== branchId) {
      pop("Seçili şubeyle Tek Ders kaydı uyuşmuyor; işlem yapılmadı.",8000);
      return null;
    }
    const transitionError = singleLessonTransitionError(lesson,changes);
    if (transitionError) { pop(transitionError,9000); return null; }
    if (singleLessonBusyIdsRef.current[lesson.id]) {
      pop("Bu Tek Ders için başka bir işlem hâlâ devam ediyor.",7000);
      return null;
    }
    if (!singleLessonSecurityReady) {
      rememberSingleLessonIssue({ kind:"setup", state:"failed" });
      pop("Tek Ders güvenlik bağlantısı hazır değil; işlem yapılmadı.",8000);
      return null;
    }
    if (singleLessonIssueRef.current?.kind === "operation" && singleLessonIssueRef.current.state !== "not_applied") {
      pop("Önce sonucu belirsiz Tek Ders işlemini yeniden kontrol edin.",8000);
      return null;
    }
    const operation = { kind:"operation", operationType:"update", operationId:uid(), lessonId:lesson.id, branchId:currentBranch.id, label:successMessage || "Tek Ders değişikliği" };
    setSingleLessonRecordBusy(lesson.id,true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("single_lessons")
        .update({ ...changes, last_write_id:operation.operationId })
        .eq("id",lesson.id)
        .eq("branch_id",branchId)
        .eq("record_version",lesson.record_version)
        .select("*")
        .single());
      if (!result.error && result.data?.id && result.data.last_write_id===operation.operationId && result.data.record_version===lesson.record_version+1) {
        setSingleLessons(current=>current.map(item=>item.id===result.data.id?result.data:item));
        clearSingleLessonIssue(issue=>issue.kind === "operation" && issue.operationId === operation.operationId);
        if (successMessage) pop(successMessage);
        return result.data;
      }
      console.error("Tek Ders güncellemesi doğrulanamadı:",result.error);
      rememberSingleLessonIssue({ ...operation, state:result.timedOut?"timeout":"unknown" });
      pop(result.timedOut ? "Tek Ders işlemi uzun sürdü; veritabanındaki sonucu kontrol ediyorum." : "Tek Ders değişikliği doğrulanamadı; veritabanındaki gerçek durum kontrol ediliyor.",9000);
      const reconciled = await reconcileSingleLessonOperation(operation,result.timedOut?3:1);
      return reconciled.state === "applied" ? reconciled.data : null;
    } finally {
      setSingleLessonRecordBusy(lesson.id,false);
    }
  };

  const handleSingleLessonSave = async (payload, existingLesson) => {
    if (singleLessonSavingRef.current) return;
    if (!currentBranch?.id) {
      pop("Şube bilgisi hazır değil; Tek Ders kaydedilmedi.",7000);
      return;
    }
    if (!singleLessonSecurityReady) {
      rememberSingleLessonIssue({ kind:"setup", state:"failed" });
      pop("Tek Ders güvenlik bağlantısı hazır değil; kayıt yapılmadı.",8000);
      return;
    }
    if (singleLessonIssueRef.current?.kind === "operation" && singleLessonIssueRef.current.state !== "not_applied") {
      pop("Önce sonucu belirsiz Tek Ders işlemini yeniden kontrol edin.",8000);
      return;
    }
    const branchId = currentBranch.id;
    singleLessonSavingRef.current = true;
    setSingleLessonSaving(true);
    if (existingLesson?.id) {
      const saved = await persistSingleLessonUpdate(existingLesson,payload,"Tek Ders güncellendi");
      if (saved) setSingleLessonSheet(null);
      singleLessonSavingRef.current = false;
      setSingleLessonSaving(false);
      return;
    }
    const payloadSignature = JSON.stringify(payload);
    if (!pendingSingleLessonCreateRef.current || pendingSingleLessonCreateRef.current.payloadSignature !== payloadSignature) {
      pendingSingleLessonCreateRef.current = { operationId:uid(), lessonId:uid(), payloadSignature };
    }
    const operation = {
      kind:"operation",
      operationType:"insert",
      operationId:pendingSingleLessonCreateRef.current.operationId,
      lessonId:pendingSingleLessonCreateRef.current.lessonId,
      branchId,
      label:"Yeni Tek Ders kaydı",
    };
    try {
      const result = await timedSingleLessonRequest(() => supabase.from("single_lessons").insert({ ...payload, id:operation.lessonId, branch_id:branchId, last_write_id:operation.operationId }).select("*").single());
      if (!result.error && result.data?.id===operation.lessonId && result.data.last_write_id===operation.operationId) {
        setSingleLessons(current=>current.some(item=>item.id===result.data.id)?current.map(item=>item.id===result.data.id?result.data:item):[...current,result.data]);
        pendingSingleLessonCreateRef.current = null;
        clearSingleLessonIssue(issue=>issue.kind === "operation" && issue.operationId === operation.operationId);
        setSingleLessonSheet(null);
        pop("Tek Ders kaydedildi");
        return;
      }
      console.error("Tek Ders kaydı doğrulanamadı:",result.error);
      rememberSingleLessonIssue({ ...operation, state:result.timedOut?"timeout":"unknown" });
      pop(result.timedOut ? "Tek Ders kaydı uzun sürdü; veritabanındaki sonucu kontrol ediyorum." : "Tek Ders kaydı doğrulanamadı; veritabanındaki gerçek durum kontrol ediliyor.",9000);
      const reconciled = await reconcileSingleLessonOperation(operation,result.timedOut?3:1);
      if (reconciled.state === "applied") {
        pendingSingleLessonCreateRef.current = null;
        setSingleLessonSheet(null);
      }
    } finally {
      singleLessonSavingRef.current = false;
      setSingleLessonSaving(false);
    }
  };

  const handleSingleLessonIssueCheck = async () => {
    if (singleLessonIssueChecking) return;
    const issue = singleLessonIssueRef.current;
    if (issue?.kind === "operation" && issue.operationId) {
      await reconcileSingleLessonOperation(issue,3);
      return;
    }
    setSingleLessonIssueChecking(true);
    try {
      await loadSingleLessons();
    } finally {
      setSingleLessonIssueChecking(false);
    }
  };

  const handleSingleLessonStatus = async (lesson, status) => {
    const label = status==="planned" ? "Tek Ders planlandıya geri alındı" : "Tek Ders durumu: "+singleLessonStatusLabel(status);
    await persistSingleLessonUpdate(lesson,{ lesson_status:status },label);
  };

  const handleSingleLessonPayment = async (lesson, status) => {
    const paid = status==="paid";
    if (!paid && typeof window!=="undefined" && !window.confirm(lesson.participant_name+" için alınmış Tek Ders ödemesini geri almak istiyor musunuz?")) return;
    await persistSingleLessonUpdate(lesson,{
      billing_status:status,
      paid_on:paid?localDateKey():null,
      payment_recorded_at:paid?new Date().toISOString():null,
    },paid?"Tek Ders ödemesi alındı":"Tek Ders ödemesi geri alındı");
  };

  const handleSingleLessonReminderToggle = async (lesson, sent) => {
    if (sent && !authSession?.user?.id) {
      pop("Yetkili oturum doğrulanamadı; hatırlatma işareti kaydedilmedi.",7000);
      return null;
    }
    return persistSingleLessonUpdate(lesson,{
      reminder_sent_at:sent?new Date().toISOString():null,
      reminder_sent_by:sent?authSession.user.id:null,
    },sent?"Tek Ders hatırlatması gönderildi işaretlendi":"Tek Ders hatırlatma işareti kaldırıldı");
  };

  const handleWASingleLesson = async lesson => {
    const text = msgTekDersHatirlatma(lesson);
    const phone = lesson.participant_phone ? lesson.participant_phone.replace(/[^0-9]/g,"") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text),"_blank");
    else {
      try {
        await navigator.clipboard.writeText(text);
        pop("Tek Ders hatırlatma mesajı kopyalandı");
      } catch {
        pop("Telefon bulunamadı; hatırlatma mesajı kopyalanamadı.",7000);
        return;
      }
    }
    await handleSingleLessonReminderToggle(lesson,true);
  };

  const handleSingleLessonDelete = async lesson => {
    if (lesson.billing_status==="paid") {
      pop("Ödenmiş Tek Ders silinemez. Önce ödemeyi geri alın.",7000);
      return;
    }
    if (typeof window!=="undefined" && !window.confirm(lesson.participant_name+" için Tek Ders kaydını kaldırmak istiyor musunuz? Kayıt güvenli arşivde korunacaktır.")) return;
    if (!authSession?.user?.id) {
      pop("Yetkili oturum doğrulanamadı; kayıt silinmedi.",7000);
      return;
    }
    await persistSingleLessonUpdate(lesson,{ deleted_at:new Date().toISOString(), deleted_by:authSession.user.id },"Tek Ders güvenli arşive alındı");
  };

  useEffect(() => {
    if (!giris || !currentBranch?.id || !activeOrganization?.id || !loadedSources.students || !loadedSources.teachers || !loadedSources.expenses || !singleLessonsLoaded || reportInitializationRef.current) return;
    reportInitializationRef.current = true;
    const reportSequence = monthlyReportLoadSequenceRef.current + 1;
    monthlyReportLoadSequenceRef.current = reportSequence;
    branchScopedWriteCountRef.current += 1;
    const initialize = async () => {
      const branch = currentBranch;
      const reportResult = await supabase.from("monthly_reports").select("*").eq("branch_id",branch.id).order("report_month",{ ascending:false });
      if (reportResult.error) {
        console.error("Aylık rapor arşivi yüklenemedi:",reportResult.error);
        pop("Ay sonu rapor arşivi yüklenemedi. v83 Supabase SQL dosyasını kontrol edin.",9000);
        return;
      }
      let rows = reportResult.data || [];
      const missingMonths = reportMonthsToEnsure(rows);
      for (const targetMonth of missingMonths) {
        const snapshot = buildMonthlyInstitutionReport(students,teachers,expenses,targetMonth,branch,singleLessons);
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
      if (reportSequence !== monthlyReportLoadSequenceRef.current) return;
      setMonthlyReports((refreshed.data || []).map(reportFromRow));
    };
    initialize().catch(error=>{
      console.error("Aylık rapor başlatma hatası:",error);
      pop("Ay sonu raporu hazırlanamadı.",9000);
    }).finally(()=>{
      branchScopedWriteCountRef.current = Math.max(0,branchScopedWriteCountRef.current - 1);
    });
  },[giris,currentBranch?.id,activeOrganization?.id,loadedSources.students,loadedSources.teachers,loadedSources.expenses,singleLessonsLoaded,students,teachers,expenses,singleLessons]);

  const handleMonthlyReportDownload = async report => {
    if (!report?.id || downloadingReportId) return;
    if (!currentBranch?.id || (report.branchId && report.branchId !== currentBranch.id)) {
      pop("Rapor seçili şubeyle uyuşmuyor; işlem yapılmadı.",7000);
      return;
    }
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
      branch_id: student.branch_id || currentBranch?.id || null,
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
    if (!requireProtectedSources(["students"],"Öğrenci kaydı")) throw new Error("STUDENTS_NOT_LOADED");
    const branchId = currentBranch?.id;
    if (!branchId || (student.branch_id && student.branch_id !== branchId)) {
      pop("Aktif şube doğrulanamadı; öğrenci kaydı gönderilmedi.",8000);
      throw new Error("STUDENT_BRANCH_CONTEXT_MISMATCH");
    }
    return runBranchScopedWrite(async () => {
      const currentVersion = typeof student.record_version === "number" ? student.record_version : 0;
      const writeId = uid();
      const nextVersion = currentVersion + 1;
      const payload = { ...studentPayload(student,nextVersion,writeId), branch_id:branchId };
      const isExisting = !!student.created_at || typeof student.record_version === "number";
      let data = null;
      let error = null;

      if (isExisting) {
        const result = await supabase
          .from("students")
          .update(payload)
          .eq("id", student.id)
          .eq("branch_id",branchId)
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

      if (error || !data?.id || data.branch_id !== branchId || data.last_write_id !== writeId || data.record_version !== nextVersion) {
        console.error("Kayıt hatası:", error);
        pop("Kayıt güvenli şekilde doğrulanamadı. Ekran veritabanından yenilendi.", 8000);
        await loadStudents(undefined,branchId);
        throw new Error("Veritabanı kaydı doğrulanamadı");
      }

      setStudents(prev => prev.map(s => s.id === data.id ? data : s));
      return data;
    });
  };

  const saveStudentWithRetry = async (student, operation=null, options={}) => {
    const branchId = currentBranch?.id;
    return runBranchScopedWrite(async () => {
      let lastError = null;
      const attempts = options.attempts || MAX_SAVE_RETRIES;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await saveStudent(student);
        } catch (error) {
          lastError = error;
          if (attempt < attempts && branchId) {
            await new Promise(resolve => setTimeout(resolve, 450 * attempt));
            const { data } = await supabase.from("students").select("*").eq("id",student.id).eq("branch_id",branchId).single();
            if (data) student = { ...student, branch_id:branchId, record_version:typeof data.record_version === "number" ? data.record_version : 0 };
          }
        }
      }
      rememberFailedOperation(operation ? { ...operation, branchId:operation.branchId || branchId || "" } : null,lastError);
      pop("İşlem şu an kaydedilemedi. Tekrar denemek için üstte uyarı olarak tutuldu.", 9000);
      throw lastError || new Error("Kayıt başarısız");
    });
  };

  const updLesson = (schedule, lid, status, note="") => {
    if (lid) return schedule.map(l => l.id===lid ? {...l,status,note} : l);
    const i = schedule.findIndex(l=>l.status==="upcoming");
    if (i===-1) return schedule;
    const s=[...schedule]; s[i]={...s[i],status,note}; return s;
  };

  const mkTelafi = (student, lid, note, options = {}) => {
    const lesson = lid ? student.schedule.find(l=>l.id===lid) : student.schedule.find(l=>l.status==="upcoming");
    const createdAt = new Date().toISOString();
    const lessonDate = lesson?.date || createdAt;
    return { id:uid(), lessonId:lesson?.id||null, lessonDate, note, createdAt, expiry:expiry30FromLessonDate(lessonDate), done:false, doneAt:null, ...(options.managerException ? { managerException:true, managerExceptionAt:createdAt } : {}) };
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

  const buildActionUpdate = (sourceStudents, sid, action, note="", lid=null, actionOptions={}) => {
    let msg = "Kaydedildi";
    const updated = sourceStudents.map(s => {
      if (s.id !== sid) return s;
      const oldLesson = lid ? s.schedule.find(l=>l.id===lid) : s.schedule.find(l=>l.status==="upcoming");
      const noShowFix = oldLesson?.status === "noshow" ? -1 : 0;
      const cleanTelafiForLesson = (records) => telafiRecordsWithoutLesson(records, oldLesson || (lid ? { id:lid } : null));
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
          const baseRecords = cleanTelafiForLesson(s.telafi_records||[]);
          const quotaBefore = telafiQuotaInfo({ ...s, telafi_records:baseRecords }, oldLesson?.date || new Date(), baseRecords);
          const managerException = actionOptions.managerException === true && quotaBefore.count !== null && quotaBefore.count>=6;
          const rec = mkTelafi(s, lid, note||"24 saat oncesi iptal", { managerException });
          const recs = clearHomeworkCheckInTelafi([...baseRecords, rec], homeworkCheckRef("lesson", lid));
          const quota = telafiQuotaInfo({ ...s, telafi_records:recs }, rec.lessonDate, recs);
          msg = managerException ? "Yönetici inisiyatifiyle telafi oluşturuldu" : quota.count===null ? "Telafi oluşturuldu - başlangıç tarihi gerekli" : quota.count===6 ? "6/6 telafi hakkı doldu" : quota.count===5 ? "5. telafi uyarisi" : "Telafi oluşturuldu";
          return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:recs, schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "telafi", note)};
        }
        case "lm-telafi": {
          const baseRecords = cleanTelafiForLesson(s.telafi_records||[]);
          const quotaBefore = telafiQuotaInfo({ ...s, telafi_records:baseRecords }, oldLesson?.date || new Date(), baseRecords);
          const managerException = actionOptions.managerException === true && quotaBefore.count !== null && quotaBefore.count>=6;
          const rec = mkTelafi(s, lid, note||"Son dakika iptali", { managerException });
          const recs = clearHomeworkCheckInTelafi([...baseRecords, rec], homeworkCheckRef("lesson", lid));
          const quota = telafiQuotaInfo({ ...s, telafi_records:recs }, rec.lessonDate, recs);
          msg = managerException ? "Yönetici inisiyatifiyle son dakika telafisi oluşturuldu" : quota.count===null ? "Son dakika + telafi kaydedildi - başlangıç tarihi gerekli" : quota.count===6 ? "6/6 telafi hakkı doldu" : quota.count===5 ? "5. telafi uyarisi" : "Son dakika + telafi kaydedildi";
          return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:recs, schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "lastminute", note||"Son dakika iptali")};
        }
        case "lm-notelafi": msg = "Son dakika iptali"; return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:clearHomeworkCheckInTelafi(cleanTelafiForLesson(s.telafi_records||[]), homeworkCheckRef("lesson", lid)), schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "lastminute", note||"Son dakika iptali")};
        case "noshow": msg = "No-show kaydedildi"; return {...s, no_show:Math.max(0, s.no_show + (oldLesson?.status === "noshow" ? 0 : 1)), telafi_records:clearHomeworkCheckInTelafi(cleanTelafiForLesson(s.telafi_records||[]), homeworkCheckRef("lesson", lid)), schedule: updLesson(clearHomeworkEffects(s.schedule, lid), lid, "noshow", note||"Habersiz gelmedi")};
        case "reset-upcoming": msg = "Ders planlandıya alındı"; return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:clearHomeworkCheckInTelafi(cleanTelafiForLesson(s.telafi_records||[]), homeworkCheckRef("lesson", lid)), schedule: clearHomeworkEffects(s.schedule, lid).map(l => l.id===lid ? {...l, status:"upcoming", note:"", activeMinutes:0, taskFocusMinutes:0, redirectionCount:0, lessonFocus:"", lessonScore:null, lessonScoreBreakdown:null, evaluatedHomework:"", evaluatedHomeworkStatus:"", focusMinutes:0, productiveMinutes:0, productiveWindow:"", focusSection:""} : l)};
        default: return s;
      }
    });
    return { updated, msg };
  };

  const checkNormalLessonEvaluationOperation = async (issue=normalLessonEvaluationIssueRef.current, options={}) => {
    if (!issue?.operationId || normalLessonEvaluationCheckingRef.current) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    if (!browserOnline) {
      if (options.notify !== false) pop("İnternet bağlantısı olmadan ders değerlendirme sonucu kontrol edilemez. Uyarı ekranda kalacak.",8000);
      return { ok:false, offline:true };
    }
    normalLessonEvaluationCheckingRef.current = true;
    setNormalLessonEvaluationIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("normal_lesson_evaluation_operations")
        .select("operation_id,student_id,branch_id,lesson_id,operation_kind,expected_record_version,resulting_record_version,request_payload,actor_user_id,created_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistNormalLessonEvaluationIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Ders değerlendirme sonucu henüz doğrulanamadı. Uyarı ekranda kalacak; işlemi tekrar göndermeyin.",9000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const createdAtMs = new Date(issue.createdAt || 0).getTime();
        const waitedLongEnough = Number.isFinite(createdAtMs) && Date.now() - createdAtMs >= NORMAL_LESSON_EVALUATION_ABSENCE_SETTLE_MS;
        if (options.knownRejected !== true && !waitedLongEnough) {
          persistNormalLessonEvaluationIssue({ ...issue, state:"unknown", notFoundSince:issue.notFoundSince || new Date().toISOString() });
          if (options.notify !== false) pop("Ders değerlendirme kanıtı henüz görünmüyor. Biraz sonra yeniden kontrol edin; işlemi tekrar göndermeyin.",9000);
          return { ok:false, applied:false, uncertain:true };
        }
        if (currentBranch?.id === issue.branchId) await loadStudents(undefined,issue.branchId);
        persistNormalLessonEvaluationIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Ders değerlendirmesi Supabase'de bulunamadı; kayıt oluşmadı.",7000);
        return { ok:true, applied:false };
      }
      const row = result.data;
      const exactEvidence = row.operation_id === issue.operationId
        && row.student_id === issue.studentId
        && row.branch_id === issue.branchId
        && row.lesson_id === issue.lessonId
        && row.operation_kind === issue.expectedOperationKind
        && Number(row.expected_record_version) === Number(issue.expectedRecordVersion)
        && Number(row.resulting_record_version) > Number(row.expected_record_version)
        && row.actor_user_id === issue.actorUserId
        && normalLessonEvaluationIntentSignature(row.request_payload) === issue.requestSignature;
      if (!exactEvidence) {
        persistNormalLessonEvaluationIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Ders değerlendirme kanıtı beklenen öğrenci veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      const studentResult = await timedSingleLessonRequest(() => supabase
        .from("students")
        .select("*")
        .eq("id",issue.studentId)
        .eq("branch_id",issue.branchId)
        .single());
      if (studentResult.error || !studentResult.data?.id) {
        persistNormalLessonEvaluationIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Ders değerlendirmesi Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      const savedStudent = studentResult.data;
      const authoritative = savedStudent.branch_id === issue.branchId
        && Number(savedStudent.record_version) >= Number(row.resulting_record_version);
      if (!authoritative) {
        persistNormalLessonEvaluationIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Ders değerlendirmesi bulundu fakat öğrenci kaydının güncel sürümü doğrulanamadı. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      if (currentBranch?.id !== issue.branchId) {
        persistNormalLessonEvaluationIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Ders değerlendirmesi kaydedildi. Güncel kaydı görmek için işlemin ait olduğu şubeyi açın.",9000);
        return { ok:false, applied:true, wrongBranch:true };
      }
      setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
      setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
      setActionModal(null);
      const cleared = clearNormalLessonEvaluationIssue(issue.operationId);
      if (!cleared) {
        normalLessonEvaluationIssueRef.current = { ...issue, state:"applied_pending_refresh" };
        setNormalLessonEvaluationIssue({ ...issue, state:"applied_pending_refresh" });
      }
      if (options.notify !== false) pop("Ders değerlendirmesi Supabase'de doğrulandı ve ekran yenilendi.",7000);
      return { ok:true, applied:true, row, student:savedStudent };
    } finally {
      normalLessonEvaluationCheckingRef.current = false;
      setNormalLessonEvaluationIssueChecking(false);
    }
  };

  const handleNormalLessonEvaluation = async (sid, detail, lid, actionOptions={}) => {
    const sourceStudent = students.find(student=>student.id === sid);
    const branchId = currentBranch?.id;
    if (!requireProtectedSources(["students"],"Ders değerlendirmesi")) return false;
    if (!browserOnline) {
      pop("İnternet bağlantısı olmadan ders değerlendirmesi kaydedilemez.",7000);
      return false;
    }
    if (!sourceStudent?.id || !lid || !branchId || sourceStudent.branch_id !== branchId) {
      pop("Öğrenci, ders veya aktif şube güvenli biçimde doğrulanamadı; kayıt gönderilmedi.",8000);
      return false;
    }
    if (normalLessonEvaluationWritingRef.current || normalLessonEvaluationIssueRef.current) {
      pop("Önce devam eden ders değerlendirmesi sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupWritingRef.current || normalLessonMakeupIssueRef.current) {
      pop("Önce bekleyen telafi hakkı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupPlanWritingRef.current || normalLessonMakeupPlanIssueRef.current) {
      pop("Önce bekleyen telafi planı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupCompletionWritingRef.current || normalLessonMakeupCompletionIssueRef.current) {
      pop("Önce bekleyen telafi tamamlama sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    const intent = normalLessonEvaluationIntent(sourceStudent,lid,detail,actionOptions.correctionReason);
    if (!intent.lesson || !intent.evaluation.lessonFocus) {
      pop("Ders değerlendirme bilgileri eksik; kayıt gönderilmedi.",7000);
      return false;
    }
    if (intent.expectedOperationKind === "corrected" && !intent.correctionReason) {
      pop("Daha önce kaydedilmiş ders verilerini değiştirmek için düzeltme nedeni zorunludur.",7000);
      return false;
    }
    const operationId = uid();
    const issue = {
      operationId,
      actorUserId:authSession?.user?.id || "",
      branchId,
      studentId:sid,
      studentName:sourceStudent.name || "Öğrenci",
      lessonId:lid,
      expectedRecordVersion:intent.expectedRecordVersion,
      expectedOperationKind:intent.expectedOperationKind,
      requestSignature:normalLessonEvaluationIntentSignature(intent.requestPayload),
      label:(sourceStudent.name || "Öğrenci")+" · "+fmtDate(intent.lesson.date)+" "+lessonTime(sourceStudent,intent.lesson),
      state:"writing",
      createdAt:new Date().toISOString(),
    };
    if (!persistNormalLessonEvaluationIssue(issue)) {
      pop("Ders değerlendirme işlem güvenliği tarayıcıda hazırlanamadı; kayıt gönderilmedi.",9000);
      return false;
    }
    normalLessonEvaluationWritingRef.current = true;
    setNormalLessonEvaluationBusyId(lid);
    try {
      const result = await runBranchScopedWrite(() => timedSingleLessonRequest(() => supabase.rpc("record_normal_lesson_evaluation",{
        p_student_id:sid,
        p_lesson_id:lid,
        p_expected_record_version:intent.expectedRecordVersion,
        p_evaluation:intent.evaluation,
        p_correction_reason:intent.correctionReason || null,
        p_invalidated_package_key:intent.invalidatedPackageKey || null,
        p_operation_id:operationId,
      }).single()));
      if (!result.error && result.data?.operation_state === "applied") {
        const savedStudent = result.data.student_record;
        const evaluatedLesson = (savedStudent?.schedule || []).find(lesson=>lesson.id === lid);
        const exactResult = result.data.operation_kind === intent.expectedOperationKind
          && savedStudent?.id === sid
          && savedStudent?.branch_id === branchId
          && Number(savedStudent?.record_version) === intent.expectedRecordVersion + 1
          && savedStudent?.last_write_id === operationId
          && evaluatedLesson?.status === "completed"
          && storedLessonScore(evaluatedLesson) !== null;
        if (exactResult) {
          setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
          setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
          setActionModal(null);
          const cleared = clearNormalLessonEvaluationIssue(operationId);
          if (!cleared) {
            normalLessonEvaluationIssueRef.current = { ...issue, state:"applied_pending_refresh" };
            setNormalLessonEvaluationIssue({ ...issue, state:"applied_pending_refresh" });
          }
          pop(intent.expectedOperationKind === "corrected" ? "Ders değerlendirmesi gerekçesiyle düzeltildi" : "Katılım ve verim bilgisi kaydedildi");
          setLessonEvaluationPrompt({ student:savedStudent, record:evaluatedLesson, type:"normal" });
          return true;
        }
      }
      persistNormalLessonEvaluationIssue({ ...issue, state:"unknown" });
      if (normalLessonEvaluationKnownRejection(result.error)) {
        await checkNormalLessonEvaluationOperation({ ...issue, state:"unknown" },{ notify:false, knownRejected:true });
        setActionModal(null);
        pop(normalLessonEvaluationErrorText(result.error),9000);
        return false;
      }
      const checked = await checkNormalLessonEvaluationOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        const evaluatedLesson = (checked.student.schedule || []).find(lesson=>lesson.id === lid);
        pop("Ders değerlendirmesi Supabase'de doğrulandı ve ekran yenilendi.",7000);
        if (evaluatedLesson && storedLessonScore(evaluatedLesson) !== null) setLessonEvaluationPrompt({ student:checked.student, record:evaluatedLesson, type:"normal" });
      } else if (!checked.applied) pop(normalLessonEvaluationErrorText(result.error),9000);
      return checked.applied === true;
    } catch (error) {
      persistNormalLessonEvaluationIssue({ ...issue, state:"unknown" });
      const checked = await checkNormalLessonEvaluationOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        const evaluatedLesson = (checked.student.schedule || []).find(lesson=>lesson.id === lid);
        pop("Ders değerlendirmesi Supabase'de doğrulandı ve ekran yenilendi.",7000);
        if (evaluatedLesson && storedLessonScore(evaluatedLesson) !== null) setLessonEvaluationPrompt({ student:checked.student, record:evaluatedLesson, type:"normal" });
      } else if (!checked.applied) pop(normalLessonEvaluationErrorText(error),9000);
      return checked.applied === true;
    } finally {
      normalLessonEvaluationWritingRef.current = false;
      setNormalLessonEvaluationBusyId("");
    }
  };

  const checkNormalLessonMakeupOperation = async (issue=normalLessonMakeupIssueRef.current, options={}) => {
    if (!issue?.operationId || normalLessonMakeupCheckingRef.current) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    if (!browserOnline) {
      if (options.notify !== false) pop("İnternet bağlantısı olmadan telafi hakkı sonucu kontrol edilemez. Uyarı ekranda kalacak.",8000);
      return { ok:false, offline:true };
    }
    normalLessonMakeupCheckingRef.current = true;
    setNormalLessonMakeupIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("normal_lesson_makeup_operations")
        .select("operation_id,student_id,branch_id,lesson_id,operation_kind,action_kind,manager_exception,expected_record_version,resulting_record_version,request_payload,created_makeup_record,quota_normal_count_after,quota_exception_count_after,actor_user_id,created_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistNormalLessonMakeupIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Telafi hakkı sonucu henüz doğrulanamadı. Uyarı ekranda kalacak; işlemi tekrar göndermeyin.",9000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const createdAtMs = new Date(issue.createdAt || 0).getTime();
        const waitedLongEnough = Number.isFinite(createdAtMs) && Date.now() - createdAtMs >= NORMAL_LESSON_MAKEUP_ABSENCE_SETTLE_MS;
        if (options.knownRejected !== true && !waitedLongEnough) {
          persistNormalLessonMakeupIssue({ ...issue, state:"unknown", notFoundSince:issue.notFoundSince || new Date().toISOString() });
          if (options.notify !== false) pop("Telafi hakkı kanıtı henüz görünmüyor. Biraz sonra yeniden kontrol edin; işlemi tekrar göndermeyin.",9000);
          return { ok:false, applied:false, uncertain:true };
        }
        if (currentBranch?.id === issue.branchId) await loadStudents(undefined,issue.branchId);
        persistNormalLessonMakeupIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Telafi hakkı işlemi Supabase'de bulunamadı; kayıt oluşmadı.",7000);
        return { ok:true, applied:false };
      }
      const row = result.data;
      const createdRecord = row.created_makeup_record;
      const exactEvidence = row.operation_id === issue.operationId
        && row.student_id === issue.studentId
        && row.branch_id === issue.branchId
        && row.lesson_id === issue.lessonId
        && row.operation_kind === issue.expectedOperationKind
        && row.action_kind === issue.actionKind
        && Number(row.expected_record_version) === Number(issue.expectedRecordVersion)
        && Number(row.resulting_record_version) > Number(row.expected_record_version)
        && row.actor_user_id === issue.actorUserId
        && createdRecord?.id === issue.operationId
        && createdRecord?.lessonId === issue.lessonId
        && row.manager_exception === (createdRecord?.managerException === true || createdRecord?.manager_exception === true)
        && normalLessonMakeupIntentSignature(row.request_payload) === issue.requestSignature;
      if (!exactEvidence) {
        persistNormalLessonMakeupIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Telafi hakkı kanıtı beklenen öğrenci, ders veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      const studentResult = await timedSingleLessonRequest(() => supabase
        .from("students")
        .select("*")
        .eq("id",issue.studentId)
        .eq("branch_id",issue.branchId)
        .single());
      if (studentResult.error || !studentResult.data?.id) {
        persistNormalLessonMakeupIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Telafi hakkı Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      const savedStudent = studentResult.data;
      const authoritative = savedStudent.branch_id === issue.branchId
        && Number(savedStudent.record_version) >= Number(row.resulting_record_version);
      if (!authoritative) {
        persistNormalLessonMakeupIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Telafi hakkı bulundu fakat öğrenci kaydının güncel sürümü doğrulanamadı. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      if (currentBranch?.id !== issue.branchId) {
        persistNormalLessonMakeupIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Telafi hakkı kaydedildi. Güncel kaydı görmek için işlemin ait olduğu şubeyi açın.",9000);
        return { ok:false, applied:true, wrongBranch:true };
      }
      setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
      setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
      setActionModal(null);
      const cleared = clearNormalLessonMakeupIssue(issue.operationId);
      if (!cleared) {
        normalLessonMakeupIssueRef.current = { ...issue, state:"applied_pending_refresh" };
        setNormalLessonMakeupIssue({ ...issue, state:"applied_pending_refresh" });
      }
      if (options.notify !== false) pop("Telafi hakkı Supabase'de doğrulandı ve ekran yenilendi.",7000);
      const currentRecord = (savedStudent.telafi_records || []).find(record=>record.id === issue.operationId && record.lessonId === issue.lessonId) || null;
      return { ok:true, applied:true, row, student:savedStudent, record:currentRecord };
    } finally {
      normalLessonMakeupCheckingRef.current = false;
      setNormalLessonMakeupIssueChecking(false);
    }
  };

  const handleNormalLessonMakeup = async (sid, actionKind, note, lid, actionOptions={}) => {
    const sourceStudent = students.find(student=>student.id === sid);
    const branchId = currentBranch?.id;
    if (!requireProtectedSources(["students"],"Telafi hakkı")) return false;
    if (!browserOnline) {
      pop("İnternet bağlantısı olmadan telafi hakkı oluşturulamaz.",7000);
      return false;
    }
    if (!sourceStudent?.id || !lid || !branchId || sourceStudent.branch_id !== branchId || !["telafi","lm-telafi"].includes(actionKind)) {
      pop("Öğrenci, ders veya aktif şube güvenli biçimde doğrulanamadı; kayıt gönderilmedi.",8000);
      return false;
    }
    if (normalLessonEvaluationWritingRef.current || normalLessonEvaluationIssueRef.current) {
      pop("Önce bekleyen ders değerlendirmesi sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupWritingRef.current || normalLessonMakeupIssueRef.current) {
      pop("Önce devam eden telafi hakkı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupPlanWritingRef.current || normalLessonMakeupPlanIssueRef.current) {
      pop("Önce bekleyen telafi planı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupCompletionWritingRef.current || normalLessonMakeupCompletionIssueRef.current) {
      pop("Önce bekleyen telafi tamamlama sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    const intent = normalLessonMakeupIntent(sourceStudent,lid,actionKind,note,actionOptions);
    if (!intent.lesson) {
      pop("Ders kaydı bulunamadı; telafi hakkı gönderilmedi.",7000);
      return false;
    }
    const sourceQuotaRecords = telafiRecordsWithoutLesson(sourceStudent.telafi_records,intent.lesson);
    const sourceQuota = telafiQuotaInfo(sourceStudent,intent.lesson.date || new Date(),sourceQuotaRecords);
    if (sourceQuota.count === null) {
      pop("Derse başlangıç tarihi girilmeden telafi hak dönemi hesaplanamaz; telafi oluşturulmadı.",7000);
      return false;
    }
    if (sourceQuota.count >= 6 && !intent.managerExceptionRequested) {
      pop("Telafi hakları 6/6 dolu. Yönetici inisiyatifi onayı olmadan telafi oluşturulmadı.",7000);
      return false;
    }
    const operationId = uid();
    const issue = {
      operationId,
      actorUserId:authSession?.user?.id || "",
      branchId,
      studentId:sid,
      studentName:sourceStudent.name || "Öğrenci",
      lessonId:lid,
      actionKind,
      expectedRecordVersion:intent.expectedRecordVersion,
      expectedOperationKind:intent.expectedOperationKind,
      requestSignature:normalLessonMakeupIntentSignature(intent.requestPayload),
      label:(sourceStudent.name || "Öğrenci")+" · "+fmtDate(intent.lesson.date)+" "+lessonTime(sourceStudent,intent.lesson),
      state:"writing",
      createdAt:new Date().toISOString(),
    };
    if (!persistNormalLessonMakeupIssue(issue)) {
      pop("Telafi hakkı işlem güvenliği tarayıcıda hazırlanamadı; kayıt gönderilmedi.",9000);
      return false;
    }
    normalLessonMakeupWritingRef.current = true;
    setNormalLessonMakeupBusyId(lid);
    try {
      const result = await runBranchScopedWrite(() => timedSingleLessonRequest(() => supabase.rpc("record_normal_lesson_makeup_right",{
        p_student_id:sid,
        p_lesson_id:lid,
        p_expected_record_version:intent.expectedRecordVersion,
        p_action_kind:actionKind,
        p_note:intent.note,
        p_manager_exception:intent.managerExceptionRequested,
        p_invalidated_package_key:intent.invalidatedPackageKey || null,
        p_operation_id:operationId,
      }).single()));
      if (!result.error && result.data?.operation_state === "applied") {
        const savedStudent = result.data.student_record;
        const savedLesson = (savedStudent?.schedule || []).find(lesson=>lesson.id === lid);
        const createdRecord = (savedStudent?.telafi_records || []).find(record=>record.id === operationId && record.lessonId === lid);
        const expectedStatus = actionKind === "telafi" ? "telafi" : "lastminute";
        const exactResult = result.data.operation_kind === intent.expectedOperationKind
          && result.data.action_kind === actionKind
          && savedStudent?.id === sid
          && savedStudent?.branch_id === branchId
          && Number(savedStudent?.record_version) === intent.expectedRecordVersion + 1
          && savedStudent?.last_write_id === operationId
          && savedLesson?.status === expectedStatus
          && createdRecord?.id === operationId;
        if (exactResult) {
          setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
          setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
          setActionModal(null);
          const cleared = clearNormalLessonMakeupIssue(operationId);
          if (!cleared) {
            normalLessonMakeupIssueRef.current = { ...issue, state:"applied_pending_refresh" };
            setNormalLessonMakeupIssue({ ...issue, state:"applied_pending_refresh" });
          }
          pop(normalLessonMakeupSuccessMessage(actionKind,createdRecord,result.data.quota_normal_count));
          setTelafiMessagePrompt({ student:savedStudent, record:createdRecord });
          return true;
        }
      }
      persistNormalLessonMakeupIssue({ ...issue, state:"unknown" });
      if (normalLessonMakeupKnownRejection(result.error)) {
        await checkNormalLessonMakeupOperation({ ...issue, state:"unknown" },{ notify:false, knownRejected:true });
        setActionModal(null);
        pop(normalLessonMakeupErrorText(result.error),9000);
        return false;
      }
      const checked = await checkNormalLessonMakeupOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        pop(normalLessonMakeupSuccessMessage(actionKind,checked.row?.created_makeup_record,checked.row?.quota_normal_count_after),7000);
        if (checked.record) setTelafiMessagePrompt({ student:checked.student, record:checked.record });
      } else if (!checked.applied) pop(normalLessonMakeupErrorText(result.error),9000);
      return checked.applied === true;
    } catch (error) {
      persistNormalLessonMakeupIssue({ ...issue, state:"unknown" });
      const checked = await checkNormalLessonMakeupOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        pop(normalLessonMakeupSuccessMessage(actionKind,checked.row?.created_makeup_record,checked.row?.quota_normal_count_after),7000);
        if (checked.record) setTelafiMessagePrompt({ student:checked.student, record:checked.record });
      } else if (!checked.applied) pop(normalLessonMakeupErrorText(error),9000);
      return checked.applied === true;
    } finally {
      normalLessonMakeupWritingRef.current = false;
      setNormalLessonMakeupBusyId("");
    }
  };

  const checkNormalLessonMakeupPlanOperation = async (issue=normalLessonMakeupPlanIssueRef.current, options={}) => {
    if (!issue?.operationId || normalLessonMakeupPlanCheckingRef.current) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    if (!browserOnline) {
      if (options.notify !== false) pop("İnternet bağlantısı olmadan telafi planı sonucu kontrol edilemez. Uyarı ekranda kalacak.",8000);
      return { ok:false, offline:true };
    }
    normalLessonMakeupPlanCheckingRef.current = true;
    setNormalLessonMakeupPlanIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("normal_lesson_makeup_plan_operations")
        .select("operation_id,student_id,branch_id,makeup_record_id,operation_kind,expected_record_version,resulting_record_version,request_payload,target_after,actor_user_id,created_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistNormalLessonMakeupPlanIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Telafi planı sonucu henüz doğrulanamadı. Uyarı ekranda kalacak; işlemi tekrar göndermeyin.",9000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const createdAtMs = new Date(issue.createdAt || 0).getTime();
        const waitedLongEnough = Number.isFinite(createdAtMs) && Date.now() - createdAtMs >= NORMAL_LESSON_MAKEUP_PLAN_ABSENCE_SETTLE_MS;
        if (options.knownRejected !== true && !waitedLongEnough) {
          persistNormalLessonMakeupPlanIssue({ ...issue, state:"unknown", notFoundSince:issue.notFoundSince || new Date().toISOString() });
          if (options.notify !== false) pop("Telafi planı kanıtı henüz görünmüyor. Biraz sonra yeniden kontrol edin; işlemi tekrar göndermeyin.",9000);
          return { ok:false, applied:false, uncertain:true };
        }
        if (currentBranch?.id === issue.branchId) await loadStudents(undefined,issue.branchId);
        persistNormalLessonMakeupPlanIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Telafi planı Supabase'de bulunamadı; kayıt oluşmadı.",7000);
        return { ok:true, applied:false };
      }
      const row = result.data;
      const targetAfter = row.target_after;
      const exactEvidence = row.operation_id === issue.operationId
        && row.student_id === issue.studentId
        && row.branch_id === issue.branchId
        && row.makeup_record_id === issue.makeupRecordId
        && row.operation_kind === issue.expectedOperationKind
        && Number(row.expected_record_version) === Number(issue.expectedRecordVersion)
        && Number(row.resulting_record_version) === Number(row.expected_record_version) + 1
        && row.actor_user_id === issue.actorUserId
        && targetAfter?.id === issue.makeupRecordId
        && telafiPlannedAt(targetAfter) === issue.plannedAt
        && Number(targetAfter?.plannedDurationMinutes) === Number(issue.plannedDurationMinutes)
        && String(targetAfter?.plannedNote || "") === issue.plannedNote
        && normalLessonMakeupPlanIntentSignature(row.request_payload) === issue.requestSignature;
      if (!exactEvidence) {
        persistNormalLessonMakeupPlanIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Telafi planı kanıtı beklenen öğrenci, telafi hakkı veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:false, conflict:true };
      }
      const studentResult = await timedSingleLessonRequest(() => supabase
        .from("students")
        .select("*")
        .eq("id",issue.studentId)
        .eq("branch_id",issue.branchId)
        .single());
      if (studentResult.error || !studentResult.data?.id) {
        persistNormalLessonMakeupPlanIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Telafi planı Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      const savedStudent = studentResult.data;
      const savedVersion = Number(savedStudent.record_version);
      const resultVersion = Number(row.resulting_record_version);
      const currentRecord = (savedStudent.telafi_records || []).find(record=>String(record?.id || "") === issue.makeupRecordId) || null;
      const currentMatches = !!currentRecord
        && telafiPlannedAt(currentRecord) === issue.plannedAt
        && Number(currentRecord.plannedDurationMinutes) === Number(issue.plannedDurationMinutes)
        && String(currentRecord.plannedNote || "") === issue.plannedNote;
      const authoritative = savedStudent.branch_id === issue.branchId
        && savedVersion >= resultVersion
        && (savedVersion > resultVersion || (savedStudent.last_write_id === issue.operationId && currentMatches));
      if (!authoritative) {
        persistNormalLessonMakeupPlanIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Telafi planı bulundu fakat öğrenci kaydının güncel sürümü doğrulanamadı. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      if (currentBranch?.id !== issue.branchId) {
        persistNormalLessonMakeupPlanIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Telafi planı kaydedildi. Güncel kaydı görmek için işlemin ait olduğu şubeyi açın.",9000);
        return { ok:false, applied:true, wrongBranch:true };
      }
      setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
      setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
      const cleared = clearNormalLessonMakeupPlanIssue(issue.operationId);
      if (!cleared) {
        normalLessonMakeupPlanIssueRef.current = { ...issue, state:"applied_pending_refresh" };
        setNormalLessonMakeupPlanIssue({ ...issue, state:"applied_pending_refresh" });
      }
      if (options.notify !== false) pop("Telafi planı Supabase'de doğrulandı ve ekran yenilendi.",7000);
      return { ok:true, applied:true, row, student:savedStudent, record:currentRecord, currentMatches };
    } finally {
      normalLessonMakeupPlanCheckingRef.current = false;
      setNormalLessonMakeupPlanIssueChecking(false);
    }
  };

  const handleNormalLessonMakeupPlan = async (sid, tid, payload={}) => {
    const sourceStudent = students.find(student=>student.id === sid);
    const branchId = currentBranch?.id;
    if (!requireProtectedSources(["students"],"Telafi planı")) return false;
    if (!browserOnline) {
      pop("İnternet bağlantısı olmadan telafi planı kaydedilemez.",7000);
      return false;
    }
    if (!sourceStudent?.id || !tid || !branchId || sourceStudent.branch_id !== branchId) {
      pop("Öğrenci, telafi hakkı veya aktif şube güvenli biçimde doğrulanamadı; kayıt gönderilmedi.",8000);
      return false;
    }
    if (normalLessonEvaluationWritingRef.current || normalLessonEvaluationIssueRef.current) {
      pop("Önce bekleyen ders değerlendirmesi sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupWritingRef.current || normalLessonMakeupIssueRef.current) {
      pop("Önce bekleyen telafi hakkı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupPlanWritingRef.current || normalLessonMakeupPlanIssueRef.current) {
      pop("Önce devam eden telafi planı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupCompletionWritingRef.current || normalLessonMakeupCompletionIssueRef.current) {
      pop("Önce bekleyen telafi tamamlama sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    const intent = normalLessonMakeupPlanIntent(sourceStudent,tid,payload);
    if (intent.matchingRecordCount !== 1 || !intent.record) {
      pop("Telafi hakkı güvenli biçimde eşleştirilemedi; plan gönderilmedi.",7000);
      return false;
    }
    if (intent.record.done === true || String(intent.record.done).toLowerCase() === "true") {
      pop("Tamamlanmış telafi yeniden planlanamaz.",7000);
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(intent.plannedAt) || !Number.isFinite(new Date(intent.plannedAt).getTime())) {
      pop("Geçerli telafi tarihi ve saati seçin.",7000);
      return false;
    }
    if (!Number.isInteger(intent.plannedDurationMinutes) || intent.plannedDurationMinutes < 15 || intent.plannedDurationMinutes > 1440 || intent.plannedNote.length > 10000) {
      pop("Telafi süresi veya plan notu doğrulanamadı; kayıt gönderilmedi.",7000);
      return false;
    }
    const operationId = uid();
    const issue = {
      operationId,
      actorUserId:authSession?.user?.id || "",
      branchId,
      studentId:sid,
      studentName:sourceStudent.name || "Öğrenci",
      makeupRecordId:tid,
      expectedRecordVersion:intent.expectedRecordVersion,
      expectedOperationKind:intent.expectedOperationKind,
      plannedAt:intent.plannedAt,
      plannedDurationMinutes:intent.plannedDurationMinutes,
      plannedNote:intent.plannedNote,
      requestSignature:normalLessonMakeupPlanIntentSignature(intent.requestPayload),
      label:(sourceStudent.name || "Öğrenci")+" · "+fmtDate(intent.plannedAt)+" "+timeFromISO(intent.plannedAt),
      state:"writing",
      createdAt:new Date().toISOString(),
    };
    if (!persistNormalLessonMakeupPlanIssue(issue)) {
      pop("Telafi planı işlem güvenliği tarayıcıda hazırlanamadı; kayıt gönderilmedi.",9000);
      return false;
    }
    normalLessonMakeupPlanWritingRef.current = true;
    try {
      const result = await runBranchScopedWrite(() => timedSingleLessonRequest(() => supabase.rpc("plan_normal_lesson_makeup",{
        p_student_id:sid,
        p_makeup_record_id:tid,
        p_expected_record_version:intent.expectedRecordVersion,
        p_planned_at:intent.plannedAt,
        p_planned_duration_minutes:intent.plannedDurationMinutes,
        p_planned_note:intent.plannedNote,
        p_operation_id:operationId,
      }).single()));
      if (!result.error && result.data?.operation_state === "applied") {
        const savedStudent = result.data.student_record;
        const plannedRecord = (savedStudent?.telafi_records || []).find(record=>String(record?.id || "") === tid);
        const exactResult = result.data.operation_kind === intent.expectedOperationKind
          && savedStudent?.id === sid
          && savedStudent?.branch_id === branchId
          && Number(savedStudent?.record_version) === intent.expectedRecordVersion + 1
          && savedStudent?.last_write_id === operationId
          && !!plannedRecord
          && telafiPlannedAt(plannedRecord) === intent.plannedAt
          && Number(plannedRecord.plannedDurationMinutes) === intent.plannedDurationMinutes
          && String(plannedRecord.plannedNote || "") === intent.plannedNote;
        if (exactResult) {
          setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
          setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
          const cleared = clearNormalLessonMakeupPlanIssue(operationId);
          if (!cleared) {
            normalLessonMakeupPlanIssueRef.current = { ...issue, state:"applied_pending_refresh" };
            setNormalLessonMakeupPlanIssue({ ...issue, state:"applied_pending_refresh" });
          }
          pop(intent.expectedOperationKind === "rescheduled" ? "Telafi yeniden planlandı" : "Telafi planlandı");
          setTelafiPlanMessagePrompt({ student:savedStudent, record:plannedRecord });
          return true;
        }
      }
      persistNormalLessonMakeupPlanIssue({ ...issue, state:"unknown" });
      if (normalLessonMakeupPlanKnownRejection(result.error)) {
        await checkNormalLessonMakeupPlanOperation({ ...issue, state:"unknown" },{ notify:false, knownRejected:true });
        pop(normalLessonMakeupPlanErrorText(result.error),9000);
        return false;
      }
      const checked = await checkNormalLessonMakeupPlanOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        pop("Telafi planı Supabase'de doğrulandı ve ekran yenilendi.",7000);
        if (checked.currentMatches && checked.record) setTelafiPlanMessagePrompt({ student:checked.student, record:checked.record });
      } else if (!checked.applied && !checked.conflict) pop(normalLessonMakeupPlanErrorText(result.error),9000);
      return checked.applied === true && checked.conflict !== true;
    } catch (error) {
      persistNormalLessonMakeupPlanIssue({ ...issue, state:"unknown" });
      const checked = await checkNormalLessonMakeupPlanOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        pop("Telafi planı Supabase'de doğrulandı ve ekran yenilendi.",7000);
        if (checked.currentMatches && checked.record) setTelafiPlanMessagePrompt({ student:checked.student, record:checked.record });
      } else if (!checked.applied && !checked.conflict) pop(normalLessonMakeupPlanErrorText(error),9000);
      return checked.applied === true && checked.conflict !== true;
    } finally {
      normalLessonMakeupPlanWritingRef.current = false;
    }
  };

  const checkNormalLessonMakeupCompletionOperation = async (issue=normalLessonMakeupCompletionIssueRef.current, options={}) => {
    if (!issue?.operationId || normalLessonMakeupCompletionCheckingRef.current) return { ok:false };
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return { ok:false, foreignUser:true };
    if (!browserOnline) {
      if (options.notify !== false) pop("İnternet bağlantısı olmadan telafi sonucu kontrol edilemez. Uyarı ekranda kalacak.",8000);
      return { ok:false, offline:true };
    }
    normalLessonMakeupCompletionCheckingRef.current = true;
    setNormalLessonMakeupCompletionIssueChecking(true);
    try {
      const result = await timedSingleLessonRequest(() => supabase
        .from("normal_lesson_makeup_completion_operations")
        .select("operation_id,student_id,branch_id,makeup_record_id,operation_kind,action_kind,expected_record_version,resulting_record_version,request_payload,target_before,target_after,homework_source_kind,homework_source_id,homework_before,homework_after,actor_user_id,created_at")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (result.error) {
        persistNormalLessonMakeupCompletionIssue({ ...issue, state:"unknown" });
        if (options.notify !== false) pop("Telafi sonucu henüz doğrulanamadı. Uyarı ekranda kalacak; işlemi tekrar göndermeyin.",9000);
        return { ok:false, error:result.error };
      }
      if (!result.data) {
        const createdAtMs = new Date(issue.createdAt || 0).getTime();
        const waitedLongEnough = Number.isFinite(createdAtMs) && Date.now() - createdAtMs >= NORMAL_LESSON_MAKEUP_COMPLETION_ABSENCE_SETTLE_MS;
        if (options.knownRejected !== true && !waitedLongEnough) {
          persistNormalLessonMakeupCompletionIssue({ ...issue, state:"unknown", notFoundSince:issue.notFoundSince || new Date().toISOString() });
          if (options.notify !== false) pop("Telafi tamamlama kanıtı henüz görünmüyor. Biraz sonra yeniden kontrol edin; işlemi tekrar göndermeyin.",9000);
          return { ok:false, applied:false, uncertain:true };
        }
        if (currentBranch?.id === issue.branchId) await loadStudents(undefined,issue.branchId);
        persistNormalLessonMakeupCompletionIssue({ ...issue, state:"not_applied" });
        if (options.notify !== false) pop("Telafi tamamlama işlemi Supabase'de bulunamadı; kayıt oluşmadı.",7000);
        return { ok:true, applied:false };
      }
      const row = result.data;
      const targetAfter = row.target_after;
      const requestEvaluation = row.request_payload?.evaluation || {};
      const expectedHomeworkSourceKind = requestEvaluation.previousHomeworkSource || null;
      const expectedHomeworkSourceId = requestEvaluation.previousHomeworkSourceId || null;
      const evidenceIntent = {
        record:row.target_before,
        actionKind:row.action_kind,
        doneAt:String(row.request_payload?.doneAt || ""),
        doneNote:String(row.request_payload?.doneNote || ""),
        evaluation:requestEvaluation,
        expectedEvaluatedHomework:String(row.homework_before?.homework || ""),
      };
      const exactHomeworkEvidence = expectedHomeworkSourceKind
        ? row.homework_source_kind === expectedHomeworkSourceKind
          && row.homework_source_id === expectedHomeworkSourceId
          && String(row.homework_before?.id || "") === expectedHomeworkSourceId
          && String(row.homework_after?.id || "") === expectedHomeworkSourceId
          && String(row.homework_after?.homework || "") === String(row.homework_before?.homework || "")
          && String(row.homework_after?.homeworkStatus || "") === String(requestEvaluation.homeworkStatus || "")
          && String(row.homework_after?.homeworkCheckNote || "") === ""
          && !!row.homework_after?.homeworkCheckedAt
          && String(row.homework_after?.homeworkCheckedInRef || "") === homeworkCheckRef("telafi",issue.makeupRecordId)
        : row.homework_source_kind == null && row.homework_source_id == null && row.homework_before == null && row.homework_after == null;
      const exactEvidence = row.operation_id === issue.operationId
        && row.student_id === issue.studentId
        && row.branch_id === issue.branchId
        && row.makeup_record_id === issue.makeupRecordId
        && row.operation_kind === issue.expectedOperationKind
        && row.action_kind === issue.actionKind
        && Number(row.expected_record_version) === Number(issue.expectedRecordVersion)
        && Number(row.resulting_record_version) === Number(row.expected_record_version) + 1
        && row.actor_user_id === issue.actorUserId
        && evidenceIntent.doneAt === issue.doneAt
        && normalLessonMakeupCompletionTargetMatches(targetAfter,evidenceIntent)
        && exactHomeworkEvidence
        && normalLessonMakeupCompletionIntentSignature(row.request_payload) === issue.requestSignature;
      if (!exactEvidence) {
        persistNormalLessonMakeupCompletionIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Telafi tamamlama kanıtı beklenen öğrenci, telafi hakkı veya içerikle eşleşmedi. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:false, conflict:true };
      }
      const studentResult = await timedSingleLessonRequest(() => supabase
        .from("students")
        .select("*")
        .eq("id",issue.studentId)
        .eq("branch_id",issue.branchId)
        .single());
      if (studentResult.error || !studentResult.data?.id) {
        persistNormalLessonMakeupCompletionIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Telafi sonucu Supabase'e kaydedildi; güncel öğrenci kaydı henüz yüklenemedi. İşlemi tekrarlamayın.",9000);
        return { ok:false, applied:true, refreshFailed:true };
      }
      const savedStudent = studentResult.data;
      const savedVersion = Number(savedStudent.record_version);
      const resultVersion = Number(row.resulting_record_version);
      const currentRecord = (savedStudent.telafi_records || []).find(record=>String(record?.id || "") === issue.makeupRecordId) || null;
      const currentMatches = !!currentRecord && JSON.stringify(canonicalJson(currentRecord)) === JSON.stringify(canonicalJson(targetAfter));
      const authoritative = savedStudent.branch_id === issue.branchId
        && savedVersion >= resultVersion
        && (savedVersion > resultVersion || (savedStudent.last_write_id === issue.operationId && currentMatches));
      if (!authoritative) {
        persistNormalLessonMakeupCompletionIssue({ ...issue, state:"conflict" });
        if (options.notify !== false) pop("Telafi sonucu bulundu fakat öğrenci kaydının güncel sürümü doğrulanamadı. İşlemi yeniden göndermeyin.",9000);
        return { ok:false, applied:true, conflict:true };
      }
      if (currentBranch?.id !== issue.branchId) {
        persistNormalLessonMakeupCompletionIssue({ ...issue, state:"applied_pending_refresh" });
        if (options.notify !== false) pop("Telafi sonucu kaydedildi. Güncel kaydı görmek için işlemin ait olduğu şubeyi açın.",9000);
        return { ok:false, applied:true, wrongBranch:true };
      }
      setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
      setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
      const cleared = clearNormalLessonMakeupCompletionIssue(issue.operationId);
      if (!cleared) {
        normalLessonMakeupCompletionIssueRef.current = { ...issue, state:"applied_pending_refresh" };
        setNormalLessonMakeupCompletionIssue({ ...issue, state:"applied_pending_refresh" });
      }
      if (options.notify !== false) pop("Telafi sonucu Supabase'de doğrulandı ve ekran yenilendi.",7000);
      return { ok:true, applied:true, row, student:savedStudent, record:currentRecord, currentMatches };
    } finally {
      normalLessonMakeupCompletionCheckingRef.current = false;
      setNormalLessonMakeupCompletionIssueChecking(false);
    }
  };

  const handleNormalLessonMakeupCompletion = async (sid, tid, payload={}) => {
    const sourceStudent = students.find(student=>student.id === sid);
    const branchId = currentBranch?.id;
    if (!requireProtectedSources(["students"],"Telafi tamamlama")) return false;
    if (!browserOnline) {
      pop("İnternet bağlantısı olmadan telafi sonucu kaydedilemez.",7000);
      return false;
    }
    if (!sourceStudent?.id || !tid || !branchId || sourceStudent.branch_id !== branchId) {
      pop("Öğrenci, telafi hakkı veya aktif şube güvenli biçimde doğrulanamadı; kayıt gönderilmedi.",8000);
      return false;
    }
    if (normalLessonEvaluationWritingRef.current || normalLessonEvaluationIssueRef.current) {
      pop("Önce bekleyen ders değerlendirmesi sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupWritingRef.current || normalLessonMakeupIssueRef.current) {
      pop("Önce bekleyen telafi hakkı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupPlanWritingRef.current || normalLessonMakeupPlanIssueRef.current) {
      pop("Önce bekleyen telafi planı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    if (normalLessonMakeupCompletionWritingRef.current || normalLessonMakeupCompletionIssueRef.current) {
      pop("Önce devam eden telafi tamamlama sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return false;
    }
    const requestedAction = payload.action || "attended";
    if (!["attended","counted"].includes(requestedAction)) {
      pop("Telafi sonucu türü doğrulanamadı; kayıt gönderilmedi.",7000);
      return false;
    }
    const intent = normalLessonMakeupCompletionIntent(sourceStudent,tid,payload,payload.correctionReason);
    if (intent.matchingRecordCount !== 1 || !intent.record) {
      pop("Telafi hakkı güvenli biçimde eşleştirilemedi; sonuç gönderilmedi.",7000);
      return false;
    }
    if (!telafiPlannedAt(intent.record) || intent.doneAt !== telafiPlannedAt(intent.record)) {
      pop("Telafi planının kesin tarih ve saati doğrulanamadı; sonuç gönderilmedi.",7000);
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(intent.doneAt)) {
      pop("Telafi planının tarih ve saat biçimi doğrulanamadı; sonuç gönderilmedi.",7000);
      return false;
    }
    if (intent.expectedOperationKind === "corrected" && (intent.actionKind !== "attended" || String(intent.record.doneStatus || intent.record.done_status || "") !== "attended")) {
      pop("Bu tamamlanmış telafi sonucu bu işlemle değiştirilemez.",7000);
      return false;
    }
    if (intent.expectedOperationKind === "corrected" && !intent.correctionReason) {
      pop("Daha önce tamamlanmış telafi verilerini değiştirmek için düzeltme nedeni zorunludur.",7000);
      return false;
    }
    if (intent.expectedOperationKind === "completed" && intent.correctionReason) {
      pop("Yeni telafi sonucu için düzeltme nedeni gönderilemez.",7000);
      return false;
    }
    if (intent.actionKind === "attended") {
      const lessonDuration = Number(intent.record.plannedDurationMinutes || intent.record.planned_duration_minutes || sourceStudent.lesson_duration || 45);
      const sourcePairValid = (!!intent.evaluation.previousHomeworkSource) === (!!intent.evaluation.previousHomeworkSourceId);
      if (!intent.evaluation.lessonFocus || !sourcePairValid
        || (intent.evaluation.previousHomeworkSource && !["schedule","telafi"].includes(intent.evaluation.previousHomeworkSource))
        || !Number.isInteger(intent.evaluation.activeMinutes) || intent.evaluation.activeMinutes < 0 || intent.evaluation.activeMinutes > lessonDuration
        || !Number.isInteger(intent.evaluation.taskFocusMinutes) || intent.evaluation.taskFocusMinutes < 0 || intent.evaluation.taskFocusMinutes > lessonDuration
        || !Number.isInteger(intent.evaluation.redirectionCount) || intent.evaluation.redirectionCount < 0
        || (intent.evaluation.previousHomeworkSource && !["done","partial","not_done"].includes(intent.evaluation.homeworkStatus))) {
        pop("Telafi değerlendirme bilgileri doğrulanamadı; kayıt gönderilmedi.",7000);
        return false;
      }
    }
    const operationId = uid();
    const issue = {
      operationId,
      actorUserId:authSession?.user?.id || "",
      branchId,
      studentId:sid,
      studentName:sourceStudent.name || "Öğrenci",
      makeupRecordId:tid,
      actionKind:intent.actionKind,
      expectedRecordVersion:intent.expectedRecordVersion,
      expectedOperationKind:intent.expectedOperationKind,
      doneAt:intent.doneAt,
      requestSignature:normalLessonMakeupCompletionIntentSignature(intent.requestPayload),
      label:(sourceStudent.name || "Öğrenci")+" · "+fmtDate(intent.doneAt)+" "+timeFromISO(intent.doneAt),
      state:"writing",
      createdAt:new Date().toISOString(),
    };
    if (!persistNormalLessonMakeupCompletionIssue(issue)) {
      pop("Telafi tamamlama işlem güvenliği tarayıcıda hazırlanamadı; kayıt gönderilmedi.",9000);
      return false;
    }
    normalLessonMakeupCompletionWritingRef.current = true;
    try {
      const result = await runBranchScopedWrite(() => timedSingleLessonRequest(() => supabase.rpc("complete_normal_lesson_makeup",{
        p_student_id:sid,
        p_makeup_record_id:tid,
        p_expected_record_version:intent.expectedRecordVersion,
        p_action_kind:intent.actionKind,
        p_done_at:intent.doneAt,
        p_done_note:intent.doneNote,
        p_evaluation:intent.evaluation,
        p_correction_reason:intent.correctionReason,
        p_operation_id:operationId,
      }).single()));
      if (!result.error && result.data?.operation_state === "applied") {
        const savedStudent = result.data.student_record;
        const completedRecord = (savedStudent?.telafi_records || []).find(record=>String(record?.id || "") === tid);
        const exactResult = result.data.operation_kind === intent.expectedOperationKind
          && result.data.action_kind === intent.actionKind
          && savedStudent?.id === sid
          && savedStudent?.branch_id === branchId
          && Number(savedStudent?.record_version) === intent.expectedRecordVersion + 1
          && savedStudent?.last_write_id === operationId
          && normalLessonMakeupCompletionTargetMatches(completedRecord,intent)
          && normalLessonMakeupCompletionHomeworkMatches(savedStudent,intent);
        if (exactResult) {
          setStudents(previous=>previous.map(student=>student.id === savedStudent.id ? savedStudent : student));
          setDetailSt(previous=>previous?.id === savedStudent.id ? savedStudent : previous);
          const cleared = clearNormalLessonMakeupCompletionIssue(operationId);
          if (!cleared) {
            normalLessonMakeupCompletionIssueRef.current = { ...issue, state:"applied_pending_refresh" };
            setNormalLessonMakeupCompletionIssue({ ...issue, state:"applied_pending_refresh" });
          }
          pop(intent.expectedOperationKind === "corrected" ? "Telafi verileri düzeltildi" : "Telafi yapıldı");
          if (intent.actionKind === "attended" && storedLessonScore(completedRecord) !== null) setLessonEvaluationPrompt({ student:savedStudent, record:completedRecord, type:"telafi" });
          return true;
        }
      }
      persistNormalLessonMakeupCompletionIssue({ ...issue, state:"unknown" });
      if (normalLessonMakeupCompletionKnownRejection(result.error)) {
        await checkNormalLessonMakeupCompletionOperation({ ...issue, state:"unknown" },{ notify:false, knownRejected:true });
        pop(normalLessonMakeupCompletionErrorText(result.error),9000);
        return false;
      }
      const checked = await checkNormalLessonMakeupCompletionOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        pop("Telafi sonucu Supabase'de doğrulandı ve ekran yenilendi.",7000);
        if (intent.actionKind === "attended" && checked.record && storedLessonScore(checked.record) !== null) setLessonEvaluationPrompt({ student:checked.student, record:checked.record, type:"telafi" });
      } else if (!checked.applied && !checked.conflict) pop(normalLessonMakeupCompletionErrorText(result.error),9000);
      return checked.applied === true && checked.conflict !== true;
    } catch (error) {
      persistNormalLessonMakeupCompletionIssue({ ...issue, state:"unknown" });
      const checked = await checkNormalLessonMakeupCompletionOperation({ ...issue, state:"unknown" },{ notify:false });
      if (checked.applied && checked.student) {
        pop("Telafi sonucu Supabase'de doğrulandı ve ekran yenilendi.",7000);
        if (intent.actionKind === "attended" && checked.record && storedLessonScore(checked.record) !== null) setLessonEvaluationPrompt({ student:checked.student, record:checked.record, type:"telafi" });
      } else if (!checked.applied && !checked.conflict) pop(normalLessonMakeupCompletionErrorText(error),9000);
      return checked.applied === true && checked.conflict !== true;
    } finally {
      normalLessonMakeupCompletionWritingRef.current = false;
    }
  };

  const handleAction = async (sid, action, note="", lid=null, actionOptions={}) => {
    if (action === "attended") return handleNormalLessonEvaluation(sid,note,lid,actionOptions);
    if (action === "telafi" || action === "lm-telafi") return handleNormalLessonMakeup(sid,action,note,lid,actionOptions);
    if (normalLessonEvaluationIssueRef.current) {
      pop("Önce bekleyen ders değerlendirmesi sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return;
    }
    if (normalLessonMakeupIssueRef.current) {
      pop("Önce bekleyen telafi hakkı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return;
    }
    if (normalLessonMakeupPlanIssueRef.current) {
      pop("Önce bekleyen telafi planı sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return;
    }
    if (normalLessonMakeupCompletionIssueRef.current) {
      pop("Önce bekleyen telafi tamamlama sonucunu üstteki uyarıdan kesinleştirin.",9000);
      return;
    }
    const sourceStudent = students.find(student=>student.id===sid);
    const sourceLesson = sourceStudent?.schedule?.find(lesson=>lesson.id===lid) || sourceStudent?.schedule?.find(lesson=>lesson.status==="upcoming");
    const built = buildActionUpdate(students, sid, action, note, lid, actionOptions);
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

  useEffect(() => {
    const issue = normalLessonEvaluationIssue;
    if (!giris || !browserOnline || !accessContext || !currentBranch?.id || !issue?.operationId) return;
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return;
    if (issue.branchId !== currentBranch.id || ["not_applied","conflict"].includes(issue.state)) return;
    if (normalLessonEvaluationWritingRef.current || normalLessonEvaluationCheckingRef.current) return;
    if (normalLessonEvaluationAutoCheckRef.current === issue.operationId) return;
    normalLessonEvaluationAutoCheckRef.current = issue.operationId;
    void checkNormalLessonEvaluationOperation(issue,{ notify:false });
  },[giris,browserOnline,accessContext,currentBranch?.id,normalLessonEvaluationIssue?.operationId,normalLessonEvaluationIssue?.state,authSession?.user?.id]);

  useEffect(() => {
    const issue = normalLessonMakeupIssue;
    if (!giris || !browserOnline || !accessContext || !currentBranch?.id || !issue?.operationId) return;
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return;
    if (issue.branchId !== currentBranch.id || ["not_applied","conflict"].includes(issue.state)) return;
    if (normalLessonMakeupWritingRef.current || normalLessonMakeupCheckingRef.current) return;
    if (normalLessonMakeupAutoCheckRef.current === issue.operationId) return;
    normalLessonMakeupAutoCheckRef.current = issue.operationId;
    void checkNormalLessonMakeupOperation(issue,{ notify:false });
  },[giris,browserOnline,accessContext,currentBranch?.id,normalLessonMakeupIssue?.operationId,normalLessonMakeupIssue?.state,authSession?.user?.id]);

  useEffect(() => {
    const issue = normalLessonMakeupPlanIssue;
    if (!giris || !browserOnline || !accessContext || !currentBranch?.id || !issue?.operationId) return;
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return;
    if (issue.branchId !== currentBranch.id || ["not_applied","conflict"].includes(issue.state)) return;
    if (normalLessonMakeupPlanWritingRef.current || normalLessonMakeupPlanCheckingRef.current) return;
    if (normalLessonMakeupPlanAutoCheckRef.current === issue.operationId) return;
    normalLessonMakeupPlanAutoCheckRef.current = issue.operationId;
    void checkNormalLessonMakeupPlanOperation(issue,{ notify:false });
  },[giris,browserOnline,accessContext,currentBranch?.id,normalLessonMakeupPlanIssue?.operationId,normalLessonMakeupPlanIssue?.state,authSession?.user?.id]);

  useEffect(() => {
    const issue = normalLessonMakeupCompletionIssue;
    if (!giris || !browserOnline || !accessContext || !currentBranch?.id || !issue?.operationId) return;
    if (issue.actorUserId && issue.actorUserId !== authSession?.user?.id) return;
    if (issue.branchId !== currentBranch.id || ["not_applied","conflict"].includes(issue.state)) return;
    if (normalLessonMakeupCompletionWritingRef.current || normalLessonMakeupCompletionCheckingRef.current) return;
    if (normalLessonMakeupCompletionAutoCheckRef.current === issue.operationId) return;
    normalLessonMakeupCompletionAutoCheckRef.current = issue.operationId;
    void checkNormalLessonMakeupCompletionOperation(issue,{ notify:false });
  },[giris,browserOnline,accessContext,currentBranch?.id,normalLessonMakeupCompletionIssue?.operationId,normalLessonMakeupCompletionIssue?.state,authSession?.user?.id]);

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
    const leftAt = turkeyDateKey();
    const updated = students.map(s => s.id!==sid ? s : withStatusEvent({ ...s, frozen:true, left_at:leftAt }, "left", leftAt));
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Öğrenci ayrılan olarak kaydedildi");
  };

  const handleTelafiDone = async (sid, tid, payload = {}) => {
    const action = payload.action || "attended";
    if (action === "plan") return handleNormalLessonMakeupPlan(sid,tid,payload);
    return handleNormalLessonMakeupCompletion(sid,tid,payload);
  };

  const persistSingleLessonMoveIssue = (issue, creating=false) => {
    if (singleLessonMoveActorRef.current === issue.actorUserId && singleLessonMoveIssueRef.current?.operationId
      && singleLessonMoveIssueRef.current.operationId !== issue.operationId) return false;
    const saved = writeSingleLessonMoveIssue(issue.actorUserId,issue,creating ? "" : issue.operationId);
    if (!saved && creating) return false;
    if (singleLessonMoveActorRef.current === issue.actorUserId) {
      if (!saved) {
        try {
          const newer = readSingleLessonMoveIssue(issue.actorUserId);
          if (newer && newer.operationId !== issue.operationId) {
            singleLessonMoveIssueRef.current = newer;
            setSingleLessonMoveIssue(newer);
            return false;
          }
        } catch { /* Keep unresolved evidence visible if storage is unavailable. */ }
      }
      singleLessonMoveIssueRef.current = issue;
      setSingleLessonMoveIssue(issue);
    }
    return saved;
  };

  const clearSingleLessonMoveIssue = issue => {
    if (!issue || singleLessonMoveWritingRef.current || singleLessonMoveActorRef.current !== issue.actorUserId) return false;
    try {
      const stored = readSingleLessonMoveIssue(issue.actorUserId);
      if (stored && !writeSingleLessonMoveIssue(issue.actorUserId,null,issue.operationId)) return false;
    } catch { return false; }
    singleLessonMoveIssueRef.current = null;
    setSingleLessonMoveIssue(null);
    singleLessonMoveAutoCheckRef.current = "";
    return true;
  };

  const checkSingleLessonMoveOperation = async (issue=singleLessonMoveIssueRef.current, options={}) => {
    if (!issue?.operationId || !issue.requestPayload || singleLessonMoveCheckingRef.current
      || singleLessonMoveIssueRef.current?.operationId !== issue.operationId
      || issue.actorUserId !== singleLessonMoveActorRef.current || !giris || !browserOnline
      || currentBranch?.id !== issue.branchId) return { ok:false };
    const generation = protectedDataLoadGenerationRef.current;
    const currentContext = () => generation === protectedDataLoadGenerationRef.current && issue.actorUserId === singleLessonMoveActorRef.current
      && singleLessonMoveIssueRef.current?.operationId === issue.operationId;
    singleLessonMoveCheckingRef.current = true;
    setSingleLessonMoveChecking(true);
    try {
      const evidence = await timedSingleLessonRequest(() => supabase.from("single_lesson_move_operations")
        .select("*").eq("operation_id",issue.operationId).eq("branch_id",issue.branchId).maybeSingle());
      if (!currentContext()) return { ok:false, superseded:true };
      if (evidence.error) {
        persistSingleLessonMoveIssue({ ...issue,state:"unknown" });
        return { ok:false };
      }
      if (!evidence.data && options.knownRejected !== true) {
        // A timed-out request can still be waiting for a server row lock.
        // Absence, even after a delay, is not proof that it cannot commit later.
        persistSingleLessonMoveIssue({ ...issue,state:"unknown" });
        return { ok:false, uncertain:true };
      }
      if (evidence.data && !singleLessonMoveEvidenceMatches(issue,evidence.data)) {
        persistSingleLessonMoveIssue({ ...issue,state:"conflict" });
        return { ok:false, conflict:true };
      }
      const request = issue.requestPayload;
      const studentResult = await timedSingleLessonRequest(() => supabase.from("students").select("*")
        .eq("id",request.studentId).eq("branch_id",issue.branchId).single());
      if (!currentContext()) return { ok:false, superseded:true };
      const savedStudent = studentResult.data;
      if (studentResult.error || savedStudent?.id !== request.studentId || savedStudent.branch_id !== issue.branchId
        || !Number.isInteger(savedStudent.record_version)
        || Number(savedStudent.record_version) < Number(evidence.data?.resulting_record_version ?? request.expectedRecordVersion)) {
        persistSingleLessonMoveIssue({ ...issue,state:evidence.data ? "applied_pending_refresh" : "unknown" });
        return { ok:false, applied:!!evidence.data };
      }
      // Always use the current row, not the older audit snapshot/response.
      setStudents(previous=>previous.map(student=>student.id === savedStudent.id && Number(student.record_version) <= Number(savedStudent.record_version) ? savedStudent : student));
      setDetailSt(previous=>previous?.id === savedStudent.id && Number(previous.record_version) <= Number(savedStudent.record_version) ? savedStudent : previous);
      if (!evidence.data) {
        persistSingleLessonMoveIssue({ ...issue,state:"not_applied" });
        return { ok:true, applied:false };
      }
      // Write handler keeps its lock until finally; clearing there is deferred.
      if (singleLessonMoveWritingRef.current) persistSingleLessonMoveIssue({ ...issue,state:"verified" });
      else if (!clearSingleLessonMoveIssue(issue)) persistSingleLessonMoveIssue({ ...issue,state:"applied_pending_refresh" });
      if (options.notify !== false) pop("Ders taşıması Supabase'de doğrulandı ve ekran yenilendi.",7000);
      return { ok:true, applied:true, student:savedStudent };
    } catch {
      if (currentContext()) persistSingleLessonMoveIssue({ ...issue,state:"unknown" });
      return { ok:false };
    } finally {
      singleLessonMoveCheckingRef.current = false;
      setSingleLessonMoveChecking(false);
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
    if (!requireProtectedSources(["students"],"Ders taşıma") || !browserOnline || connectionRevalidationRequired) return false;
    const actorUserId = authSession?.user?.id || "";
    if (!actorUserId || !navigator.locks?.request) {
      pop("Güvenli tek ders taşıma için güncel tarayıcı ve geçerli oturum gereklidir; kayıt gönderilmedi.",9000);
      return false;
    }
    const generation = protectedDataLoadGenerationRef.current;
    try {
      return await navigator.locks.request("sonsuz-single-lesson-move:"+actorUserId,{ ifAvailable:true },async lock => {
        if (!lock || singleLessonMoveWritingRef.current || singleLessonMoveCheckingRef.current) return false;
        const savedIssue = readSingleLessonMoveIssue(actorUserId);
        if (savedIssue || singleLessonMoveIssueRef.current) {
          singleLessonMoveIssueRef.current = savedIssue || singleLessonMoveIssueRef.current;
          setSingleLessonMoveIssue(singleLessonMoveIssueRef.current);
          pop("Önce bekleyen tek ders taşıma sonucunu üstteki uyarıdan kesinleştirin.",9000);
          return false;
        }
        const sourceStudent = students.find(student=>student.id === sid);
        const branchId = currentBranch?.id;
        const intent = singleLessonMoveIntent(sourceStudent,lid,date,time);
        if (!intent || !branchId || sourceStudent.branch_id !== branchId || generation !== protectedDataLoadGenerationRef.current
          || actorUserId !== singleLessonMoveActorRef.current) {
          pop("Ders konumu doğrulanamadı. Yalnız bugün/gelecekteki planlı ders için farklı geçerli tarih ve saat seçin; kayıt gönderilmedi.",9000);
          return false;
        }
        if (branchScopedWriteCountRef.current || packagePaymentWritingRef.current || packagePaymentIssueRef.current
          || extraLessonPaymentWritingRef.current || extraLessonPaymentIssueRef.current
          || normalLessonEvaluationWritingRef.current || normalLessonEvaluationIssueRef.current
          || normalLessonMakeupWritingRef.current || normalLessonMakeupIssueRef.current
          || normalLessonMakeupPlanWritingRef.current || normalLessonMakeupPlanIssueRef.current
          || normalLessonMakeupCompletionWritingRef.current || normalLessonMakeupCompletionIssueRef.current
          || failedOps.length) {
          pop("Önce devam eden veya sonucu bekleyen öğrenci işlemini sonuçlandırın; taşıma gönderilmedi.",9000);
          return false;
        }
        const operationId = uid();
        if (!SINGLE_LESSON_MOVE_UUID.test(operationId)) return false;
        const issue = { operationId,actorUserId,branchId,requestPayload:intent,state:"writing",createdAt:new Date().toISOString(),label:(sourceStudent.name || "Öğrenci")+" · "+date+" "+time };
        if (!persistSingleLessonMoveIssue(issue,true)) {
          pop("Taşıma niyeti tarayıcıda güvenli saklanamadı; kayıt gönderilmedi.",9000);
          return false;
        }
        singleLessonMoveWritingRef.current = true;
        branchScopedWriteCountRef.current += 1;
        try {
          const result = await timedSingleLessonRequest(() => supabase.rpc("move_single_normal_lesson",{
            p_student_id:sid,p_lesson_id:lid,p_expected_record_version:intent.expectedRecordVersion,
            p_expected_date:intent.expectedDate,p_expected_time:intent.expectedTime,
            p_target_date:intent.targetDate,p_target_time:intent.targetTime,p_operation_id:operationId,
          }).single());
          if (generation !== protectedDataLoadGenerationRef.current || actorUserId !== singleLessonMoveActorRef.current) return false;
          persistSingleLessonMoveIssue({ ...issue,state:"unknown" });
          const checked = await checkSingleLessonMoveOperation(issue,{ notify:false,knownRejected:singleLessonMoveKnownRejection(result.error) });
          if (checked.ok && checked.applied) {
            pop("Ders tarih ve saate taşındı");
            return true;
          }
          pop(singleLessonMoveIssueMessage(singleLessonMoveIssueRef.current || issue),9000);
          return false;
        } catch {
          persistSingleLessonMoveIssue({ ...issue,state:"unknown" });
          return false;
        } finally {
          singleLessonMoveWritingRef.current = false;
          branchScopedWriteCountRef.current = Math.max(0,branchScopedWriteCountRef.current-1);
          if (singleLessonMoveIssueRef.current?.operationId === operationId) {
            if (singleLessonMoveIssueRef.current.state === "verified") clearSingleLessonMoveIssue(issue);
            else {
              if (singleLessonMoveIssueRef.current.state === "writing") persistSingleLessonMoveIssue({ ...issue,state:"unknown" });
              if (generation === protectedDataLoadGenerationRef.current && actorUserId === singleLessonMoveActorRef.current) setDetailSt(null);
            }
          }
        }
      });
    } catch {
      pop("Tek ders taşıma güvenliği hazırlanamadı. Kayıt tekrar gönderilmedi.",9000);
      return false;
    }
  };

  useEffect(() => {
    const actor = authSession?.user?.id || "";
    singleLessonMoveAutoCheckRef.current = "";
    const restore = () => {
      let issue = null;
      try { issue = readSingleLessonMoveIssue(actor); }
      catch { issue = { actorUserId:actor,operationId:"invalid-local-evidence",state:"conflict" }; }
      singleLessonMoveIssueRef.current = issue;
      setSingleLessonMoveIssue(issue);
    };
    restore();
    const changed = event => { if (event.key === SINGLE_LESSON_MOVE_ISSUE_PREFIX+actor || event.key === null) restore(); };
    window.addEventListener("storage",changed);
    return () => window.removeEventListener("storage",changed);
  },[authSession?.user?.id]);

  useEffect(() => {
    const issue = singleLessonMoveIssue;
    if (!browserOnline) singleLessonMoveAutoCheckRef.current = "";
    if (!giris || !browserOnline || !accessContext || issue?.branchId !== currentBranch?.id
      || issue?.actorUserId !== authSession?.user?.id || !issue?.operationId
      || ["not_applied","conflict"].includes(issue.state) || singleLessonMoveWritingRef.current
      || singleLessonMoveCheckingRef.current || singleLessonMoveAutoCheckRef.current === issue.operationId) return;
    singleLessonMoveAutoCheckRef.current = issue.operationId;
    void checkSingleLessonMoveOperation(issue,{ notify:false });
  },[giris,browserOnline,accessContext,currentBranch?.id,singleLessonMoveIssue?.operationId,singleLessonMoveIssue?.state,authSession?.user?.id]);

  const handleDelete = async (sid) => {
    const source = students.find(student=>student.id===sid);
    if (!source) return false;
    const deletedAt = new Date().toISOString();
    const archived = withStatusEvent({ ...source, frozen:true, left_at:turkeyDateKey(deletedAt) }, "deleted", deletedAt);
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
    if (!requireProtectedSources(["students","teachers"],"Öğrenci ekleme")) return null;
    const from = new Date((f.firstDate||turkeyDateKey())+"T12:00:00");
    const slots = normalizeSlots(f.lessonSlots);
    const packageLessonCount = Math.max(1, parseInt(f.count)||PAYMENT_PACK_SIZE);
    const teacher = teachers.find(t => t.id === f.teacher_id);
    if (!teacher) { pop("Öğretmen seçilmeden öğrenci eklenemez", 5000); return; }
    const teacherFrom = f.lesson_start_date || dateKey(from);
    const newStudent = {
      id: uid(), branch_id:currentBranch?.id || null, name: f.name, phone: f.phone||"", veli_adi: f.veli_adi||"", dogum_tarihi: f.dogum_tarihi||"",
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
      const branchId = currentBranch?.id;
      if (!branchId || (student.branch_id && student.branch_id !== branchId)) return false;
      return runBranchScopedWrite(async () => {
        const result = await supabase.from("students").select("*").eq("id",student.id).eq("branch_id",branchId).single();
        const current = result.data || students.find(item=>item.id===student.id && item.branch_id===branchId) || student;
        const event = { id:uid(), type:"communication_"+key, value, at:new Date().toISOString(), ...extra };
        const updatedStudent = { ...current, branch_id:branchId, status_history:[...(current.status_history || []),event] };
        setStudents(prev=>prev.map(item=>item.id===updatedStudent.id?updatedStudent:item));
        try {
          await saveStudent(updatedStudent);
          pop("İletişim durumu kaydedildi");
          return true;
        } catch (error) {
          return false;
        }
      });
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

  const reconcilePackagePaymentOperation = async (issue=packagePaymentIssueRef.current, options={}) => {
    if (!issue?.operationId) return { state:"none" };
    if (packagePaymentCheckingRef.current) return { state:"checking" };
    if (!browserOnline) {
      rememberPackagePaymentIssue({ ...issue, state:"unknown" });
      if (options.announce !== false) pop("İnternet bağlantısı yok; paket ödemesi henüz kontrol edilemedi.",7000);
      return { state:"unknown" };
    }
    packagePaymentCheckingRef.current = true;
    setPackagePaymentIssueChecking(true);
    try {
      const operationCheck = await timedSingleLessonRequest(() => supabase
        .from("package_payment_operations")
        .select("operation_id,student_id")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (operationCheck.error) {
        rememberPackagePaymentIssue({ ...issue, state:"unknown" });
        if (options.announce !== false) pop("Paket ödeme işlemi henüz doğrulanamadı; uyarı korunuyor.",8000);
        return { state:"unknown", error:operationCheck.error };
      }
      if (operationCheck.data?.operation_id===issue.operationId) {
        const expectedBranchId = issue.branchId || currentBranch?.id;
        const studentResult = await timedSingleLessonRequest(() => supabase
          .from("students").select("*")
          .eq("id",operationCheck.data.student_id || issue.studentId)
          .eq("branch_id",expectedBranchId)
          .single());
        if (studentResult.error || !studentResult.data?.id || (expectedBranchId && studentResult.data.branch_id !== expectedBranchId)) {
          rememberPackagePaymentIssue({ ...issue, state:"applied_pending_refresh" });
          if (options.announce !== false) pop("Paket ödemesi Supabase'e kaydedildi; ekran yenilenemedi. Uyarı korunuyor.",8000);
          return { state:"applied_pending_refresh", error:studentResult.error };
        }
        setStudents(current=>current.map(student=>student.id===studentResult.data.id?studentResult.data:student));
        clearPackagePaymentIssue(issue.operationId);
        if (options.announce !== false) pop("Paket ödemesi Supabase kaydından doğrulandı.",7000);
        return { state:"applied" };
      }
      await loadStudents();
      rememberPackagePaymentIssue({ ...issue, state:"not_applied" });
      if (options.announce !== false) pop("Paket ödemesi oluşmamış; gerekiyorsa işlemi yeniden yapın.",8000);
      return { state:"not_applied" };
    } finally {
      packagePaymentCheckingRef.current = false;
      setPackagePaymentIssueChecking(false);
    }
  };

  const handleÖdemeKaydet = async (sid, tarih) => {
    if (!requireProtectedSources(["students"],"Paket ödemesi")) return false;
    if (!isValidLocalDateInput(tarih)) {
      pop("Geçerli bir ödeme tarihi seçin",5000);
      return false;
    }
    if (paymentSavingId || packagePaymentWritingRef.current) return false;
    if (packagePaymentIssueRef.current) {
      pop("Önce bekleyen paket ödeme uyarısını kontrol edin.",7000);
      return false;
    }
    const sourceStudent = students.find(s=>s.id===sid);
    const packageInfo = sourceStudent ? (currentPaymentDueInfo(sourceStudent) || nextPayablePackageInfo(sourceStudent)) : null;
    if (!sourceStudent || !packageInfo || ![4,8,12,16].includes(packageInfo.packageSize) || (packageInfo.lessonIds||[]).length!==packageInfo.packageSize) {
      pop("Ödenecek paket güvenli biçimde belirlenemedi; öğrenci bilgileri yenilendi.",7000);
      await loadStudents();
      return false;
    }
    const unpaidExtras = unpaidEkDersler(sourceStudent);
    const operationId = uid();
    const operation = {
      operationId,
      branchId:currentBranch?.id || sourceStudent.branch_id || "",
      studentId:sid,
      studentName:sourceStudent.name || "Öğrenci",
      packageRef:packageInfo.packageId ? "id:"+packageInfo.packageId : "period:"+packageInfo.startKey+":"+packageInfo.endKey,
      paidOn:tarih,
      state:"pending",
      createdAt:new Date().toISOString(),
    };
    if (!rememberPackagePaymentIssue(operation)) {
      pop("Tarayıcı işlem güvenliği hazırlanamadı; paket ödemesi gönderilmedi.",8000);
      return false;
    }

    packagePaymentWritingRef.current = true;
    setPaymentSavingId(sid);
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("record_package_payment",{
        p_student_id:sid,
        p_paid_on:tarih,
        p_package_id:packageInfo.packageId || null,
        p_package_index:Number.isInteger(packageInfo.packageIndex) ? packageInfo.packageIndex : null,
        p_package_lesson_count:packageInfo.packageSize,
        p_package_lesson_ids:packageInfo.lessonIds || [],
        p_package_start:packageInfo.startKey,
        p_package_end:packageInfo.endKey,
        p_payment_label:packageInfo.donem || "",
        p_program_snapshot:studentScheduleLabel(sourceStudent),
        p_extra_lesson_refs:unpaidExtras.map(extraLessonPaymentRef),
        p_operation_id:operationId,
      }).single());

      if (!result.error && result.data?.student_record?.id) {
        const savedStudent = result.data.student_record;
        const savedPayment = (savedStudent.odemeler||[]).find(payment=>payment.operationId===operationId);
        const extrasApplied = unpaidExtras.every(extra => (savedStudent.ek_dersler||[]).find(item=>extraLessonPaymentRef(item)===extraLessonPaymentRef(extra))?.odendi);
        if (savedPayment && extrasApplied) {
          setStudents(prev=>prev.map(item=>item.id===savedStudent.id?savedStudent:item));
          clearPackagePaymentIssue(operationId);
          pop("Ödeme kaydedildi");
          return true;
        }
      }

      const alreadyPaid = String(result.error?.message||"").includes("PACKAGE_ALREADY_PAID");
      if (alreadyPaid) {
        await loadStudents();
        clearPackagePaymentIssue(operationId);
        pop("Bu paketin ödemesi zaten kayıtlı; ikinci ödeme oluşturulmadı.",7000);
        return false;
      }
      console.error("Paket ödeme yanıtı doğrulanamadı:",result.error);
      const reconciled = await reconcilePackagePaymentOperation(operation,{ announce:false });
      if (reconciled.state === "applied") {
        pop("Paket ödemesi Supabase'de doğrulandı ve ekran yenilendi.",7000);
        return true;
      }
      if (reconciled.state === "applied_pending_refresh") {
        pop("Paket ödemesi Supabase'e kaydedildi; ekran yenilenemedi. İkinci ödeme göndermeyin.",9000);
        return true;
      }
      pop(reconciled.state === "not_applied"
        ? "Paket ödemesi kaydedilmedi. İkinci ödeme gönderilmedi; gerekiyorsa yeniden deneyin."
        : "Paket ödeme işlemi kesinleştirilemedi. İkinci ödeme gönderilmedi; uyarı korunuyor.",9000);
      return false;
    } finally {
      packagePaymentWritingRef.current = false;
      setPaymentSavingId("");
    }
  };

  const removeFailedOperation = (id) => {
    persistFailedOps(failedOps.filter(op => op.id !== id));
  };

  const retryFailedOperation = async (op) => {
    if (!op?.studentId || retryingOps[op.id]) return;
    if (op.type === "lessonAction" && op.action === "attended") {
      pop("Eski bekleyen Katıldı kaydı güvenli işlem kimliği taşımıyor. Bu kayıt otomatik tekrar gönderilmedi; güncel öğrenci ekranından yeniden değerlendirin.",9000);
      return;
    }
    if (op.type === "lessonAction" && ["telafi","lm-telafi"].includes(op.action)) {
      pop("Eski bekleyen telafi hakkı kaydı güvenli işlem kimliği taşımıyor. Bu kayıt otomatik tekrar gönderilmedi; güncel öğrenci ekranından yeniden değerlendirin.",9000);
      return;
    }
    const branchId = currentBranch?.id;
    if (!branchId || (op.branchId && op.branchId !== branchId)) {
      pop("Bekleyen işlem yalnız ait olduğu şubede yeniden denenebilir.",8000);
      return;
    }
    setRetryingOps(prev => ({ ...prev, [op.id]: true }));
    branchScopedWriteCountRef.current += 1;
    try {
      const { data, error } = await supabase.from("students").select("*").eq("id",op.studentId).eq("branch_id",branchId).single();
      if (error || !data) throw error || new Error("Öğrenci bulunamadı");
      let built = null;
      if (op.type === "lessonAction") {
        built = buildActionUpdate([data], op.studentId, op.action, op.note, op.lessonId);
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
      branchScopedWriteCountRef.current = Math.max(0,branchScopedWriteCountRef.current - 1);
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
        ek_dersler: (s.ek_dersler||[]).map(e => original?.ekDersIds?.includes(extraLessonPaymentRef(e)) ? {...e, paidAt:nextPayment.tarih||e.paidAt} : e),
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
        return deleted?.ekDersIds?.includes(extraLessonPaymentRef(e)) ? {...e, odendi:false, paidAt:null} : e;
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

  const handlePieceAdd = async (sid, piece) => {
    const student = students.find(s => s.id === sid);
    const result = pieceResultOption(piece?.result);
    const name = String(piece?.name || "").trim();
    if (!student || !name || !result) { pop("Parça kaydı tamamlanamadı", 5000); return false; }
    const addedAt = new Date().toISOString();
    const updatedStudent = {
      ...student,
      package_summary_logs:[
        ...(student.package_summary_logs || []),
        {
          id:uid(),
          type:"manual_piece",
          addedAt,
          piece:{ name, result:result.value, label:result.label, score:result.score },
        },
      ],
    };
    try {
      await saveStudent(updatedStudent);
      pop("Parça kaydedildi");
      return true;
    } catch {
      return false;
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
    if (!requireProtectedSources(["students","teachers"],"Öğrenci düzenleme")) return false;
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
              ...(s.teacher_history || []).filter(entry => dateKey(entry.from) !== (f.teacher_change_date || turkeyDateKey())),
              { teacherId:selectedTeacher.id, teacherName:selectedTeacher.name, from:f.teacher_change_date || turkeyDateKey() }
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
      last_raise_date: date || turkeyDateKey()
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

  const reconcileExtraLessonPaymentOperation = async (issue=extraLessonPaymentIssueRef.current, options={}) => {
    if (!issue?.operationId) return { state:"none" };
    if (extraLessonPaymentCheckingRef.current) return { state:"checking" };
    if (!browserOnline) {
      rememberExtraLessonPaymentIssue({ ...issue, state:"unknown" });
      if (options.announce !== false) pop("İnternet bağlantısı yok; Ek Ders ödemesi henüz kontrol edilemedi.",7000);
      return { state:"unknown" };
    }
    extraLessonPaymentCheckingRef.current = true;
    setExtraLessonPaymentIssueChecking(true);
    try {
      const operationCheck = await timedSingleLessonRequest(() => supabase
        .from("extra_lesson_payment_operations")
        .select("operation_id,student_id")
        .eq("operation_id",issue.operationId)
        .maybeSingle());
      if (operationCheck.error) {
        rememberExtraLessonPaymentIssue({ ...issue, state:"unknown" });
        if (options.announce !== false) pop("Ek Ders ödeme işlemi henüz doğrulanamadı; uyarı korunuyor.",8000);
        return { state:"unknown", error:operationCheck.error };
      }
      if (operationCheck.data?.operation_id===issue.operationId) {
        const expectedBranchId = issue.branchId || currentBranch?.id;
        const studentResult = await timedSingleLessonRequest(() => supabase
          .from("students")
          .select("*")
          .eq("id",operationCheck.data.student_id || issue.studentId)
          .eq("branch_id",expectedBranchId)
          .single());
        if (studentResult.error || !studentResult.data?.id || (expectedBranchId && studentResult.data.branch_id !== expectedBranchId)) {
          rememberExtraLessonPaymentIssue({ ...issue, state:"applied_pending_refresh" });
          if (options.announce !== false) pop("Ek Ders ödemesi Supabase'e kaydedildi; ekran yenilenemedi. Uyarı korunuyor.",8000);
          return { state:"applied_pending_refresh", error:studentResult.error };
        }
        setStudents(current=>current.map(student=>student.id===studentResult.data.id?studentResult.data:student));
        clearExtraLessonPaymentIssue(issue.operationId);
        if (options.announce !== false) pop("Ek Ders ödemesi Supabase kaydından doğrulandı.",7000);
        return { state:"applied" };
      }
      await loadStudents();
      rememberExtraLessonPaymentIssue({ ...issue, state:"not_applied" });
      if (options.announce !== false) pop("Ek Ders ödemesi oluşmamış; gerekiyorsa işlemi yeniden yapın.",8000);
      return { state:"not_applied" };
    } finally {
      extraLessonPaymentCheckingRef.current = false;
      setExtraLessonPaymentIssueChecking(false);
    }
  };

  const handleEkDersOdeme = async (sid, selectedExtra, tarih) => {
    if (!requireProtectedSources(["students"],"Ek Ders ödemesi")) return false;
    if (!isValidLocalDateInput(tarih)) {
      pop("Geçerli bir ödeme tarihi seçin",5000);
      return false;
    }
    if (extraLessonPaymentIssueRef.current) {
      pop("Önce bekleyen Ek Ders ödeme uyarısını kontrol edin.",7000);
      return false;
    }
    const student = students.find(s=>s.id===sid);
    const extraRef = extraLessonPaymentRef(selectedExtra);
    const extra = (student?.ek_dersler||[]).find(e=>extraLessonPaymentRef(e)===extraRef);
    if (!student || !extra) {
      pop("Ek ders kaydı bulunamadı; öğrenci bilgileri yenilendi.",6000);
      await loadStudents();
      return false;
    }
    if (extra.odendi || (student.odemeler||[]).some(payment=>(payment.ekDersIds||[]).includes(extraRef))) {
      pop("Bu ek dersin ödemesi zaten kayıtlı; ikinci ödeme oluşturulmadı.",7000);
      await loadStudents();
      return false;
    }

    const operationId = uid();
    const tutar = extra.fee || ekDersFee(student);
    const paymentLabel = "Ek ders - "+fmtShort(extra.date);
    const operation = {
      operationId,
      branchId:currentBranch?.id || student.branch_id || "",
      studentId:sid,
      studentName:student.name || "Öğrenci",
      extraRef,
      extraDate:extra.date || "",
      paidOn:tarih,
      amount:tutar,
      state:"pending",
      createdAt:new Date().toISOString(),
    };
    if (!rememberExtraLessonPaymentIssue(operation)) {
      pop("Tarayıcı işlem güvenliği hazırlanamadı; Ek Ders ödemesi gönderilmedi.",8000);
      return false;
    }

    extraLessonPaymentWritingRef.current = true;
    try {
      const result = await timedSingleLessonRequest(() => supabase.rpc("record_extra_lesson_payment",{
        p_student_id:sid,
        p_extra_lesson_ref:extraRef,
        p_paid_on:tarih,
        p_amount:tutar,
        p_payment_label:paymentLabel,
        p_operation_id:operationId,
      }).single());

      if (!result.error && result.data?.student_record?.id) {
        const savedStudent = result.data.student_record;
        const savedExtra = (savedStudent.ek_dersler||[]).find(e=>extraLessonPaymentRef(e)===extraRef);
        const savedPayment = (savedStudent.odemeler||[]).find(payment=>payment.operationId===operationId || (payment.ekDersIds||[]).includes(extraRef));
        if (savedExtra?.odendi && savedPayment) {
          setStudents(prev=>prev.map(item=>item.id===savedStudent.id?savedStudent:item));
          clearExtraLessonPaymentIssue(operationId);
          pop("Ek ders ödemesi kaydedildi");
          return true;
        }
      }

      const alreadyPaid = String(result.error?.message||"").includes("EXTRA_LESSON_ALREADY_PAID");
      if (alreadyPaid) {
        await loadStudents();
        clearExtraLessonPaymentIssue(operationId);
        pop("Bu ek dersin ödemesi zaten kayıtlı; ikinci ödeme oluşturulmadı.",7000);
        return false;
      }

      console.error("Ek ders ödeme yanıtı doğrulanamadı:",result.error);
      const reconciled = await reconcileExtraLessonPaymentOperation(operation,{ announce:false });
      if (reconciled.state === "applied") {
        pop("Ek ders ödemesi Supabase'de doğrulandı ve ekran yenilendi.",7000);
        return true;
      }
      if (reconciled.state === "applied_pending_refresh") {
        pop("Ek ders ödemesi Supabase'e kaydedildi; ekran yenilenemedi. İkinci ödeme göndermeyin.",9000);
        return true;
      }
      pop(reconciled.state === "not_applied"
        ? "Ek ders ödemesi kaydedilmedi. İkinci ödeme gönderilmedi; gerekiyorsa yeniden deneyin."
        : "Ek ders ödeme işlemi kesinleştirilemedi. İkinci ödeme gönderilmedi; uyarı korunuyor.",9000);
      return false;
    } finally {
      extraLessonPaymentWritingRef.current = false;
    }
  };

  const handleExtraLessonPaymentIssueCheck = async () => {
    await reconcileExtraLessonPaymentOperation(extraLessonPaymentIssueRef.current,{ announce:true });
  };

  const handlePackagePaymentIssueCheck = async () => {
    await reconcilePackagePaymentOperation(packagePaymentIssueRef.current,{ announce:true });
  };

  useEffect(() => {
    const issue = extraLessonPaymentIssueRef.current;
    if (!giris || !browserOnline || !issue?.operationId || issue.state === "not_applied" || extraLessonPaymentWritingRef.current) return;
    const checkKey = issue.operationId+"|online";
    if (extraLessonPaymentAutoCheckRef.current === checkKey) return;
    extraLessonPaymentAutoCheckRef.current = checkKey;
    void reconcileExtraLessonPaymentOperation(issue,{ announce:true });
  }, [giris,browserOnline,extraLessonPaymentIssue?.operationId,extraLessonPaymentIssue?.state]);

  useEffect(() => {
    const issue = packagePaymentIssueRef.current;
    if (!giris || !browserOnline || !issue?.operationId || issue.state === "not_applied" || packagePaymentWritingRef.current) return;
    const checkKey = issue.operationId+"|online";
    if (packagePaymentAutoCheckRef.current === checkKey) return;
    packagePaymentAutoCheckRef.current = checkKey;
    void reconcilePackagePaymentOperation(issue,{ announce:false });
  }, [giris,browserOnline,packagePaymentIssue?.operationId,packagePaymentIssue?.state]);

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

  const handleExtraLessonReminderToggle = async (sid, extra, sent) => {
    await handleReminderToggle(sid, extraLessonReminderRef(extra), sent);
  };

  const handleWAExtraLesson = async (student, extra) => {
    const text = msgEkDersHatirlatma(extra);
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else {
      try {
        await navigator.clipboard.writeText(text);
        pop("Ek Ders hatırlatma mesajı kopyalandı");
      } catch {
        pop("Telefon bulunamadı; Ek Ders hatırlatma mesajı kopyalanamadı.",7000);
        return;
      }
    }
    await handleExtraLessonReminderToggle(student.id,extra,true);
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
    const count = downloadGoogleCalendarICS(students,singleLessons);
    pop(count ? count + " ders Google Takvim dosyasına aktarıldı" : "Aktarılacak ders bulunamadı");
  };

  const handleTeacherAdd = async (name) => {
    if (!requireProtectedSources(["teachers"],"Öğretmen ekleme")) return false;
    if (!activeOrganization?.id) { pop("Kurum bilgisi doğrulanamadı; öğretmen kaydedilmedi.",7000); return false; }
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (teachers.some(t => t.name.toLocaleLowerCase("tr-TR") === cleanName.toLocaleLowerCase("tr-TR"))) {
      pop("Bu öğretmen zaten kayıtlı", 5000);
      return false;
    }
    const organizationId = activeOrganization.id;
    const { data, error } = await runBranchScopedWrite(() => supabase.from("teachers").insert({ name:cleanName, active:true, organization_id:organizationId }).select("*").single());
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
    if (!requireProtectedSources(["teachers"],"Öğretmen durumu değişikliği")) return false;
    if (!activeOrganization?.id || teacher.organization_id !== activeOrganization.id) { pop("Seçili kurumla öğretmen kaydı uyuşmuyor; işlem yapılmadı.",7000); return false; }
    if (teacher.active && teachers.filter(t=>t.active).length <= 1) {
      pop("En az bir aktif öğretmen kalmalıdır", 5000);
      return;
    }
    const nextActive = !teacher.active;
    const organizationId = activeOrganization.id;
    const { data, error } = await runBranchScopedWrite(() => supabase.from("teachers").update({ active:nextActive }).eq("id",teacher.id).eq("organization_id",organizationId).select("*").single());
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
    if (!requireProtectedSources(["expenses"],"Gider kaydı")) return false;
    if (!currentBranch?.id) { pop("Şube bilgisi doğrulanamadı; gider kaydedilmedi.",7000); return false; }
    const payload = {
      branch_id:currentBranch.id,
      title:expense.title,
      category:expense.category,
      amount:expense.amount,
      expense_date:expense.expense_date,
      is_recurring:!!expense.is_recurring,
      recurring_until:null,
      deleted_at:null,
      updated_at:new Date().toISOString(),
    };
    const { data, error } = await runBranchScopedWrite(() => supabase.from("expenses").insert(payload).select("*").single());
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
    if (!requireProtectedSources(["expenses"],"Gider değişikliği")) return false;
    if (!currentBranch?.id || expense.branch_id !== currentBranch.id) { pop("Seçili şubeyle gider kaydı uyuşmuyor; işlem yapılmadı.",7000); return false; }
    const updatedAt = new Date().toISOString();
    const changes = expense.is_recurring
      ? { recurring_until:localDateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0)), updated_at:updatedAt }
      : { deleted_at:updatedAt, updated_at:updatedAt };
    const branchId = currentBranch.id;
    const { data, error } = await runBranchScopedWrite(() => supabase.from("expenses").update(changes).eq("id",expense.id).eq("branch_id",branchId).select("*").single());
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
    if (filter==="telafi") return s.telafi_records.some(isCurrentTelafi);
    if (filter==="odeme") return isÖdemeBekleyen(s);
    if (filter==="zam") return isRaiseDue(s);
    return true;
  });

  const stats = { total:operationalStudents.length, active:operationalStudents.filter(s=>!s.frozen && !isStudentLeft(s)).length, frozen:operationalStudents.filter(s=>s.frozen && !isStudentLeft(s)).length, left:operationalStudents.filter(isStudentLeft).length, telafi:operationalStudents.filter(s=>s.telafi_records.some(isCurrentTelafi)).length, odeme:todayPayments.length, zam:raiseDueList.length };
  const telafiWarnList = operationalStudents.filter(s => telafiQuotaInfo(s).count===5 && !s.frozen);
  const pendingMonthlyReports = monthlyReports.filter(report=>!report.downloadedAt);
  const branchOptions = accessBranchOptions(accessContext);
  const selectableBranchOptions = branchOptions.filter(option=>option.selectable);
  const hasMultipleSelectableBranches = selectableBranchOptions.length > 1;
  const canManageBranches = activeOrganization?.canCreateBranches === true;
  const canManageStaff = activeOrganization?.role === "owner" && accessContext?.profileRole === "admin";
  const organizationBranches = Array.isArray(activeOrganization?.branches) ? activeOrganization.branches : [];
  const activeStaffBranches = organizationBranches.filter(branch=>branch.active !== false);
  const staffActivationByInvitation = new Map(staffActivations.map(operation=>[operation.invitation_id,operation]));
  const visibleNormalLessonEvaluationIssue = normalLessonEvaluationIssue && (!normalLessonEvaluationIssue.actorUserId || normalLessonEvaluationIssue.actorUserId === authSession?.user?.id) ? normalLessonEvaluationIssue : null;
  const visibleSingleLessonMoveIssue = singleLessonMoveIssue?.actorUserId === authSession?.user?.id ? singleLessonMoveIssue : null;
  const guardSingleLessonMoveInteraction = event => {
    if (!visibleSingleLessonMoveIssue && !singleLessonMoveWritingRef.current) return;
    if (event.target.closest?.("[data-single-lesson-move-control],.crm-nav-btn,.crm-mobile-nav,.crm-branch-switch,.crm-desktop-logout,[data-crm-security]")) return;
    event.preventDefault();
    event.stopPropagation();
    pop("Önce tek ders taşıma sonucunu üstteki uyarıdan kesinleştirin.",7000);
  };
  const visibleNormalLessonMakeupIssue = normalLessonMakeupIssue && (!normalLessonMakeupIssue.actorUserId || normalLessonMakeupIssue.actorUserId === authSession?.user?.id) ? normalLessonMakeupIssue : null;
  const visibleNormalLessonMakeupPlanIssue = normalLessonMakeupPlanIssue && (!normalLessonMakeupPlanIssue.actorUserId || normalLessonMakeupPlanIssue.actorUserId === authSession?.user?.id) ? normalLessonMakeupPlanIssue : null;
  const visibleNormalLessonMakeupCompletionIssue = normalLessonMakeupCompletionIssue && (!normalLessonMakeupCompletionIssue.actorUserId || normalLessonMakeupCompletionIssue.actorUserId === authSession?.user?.id) ? normalLessonMakeupCompletionIssue : null;
  const visibleBranchLifecycleIssue = branchLifecycleIssue && (!branchLifecycleIssue.actorUserId || branchLifecycleIssue.actorUserId === authSession?.user?.id) ? branchLifecycleIssue : null;
  const visibleStaffInvitationIssue = staffInvitationIssue && (!staffInvitationIssue.actorUserId || staffInvitationIssue.actorUserId === authSession?.user?.id) ? staffInvitationIssue : null;
  const visibleStaffActivationIssue = staffActivationIssue && (!staffActivationIssue.actorUserId || staffActivationIssue.actorUserId === authSession?.user?.id) ? staffActivationIssue : null;
  const visibleStaffAssignmentIssue = staffAssignmentIssue && (!staffAssignmentIssue.actorUserId || staffAssignmentIssue.actorUserId === authSession?.user?.id) ? staffAssignmentIssue : null;
  const visibleStaffDeactivationIssue = staffDeactivationIssue && (!staffDeactivationIssue.actorUserId || staffDeactivationIssue.actorUserId === authSession?.user?.id) ? staffDeactivationIssue : null;
  const mainNav = [
    { key:"bugün", label:"Bugün", icon:"◫" },
    { key:"liste", label:"Öğrenciler", icon:<StudentsNavIcon />, badge:stats.active },
    { key:"ogretmenler", label:"Öğretmenler", icon:<TeachersNavIcon />, badge:teachers.filter(t=>t.active).length },
    { key:"iletisim", label:"İletişim", icon:<CommunicationNavIcon /> },
    { key:"tekders", label:"Tek Ders", icon:"◇", badge:singleLessons.filter(lesson=>!lesson.deleted_at && lesson.lesson_status==="planned").length },
    { key:"takvim", label:"Takvim", icon:"□" },
    { key:"gelir", label:"Finans", icon:"↗" },
    { key:"ozet", label:"Özet", icon:"◎" },
    ...(canManageBranches ? [{ key:"subeler", label:"Şubeler", icon:"⌂" }] : []),
    ...(canManageStaff ? [{ key:"personel", label:"Personel", icon:"◉" }] : []),
  ];
  const mobileNav = mainNav.filter(item=>item.key !== "subeler");
  const viewMeta = {
    bugün:{ eyebrow:"Günlük Merkez", title:"Bugünün akışı", subtitle:"Dersler, ödemeler ve bekleyen işler tek ekranda." },
    liste:{ eyebrow:"ÖĞRENCİ YÖNETİMİ", title:"Öğrenciler", subtitle:"Tüm öğrencileri, paketleri ve gelişim durumlarını yönet." },
    ogretmenler:{ eyebrow:"ÖĞRETMEN YÖNETİMİ", title:"Öğretmenler", subtitle:"Öğretmenlerin öğrencilerini, haftalık programını ve aylık derslerini gör." },
    iletisim:{ eyebrow:"VELİ İLETİŞİMİ", title:"İletişim", subtitle:"WhatsApp grubu, bülten, ders kuralları ve Google yorumlarını takip et." },
    tekders:{ eyebrow:"BAĞIMSIZ DERS YÖNETİMİ", title:"Tek Ders", subtitle:"Kayıtlı öğrenciler ve misafirler için paket dışı tek dersleri yönet." },
    takvim:{ eyebrow:"Haftalık Program", title:"Ders takvimi", subtitle:"Haftanın derslerini ve değişikliklerini birlikte gör." },
    gelir:{ eyebrow:"Finansal Görünüm", title:"Finans", subtitle:"Tahsilat, gider ve net kârını aylık olarak takip et." },
    ozet:{ eyebrow:"AYLIK YÖNETİM", title:"Kurum özeti", subtitle:"Ders, gelir, kayıt, öğrenci durumu ve öğretmen dağılımını ay ay izle." },
    subeler:{ eyebrow:"KURUM YÖNETİMİ", title:"Şubeler", subtitle:"Kurum şubelerini güvenli biçimde oluştur ve aktiflik durumlarını yönet." },
    personel:{ eyebrow:"ERİŞİM YÖNETİMİ", title:"Personel", subtitle:"Yönetici ve öğretmenleri davet et; güncel şube erişimlerini güvenle yönet." },
  }[mainTab];
  const protectedDataIssueLabels = Object.keys(protectedDataLoadIssues)
    .filter(source=>protectedDataLoadIssues[source])
    .map(protectedSourceLabel);
  const singleLessonLoadBlocked = !singleLessonsLoaded || !singleLessonSecurityReady;
  if (singleLessonLoadBlocked && !protectedDataIssueLabels.includes("Tek Ders kayıtları")) protectedDataIssueLabels.push("Tek Ders kayıtları");
  const operationalDataReady = !!activeOrganization?.id && !!currentBranch?.id && browserOnline && !connectionRevalidationRequired && loadedSources.students && loadedSources.teachers && loadedSources.expenses && !singleLessonLoadBlocked;

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
          ) : authMode === "mfa-enroll" ? (
            <>
              <h2>İki adımlı güvenliği kur</h2>
              <p>Bu işlem yalnızca ilk kurulumda yapılır. Google Authenticator, Microsoft Authenticator veya 1Password kullanabilirsiniz.</p>
              {!mfaEnrollment ? (
                <button disabled={authBusy} onClick={handleMfaEnrollmentStart} style={{opacity:authBusy ? .65 : 1}}>
                  {authBusy ? "Hazırlanıyor..." : "QR Kodu Oluştur"}
                </button>
              ) : (
                <>
                  <img
                    src={mfaEnrollment.qrCode}
                    alt="Sonsuz CRM doğrulama QR kodu"
                    style={{display:"block",width:190,height:190,maxWidth:"100%",margin:"16px auto",borderRadius:14,background:"#fff",padding:8}}
                  />
                  <p style={{fontSize:12}}>QR kodunu telefonunuzdaki doğrulama uygulamasıyla tarayın.</p>
                  {mfaEnrollment.secret && (
                    <p style={{fontSize:11,wordBreak:"break-all",background:"#f4f1ff",padding:10,borderRadius:10}}>
                      Elle ekleme kodu: <strong>{mfaEnrollment.secret}</strong>
                    </p>
                  )}
                  <label>Uygulamadaki 6 haneli kod</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={e => { setMfaCode(e.target.value.replace(/\D/g, "").slice(0,6)); setAuthError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleMfaVerify(); }}
                    placeholder="000000"
                  />
                  <label style={{display:"flex",alignItems:"center",gap:9,marginTop:13,cursor:"pointer"}}>
                    <input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} style={{width:16,height:16,margin:0}} />
                    Bu tarayıcıya {TRUSTED_DEVICE_DAYS} gün güven
                  </label>
                  {authError && <p style={{ color:"#dc5d51", fontSize:12, fontWeight:700, margin:"9px 0 0" }}>{authError}</p>}
                  <button disabled={authBusy} onClick={handleMfaVerify} style={{opacity:authBusy ? .65 : 1}}>
                    {authBusy ? "Doğrulanıyor..." : "Doğrula ve CRM'e Gir"}
                  </button>
                </>
              )}
              {!mfaEnrollment && authError && <p style={{ color:"#dc5d51", fontSize:12, fontWeight:700, margin:"9px 0 0" }}>{authError}</p>}
              <button type="button" disabled={authBusy} onClick={()=>handleSecureLogout(false)} style={{background:"transparent",color:"#756f7a",border:"1px solid #ded9d3",marginTop:10}}>
                Vazgeç ve güvenli çıkış yap
              </button>
            </>
          ) : authMode === "mfa-challenge" ? (
            <>
              <h2>Doğrulama kodu</h2>
              <p>Telefonunuzdaki doğrulama uygulamasında görünen 6 haneli kodu girin.</p>
              <label>6 haneli kod</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={e => { setMfaCode(e.target.value.replace(/\D/g, "").slice(0,6)); setAuthError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleMfaVerify(); }}
                placeholder="000000"
              />
              <label style={{display:"flex",alignItems:"center",gap:9,marginTop:13,cursor:"pointer"}}>
                <input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} style={{width:16,height:16,margin:0}} />
                Bu tarayıcıya {TRUSTED_DEVICE_DAYS} gün güven
              </label>
              {authError && <p style={{ color:"#dc5d51", fontSize:12, fontWeight:700, margin:"9px 0 0" }}>{authError}</p>}
              {authNotice && <p style={{ color:"#8a6414", fontSize:12, fontWeight:700, margin:"9px 0 0" }}>{authNotice}</p>}
              <button disabled={authBusy} onClick={handleMfaVerify} style={{opacity:authBusy ? .65 : 1}}>
                {authBusy ? "Doğrulanıyor..." : "Doğrula ve CRM'e Gir"}
              </button>
              <button type="button" disabled={authBusy} onClick={()=>handleSecureLogout(false)} style={{background:"transparent",color:"#756f7a",border:"1px solid #ded9d3",marginTop:10}}>
                Güvenli çıkış yap
              </button>
            </>
          ) : (
            <>
              <h2>Tekrar hoş geldin</h2>
              <p>Yönetici veya öğretmen hesabınla güvenli giriş yap.</p>
              <label>E-posta</label>
              <input
                type="email"
                autoComplete="username"
                value={authEmail}
                onChange={e => { setAuthEmail(e.target.value); setAuthError(""); setAuthNotice(""); }}
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
              {authNotice && <p style={{ color:"#0f8a62", fontSize:12, fontWeight:700, margin:"9px 0 0" }}>{authNotice}</p>}
              <button disabled={authBusy} onClick={handleSupabaseLogin} style={{opacity:authBusy ? .65 : 1}}>
                {authBusy ? "Giriş yapılıyor..." : "Güvenli Giriş"}
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={handlePasswordRecovery}
                style={{background:"transparent",color:"#5e43dd",border:"none",boxShadow:"none",marginTop:8,padding:"8px 10px"}}
              >
                Parolamı unuttum
              </button>
            </>
          )}
        </div>
        </section>
      </div>
      </>
    );
  }

  if (accessContextLoading || (!accessContext && !accessContextError)) {
    return (
      <>
      <style>{MIZAN_UI_CSS}</style>
      <div className="crm-loading">
        <div>
          <div className="crm-loading-mark">S</div>
          <p style={{ fontWeight:750, color:"#77717d" }}>Kurum ve şube yetkilerin doğrulanıyor...</p>
        </div>
      </div>
      </>
    );
  }

  if (accessContextError) {
    return (
      <>
      <style>{MIZAN_UI_CSS}</style>
      <div className="crm-loading">
        <div style={{ width:"min(460px,calc(100vw - 32px))", background:"#fff", border:"1.5px solid #fca5a5", borderRadius:18, padding:26, boxShadow:"0 18px 50px rgba(127,29,29,.10)" }}>
          <div className="crm-loading-mark">S</div>
          <h2 style={{ margin:"16px 0 8px", color:"#991b1b", fontSize:22 }}>Şube yetkisi doğrulanamadı</h2>
          <p style={{ margin:"0 0 16px", color:"#7f1d1d", fontSize:13, fontWeight:650, lineHeight:1.55 }}>{accessContextError} Hiçbir kurum verisi gösterilmiyor ve işlem yapılamıyor.</p>
          <button onClick={loadAccessContext} disabled={!browserOnline || accessContextLoading} style={{ width:"100%", border:"none", borderRadius:10, padding:"11px 14px", background:"#dc2626", color:"#fff", fontSize:13, fontWeight:850, cursor:(!browserOnline || accessContextLoading)?"wait":"pointer", opacity:(!browserOnline || accessContextLoading)?.65:1 }}>Yeniden Dene</button>
          <button onClick={()=>handleSecureLogout(false)} disabled={authBusy} style={{ width:"100%", marginTop:9, border:"1px solid #fecaca", borderRadius:10, padding:"10px 14px", background:"#fff", color:"#991b1b", fontSize:12, fontWeight:800 }}>Güvenli çıkış yap</button>
        </div>
      </div>
      </>
    );
  }

  if (!activeOrganization?.id || !currentBranch?.id) {
    return (
      <>
      <style>{MIZAN_UI_CSS}</style>
      <div className="crm-loading">
        <div style={{ width:"min(540px,calc(100vw - 32px))", background:"#fff", border:"1px solid #e7e2ef", borderRadius:22, padding:26, boxShadow:"0 20px 60px rgba(54,38,78,.12)" }}>
          <div className="crm-loading-mark">S</div>
          <h2 style={{ margin:"16px 0 7px", color:"#211a2a", fontSize:23 }}>Şube Seç</h2>
          <p style={{ margin:"0 0 18px", color:"#746d7a", fontSize:13, lineHeight:1.55 }}>Yalnızca yetkili olduğun aktif şubeler açılabilir. Seçim, Supabase yetkilerinin yerine geçmez.</p>
          <div style={{ display:"grid", gap:10 }}>
            {branchOptions.map(option=><button key={option.organizationId+"|"+option.branchId} type="button" disabled={!option.selectable} onClick={()=>selectBranchContext(option)} style={{ border:option.selectable?"1.5px solid #d9ccff":"1px solid #e5e7eb", borderRadius:13, padding:"13px 14px", background:option.selectable?"#f7f3ff":"#f5f5f5", color:option.selectable?"#4f2fc5":"#999", textAlign:"left", cursor:option.selectable?"pointer":"not-allowed", fontFamily:"inherit" }}>
              <strong style={{ display:"block", fontSize:14 }}>{option.branchName}</strong>
              <span style={{ display:"block", marginTop:3, fontSize:11 }}>{option.organizationName}{option.selectable?"":" · Pasif"}</span>
            </button>)}
          </div>
          <button onClick={()=>handleSecureLogout(false)} disabled={authBusy} style={{ width:"100%", marginTop:16, border:"1px solid #ddd6e8", borderRadius:10, padding:"10px 14px", background:"#fff", color:"#665d70", fontSize:12, fontWeight:800 }}>Güvenli çıkış yap</button>
        </div>
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

  if (!operationalDataReady) {
    return (
      <>
      <style>{MIZAN_UI_CSS}</style>
      <div className="crm-loading">
        <div style={{ width:"min(460px,calc(100vw - 32px))", background:"#fff", border:"1.5px solid #fca5a5", borderRadius:18, padding:"26px", boxShadow:"0 18px 50px rgba(127,29,29,.10)" }}>
          <div className="crm-loading-mark">S</div>
          <h2 style={{ margin:"16px 0 8px", color:"#991b1b", fontSize:22 }}>{browserOnline ? "CRM verileri doğrulanıyor" : "İnternet bağlantısı kesildi"}</h2>
          <p style={{ margin:"0 0 8px", color:"#7f1d1d", fontSize:13, fontWeight:650, lineHeight:1.55 }}>{browserOnline ? "Güvenli çalışma için gerekli bütün veriler henüz doğrulanamadı. Hiçbir kurum verisi gösterilmiyor ve işlem yapılamıyor." : "Bağlantı geri gelip bütün CRM verileri Supabase'den yeniden doğrulanana kadar hiçbir kurum verisi gösterilmiyor ve işlem yapılamıyor."}</p>
          <p style={{ margin:"0 0 16px", color:"#991b1b", fontSize:12, fontWeight:800 }}>Yüklenemeyen: {protectedDataIssueLabels.join(", ") || "CRM kayıtları"}</p>
          <button onClick={()=>handleProtectedDataRetry(connectionRevalidationRequired)} disabled={!browserOnline || protectedDataRetrying} style={{ width:"100%", border:"none", borderRadius:10, padding:"11px 14px", background:"#dc2626", color:"#fff", fontSize:13, fontWeight:850, cursor:(!browserOnline || protectedDataRetrying)?"wait":"pointer", opacity:(!browserOnline || protectedDataRetrying)?0.65:1 }}>{protectedDataRetrying?"Yeniden Yükleniyor...":"Yeniden Dene"}</button>
          <button onClick={()=>handleSecureLogout(false)} disabled={authBusy || protectedDataRetrying} style={{ width:"100%", marginTop:9, border:"1px solid #fecaca", borderRadius:10, padding:"10px 14px", background:"#fff", color:"#991b1b", fontSize:12, fontWeight:800, cursor:(authBusy || protectedDataRetrying)?"wait":"pointer" }}>Güvenli çıkış yap</button>
          <p style={{ margin:"12px 0 0", color:"#991b1b", fontSize:10, fontWeight:650 }}>“Yeniden Dene” yalnızca Supabase'den veri okur; hiçbir ödeme veya değişiklik göndermez.</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <style>{MIZAN_UI_CSS}</style>
    <div className="crm-app" onClickCapture={guardSingleLessonMoveInteraction} onKeyDownCapture={event=>{ if (event.key === "Enter" || event.key === " ") guardSingleLessonMoveInteraction(event); }}>
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
        <div className="crm-sidebar-bottom">
          <div className="crm-tip"><strong>Bugünün özeti</strong>{stats.active} aktif öğrenci · {stats.odeme} ödeme bekliyor · {telafiWarnList.length} telafi uyarısı.</div>
          <button className="crm-side-action" onClick={handleGoogleCalendarExport}>⇧ Google Takvim'e aktar</button>
        </div>
      </aside>

      <main className="crm-content">
        <header className="crm-topbar">
          <div><p className="crm-eyebrow">{viewMeta.eyebrow}</p><h1 className="crm-title">{viewMeta.title}</h1><p className="crm-subtitle">{viewMeta.subtitle}</p></div>
          <div className="crm-header-actions">
            {canManageBranches && mainTab!=="subeler" ? <button type="button" className="crm-owner-branches" title="Şubeleri yönet" onClick={()=>setMainTab("subeler")}>Şubeler</button> : null}
            {hasMultipleSelectableBranches ? <button type="button" className="crm-branch-switch" title="Aktif şubeyi değiştir" onClick={()=>setShowBranchMenu(true)}>⌄ {currentBranch.name}</button> : null}
            <button className="crm-primary" onClick={()=>mainTab==="subeler"?openBranchCreate():mainTab==="personel"?openStaffInvite():mainTab==="tekders"?setSingleLessonSheet({ mode:"add" }):mainTab==="takvim"?setShowCalendarAvailability(true):setShowAdd(true)}>{mainTab==="subeler"?"＋ Yeni Şube":mainTab==="personel"?"＋ Personel Davet Et":mainTab==="tekders"?"＋ Tek Ders Ekle":mainTab==="takvim"?"Uygun Saatler":"＋ Öğrenci ekle"}</button>
          </div>
        </header>
        <section className="crm-page">
        {visibleSingleLessonMoveIssue ? (
          <div role="alert" data-single-lesson-move-control style={{ background:"#fff7ed",border:"1.5px solid #fdba74",borderRadius:14,padding:"12px 14px",marginBottom:14 }}>
            <p style={{ margin:"0 0 5px",fontSize:13,fontWeight:850,color:"#9a3412" }}>Tek ders taşıma kontrolü</p>
            <p style={{ margin:"0 0 8px",fontSize:12,color:"#9a3412",lineHeight:1.5 }}>{singleLessonMoveIssueMessage(visibleSingleLessonMoveIssue)}</p>
            <p style={{ fontSize:11,color:"#9a3412" }}>{visibleSingleLessonMoveIssue.label}</p>
            <button type="button" disabled={!browserOnline || singleLessonMoveChecking || singleLessonMoveWritingRef.current} onClick={()=>checkSingleLessonMoveOperation(visibleSingleLessonMoveIssue)} style={{ border:0,borderRadius:9,padding:"8px 11px",background:"#ea580c",color:"#fff",fontWeight:850 }}>{singleLessonMoveChecking ? "Kontrol Ediliyor…" : "Yeniden Kontrol Et"}</button>
            {visibleSingleLessonMoveIssue.state === "not_applied" ? <button type="button" onClick={()=>clearSingleLessonMoveIssue(visibleSingleLessonMoveIssue)} style={{ marginLeft:8,border:"1px solid #fdba74",borderRadius:9,padding:"8px 11px",background:"#fff",color:"#9a3412",fontWeight:850 }}>Uyarıyı Gördüm</button> : null}
          </div>
        ) : null}
        {visibleNormalLessonEvaluationIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Ders değerlendirmesi kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{normalLessonEvaluationIssueMessage(visibleNormalLessonEvaluationIssue)}</p>
            {visibleNormalLessonEvaluationIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleNormalLessonEvaluationIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkNormalLessonEvaluationOperation(visibleNormalLessonEvaluationIssue)} disabled={!browserOnline || normalLessonEvaluationIssueChecking || normalLessonEvaluationWritingRef.current} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || normalLessonEvaluationIssueChecking || normalLessonEvaluationWritingRef.current)?"wait":"pointer", opacity:(!browserOnline || normalLessonEvaluationIssueChecking || normalLessonEvaluationWritingRef.current)?0.65:1 }}>{normalLessonEvaluationIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleNormalLessonEvaluationIssue.state === "not_applied" ? <button type="button" onClick={()=>clearNormalLessonEvaluationIssue(visibleNormalLessonEvaluationIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; ders değerlendirmesini kendiliğinden tekrar göndermez.</p>
          </div>
        ) : null}
        {visibleNormalLessonMakeupIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Telafi hakkı kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{normalLessonMakeupIssueMessage(visibleNormalLessonMakeupIssue)}</p>
            {visibleNormalLessonMakeupIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleNormalLessonMakeupIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkNormalLessonMakeupOperation(visibleNormalLessonMakeupIssue)} disabled={!browserOnline || normalLessonMakeupIssueChecking || normalLessonMakeupWritingRef.current} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || normalLessonMakeupIssueChecking || normalLessonMakeupWritingRef.current)?"wait":"pointer", opacity:(!browserOnline || normalLessonMakeupIssueChecking || normalLessonMakeupWritingRef.current)?0.65:1 }}>{normalLessonMakeupIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleNormalLessonMakeupIssue.state === "not_applied" ? <button type="button" onClick={()=>clearNormalLessonMakeupIssue(visibleNormalLessonMakeupIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; telafi hakkını kendiliğinden tekrar göndermez.</p>
          </div>
        ) : null}
        {visibleNormalLessonMakeupPlanIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Telafi planı kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{normalLessonMakeupPlanIssueMessage(visibleNormalLessonMakeupPlanIssue)}</p>
            {visibleNormalLessonMakeupPlanIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleNormalLessonMakeupPlanIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkNormalLessonMakeupPlanOperation(visibleNormalLessonMakeupPlanIssue)} disabled={!browserOnline || normalLessonMakeupPlanIssueChecking || normalLessonMakeupPlanWritingRef.current} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || normalLessonMakeupPlanIssueChecking || normalLessonMakeupPlanWritingRef.current)?"wait":"pointer", opacity:(!browserOnline || normalLessonMakeupPlanIssueChecking || normalLessonMakeupPlanWritingRef.current)?0.65:1 }}>{normalLessonMakeupPlanIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleNormalLessonMakeupPlanIssue.state === "not_applied" ? <button type="button" onClick={()=>clearNormalLessonMakeupPlanIssue(visibleNormalLessonMakeupPlanIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; telafi planını kendiliğinden tekrar göndermez.</p>
          </div>
        ) : null}
        {visibleNormalLessonMakeupCompletionIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Telafi tamamlama kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{normalLessonMakeupCompletionIssueMessage(visibleNormalLessonMakeupCompletionIssue)}</p>
            {visibleNormalLessonMakeupCompletionIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleNormalLessonMakeupCompletionIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkNormalLessonMakeupCompletionOperation(visibleNormalLessonMakeupCompletionIssue)} disabled={!browserOnline || normalLessonMakeupCompletionIssueChecking || normalLessonMakeupCompletionWritingRef.current} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || normalLessonMakeupCompletionIssueChecking || normalLessonMakeupCompletionWritingRef.current)?"wait":"pointer", opacity:(!browserOnline || normalLessonMakeupCompletionIssueChecking || normalLessonMakeupCompletionWritingRef.current)?0.65:1 }}>{normalLessonMakeupCompletionIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleNormalLessonMakeupCompletionIssue.state === "not_applied" ? <button type="button" onClick={()=>clearNormalLessonMakeupCompletionIssue(visibleNormalLessonMakeupCompletionIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; telafi sonucunu kendiliğinden tekrar göndermez.</p>
          </div>
        ) : null}
        {visibleBranchLifecycleIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Şube işlemi kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{branchLifecycleIssueMessage(visibleBranchLifecycleIssue)}</p>
            {visibleBranchLifecycleIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleBranchLifecycleIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkBranchLifecycleOperation(visibleBranchLifecycleIssue)} disabled={!browserOnline || branchLifecycleIssueChecking} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || branchLifecycleIssueChecking)?"wait":"pointer", opacity:(!browserOnline || branchLifecycleIssueChecking)?0.65:1 }}>{branchLifecycleIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleBranchLifecycleIssue.state === "not_applied" ? <button type="button" onClick={()=>clearBranchLifecycleIssue(visibleBranchLifecycleIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Kontrol yalnızca Supabase'den okur; şube işlemini kendiliğinden tekrarlamaz.</p>
          </div>
        ) : null}
        {visibleStaffInvitationIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Personel daveti kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{staffInvitationIssueMessage(visibleStaffInvitationIssue)}</p>
            {visibleStaffInvitationIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleStaffInvitationIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkStaffInvitationOperation(visibleStaffInvitationIssue)} disabled={!browserOnline || staffInvitationIssueChecking} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || staffInvitationIssueChecking)?"wait":"pointer", opacity:(!browserOnline || staffInvitationIssueChecking)?0.65:1 }}>{staffInvitationIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleStaffInvitationIssue.state === "prepared" && staffInvitations.some(invitation=>invitation.operation_id===visibleStaffInvitationIssue.operationId) ? <button type="button" onClick={()=>retryPreparedStaffInvitation(staffInvitations.find(invitation=>invitation.operation_id===visibleStaffInvitationIssue.operationId))} disabled={!browserOnline || staffInvitationBusy} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:(!browserOnline || staffInvitationBusy)?"wait":"pointer" }}>{staffInvitationBusy?"Tamamlanıyor...":"Daveti Açıkça Tamamla"}</button> : null}
              {visibleStaffInvitationIssue.state === "not_applied" ? <button type="button" onClick={()=>clearStaffInvitationIssue(visibleStaffInvitationIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; davet işlemini kendiliğinden tekrarlamaz.</p>
          </div>
        ) : null}
        {visibleStaffActivationIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Personel erişimi kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{staffActivationIssueMessage(visibleStaffActivationIssue)}</p>
            {visibleStaffActivationIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleStaffActivationIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkStaffActivationOperation(visibleStaffActivationIssue)} disabled={!browserOnline || staffActivationIssueChecking} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || staffActivationIssueChecking)?"wait":"pointer", opacity:(!browserOnline || staffActivationIssueChecking)?0.65:1 }}>{staffActivationIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleStaffActivationIssue.state === "not_applied" ? <button type="button" onClick={()=>clearStaffActivationIssue(visibleStaffActivationIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; yetki atamasını kendiliğinden tekrarlamaz.</p>
          </div>
        ) : null}
        {visibleStaffAssignmentIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Personel şube değişikliği kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{staffAssignmentIssueMessage(visibleStaffAssignmentIssue)}</p>
            {visibleStaffAssignmentIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleStaffAssignmentIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkStaffAssignmentOperation(visibleStaffAssignmentIssue)} disabled={!browserOnline || staffAssignmentIssueChecking} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || staffAssignmentIssueChecking)?"wait":"pointer", opacity:(!browserOnline || staffAssignmentIssueChecking)?0.65:1 }}>{staffAssignmentIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleStaffAssignmentIssue.state === "not_applied" ? <button type="button" onClick={()=>clearStaffAssignmentIssue(visibleStaffAssignmentIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; şube değişikliğini kendiliğinden tekrarlamaz.</p>
          </div>
        ) : null}
        {visibleStaffDeactivationIssue ? (
          <div role="alert" style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:13, fontWeight:850, color:"#9a3412" }}>Personel pasifleştirme kontrolü gerekli</p>
            <p style={{ margin:"0 0 4px", fontSize:12, color:"#9a3412", fontWeight:650, lineHeight:1.5 }}>{staffDeactivationIssueMessage(visibleStaffDeactivationIssue)}</p>
            {visibleStaffDeactivationIssue.label ? <p style={{ margin:"0 0 10px", fontSize:11, color:"#9a3412", fontWeight:800 }}>İşlem: {visibleStaffDeactivationIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={()=>checkStaffDeactivationOperation(visibleStaffDeactivationIssue)} disabled={!browserOnline || staffDeactivationIssueChecking} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#ea580c", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || staffDeactivationIssueChecking)?"wait":"pointer", opacity:(!browserOnline || staffDeactivationIssueChecking)?0.65:1 }}>{staffDeactivationIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button>
              {visibleStaffDeactivationIssue.state === "not_applied" ? <button type="button" onClick={()=>clearStaffDeactivationIssue(visibleStaffDeactivationIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#9a3412", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#9a3412", fontWeight:650 }}>Yeniden kontrol yalnızca Supabase'den okur; pasifleştirme işlemini kendiliğinden tekrarlamaz.</p>
          </div>
        ) : null}
        {!browserOnline || singleLessonIssue ? (
          <div role="alert" style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <p style={{ margin:"0 0 6px", fontSize:13, fontWeight:850, color:"#991b1b" }}>{!browserOnline ? "İnternet bağlantısı yok" : "Tek Ders kayıt güvenliği uyarısı"}</p>
            <p style={{ margin:"0 0 10px", fontSize:12, color:"#7f1d1d", fontWeight:650, lineHeight:1.5 }}>{!browserOnline ? "Bağlantı geri gelene kadar Tek Ders kayıtları yüklenemez veya güvenli biçimde değiştirilemez." : singleLessonIssueMessage(singleLessonIssue)}</p>
            {singleLessonIssue?.label ? <p style={{ margin:"-4px 0 10px", fontSize:11, color:"#991b1b", fontWeight:800 }}>İşlem: {singleLessonIssue.label}</p> : null}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button onClick={handleSingleLessonIssueCheck} disabled={!browserOnline || singleLessonIssueChecking} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#dc2626", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || singleLessonIssueChecking) ? "wait" : "pointer", opacity:(!browserOnline || singleLessonIssueChecking) ? 0.65 : 1 }}>{singleLessonIssueChecking ? "Kontrol Ediliyor..." : "Yeniden Kontrol Et"}</button>
              {singleLessonIssue?.kind === "operation" && singleLessonIssue.state === "not_applied" ? <button onClick={()=>clearSingleLessonIssue()} style={{ border:"1px solid #fca5a5", borderRadius:9, padding:"8px 11px", background:"#fff", color:"#991b1b", fontSize:12, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
            <p style={{ margin:"9px 0 0", fontSize:10, color:"#991b1b", fontWeight:650 }}>“Yeniden Kontrol Et” yalnızca Supabase'den okur; hiçbir yazma işlemini kendiliğinden tekrarlamaz.</p>
          </div>
        ) : null}
        {extraLessonPaymentIssue ? (
          <div role="alert" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:12, padding:"10px 12px", marginBottom:12 }}>
            <div style={{ minWidth:0, flex:"1 1 280px" }}>
              <p style={{ margin:0, fontSize:12, fontWeight:850, color:"#9a3412" }}>Ek Ders ödeme kontrolü gerekli · {extraLessonPaymentIssue.studentName}</p>
              <p style={{ margin:"3px 0 0", fontSize:11, color:"#9a3412", lineHeight:1.45 }}>{extraLessonPaymentIssueMessage(extraLessonPaymentIssue)}</p>
            </div>
            <div style={{ display:"flex", gap:7, flexShrink:0 }}>
              {extraLessonPaymentIssue.state !== "not_applied" ? <button onClick={handleExtraLessonPaymentIssueCheck} disabled={!browserOnline || extraLessonPaymentIssueChecking} style={{ border:"none", borderRadius:8, padding:"7px 10px", background:"#c2410c", color:"#fff", fontSize:11, fontWeight:850, cursor:(!browserOnline || extraLessonPaymentIssueChecking)?"wait":"pointer", opacity:(!browserOnline || extraLessonPaymentIssueChecking)?.65:1 }}>{extraLessonPaymentIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button> : null}
              {extraLessonPaymentIssue.state === "not_applied" ? <button onClick={()=>clearExtraLessonPaymentIssue(extraLessonPaymentIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:8, padding:"7px 10px", background:"#fff", color:"#9a3412", fontSize:11, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
          </div>
        ) : null}
        {packagePaymentIssue ? (
          <div role="alert" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:12, padding:"10px 12px", marginBottom:12 }}>
            <div style={{ minWidth:0, flex:"1 1 280px" }}>
              <p style={{ margin:0, fontSize:12, fontWeight:850, color:"#9a3412" }}>Paket ödeme kontrolü gerekli · {packagePaymentIssue.studentName}</p>
              <p style={{ margin:"3px 0 0", fontSize:11, color:"#9a3412", lineHeight:1.45 }}>{packagePaymentIssueMessage(packagePaymentIssue)}</p>
            </div>
            <div style={{ display:"flex", gap:7, flexShrink:0 }}>
              {packagePaymentIssue.state !== "not_applied" ? <button onClick={handlePackagePaymentIssueCheck} disabled={!browserOnline || packagePaymentIssueChecking} style={{ border:"none", borderRadius:8, padding:"7px 10px", background:"#c2410c", color:"#fff", fontSize:11, fontWeight:850, cursor:(!browserOnline || packagePaymentIssueChecking)?"wait":"pointer", opacity:(!browserOnline || packagePaymentIssueChecking)?.65:1 }}>{packagePaymentIssueChecking?"Kontrol Ediliyor...":"Yeniden Kontrol Et"}</button> : null}
              {packagePaymentIssue.state === "not_applied" ? <button onClick={()=>clearPackagePaymentIssue(packagePaymentIssue.operationId)} style={{ border:"1px solid #fdba74", borderRadius:8, padding:"7px 10px", background:"#fff", color:"#9a3412", fontSize:11, fontWeight:850, cursor:"pointer" }}>Uyarıyı Gördüm</button> : null}
            </div>
          </div>
        ) : null}
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
        {mainTab === "personel" && canManageStaff ? (
          <div>
            <div style={{ ...SECTION, background:"#faf8ff", borderColor:"#ddd6fe" }}>
              <p style={{ margin:0, fontSize:13, fontWeight:850, color:"#4c1d95" }}>{activeOrganization.name}</p>
              <p style={{ margin:"6px 0 0", fontSize:12, color:"#6d5b82", lineHeight:1.55 }}>Yeni yönetici veya öğretmen önce e-posta davetiyle pasif oluşturulur. Kurum verilerine ancak sizin seçtiğiniz aktif şubeler tek işlemde atandıktan sonra erişebilir.</p>
              <p style={{ margin:"7px 0 0", fontSize:10, color:"#7c6b8e", fontWeight:700 }}>Aktif personelin güncel şubeleri değiştirilebilir veya erişimi geçmiş kayıtlar silinmeden pasife alınabilir. Rol değiştirme ve yeniden etkinleştirme ayrı işlemlerdir.</p>
              <p style={{ margin:"5px 0 0", fontSize:10, color:"#7c6b8e" }}>Mevcut kurum sahibi hesabınız güvenli ilk kurulumla tanımlandığı için yeni davetler listesinde yer almaz.</p>
            </div>
            {staffManagementError ? (
              <div role="alert" style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
                <p style={{ margin:"0 0 8px", fontSize:12, color:"#991b1b", fontWeight:750, lineHeight:1.5 }}>{staffManagementError}</p>
                <button type="button" onClick={()=>loadStaffManagement(activeOrganization.id)} disabled={!browserOnline || staffManagementLoading} style={{ border:"none", borderRadius:9, padding:"8px 11px", background:"#dc2626", color:"#fff", fontSize:12, fontWeight:850, cursor:(!browserOnline || staffManagementLoading)?"wait":"pointer" }}>{staffManagementLoading?"Yükleniyor...":"Yeniden Yükle"}</button>
              </div>
            ) : null}
            {staffManagementLoading ? <div style={{ ...CARD, padding:30, textAlign:"center", color:"#8b8490", fontSize:13, fontWeight:750 }}>Personel davetleri ve erişimleri doğrulanıyor...</div> : null}
            {!staffManagementLoading && !staffManagementError ? (
              <div style={{ display:"grid", gap:10 }}>
                {staffInvitations.map(invitation=>{
                  const activation = staffActivationByInvitation.get(invitation.id);
                  const accessFacts = staffAccessFacts(staffProfiles,staffOrganizationMemberships,staffBranchMemberships,staffDeactivations,invitation.target_user_id,invitation.requested_app_role);
                  const accessActive = !!activation && accessFacts.active;
                  const accessDeactivated = !!activation && accessFacts.deactivated;
                  const accessInconsistent = !!activation && !accessActive && !accessDeactivated;
                  const selectedBranchIds = canonicalStaffBranchIds(staffBranchSelections[invitation.id]);
                  const currentBranchIds = accessFacts.branchIds;
                  const activatedBranchNames = currentBranchIds.map(branchId=>organizationBranches.find(branch=>branch.id===branchId)?.name || "Bilinmeyen şube");
                  const activationBusy = staffActivationBusyId === invitation.id;
                  const assignmentBusy = staffAssignmentBusyId === invitation.id;
                  const deactivationBusy = staffDeactivationBusyId === invitation.id;
                  const assignmentEditing = staffAssignmentEditingId === invitation.id;
                  const assignmentBranchIds = canonicalStaffBranchIds(staffAssignmentSelections[invitation.target_user_id]);
                  return <div key={invitation.id} style={{ ...CARD, padding:"15px 16px", borderLeft:`5px solid ${accessActive?"#10b981":accessDeactivated?"#94a3b8":accessInconsistent?"#dc2626":invitation.status==="sent"?"#7c3aed":"#f59e0b"}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                          <strong style={{ fontSize:15 }}>{invitation.display_name}</strong>
                          <TonePill tone={invitation.requested_app_role==="admin"?"special":"info"}>{staffRoleLabel(invitation.requested_app_role)}</TonePill>
                          <TonePill tone={accessActive?"good":accessDeactivated?"neutral":accessInconsistent?"danger":invitation.status==="sent"?"warn":"danger"}>{accessActive?"Erişim aktif":accessDeactivated?"Erişim pasif":accessInconsistent?"Erişim doğrulanamadı":invitation.status==="sent"?"Şube bekliyor":"Davet tamamlanmadı"}</TonePill>
                        </div>
                        <p style={{ margin:"7px 0 0", color:"#57505f", fontSize:12, fontWeight:700, overflowWrap:"anywhere" }}>{invitation.normalized_email}</p>
                        <p style={{ margin:"4px 0 0", color:"#8b8490", fontSize:10 }}>{invitation.sent_at ? "Davet: "+fmtDate(invitation.sent_at) : "Davet hazırlığı: "+fmtDate(invitation.prepared_at)}</p>
                        {accessActive ? <p style={{ margin:"7px 0 0", color:"#047857", fontSize:11, fontWeight:800 }}>Şubeler: {activatedBranchNames.join(", ") || "-"}</p> : null}
                        {accessDeactivated ? <p style={{ margin:"7px 0 0", color:"#64748b", fontSize:11, fontWeight:800 }}>Hesap ve geçmiş kayıtlar korunuyor; kurum ve şube erişimi kapalı.</p> : null}
                        {accessInconsistent ? <p style={{ margin:"7px 0 0", color:"#b91c1c", fontSize:11, fontWeight:800 }}>Profil ve üyelik kaynakları birbiriyle uyuşmuyor. Liste yeniden doğrulanmadan işlem yapılmayacak.</p> : null}
                      </div>
                      <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                        {accessActive ? <button type="button" disabled={assignmentBusy || deactivationBusy || !!visibleStaffAssignmentIssue || !!visibleStaffDeactivationIssue || !browserOnline || !currentBranchIds.length} onClick={()=>assignmentEditing?setStaffAssignmentEditingId(""):openStaffAssignmentEditor(invitation)} style={{ border:"1px solid #c4b5fd", background:"#f5f3ff", color:"#5b21b6", borderRadius:10, padding:"8px 11px", fontSize:11, fontWeight:850, cursor:(assignmentBusy || deactivationBusy || visibleStaffAssignmentIssue || visibleStaffDeactivationIssue || !browserOnline || !currentBranchIds.length)?"not-allowed":"pointer", opacity:(assignmentBusy || deactivationBusy || visibleStaffAssignmentIssue || visibleStaffDeactivationIssue || !browserOnline || !currentBranchIds.length)?0.58:1 }}>{assignmentEditing?"Düzenlemeyi Kapat":"Şubeleri Düzenle"}</button> : null}
                        {accessActive ? <button type="button" disabled={deactivationBusy || assignmentBusy || !!visibleStaffDeactivationIssue || !!visibleStaffAssignmentIssue || !browserOnline} onClick={()=>handleStaffDeactivation(invitation)} style={{ border:"1px solid #fecaca", background:"#fff1f2", color:"#be123c", borderRadius:10, padding:"8px 11px", fontSize:11, fontWeight:850, cursor:(deactivationBusy || assignmentBusy || visibleStaffDeactivationIssue || visibleStaffAssignmentIssue || !browserOnline)?"not-allowed":"pointer", opacity:(deactivationBusy || assignmentBusy || visibleStaffDeactivationIssue || visibleStaffAssignmentIssue || !browserOnline)?0.58:1 }}>{deactivationBusy?"Pasife Alınıyor...":"Erişimi Pasife Al"}</button> : null}
                        {invitation.status === "prepared" ? <button type="button" disabled={staffInvitationBusy || !!visibleStaffInvitationIssue && visibleStaffInvitationIssue.operationId!==invitation.operation_id || !browserOnline} onClick={()=>retryPreparedStaffInvitation(invitation)} style={{ border:"1px solid #fdba74", background:"#fff7ed", color:"#9a3412", borderRadius:10, padding:"8px 11px", fontSize:11, fontWeight:850, cursor:staffInvitationBusy?"wait":"pointer" }}>{staffInvitationBusy?"Tamamlanıyor...":"Daveti Tamamla"}</button> : null}
                      </div>
                    </div>
                    {accessActive && assignmentEditing ? (
                      <div style={{ marginTop:14, paddingTop:13, borderTop:"1px solid #eee9f4" }}>
                        <p style={{ margin:"0 0 4px", fontSize:11, color:"#5d5663", fontWeight:850 }}>Güncel erişimde kalacak aktif şubeleri seçin</p>
                        <p style={{ margin:"0 0 9px", fontSize:10, color:"#8b8490", lineHeight:1.45 }}>Bu işlem yalnız şube kümesini değiştirir; {staffRoleLabel(invitation.requested_app_role).toLocaleLowerCase("tr-TR")} rolü aynı kalır.</p>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:7 }}>
                          {activeStaffBranches.map(branch=>{
                            const checked = assignmentBranchIds.includes(branch.id);
                            return <label key={branch.id} style={{ display:"flex", alignItems:"center", gap:8, border:checked?"1.5px solid #7c3aed":"1px solid #ddd6e8", borderRadius:10, padding:"9px 10px", background:checked?"#f5f3ff":"#fff", color:checked?"#5b21b6":"#554e59", fontSize:11, fontWeight:800, cursor:assignmentBusy?"wait":"pointer" }}>
                              <input type="checkbox" checked={checked} disabled={assignmentBusy || !!visibleStaffAssignmentIssue || !browserOnline} onChange={event=>setStaffAssignmentSelections(previous=>{
                                const current = canonicalStaffBranchIds(previous[invitation.target_user_id]);
                                const next = event.target.checked ? canonicalStaffBranchIds([...current,branch.id]) : current.filter(branchId=>branchId!==branch.id);
                                return { ...previous, [invitation.target_user_id]:next };
                              })} />
                              <span>{branch.name}</span>
                            </label>;
                          })}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:11 }}>
                          <button type="button" disabled={assignmentBusy} onClick={()=>setStaffAssignmentEditingId("")} style={{ border:"1px solid #d6d3d1", borderRadius:10, padding:"10px 12px", background:"#fff", color:"#57534e", fontSize:12, fontWeight:850, cursor:assignmentBusy?"wait":"pointer" }}>Vazgeç</button>
                          <button type="button" disabled={!assignmentBranchIds.length || assignmentBusy || !!visibleStaffAssignmentIssue || !browserOnline} onClick={()=>handleStaffAssignment(invitation)} style={{ border:"none", borderRadius:10, padding:"10px 12px", background:"#5b42d6", color:"#fff", fontSize:12, fontWeight:850, cursor:(!assignmentBranchIds.length || assignmentBusy || visibleStaffAssignmentIssue || !browserOnline)?"not-allowed":"pointer", opacity:(!assignmentBranchIds.length || assignmentBusy || visibleStaffAssignmentIssue || !browserOnline)?0.58:1 }}>{assignmentBusy?"Şubeler Güncelleniyor...":"Şube Erişimini Güncelle"}</button>
                        </div>
                      </div>
                    ) : null}
                    {!activation && invitation.status === "sent" ? (
                      <div style={{ marginTop:14, paddingTop:13, borderTop:"1px solid #eee9f4" }}>
                        <p style={{ margin:"0 0 9px", fontSize:11, color:"#5d5663", fontWeight:850 }}>İlk erişim verilecek aktif şubeleri seçin</p>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:7 }}>
                          {activeStaffBranches.map(branch=>{
                            const checked = selectedBranchIds.includes(branch.id);
                            return <label key={branch.id} style={{ display:"flex", alignItems:"center", gap:8, border:checked?"1.5px solid #7c3aed":"1px solid #ddd6e8", borderRadius:10, padding:"9px 10px", background:checked?"#f5f3ff":"#fff", color:checked?"#5b21b6":"#554e59", fontSize:11, fontWeight:800, cursor:activationBusy?"wait":"pointer" }}>
                              <input type="checkbox" checked={checked} disabled={activationBusy || !!visibleStaffActivationIssue || !browserOnline} onChange={event=>setStaffBranchSelections(previous=>{
                                const current = canonicalStaffBranchIds(previous[invitation.id]);
                                const next = event.target.checked ? canonicalStaffBranchIds([...current,branch.id]) : current.filter(branchId=>branchId!==branch.id);
                                return { ...previous, [invitation.id]:next };
                              })} />
                              <span>{branch.name}</span>
                            </label>;
                          })}
                        </div>
                        {activeStaffBranches.length===0 ? <p style={{ margin:"7px 0 0", color:"#b91c1c", fontSize:11, fontWeight:750 }}>Atanabilecek aktif şube yok.</p> : null}
                        <button type="button" disabled={!selectedBranchIds.length || activationBusy || !!visibleStaffActivationIssue || !!visibleStaffDeactivationIssue || !browserOnline} onClick={()=>handleStaffActivation(invitation)} style={{ width:"100%", marginTop:11, border:"none", borderRadius:10, padding:"10px 12px", background:"#5b42d6", color:"#fff", fontSize:12, fontWeight:850, cursor:(!selectedBranchIds.length || activationBusy || visibleStaffActivationIssue || visibleStaffDeactivationIssue || !browserOnline)?"not-allowed":"pointer", opacity:(!selectedBranchIds.length || activationBusy || visibleStaffActivationIssue || visibleStaffDeactivationIssue || !browserOnline)?0.58:1 }}>{activationBusy?"Erişim Etkinleştiriliyor...":"Seçili Şubelerde Erişimi Etkinleştir"}</button>
                      </div>
                    ) : null}
                  </div>;
                })}
                {staffInvitations.length===0 ? <div style={{ ...CARD, padding:28, textAlign:"center", color:"#8b8490", fontSize:13 }}><p style={{ margin:"0 0 5px", fontSize:27 }}>◉</p><p style={{ margin:0, fontWeight:750 }}>Henüz personel daveti yok.</p></div> : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {mainTab === "subeler" && canManageBranches ? (
          <div>
            <div style={{ ...SECTION, background:"#faf8ff", borderColor:"#ddd6fe" }}>
              <p style={{ margin:0, fontSize:13, fontWeight:850, color:"#4c1d95" }}>{activeOrganization.name}</p>
              <p style={{ margin:"6px 0 0", fontSize:12, color:"#6d5b82", lineHeight:1.55 }}>Yeni şube boş oluşturulur; Bodrum öğrencileri, ödemeleri, takvimi veya Finans kayıtları kopyalanmaz. Şubeler fiziksel olarak silinmez.</p>
            </div>
            <div style={{ display:"grid", gap:10 }}>
              {organizationBranches.map(branch=>{
                const active = branch.active !== false;
                const selected = branch.id === currentBranch?.id;
                const busy = branchLifecycleBusyId === branch.id;
                const lastActive = active && organizationBranches.filter(item=>item.active !== false).length <= 1;
                return <div key={branch.id} style={{ ...CARD, padding:"15px 16px", borderLeft:`5px solid ${active?"#10b981":"#94a3b8"}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14, flexWrap:"wrap" }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                        <strong style={{ fontSize:15 }}>{branch.name || "Şube"}</strong>
                        <TonePill tone={active?"good":"neutral"}>{active?"Aktif":"Pasif"}</TonePill>
                        {selected ? <TonePill tone="special">Açık şube</TonePill> : null}
                      </div>
                      <p style={{ margin:"7px 0 0", color:"#7b7480", fontSize:11 }}>Kısa kod: <strong>{branch.code || "-"}</strong></p>
                      {lastActive ? <p style={{ margin:"6px 0 0", color:"#6d5b82", fontSize:10, fontWeight:700 }}>Kurumun son aktif şubesi pasife alınamaz.</p> : null}
                    </div>
                    <button type="button" disabled={lastActive || busy || !!visibleBranchLifecycleIssue || !browserOnline} onClick={()=>handleBranchActiveChange(branch)} style={{ border:active?"1px solid #fca5a5":"1px solid #86efac", background:"#fff", color:active?"#b91c1c":"#047857", borderRadius:10, padding:"8px 11px", fontSize:11, fontWeight:850, cursor:(lastActive || busy || visibleBranchLifecycleIssue || !browserOnline)?"not-allowed":"pointer", opacity:(lastActive || busy || visibleBranchLifecycleIssue || !browserOnline)?0.6:1 }}>{busy?"Kaydediliyor...":active?"Pasife Al":"Aktif Et"}</button>
                  </div>
                </div>;
              })}
              {organizationBranches.length===0 ? <div style={{ ...CARD, padding:24, textAlign:"center", color:"#8b8490", fontSize:13 }}>Bu kurumda şube bulunamadı.</div> : null}
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
            <BugünEkDersleri students={operationalStudents} onWA={handleWAExtraLesson} onReminderToggle={handleExtraLessonReminderToggle} onOpen={(student) => { setDetailInitialTab("ekders"); setDetailSt(student); }} />
            <BugünTekDersleri lessons={singleLessons} onWA={handleWASingleLesson} onReminderToggle={handleSingleLessonReminderToggle} onOpen={lesson=>setSingleLessonSheet({mode:"edit",lesson})} />
            <SonuçBekleyenTekDersler lessons={pendingSingleResults} busyIds={singleLessonBusyIds} onStatus={handleSingleLessonStatus} onOpen={lesson=>setSingleLessonSheet({mode:"edit",lesson})} onManage={()=>setMainTab("tekders")} />
            <GecikenTekDersÖdemeleri lessons={overdueSinglePayments} now={singleLessonResultClock} busyIds={singleLessonBusyIds} onPayment={handleSingleLessonPayment} onOpen={lesson=>setSingleLessonSheet({mode:"edit",lesson})} />
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
            <BugünÖdemeleri students={operationalStudents} onÖdemeAl={handleÖdemeKaydet} paymentSavingId={paymentSavingId} onMesaj={(s)=>setMesajSt(s)} onStudentClick={setDetailSt} />
            {overdueSinglePayments.length===0 && pendingSingleResults.length===0 && pendingMonthlyReports.length===0 && operationalStudents.filter(s=>{ if (s.frozen) return false; const l=s.schedule.find(x=>x.status==="upcoming"); return l&&isToday(l.date); }).length===0 && todayExtraLessons(operationalStudents).length===0 && !singleLessons.some(lesson=>!lesson.deleted_at && lesson.lesson_status==="planned" && isToday(lesson.starts_at)) && !operationalStudents.some(s=>isÖdemeBekleyen(s)) && !operationalStudents.some(s=>!isStudentLeft(s)&&(s.telafi_records||[]).some(isCurrentTelafi)) ? (
              <div style={{ textAlign:"center", padding:"48px 20px" }}>
                <p style={{ fontSize:36 }}>☀️</p>
                <p style={{ fontWeight:600, color:"#aaa" }}>Bugün için bir şey yok</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {mainTab === "takvim" ? <WeekCal students={operationalStudents} singleLessons={singleLessons} offset={weekOffset} setOffset={setWeekOffset} onStudentClick={setDetailSt} onSingleLessonClick={lesson=>setSingleLessonSheet({mode:"edit",lesson})} onExtraLessonClick={(student) => { setDetailInitialTab("ekders"); setDetailSt(student); }} calendarMoveReadScope={{ actorUserId:authSession?.user?.id, branchId:currentBranch?.id, generation:protectedDataLoadGenerationRef.current }} availabilityOpen={showCalendarAvailability} onAvailabilityClose={()=>setShowCalendarAvailability(false)} /> : null}
        {mainTab === "ogretmenler" ? <ÖğretmenlerPaneli students={students} teachers={teachers} singleLessons={singleLessons} onStudentClick={setDetailSt} onSingleLessonClick={lesson=>setSingleLessonSheet({mode:"edit",lesson})} onExtraLessonClick={(student) => { setDetailInitialTab("ekders"); setDetailSt(student); }} calendarMoveReadScope={{ actorUserId:authSession?.user?.id, branchId:currentBranch?.id, generation:protectedDataLoadGenerationRef.current }} /> : null}
        {mainTab === "iletisim" ? <İletişimPaneli students={students} onStudentClick={setDetailSt} onMessage={handleCommunicationMessage} onStatusChange={handleCommunicationStatus} /> : null}
        {mainTab === "tekders" ? <SingleLessonsPanel lessons={singleLessons} loading={singleLessonsLoading} onAdd={()=>setSingleLessonSheet({mode:"add"})} onEdit={lesson=>setSingleLessonSheet({mode:"edit",lesson})} onStatus={handleSingleLessonStatus} onPayment={handleSingleLessonPayment} onDelete={handleSingleLessonDelete} busyIds={singleLessonBusyIds} /> : null}
        {mainTab === "gelir" ? <FinansRaporu students={students} expenses={expenses} singleLessons={singleLessons} onExpenseAdd={handleExpenseAdd} onExpenseRemove={handleExpenseRemove} /> : null}
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
                const ac = activeTelafiRecords(s.telafi_records).length;
                const quota = telafiQuotaInfo(s);
                const warn = quota.count===5 && !s.frozen;
                const quotaFull = quota.count !== null && quota.count>=6;
                const payDue = isÖdemeBekleyen(s);
                const age = studentAge(s);
                const ekCount = (s.ek_dersler||[]).length;
                const unpaidEkCount = unpaidEkDersler(s).length;
                const stripe = left ? "#be123c" : s.frozen ? "#3b82f6" : quotaFull ? "#dc2626" : warn ? "#f59e0b" : payDue ? "#fb923c" : "#10b981";
                return (
                  <div key={s.id} style={{ ...CARD, position:"relative", overflow:"hidden", background:left?"#fff7f7":s.frozen?"#f8fbff":"#fff", padding:"14px 16px 14px 20px", border:left?"1.5px solid #fecdd3":quotaFull?"1.5px solid #fca5a5":warn?"1.5px solid #fcd34d":payDue?"1.5px solid #fb923c":s.frozen?"1.5px solid #bfdbfe":"1px solid #e8eaee" }}>
                    <div style={{ position:"absolute", left:0, top:0, bottom:0, width:5, background:stripe }} />
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setDetailSt(s)}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <p style={{ fontWeight:700, fontSize:15, margin:0, color:"#111" }}>{s.name}</p>
                          {left ? <TonePill tone="danger">Ayrılan</TonePill> : s.frozen ? <TonePill tone="info">Donuk</TonePill> : null}
                          {warn ? <TonePill tone="warn">5/6 Telafi</TonePill> : null}
                          {quotaFull ? <TonePill tone="danger">6/6 Normal Telafi{quota.exceptionCount>0?" · "+quota.exceptionCount+" Yönetici İnisiyatifi":""}{quota.legacyOverflowCount>0?" · "+quota.legacyOverflowCount+" Geçmiş Ek":""}</TonePill> : null}
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
                        {payDue ? <button onClick={()=>{ setÖdemeKaydetDate(turkeyDateKey()); setÖdemeKaydetModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:800, cursor:"pointer", flexShrink:0 }}>💳</button> : null}
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

      <button className="crm-desktop-logout" disabled={authBusy} onClick={()=>setShowSecurityMenu(true)}>↪ Güvenli çıkış</button>

      <nav className="crm-mobile-nav" style={{ "--crm-mobile-nav-columns":mobileNav.length + 1 }}>
        {mobileNav.map(t=>(
          <button key={t.key} className={mainTab===t.key?"active":""} onClick={()=>setMainTab(t.key)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
        <button data-crm-security disabled={authBusy} onClick={()=>setShowSecurityMenu(true)}>
          <span>↪</span>Çıkış
        </button>
      </nav>

      {showSecurityMenu ? (
        <div data-crm-security>
        <Sheet title="Hesap ve cihaz güvenliği" subtitle="Nasıl çıkış yapmak istediğinizi seçin" onClose={()=>{ if(!authBusy) setShowSecurityMenu(false); }}>
          <p style={{fontSize:13,color:"#666",lineHeight:1.6,margin:"0 0 16px"}}>Normal çıkışta bu tarayıcı 30 gün boyunca güvenilen cihaz olarak kalır. Bir sonraki girişte parolanız sorulur, doğrulama kodu sorulmaz.</p>
          <Btn bg="#5b42d6" onClick={()=>handleSecureLogout(false)}>Yalnızca Güvenli Çıkış</Btn>
          <Btn bg="#dc5d51" outline onClick={()=>handleSecureLogout(true)}>Çıkış Yap ve Bu Cihazı Unut</Btn>
        </Sheet>
        </div>
      ) : null}

      {showStaffInvite ? (
        <Sheet title="Personel Davet Et" subtitle={activeOrganization?.name || "Kurum"} onClose={()=>{ if(!staffInvitationBusy) setShowStaffInvite(false); }}>
          <p style={{ margin:"0 0 14px", padding:"10px 11px", borderRadius:10, background:"#faf5ff", color:"#5b21b6", fontSize:11, fontWeight:700, lineHeight:1.55 }}>Davet edilen hesap önce pasif oluşturulur. Davet tamamlandıktan sonra Personel ekranında en az bir aktif şubeyi siz seçmedikçe hiçbir CRM iş verisine erişemez.</p>
          <label style={{ display:"block", margin:"0 0 6px", color:"#756f7a", fontSize:11, fontWeight:800 }}>Ad soyad</label>
          <input style={INP} value={staffInviteName} disabled={staffInvitationBusy} onChange={event=>setStaffInviteName(event.target.value)} placeholder="Örn. Ayşe Yılmaz" maxLength={120} autoComplete="name" />
          <label style={{ display:"block", margin:"13px 0 6px", color:"#756f7a", fontSize:11, fontWeight:800 }}>E-posta</label>
          <input style={INP} type="email" value={staffInviteEmail} disabled={staffInvitationBusy} onChange={event=>setStaffInviteEmail(event.target.value)} placeholder="ayse@example.com" maxLength={320} autoComplete="email" />
          <label style={{ display:"block", margin:"13px 0 6px", color:"#756f7a", fontSize:11, fontWeight:800 }}>Rol</label>
          <select style={INP} value={staffInviteRole} disabled={staffInvitationBusy} onChange={event=>setStaffInviteRole(event.target.value)}>
            <option value="teacher">Öğretmen</option>
            <option value="admin">Şube yöneticisi</option>
          </select>
          <p style={{ margin:"7px 0 15px", color:"#8a8390", fontSize:10, lineHeight:1.5 }}>Şube yöneticisi yalnız sonradan atayacağınız şubeleri yönetir. Kurum sahibi yetkisi verilmez.</p>
          <Btn bg="#5b42d6" disabled={staffInvitationBusy || !!visibleStaffInvitationIssue || !!visibleStaffDeactivationIssue || !browserOnline} onClick={handleStaffInvite}>{staffInvitationBusy?"Davet Gönderiliyor...":"Güvenli Daveti Gönder"}</Btn>
          <Btn bg="#6b7280" outline disabled={staffInvitationBusy} onClick={()=>setShowStaffInvite(false)}>İptal</Btn>
        </Sheet>
      ) : null}

      {showBranchCreate ? (
        <Sheet title="Yeni Şube" subtitle={activeOrganization?.name || "Kurum"} onClose={()=>{ if(!branchLifecycleBusyId) setShowBranchCreate(false); }}>
          <label style={{ display:"block", margin:"0 0 6px", color:"#756f7a", fontSize:11, fontWeight:800 }}>Şube adı</label>
          <input style={INP} value={branchCreateName} disabled={branchLifecycleBusyId==="create"} onChange={event=>{
            const value = event.target.value;
            setBranchCreateName(value);
            if (!branchCreateCodeEdited) setBranchCreateCode(branchLocalCodeFromName(value));
          }} placeholder="Örn. Çeşme Sonsuz Sanat" maxLength={200} />
          <label style={{ display:"block", margin:"13px 0 6px", color:"#756f7a", fontSize:11, fontWeight:800 }}>Kalıcı kısa kod</label>
          <input style={INP} value={branchCreateCode} disabled={branchLifecycleBusyId==="create"} onChange={event=>{
            setBranchCreateCodeEdited(true);
            setBranchCreateCode(branchLocalCodeFromName(event.target.value));
          }} placeholder="cesme" maxLength={60} />
          <p style={{ margin:"7px 0 15px", color:"#8a8390", fontSize:10, lineHeight:1.5 }}>Kısa kod küçük harf, rakam ve tire içerebilir; oluşturulduktan sonra değiştirilemez. Şube aktif ve tamamen boş başlayacaktır.</p>
          <Btn bg="#5b42d6" disabled={branchLifecycleBusyId==="create" || !!visibleBranchLifecycleIssue || !browserOnline} onClick={handleBranchCreate}>{branchLifecycleBusyId==="create"?"Oluşturuluyor...":"Şubeyi Oluştur"}</Btn>
          <Btn bg="#6b7280" outline disabled={branchLifecycleBusyId==="create"} onClick={()=>setShowBranchCreate(false)}>İptal</Btn>
        </Sheet>
      ) : null}

      {showBranchMenu ? (
        <div data-single-lesson-move-control>
        <Sheet title="Şube değiştir" subtitle={activeOrganization?.name || "Yetkili şubeler"} onClose={()=>setShowBranchMenu(false)}>
          <p style={{fontSize:12,color:"#6b6470",lineHeight:1.55,margin:"0 0 13px"}}>Yalnız hesabınıza atanmış aktif şubeler gösterilir. Yeni şube tamamen yüklenmeden eski şubenin verileri ekranda tutulmaz.</p>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {selectableBranchOptions.map(option=>{
              const selected = option.branchId===currentBranch?.id;
              return <button key={option.organizationId+"|"+option.branchId} type="button" disabled={selected} onClick={()=>selectBranchContext(option)} style={{border:selected?"1.5px solid #7c3aed":"1px solid #ddd6fe",borderRadius:12,padding:"12px 13px",background:selected?"#f3e8ff":"#fff",color:selected?"#5b21b6":"#332b3a",textAlign:"left",cursor:selected?"default":"pointer",fontFamily:"inherit"}}>
                <strong style={{display:"block",fontSize:13}}>{selected?"✓ ":""}{option.branchName}</strong>
                <span style={{display:"block",marginTop:3,fontSize:10,color:"#83788b"}}>{option.organizationName}</span>
              </button>;
            })}
          </div>
        </Sheet>
        </div>
      ) : null}

      {actionModal ? <ActionSheet student={students.find(s=>s.id===actionModal.student.id)} lessonId={actionModal.lessonId} saving={normalLessonEvaluationBusyId===actionModal.lessonId || normalLessonMakeupBusyId===actionModal.lessonId} onClose={()=>{ if (!normalLessonEvaluationWritingRef.current && !normalLessonMakeupWritingRef.current) setActionModal(null); }} onBack={actionModal.returnTo ? ()=>{ if (normalLessonEvaluationWritingRef.current || normalLessonMakeupWritingRef.current) return; const student=students.find(s=>s.id===actionModal.returnTo.studentId); setActionModal(null); setDetailInitialTab(actionModal.returnTo.tab || "takvim"); if(student) setDetailSt(student); } : null} onAction={(a,n,l,options)=>handleAction(actionModal.student.id,a,n,l,options)} onEvaluationMessage={(record)=>{ const student=students.find(s=>s.id===actionModal.student.id); setActionModal(null); setLessonEvaluationPrompt({ student, record, type:"normal" }); }} /> : null}
      {telafiMessagePrompt ? <TelafiHakkiMesajSheet student={telafiMessagePrompt.student} record={telafiMessagePrompt.record} onClose={()=>setTelafiMessagePrompt(null)} onSent={async(result)=>{ setTelafiMessagePrompt(null); pop(result === "copied" ? "Telafi hakkı mesajı kopyalandı" : "Telafi hakkı mesajı WhatsApp'ta hazırlandı"); }} /> : null}
      {detailSt ? <DetailSheet student={students.find(s=>s.id===detailSt.id)} teachers={teachers} singleLessons={singleLessons} singleLessonsLoading={singleLessonsLoading} initialTab={detailInitialTab} onClose={()=>{ setDetailSt(null); setDetailInitialTab("takvim"); }} onRecharge={handleRecharge} onUndoLastPackage={handleUndoLastPackage} onLessonClick={(st,lid,tab)=>{ const returnTab=tab || "takvim"; setDetailSt(null); setDetailInitialTab(returnTab); setTimeout(()=>setActionModal({student:st,lessonId:lid,returnTo:{studentId:st.id,tab:returnTab}}),100); }} onShift={handleShift} onMoveOne={handleMoveOneLesson} onTelafiDone={handleTelafiDone} onTelafiPlanMessage={(student,record)=>setTelafiPlanMessagePrompt({student,record})} onTelafiEvaluationMessage={(student,record)=>{ setDetailSt(null); setLessonEvaluationPrompt({student,record,type:"telafi"}); }} onPieceAdd={handlePieceAdd} onMesaj={(st)=>setMesajSt(st)} onÖdemeAl={handleÖdemeKaydet} paymentSavingId={paymentSavingId} onZamYap={handleZamYap} onDelete={handleDelete} onStudentLeft={handleStudentLeft} onEkDersEkle={handleEkDersEkle} onEkDersOdeme={handleEkDersOdeme} onEkDersSil={handleEkDersSil} onEkDersDurum={handleEkDersDurum} onSingleLessonOpen={lesson=>{ setDetailSt(null); setDetailInitialTab("takvim"); setSingleLessonSheet({mode:"edit",lesson}); }} onDuzenle={handleDuzenle} onToggleFreeze={handleToggleFreeze} onPaymentEdit={handleÖdemeDuzenle} onPaymentDelete={handleÖdemeSil} /> : null}
      {lessonEvaluationPrompt ? <WhatsAppPreviewSheet title={lessonEvaluationPrompt.type === "telafi" ? "Telafi Dersi Değerlendirmesi" : "Ders Değerlendirmesi"} subtitle={lessonEvaluationPrompt.student} text={msgDersDegerlendirmesi(lessonEvaluationPrompt.student, lessonEvaluationPrompt.record, lessonEvaluationPrompt.type)} onClose={()=>setLessonEvaluationPrompt(null)} onSent={async(result)=>{ setLessonEvaluationPrompt(null); pop(result === "copied" ? "Ders değerlendirmesi kopyalandı" : "Ders değerlendirmesi WhatsApp'ta hazırlandı"); }} /> : null}
      {telafiPlanMessagePrompt ? <TelafiPlanMesajSheet student={telafiPlanMessagePrompt.student} record={telafiPlanMessagePrompt.record} onClose={()=>setTelafiPlanMessagePrompt(null)} onSent={async(result)=>{ setTelafiPlanMessagePrompt(null); pop(result === "copied" ? "Telafi planı mesajı kopyalandı" : "Telafi planı mesajı WhatsApp'ta hazırlandı"); }} /> : null}
      {showAdd ? <AddSheet teachers={teachers} onClose={()=>setShowAdd(false)} onAdd={handleAdd} /> : null}
      {singleLessonSheet ? <SingleLessonSheet lesson={singleLessonSheet.lesson || null} students={students} teachers={teachers} saving={singleLessonSaving} onClose={()=>{ if(singleLessonSheet.mode==="add") pendingSingleLessonCreateRef.current=null; setSingleLessonSheet(null); }} onSave={handleSingleLessonSave} /> : null}
      {welcomeStudentId && students.find(student=>student.id===welcomeStudentId) ? <YeniÖğrenciİletişimSheet student={students.find(student=>student.id===welcomeStudentId)} onClose={()=>setWelcomeStudentId(null)} onMessage={handleCommunicationMessage} onStatusChange={handleCommunicationStatus} /> : null}
      {mesajSt ? <MesajSheet student={mesajSt} initialKey={mesajInitialKey} onClose={()=>{ setMesajSt(null); setMesajInitialKey(""); }} /> : null}
      {periodEvaluationModal ? <DonemDegerlendirmeSheet student={students.find(student=>student.id===periodEvaluationModal.student.id) || periodEvaluationModal.student} info={periodEvaluationModal.info} onClose={()=>setPeriodEvaluationModal(null)} onSave={evaluation=>handleDonemDegerlendirmeKaydet(periodEvaluationModal.student.id, periodEvaluationModal.info, evaluation)} /> : null}
      {periodSummaryPrompt ? <WhatsAppPreviewSheet title="Dönem Sonu Özeti" subtitle={periodSummaryPrompt.student} text={msgDonemDegerlendirmesi(periodSummaryPrompt.student, periodSummaryPrompt.info, periodSummaryPrompt.log)} onClose={()=>setPeriodSummaryPrompt(null)} onSent={()=>handlePaketOzetiGonderildi(periodSummaryPrompt.student.id, periodSummaryPrompt.info)} /> : null}
      {odemeSt ? <ÖdemeSheet student={odemeSt} onClose={()=>setÖdemeSt(null)} onÖdemeAl={handleRecharge} onMesajGonder={(st)=>setMesajSt(st)} /> : null}

      {odemeKaydetModal ? (
        <Sheet title="Ödeme Alındı" subtitle={odemeKaydetModal.name} onClose={() => { if(paymentSavingId!==odemeKaydetModal.id) setÖdemeKaydetModal(null); }}>
          <p style={{ fontSize:13, color:"#666", marginBottom:12 }}>Ödeme tarihi:</p>
          <input style={INP} type="date" value={odemeKaydetDate} disabled={paymentSavingId===odemeKaydetModal.id} onChange={e=>setÖdemeKaydetDate(e.target.value)} />
          <div style={{ marginTop:16 }}>
            <Btn bg="#10b981" disabled={paymentSavingId===odemeKaydetModal.id} onClick={async() => { if(await handleÖdemeKaydet(odemeKaydetModal.id, odemeKaydetDate)) setÖdemeKaydetModal(null); }}>{paymentSavingId===odemeKaydetModal.id ? "Kaydediliyor…" : "Kaydet"}</Btn>
            <Btn bg="#111" outline disabled={paymentSavingId===odemeKaydetModal.id} onClick={() => setÖdemeKaydetModal(null)}>İptal</Btn>
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
