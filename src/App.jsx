import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const FAILED_OPS_KEY = "sonsuz_crm_failed_operations_v1";
const MAX_SAVE_RETRIES = 3;

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
function fmtDate(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { weekday:"short", day:"numeric", month:"long" }); }
function fmtMed(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"long" }); }
function fmtShort(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"short" }); }
function calcBalance(schedule) { return schedule.filter(l => l.status === "upcoming").length; }
function calcNextPayment(schedule) { const up = schedule.filter(l => l.status === "upcoming"); if (!up.length) return null; const d = new Date(up[up.length-1].date); d.setDate(d.getDate()+7); return d.toISOString(); }
function midday(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function isToday(iso) { return midday(new Date(iso)).getTime() === midday().getTime(); }
function paymentOverdueDays(iso) { if (!iso) return 0; const diff = Math.floor((midday() - midday(new Date(iso))) / 86400000); return diff > 0 ? diff : 0; }
function daysBetweenDates(from, to) {
  if (!from || !to) return 0;
  const diff = Math.floor((midday(new Date(to)) - midday(new Date(from))) / 86400000);
  return diff > 0 ? diff : 0;
}
function dateKey(iso) { if (!iso) return ""; return new Date(iso).toISOString().split("T")[0]; }
function addMonths(iso, n) { const d = iso ? new Date(iso) : new Date(); d.setMonth(d.getMonth() + n); return d.toISOString(); }
const PAYMENT_PACK_SIZE = 4;
const PAID_LESSON_STATUSES = ["completed", "noshow", "lastminute"];
const SCORE_STATUSES = ["completed", "telafi", "lastminute", "noshow"];

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
  return packageInfos(student).find(info =>
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
  const program = studentScheduleLabel(student);
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
  const withDelay = payments.filter(o => typeof o.gecikmeGunu === "number");
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
  const scores = { completed:10, telafi:7, lastminute:4, noshow:0 };
  return scores[status] ?? null;
}

function attendanceStats(student) {
  const lessons = (student.schedule || []).filter(l => SCORE_STATUSES.includes(l.status));
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
  if (student.frozen || !student.last_raise_date) return false;
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
  return packageInfos(student).find(info => info.complete && !hasPaymentForPackage(student, info)) || null;
}

function lastUndoablePackageInfo(student) {
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
  const infos = packageInfos(student);
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

function lessonEngagementStats(student, info) {
  const ids = new Set(info?.lessonIds || []);
  const lessons = (student.schedule || []).filter(l => ids.has(l.id) && l.status === "completed");
  const withStats = lessons.filter(l => l.activeMinutes || l.focusMinutes || l.productiveWindow || l.focusSection);
  if (!withStats.length) return null;
  const totalActive = withStats.reduce((sum,l)=>sum+(parseInt(l.activeMinutes)||0),0);
  const totalDuration = withStats.reduce((sum,l)=>sum+getLessonDuration(student, l),0);
  const avgActiveRate = totalDuration ? Math.round((totalActive / totalDuration) * 100) : 0;
  const focusValues = withStats.map(l=>parseInt(l.focusMinutes)||0).filter(Boolean);
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

function lessonPerformanceScore(student, lesson) {
  if (!lesson || lesson.status !== "completed") return null;
  const duration = getLessonDuration(student, lesson);
  if (!duration) return null;
  const active = parseInt(lesson.activeMinutes) || 0;
  const focus = parseInt(lesson.focusMinutes) || 0;
  const windowBonus = lesson.productiveWindow || lesson.productive_window ? 1 : 0;
  const sectionBonus = lesson.focusSection || lesson.focus_section ? 1 : 0;
  if (!active && !focus && !windowBonus && !sectionBonus) return null;
  const score =
    (clamp(active / duration, 0, 1) * 6) +
    (clamp(focus / duration, 0, 1) * 3) +
    (windowBonus * 0.6) +
    (sectionBonus * 0.4);
  return clamp(score, 0, 10);
}

function performanceSeries(student) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setHours(0,0,0,0);
  return (student.schedule || [])
    .filter(l => l.status === "completed")
    .sort((a,b)=>new Date(a.date)-new Date(b.date))
    .map((lesson, i) => ({ lesson, index:i+1, score:lessonPerformanceScore(student, lesson) }))
    .filter(p => p.score !== null && new Date(p.lesson.date) >= sixMonthsAgo);
}

function monthShort(date) {
  return new Date(date).toLocaleDateString("tr-TR", { month:"short" }).replace(".", "");
}

function monthsCoveredText(points) {
  if (!points.length) return "mevcut";
  const first = new Date(points[0].lesson.date);
  const last = new Date(points[points.length - 1].lesson.date);
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
  const filled = clamp(Math.round((value / safeMax) * 10), 0, 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
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

function currentPackageInfoForLesson(student, lesson) {
  if (!lesson) return currentPaymentDueInfo(student) || nextPayablePackageInfo(student) || lastCompletedPackageInfo(student);
  return packageInfos(student).find(info => (info.lessonIds || []).includes(lesson.id)) || currentPaymentDueInfo(student) || nextPayablePackageInfo(student);
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
  return lessons.map((l,i) => (i+1)+". Ders: "+packageLessonStatusText(l)+" -").join("\n");
}

function lessonReminderSentInfo(student, lesson) {
  const key = reminderKey(lesson?.id || dateKey(lesson?.date));
  return (student.lesson_reminder_logs || []).find(log => log.lessonKey === key) || null;
}

function isPaymentDue(student) {
  return !!currentPaymentDueInfo(student);
}

const INSTRUMENTS = ["Davul","Piyano","Gitar"];
const DAYS = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const FOCUS_SECTIONS = ["Teknik çalışma","Ritim","Nota okuma","Parça çalışması","Doğaçlama","Teori","Tekrar"];
const PRODUCTIVE_WINDOWS = ["İlk 10 dk","İlk 15 dk","İlk 20 dk","İlk 30 dk","Orta 15 dk","Son 15 dk","Son 20 dk","Son 30 dk","Ders geneli dengeli"];
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
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:6 }}>Açıklama (opsiyonel)</label>
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

function ProgressChart({ student }) {
  const points = performanceSeries(student);
  if (points.length < 2) {
    return (
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"14px", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Gelişim Grafiği</p>
        <p style={{ margin:"8px 0 0", fontSize:13, color:"#94a3b8", fontWeight:700 }}>Grafik için en az 2 verimli ders kaydı gerekiyor.</p>
      </div>
    );
  }
  const width = 330;
  const height = 170;
  const padL = 34;
  const padR = 12;
  const padT = 16;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const dates = points.map(p => new Date(p.lesson.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const xForDate = (date) => {
    const time = new Date(date).getTime();
    return padL + (maxDate === minDate ? innerW / 2 : ((time - minDate) / (maxDate - minDate)) * innerW);
  };
  const yFor = (score) => padT + (1 - clamp(score, 0, 10) / 10) * innerH;
  const path = points.map((p,i) => (i === 0 ? "M" : "L") + xForDate(p.lesson.date).toFixed(1) + " " + yFor(p.score).toFixed(1)).join(" ");
  const first = points[0].score;
  const last = points[points.length - 1].score;
  const trend = last > first + 0.4 ? "Yükseliyor" : last < first - 0.4 ? "Düşüyor" : "Dengeli";
  const chartId = "progress-chart-" + student.id;
  const monthLabels = [];
  points.forEach(p => {
    const label = monthShort(p.lesson.date);
    if (!monthLabels.some(item => item.label === label)) monthLabels.push({ label, date:p.lesson.date });
  });
  const shownMonths = monthLabels.slice(-6);
  const sendProgressText = () => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    const text = "Merhaba,\n\n" + student.name + " için gelişim grafiğini sizinle paylaşıyorum.\n\nGrafik, öğrencimizin kendi ders verileri üzerinden hazırlanmıştır; başka öğrencilerle kıyaslama içermez.\n\nBodrum Sonsuz Sanat";
    if (phone) window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text), "_blank");
    else alert("Telefon numarası yok");
  };
  const downloadPng = () => downloadSvgAsPng(chartId, (student.name || "ogrenci").replace(/\s+/g, "-").toLowerCase()+"-gelisim-grafigi.png");

  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:8 }}>
        <div>
          <p style={{ margin:0, fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Gelişim Grafiği</p>
          <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b", fontWeight:700 }}>Kendi ders verileri üzerinden</p>
        </div>
        <p style={{ margin:0, fontSize:13, fontWeight:800, color:trend==="Yükseliyor"?"#059669":trend==="Düşüyor"?"#be123c":"#475569" }}>{trend}</p>
      </div>
      <svg id={chartId} viewBox={`0 0 ${width} ${height}`} style={{ width:"100%", height:"auto", display:"block", background:"#fff" }} role="img" aria-label="Öğrenci gelişim grafiği" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        {[0,2,4,6,8,10].map(tick => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={width-padR} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padL-8} y={y+4} textAnchor="end" fontSize="10" fill="#64748b">{tick}</text>
            </g>
          );
        })}
        <line x1={padL} x2={padL} y1={padT} y2={height-padB} stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1={padL} x2={width-padR} y1={height-padB} y2={height-padB} stroke="#cbd5e1" strokeWidth="1.5" />
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p,i) => (
          <circle key={p.lesson.id || i} cx={xForDate(p.lesson.date)} cy={yFor(p.score)} r="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
        ))}
        {shownMonths.map((item, i) => (
          <text key={item.label+"-"+i} x={xForDate(item.date)} y={height-8} textAnchor={i === 0 ? "start" : i === shownMonths.length - 1 ? "end" : "middle"} fontSize="10" fill="#64748b">{item.label}</text>
        ))}
      </svg>
      <p style={{ margin:"8px 0 0", fontSize:12, color:"#475569", fontWeight:700 }}>Son skor: {scoreLabel(last)} · İlk skor: {scoreLabel(first)}</p>
      <p style={{ margin:"4px 0 10px", fontSize:11, color:"#64748b", fontWeight:700 }}>Grafik {monthsCoveredText(points)} girilen ders verileri üzerinden hesaplanmıştır.</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <button onClick={downloadPng} style={{ background:"#eff6ff", color:"#1d4ed8", border:"none", borderRadius:10, padding:"9px 10px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>PNG İndir</button>
        <button onClick={sendProgressText} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:10, padding:"9px 10px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>WhatsApp</button>
      </div>
    </div>
  );
}

function downloadSvgAsPng(svgId, filename) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([xml], { type:"image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 990;
    canvas.height = 510;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  img.src = url;
}

const INP = { width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", background:"#fafafa", color:"#111" };
const LBL = { display:"block", fontSize:11, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:4, marginTop:14 };

function ActionSheet({ student, lessonId, onClose, onAction }) {
  const [step, setStep] = useState("main");
  const [note, setNote] = useState("");
  const [activeMinutes, setActiveMinutes] = useState("");
  const [focusMinutes, setFocusMinutes] = useState("");
  const [productiveWindow, setProductiveWindow] = useState(PRODUCTIVE_WINDOWS[0]);
  const [focusSection, setFocusSection] = useState(FOCUS_SECTIONS[0]);
  const lesson = lessonId ? student.schedule.find(l=>l.id===lessonId) : student.schedule.find(l=>l.status==="upcoming");
  const activeTelafi = student.telafi_records.filter(r=>!r.done).length;
  const willWarn = activeTelafi === 4;
  const willFreeze = activeTelafi === 5;
  const reset = (s) => { setNote(""); setStep(s); };
  const act = (a) => onAction(a, note, lessonId || lesson?.id);

  const TelafiWarn = () => (
    <>
      {willWarn && <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#92400e", fontWeight:600 }}>Uyarı: Bu telafi ile 5. hakka ulaşılacak.</div>}
      {willFreeze && <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:13, color:"#991b1b", fontWeight:600 }}>Uyarı: 6. telafi limiti - program dondurulacak.</div>}
    </>
  );

  return (
    <Sheet title={student.name} subtitle={lesson ? fmtDate(lesson.date)+" - "+lessonTime(student, lesson) : ""} onClose={onClose}>
      {step === "main" && <>
        {lesson && lesson.status !== "upcoming" ? (
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:"10px 12px", marginBottom:12 }}>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>Mevcut durum</p>
            <StatusPill status={lesson.status} />
            <p style={{ margin:"8px 0 0", fontSize:12, color:"#64748b" }}>Yanlış işaretlendiyse buradan düzeltebilirsin.</p>
          </div>
        ) : null}
        <Btn bg="#10b981" onClick={() => reset("attended")}>Katıldı</Btn>
        <Btn bg="#1f2937" onClick={() => reset("yapildi")}>Yapıldı Say</Btn>
        <Btn bg="#3b82f6" onClick={() => reset("telafi")}>Telafi Hakkı Oluştur</Btn>
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
        <label style={{ ...LBL, marginTop:0 }}>Aktif Ders Süresi (dk)</label>
        <input style={INP} type="number" min={0} max={getLessonDuration(student, lesson)} value={activeMinutes} onChange={e=>setActiveMinutes(e.target.value)} placeholder="Örn. 35" />
        <label style={LBL}>En Uzun Odaklanma (dk)</label>
        <input style={INP} type="number" min={0} max={getLessonDuration(student, lesson)} value={focusMinutes} onChange={e=>setFocusMinutes(e.target.value)} placeholder="Örn. 12" />
        <label style={LBL}>En Verimli Zaman</label>
        <select style={INP} value={productiveWindow} onChange={e=>setProductiveWindow(e.target.value)}>
          {PRODUCTIVE_WINDOWS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={LBL}>Dersin Güçlü Bölümü</label>
        <select style={INP} value={focusSection} onChange={e=>setFocusSection(e.target.value)}>
          {FOCUS_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={LBL}>Öğretmen Notu</label>
        <NoteArea value={note} onChange={setNote} placeholder="Kısa not" />
        <Btn bg="#10b981" onClick={() => onAction("attended", {
          note,
          activeMinutes:parseInt(activeMinutes)||0,
          focusMinutes:parseInt(focusMinutes)||0,
          productiveWindow,
          focusSection,
        }, lessonId || lesson?.id)}>Katılımı Kaydet</Btn>
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

function TelafiSheet({ record, studentName, onClose, onDone }) {
  const [step, setStep] = useState("main");
  const [note, setNote] = useState("");
  const days = daysLeft(record.expiry);
  const expired = days !== null && days < 0;
  const urgent = !expired && days !== null && days <= 7;

  return (
    <Sheet title="Telafi Dersi" subtitle={studentName} onClose={onClose}>
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
      {record.done
        ? <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px" }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>Telafi Yapıldı</p>
            {record.doneAt && <p style={{ margin:"4px 0 0", fontSize:13, color:"#4ade80" }}>{record.doneAt}</p>}
          </div>
        : step === "main"
          ? <Btn bg="#10b981" onClick={() => setStep("done")}>Telafi Yapıldı İşaretle</Btn>
          : <>
              <p style={{ fontSize:13, color:"#666", marginBottom:8 }}>Tarih ve saati yaz:</p>
              <NoteArea value={note} onChange={setNote} placeholder="Örn: 22 Mayıs yapıldı" />
              <Btn bg="#10b981" onClick={() => { onDone(record.id, note || fmtDate(new Date().toISOString())); onClose(); }}>Kaydet</Btn>
              <Btn bg="#111" outline onClick={() => setStep("main")}>Geri</Btn>
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

function DuzenleSheet({ student, onClose, onDuzenle }) {
  const [f, setF] = useState({
    name: student.name,
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
          <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:800, color:"#9ca3af", letterSpacing:1 }}>Program</p>
          <p style={{ margin:0, fontSize:13, color:"#374151" }}>{info.program}</p>
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

function DetailSheet({ student, onClose, onRecharge, onUndoLastPackage, onLessonClick, onShift, onMoveOne, onTelafiDone, onMesaj, onÖdemeAl, onZamYap, onDelete, onEkDersEkle, onEkDersOdeme, onEkDersDurum, onDuzenle, onToggleFreeze, onPaymentEdit, onPaymentDelete }) {
  const [tab, setTab] = useState("takvim");
  const [telafiSel, setTelafiSel] = useState(null);
  const [shiftSel, setShiftSel] = useState(null);
  const [showEkDers, setShowEkDers] = useState(false);
  const [showDuzenle, setShowDuzenle] = useState(false);
  const [showOdemeAl, setShowOdemeAl] = useState(false);
  const [showZam, setShowZam] = useState(false);
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const bal = calcBalance(student.schedule);
  const np = calcNextPayment(student.schedule);
  const active = student.telafi_records.filter(r=>!r.done);
  const done = student.telafi_records.filter(r=>r.done);
  const ekDersler = student.ek_dersler || [];
  const odenmemisEk = unpaidEkDersler(student);
  const undoablePackage = lastUndoablePackageInfo(student);
  const payStats = paymentHabitStats(student);
  const attStats = attendanceStats(student);
  const currentOrLastInfo = currentPaymentDueInfo(student) || nextPayablePackageInfo(student) || lastCompletedPackageInfo(student);
  const startInfo = lessonStartInfo(student);

  return (
    <>
      <Sheet title={student.name} onClose={onClose}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          <Pill label={student.instrument} bg="#f3f4f6" color="#374151" />
          <Pill label={studentScheduleLabel(student)} bg="#f3f4f6" color="#374151" />
          <Pill label={lessonDurationLabel(student)} bg="#f3f4f6" color="#374151" />
          {student.veli_adi ? <Pill label={"Veli: "+student.veli_adi} bg="#fef9c3" color="#854d0e" /> : null}
          {student.frozen ? <Pill label="Dondurulmuş" bg="#dbeafe" color="#1d4ed8" /> : null}
          {isRaiseDue(student) ? <Pill label="Zam zamanı" bg="#fff7ed" color="#c2410c" /> : null}
          {ekDersler.length > 0 ? <Pill label={"+"+ekDersler.length+" ek ders"} bg="#ede9fe" color="#5b21b6" /> : null}
          {odenmemisEk.length > 0 ? <Pill label={odenmemisEk.length+" ödenmemiş ek"} bg="#ffedd5" color="#c2410c" /> : null}
        </div>
        {startInfo ? (
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
            <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:1 }}>Derse Başlama</p>
            <p style={{ margin:"4px 0 0", fontSize:13, color:"#111", fontWeight:800 }}>{startInfo}</p>
          </div>
        ) : null}
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
            <p style={{ fontSize:24, fontWeight:800, color:"#047857", margin:0 }}>{scoreLabel(attStats?.score)}</p>
            <p style={{ fontSize:10, color:"#166534", margin:"2px 0 0", fontWeight:700 }}>Devam Skoru</p>
          </div>
          <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
            <p style={{ fontSize:24, fontWeight:800, color:"#1d4ed8", margin:0 }}>{scoreLabel(payStats?.score)}</p>
            <p style={{ fontSize:10, color:"#1e40af", margin:"2px 0 0", fontWeight:700 }}>Ödeme Skoru</p>
          </div>
        </div>
        {np ? (
          <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#888", letterSpacing:1 }}>Tahmini Sonraki Ödeme</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:700, color:"#111" }}>{fmtMed(np)}</p>
              </div>
              <span style={{ fontSize:22 }}>💳</span>
            </div>
          </div>
        ) : null}
        <ProgressChart student={student} />
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
            const clickable = true;
            return (
              <div key={l.id} style={{ background:clickable?"#f9fafb":"#fff", border:clickable?"1.5px solid #d1d5db":"1px solid #f3f4f6", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ cursor:"pointer", flex:1 }} onClick={() => onLessonClick(student, l.id)}>
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
          const güncel = [...güncelGecmis, ...upcomingDersler];
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
            {student.telafi_records.length === 0 ? <p style={{ textAlign:"center", color:"#aaa", padding:"24px 0", fontWeight:600 }}>Aktif telafi hakkı yok</p> : null}
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
                  <div key={r.id} style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#166534" }}>{fmtDate(r.lessonDate)} dersi yapıldı</p>
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
                    <div style={{ display:"grid", gridTemplateColumns:e.odendi?"1fr":"1fr 1fr", gap:8, marginTop:8 }}>
                      {!e.odendi ? <button onClick={() => onEkDersOdeme(student.id, e.id, new Date().toISOString().split("T")[0])} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Ödeme Alındı</button> : null}
                      <button onClick={() => onEkDersDurum(student.id, e.id, e.status === "done" ? "planned" : "done")} style={{ background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, padding:"8px 10px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{e.status === "done" ? "Planlandı Yap" : "Yapıldı Yap"}</button>
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
          <Btn bg="#111" onClick={() => { onRecharge(student.id, new Date().toISOString().split("T")[0]); onClose(); }}>Paket Yükle ({getPackageLessonCount(student)} Ders)</Btn>
          {undoablePackage ? (
            <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:12, padding:"10px 12px" }}>
              <p style={{ margin:"0 0 8px", fontSize:12, color:"#be123c", fontWeight:700 }}>Geri alınacak dersler: {undoablePackagePreview(student, undoablePackage)}</p>
              <Btn bg="#ef4444" onClick={() => { if(window.confirm("Son yüklenen paket geri alınsın mı?")) { onUndoLastPackage(student.id); onClose(); } }}>Son Paketi Geri Al</Btn>
            </div>
          ) : null}
          <div style={{ background:student.frozen?"#eff6ff":"#f9fafb", border:"1px solid "+(student.frozen?"#bfdbfe":"#e5e7eb"), borderRadius:12, padding:"12px 14px" }}>
            <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:800, color:student.frozen?"#1d4ed8":"#6b7280", letterSpacing:1 }}>Öğrenci Durumu</p>
            <p style={{ margin:"0 0 10px", fontSize:13, color:"#475569" }}>{student.frozen ? "Program dondurulmuş. Öğrenci geri başlayacağı zaman buradan aktif edebilirsin." : "Öğrenci aktif. Uzun süre ara verecekse programı dondurabilirsin."}</p>
            <button onClick={() => {
              onToggleFreeze(student.id, !student.frozen);
            }} style={{ width:"100%", background:student.frozen?"#2563eb":"#f59e0b", color:"#fff", border:"none", borderRadius:10, padding:"10px 12px", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
              {student.frozen ? "Programı Devam Ettir" : "Programı Dondur"}
            </button>
          </div>
          <Btn bg="#ef4444" onClick={() => { if(window.confirm(student.name+" silinsin mi?")){ onDelete(student.id); onClose(); } }}>Öğrenciyi Sil</Btn>
        </div>
      </Sheet>
      {telafiSel ? <TelafiSheet record={telafiSel} studentName={student.name} onClose={() => setTelafiSel(null)} onDone={(id, note) => { onTelafiDone(student.id, id, note); setTelafiSel(null); }} /> : null}
      {shiftSel ? <ShiftSheet lesson={shiftSel} student={student} onClose={() => setShiftSel(null)} onShift={(lid, days) => { onShift(student.id, lid, days); setShiftSel(null); }} onMoveOne={(lid, date, time) => { onMoveOne(student.id, lid, date, time); setShiftSel(null); }} /> : null}
      {showOdemeAl ? <OdemeAlSheet student={student} onClose={() => setShowOdemeAl(false)} onÖdemeAl={onÖdemeAl} /> : null}
      {showZam ? <ZamSheet student={student} onClose={() => setShowZam(false)} onSave={onZamYap} /> : null}
      {showEkDers ? <EkDersSheet student={student} onClose={() => setShowEkDers(false)} onEkDersEkle={(sid, ders) => { onEkDersEkle(sid, ders); setShowEkDers(false); }} /> : null}
      {showDuzenle ? <DuzenleSheet student={student} onClose={() => setShowDuzenle(false)} onDuzenle={onDuzenle} /> : null}
    </>
  );
}

function AddSheet({ onClose, onAdd }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({ name:"", phone:"", veli_adi:"", dogum_tarihi:"", lesson_start_date:"", instrument:"Davul", lessonDuration:45, lessonSlots:[{ day:"Pazartesi", time:"15:00" }], count:4, firstDate:todayISO, ucret:"", last_raise_date:"" });
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
      <div style={{ marginTop:16 }}><Btn bg="#111" onClick={() => { if(f.name.trim()){ onAdd(f); onClose(); } }}>Kaydet</Btn></div>
    </Sheet>
  );
}

function msgDersHatirlatma(student) {
  const todayLesson = student.schedule.find(l => isToday(l.date) && l.status === "upcoming");
  const nextLesson = todayLesson || student.schedule.find(l => l.status === "upcoming");
  const info = currentPackageInfoForLesson(student, nextLesson);
  const status = packageStatusText(student, info);
  let msg = "Günaydın :) Bugünkü ders saatimiz "+lessonTime(student, nextLesson)+". Lütfen 5 dakika önce hazır olun.";
  if (status) msg += "\n\nMevcut dönem durumu:\n"+status;
  return msg;
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
  return "Sonsuz Sanat Ders Süreci Bilgilendirmesi\n\nDerslerimiz haftalık sabit gün ve saatlerde ilerler. Eğitim sürecinde devamlılık ve düzenli katılım büyük önem taşır.\n\nLütfen aşağıdaki kuralları inceleyiniz:\n\nDers İptalleri\n\n• Ders iptallerinin en az 24 saat önceden bildirilmesi gerekir.\n• Her telafi hakkı oluşturulduğu tarihten itibaren 30 gün geçerlidir.\n• Kullanılmayan telafi hakları bir sonraki döneme devredilmez.\n\nDers Günü İptalleri\n\n• Ders günü yapılan iptallerde, eğer iptal sebebi sağlık sorunlarının dışındaysa ders yapılmış sayılır.\n• Derse habersiz gelinmemesi durumunda ders yapılmış sayılır ve telafi hakkı oluşmaz.\n\nTelafi Dersleri\n\n• Telafi dersleri kurumun uygunluk durumuna göre planlanır, uygunluk oluştuğunda tarafınıza bilgi verilir.\n• Telafi derslerinde gün ve saat seçimi yapılamaz.\n\nProgram Dondurma\n\n• 2-3 hafta ve üzeri planlı yokluklarda program dondurulabilir veya mevcut haliyle devam ettirilebilir.\n• Programın devam etmesi durumunda size ayrılan gün ve saat, öğrenciye özel olarak korunur.\n• Program dondurulduğunda mevcut gün ve saat korunmaz.\n• Dönüşte aynı gün ve saat garanti edilmez; kontenjan durumuna göre yeniden planlama yapılır.\n\nÖdeme Düzeni\n\n• Ödemelerin zamanında yapılması programın devamlılığı açısından önemlidir.\n• Ödeme sürecinin aksaması durumunda program dondurulabilir ve ayrılan gün/saat başka öğrencilere açılabilir.\n\nAmacımız tüm öğrencilerimiz için düzenli, adil ve sürdürülebilir bir eğitim süreci oluşturmaktır.\n\nBodrum Sonsuz Sanat";
}
function msgÖdemeHatirlatma() {
  return "Merhaba,\nDers ödemesini henüz tarafımıza ulaşmış olarak göremiyoruz.\nÖdemenizi uygun olduğunuzda gerçekleştirmenizi rica ederiz. Herhangi bir sorunuz olması durumunda bizimle iletişime geçebilirsiniz.\nTeşekkür eder, iyi günler dileriz.\nBodrum Sonsuz Sanat";
}
function msgÖdemeHatirlatma2() {
  return "Merhaba,\nDers ödemesi hâlâ tarafımıza ulaşmamıştır.\nEğitim programının kesintisiz şekilde devam edebilmesi ve öğrencimizin gün/saat planlamasının korunabilmesi için ödemenizin bu hafta içerisinde tamamlanmasını rica ederiz.\nTeşekkür eder, iyi günler dileriz.\nBodrum Sonsuz Sanat";
}
function msgÖdemeHatirlatma3() {
  return "Merhaba,\n\nDers ödemesi hâlâ tarafımıza ulaşmamıştır.\n\nDüzenli ödeme yapılmayan programlarda öğrencinin gün ve saatini korumamız mümkün olmamaktadır. Bu nedenle ödemenin belirtilen süre içerisinde tamamlanmaması durumunda programınız dondurulacak, ayrılan gün ve saat bekleme listesindeki öğrenciler için kullanıma açılacaktır.\n\nLütfen ödemenizi en kısa sürede gerçekleştiriniz.\n\nTeşekkür eder, iyi günler dileriz.\n\nBodrum Sonsuz Sanat";
}
function msgDondurmaUyarisi() {
  return "Merhaba,\n\nÖdeme konusunda daha önce tarafınıza bilgilendirme yapılmış olmasına rağmen ödemeniz henüz tarafımıza ulaşmamıştır.\n\nEğitim programlarımız sabit gün ve saat planlamasıyla yürütüldüğü için, düzenli ödeme yapılmayan programlarda öğrencinin gün ve saatini korumamız mümkün olmamaktadır.\n\nBu nedenle programınızı bugün itibarıyla donduruyoruz. Ayrılan gün ve saat, bekleme listesindeki diğer öğrencilerin kullanımına açılacaktır.\n\nİlerleyen dönemde programa devam etmek istemeniz halinde, o tarihteki uygun kontenjan durumuna göre yeni bir gün ve saat planlaması yapılabilir.\n\nAnlayışınız için teşekkür eder, iyi günler dileriz.\n\nBodrum Sonsuz Sanat";
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
        if (l.productiveWindow) dersler += ", "+l.productiveWindow;
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
    if (verim.topWindow) msg += "En verimli zaman çoğunlukla dersin "+verim.topWindow.toLowerCase()+" bölümünde görülmüş.\n";
  }
  if (aktifTelafi.length > 0) {
    msg += "\nTelafi Hakları ("+aktifTelafi.length+"):\n";
    aktifTelafi.forEach(r => { msg += "- "+fmtShort(r.lessonDate)+" dersi\n"; });
  }
  if (yapilanTelafi.length > 0) {
    msg += "\nYapılan Telafiler:\n";
    yapilanTelafi.forEach(r => { msg += "- "+fmtShort(r.lessonDate)+" dersi - "+(r.doneAt||"yapıldı")+"\n"; });
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

function MesajSheet({ student, onClose }) {
  const msgs = [
    { key:"ders", label:"Ders Hatırlatma", text:msgDersHatirlatma(student) },
    { key:"ilkders", label:"İlk Ders - Ödeme Günü", text:msgIlkDersÖdeme(student) },
    { key:"yenikayit", label:"Yeni Kayıt - Ders Süreci", text:msgYeniKayitKurallari() },
    { key:"ozet", label:"Dönem Sonu Özeti", text:msgPaketOzeti(student) },
    { key:"odeme1", label:"Ödeme Hatırlatma (1.)", text:msgÖdemeHatirlatma() },
    { key:"odeme2", label:"Ödeme Hatırlatma (2.)", text:msgÖdemeHatirlatma2() },
    { key:"odeme3", label:"Ödeme Hatırlatma (3.)", text:msgÖdemeHatirlatma3() },
    { key:"dondur", label:"Dondurma Uyarısı", text:msgDondurmaUyarisi() },
  ];
  const send = (text) => {
    const phone = student.phone ? student.phone.replace(/[^0-9]/g, "") : "";
    const encoded = encodeURIComponent(text);
    if (phone) window.open("https://wa.me/"+phone+"?text="+encoded, "_blank");
    else navigator.clipboard.writeText(text);
  };
  return (
    <Sheet title="Mesaj Şablonları" subtitle={student.name} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.map(m => (
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

function ÖdemeSheet({ student, onClose, onÖdemeAl, onMesajGonder }) {
  const ekDersler = unpaidEkDersler(student);
  const ekToplam = ekDersler.reduce((sum,e)=>sum+(e.fee||ekDersFee(student)),0);
  const paketTutar = student.ucret || 0;
  const paketDersSayisi = getPackageLessonCount(student);
  return (
    <Sheet title="Paket Yükle" subtitle={student.name} onClose={onClose}>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:13, color:"#166534" }}>{paketDersSayisi} yeni ders eklenecek.</p>
        <p style={{ margin:"6px 0 0", fontSize:13, color:"#166534", fontWeight:700 }}>Paket: {paketTutar.toLocaleString("tr-TR")} TL</p>
        {ekDersler.length > 0 ? <p style={{ margin:"6px 0 0", fontSize:13, color:"#5b21b6", fontWeight:700 }}>{ekDersler.length} ödenmemiş ek ders: {ekToplam.toLocaleString("tr-TR")} TL</p> : null}
        <p style={{ margin:"8px 0 0", fontSize:13, color:"#166534" }}>Ödeme uyarısı yeni periyodun ilk ders günü Bugünkü Ödemeler alanına düşer.</p>
      </div>
      <Btn bg="#111" onClick={() => { onÖdemeAl(student.id); onClose(); }}>Paketi Yükle</Btn>
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
    return res.sort((a,b)=>lessonTime(a.s, a.l).localeCompare(lessonTime(b.s, b.l)));
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
                      <p style={{ margin:"1px 0 0", fontSize:12, color:"#888" }}>{lessonTime(s, l)} · {s.instrument}</p>
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

function BugünDersleri({ students, onWA, onReminderToggle }) {
  const todayLessons = [];
  students.forEach(s => {
    if (s.frozen) return;
    s.schedule.forEach(l => {
      if (isToday(l.date) && l.status === "upcoming") todayLessons.push({ student: s, lesson: l });
    });
  });
  todayLessons.sort((a,b) => lessonTime(a.student, a.lesson).localeCompare(lessonTime(b.student, b.lesson)));
  if (todayLessons.length === 0) return null;
  return (
    <div style={{ background:"#f0f9ff", border:"1.5px solid #bae6fd", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
      <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#0369a1" }}>Bugünün Dersleri ({todayLessons.length})</p>
      {todayLessons.map(({student, lesson}) => {
        const sent = lessonReminderSentInfo(student, lesson);
        return (
        <div key={lesson.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #e0f2fe" }}>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{student.name}</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#0369a1" }}>{lessonTime(student, lesson)} · {student.instrument}</p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:sent?"#059669":"#64748b", fontWeight:700 }}>{sent ? "Hatırlatma gönderildi" : "Hatırlatma bekliyor"}</p>
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {student.phone ? (
              <button onClick={() => onWA(student, lesson)} style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>WA</button>
            ) : null}
            <button onClick={() => onReminderToggle(student.id, lesson.id || dateKey(lesson.date), !sent)} style={{ background:sent?"#dcfce7":"#f8fafc", color:sent?"#166534":"#475569", border:"1px solid #dbeafe", borderRadius:10, padding:"7px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{sent ? "Geri Al" : "İşaretle"}</button>
          </div>
        </div>
      );})}
    </div>
  );
}

function BugünÖdemeleri({ students, onÖdemeAl, onMesaj }) {
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
        <div style={{ background:"#fff7ed", border:"1.5px solid #fb923c", borderRadius:14, padding:"12px 16px", marginBottom:10 }}>
          <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#c2410c" }}>Bugünkü Ödemeler ({bugünÖdeme.length})</p>
          {bugünÖdeme.map(s => {
            const info = ödemeInfo(s);
            return (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fed7aa" }}>
              <div>
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
        </div>
      ) : null}
      {gecikenler.length > 0 ? (
        <div style={{ background:"#fff1f2", border:"1.5px solid #fca5a5", borderRadius:14, padding:"12px 16px" }}>
          <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#be123c" }}>Geciken Ödemeler ({gecikenler.length})</p>
          {gecikenler.map(s => {
            const info = ödemeInfo(s);
            const geciken = info ? paymentOverdueDays(info.start) : 0;
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
                  <button onClick={() => { setÖdemeDate(new Date().toISOString().split("T")[0]); setÖdemeModal(s); }} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Yapıldı</button>
                </div>
              </div>
            );
          })}
        </div>
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
        const gercekPaket = o.paketUcret || (typeof o.tutar !== "number" ? (s.ucret || 0) : 0);
        const gercekEk = o.ekTutar || 0;
        ayÖdemeleri.push({ ...o, tutar: gercekTutar, paketUcret: gercekPaket, ekTutar: gercekEk, ogrenci: s.name });
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
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111" }}>{ayAdi}</p>
          {ayOffset!==0 ? <button onClick={()=>setAyOffset(0)} style={{ background:"none", border:"none", fontSize:11, color:"#3b82f6", fontWeight:600, cursor:"pointer", padding:0, marginTop:2 }}>Bu aya dön</button> : null}
        </div>
        <button onClick={()=>setAyOffset(o=>o+1)} style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:18 }}>›</button>
      </div>
      <div style={{ background:"linear-gradient(135deg, #059669, #10b981)", borderRadius:18, padding:"20px", marginBottom:14, color:"#fff" }}>
        <p style={{ margin:0, fontSize:12, opacity:0.85, fontWeight:600, letterSpacing:1 }}>Toplam Tahsilat</p>
        <p style={{ margin:"6px 0 0", fontSize:34, fontWeight:800 }}>{toplamGelir.toLocaleString("tr-TR")} TL</p>
        <p style={{ margin:"4px 0 0", fontSize:13, opacity:0.85 }}>{ayÖdemeleri.length} ödeme alındı</p>
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
  const [search, setSearch] = useState("");
  const [failedOps, setFailedOps] = useState(() => readFailedOps());
  const [retryingOps, setRetryingOps] = useState({});

  const pop = (msg, ms=3000) => { setToast(msg); setTimeout(()=>setToast(null), ms); };

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
    if (!error && data) setStudents(data.map(s => ({ ...s, record_version: typeof s.record_version === "number" ? s.record_version : 0 })));
    if (error) {
      console.error("Veri yükleme hatası:", error);
      pop("Veriler yüklenemedi. Bağlantı veya Supabase yetkisini kontrol et.", 6000);
    }
    setLoading(false);
  };

  useEffect(() => { loadStudents(); document.title = "Sonsuz Sanat CRM"; }, []);

  const studentPayload = (student, recordVersion, writeId) => {
    const slots = getStudentSlots(student);
    return {
      id: student.id,
      name: student.name,
      phone: student.phone || "",
      veli_adi: student.veli_adi || "",
      dogum_tarihi: student.dogum_tarihi || "",
      lesson_start_date: student.lesson_start_date || student.lessonStartDate || null,
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
          return {
            ...s,
            no_show:Math.max(0, s.no_show+noShowFix),
            telafi_records:cleanTelafiForLesson(s.telafi_records||[]),
            schedule:(s.schedule||[]).map(l => l.id===lid ? {
              ...l,
              status:"completed",
              note:detail.note || "",
              activeMinutes:detail.activeMinutes || 0,
              focusMinutes:detail.focusMinutes || 0,
              productiveWindow:detail.productiveWindow || "",
              focusSection:detail.focusSection || "",
            } : l),
          };
        }
        case "telafi": {
          const rec = mkTelafi(s, lid, note||"24 saat oncesi iptal");
          const recs = [...cleanTelafiForLesson(s.telafi_records||[]), rec];
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "6. telafi - program donduruldu" : ac===5 ? "5. telafi uyarisi" : "Telafi oluşturuldu";
          return {...s, no_show:Math.max(0, s.no_show+noShowFix), frozen, telafi_records:recs, schedule: updLesson(s.schedule, lid, "telafi", note)};
        }
        case "lm-telafi": {
          const rec = mkTelafi(s, lid, note||"Son dakika iptali");
          const recs = [...cleanTelafiForLesson(s.telafi_records||[]), rec];
          const ac = recs.filter(r=>!r.done).length;
          const frozen = ac>=6 ? true : s.frozen;
          msg = ac>=6 ? "6. telafi - program donduruldu" : "Son dakika + telafi kaydedildi";
          return {...s, no_show:Math.max(0, s.no_show+noShowFix), frozen, telafi_records:recs, schedule: updLesson(s.schedule, lid, "lastminute", note||"Son dakika iptali")};
        }
        case "lm-notelafi": msg = "Son dakika iptali"; return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:cleanTelafiForLesson(s.telafi_records||[]), schedule: updLesson(s.schedule, lid, "lastminute", note||"Son dakika iptali")};
        case "noshow": msg = "No-show kaydedildi"; return {...s, no_show:Math.max(0, s.no_show + (oldLesson?.status === "noshow" ? 0 : 1)), telafi_records:cleanTelafiForLesson(s.telafi_records||[]), schedule: updLesson(s.schedule, lid, "noshow", note||"Habersiz gelmedi")};
        case "reset-upcoming": msg = "Ders planlandıya alındı"; return {...s, no_show:Math.max(0, s.no_show+noShowFix), telafi_records:cleanTelafiForLesson(s.telafi_records||[]), schedule: (s.schedule||[]).map(l => l.id===lid ? {...l, status:"upcoming", note:"", activeMinutes:0, focusMinutes:0, productiveMinutes:0, productiveWindow:"", focusSection:""} : l)};
        default: return s;
      }
    });
    return { updated, msg };
  };

  const handleAction = async (sid, action, note="", lid=null) => {
    const { updated, msg } = buildActionUpdate(students, sid, action, note, lid);
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
      await saveStudentWithRetry(student, operation);
      pop(msg);
      setActionModal(null);
    } catch {
      setActionModal(null);
    }
  };

  const handleToggleFreeze = async (sid, frozen) => {
    const updated = students.map(s => s.id!==sid ? s : { ...s, frozen });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop(frozen ? "Program donduruldu" : "Program tekrar aktif edildi");
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
    const { error } = await supabase.from("students").delete().eq("id", sid);
    if (error) {
      console.error("Silme hatası:", error);
      pop("Öğrenci silinemedi. Ekran geri yüklendi.", 6000);
      await loadStudents();
      return;
    }
    setStudents(p => p.filter(s => s.id !== sid));
    pop("Öğrenci silindi");
  };

  const handleRecharge = async (sid, odemeDate) => {
    let lessonCount = PAYMENT_PACK_SIZE;
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const last = [...s.schedule].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      const from = last ? new Date(new Date(last.date).getTime()+86400000) : new Date();
      lessonCount = getPackageLessonCount(s);
      const newLessons = buildScheduleSlots(getStudentSlots(s), lessonCount, from, getLessonDuration(s));
      return {...s, frozen:false, schedule:[...s.schedule, ...newLessons]};
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
    const newStudent = {
      id: uid(), name: f.name, phone: f.phone||"", veli_adi: f.veli_adi||"", dogum_tarihi: f.dogum_tarihi||"",
      lesson_start_date: f.lesson_start_date || null, ucret: parseInt(f.ucret)||0, last_raise_date: f.last_raise_date || null, packageLessonCount, package_lesson_count: packageLessonCount, lessonDuration: parseInt(f.lessonDuration)||45, lesson_duration: parseInt(f.lessonDuration)||45, instrument: f.instrument, day: slots[0].day, time: slots[0].time, lessonSlots: slots, lesson_slots: slots,
      no_show: 0, frozen: false, odemeler: [], telafi_records: [],
      schedule: buildScheduleSlots(slots, packageLessonCount, from, f.lessonDuration), ek_dersler: [],
    };
    setStudents(p=>[...p, newStudent]);
    await saveStudent(newStudent);
    pop("Öğrenci eklendi");
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

  const handlePaketOzetiGonderildi = async (sid) => {
    const updated = students.map(s => {
      if (s.id!==sid) return s;
      const info = lastCompletedPackageInfo(s);
      const key = packageSummaryKey(info);
      if (!info || !key) return s;
      const logs = (s.package_summary_logs || []).filter(log => log.packageKey !== key);
      return {
        ...s,
        package_summary_logs: [
          ...logs,
          {
            packageKey:key,
            sentAt:new Date().toISOString().split("T")[0],
            packageStart:info.startKey,
            packageEnd:info.endKey,
          }
        ]
      };
    });
    setStudents(updated);
    await saveStudent(updated.find(s=>s.id===sid));
    pop("Paket özeti gönderildi işaretlendi");
  };

  const handleDuzenle = async (sid, f) => {
    const slots = normalizeSlots(f.lessonSlots, f.day, f.time);
    const duration = parseInt(f.lessonDuration)||45;
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
        phone: f.phone,
        veli_adi: f.veli_adi||"",
        dogum_tarihi: f.dogum_tarihi||"",
        lesson_start_date: f.lesson_start_date || null,
        ucret: parseInt(f.ucret)||0,
        last_raise_date: f.last_raise_date || null,
        lessonDuration: duration,
        lesson_duration: duration,
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

  const isÖdemeBekleyen = (s) => {
    return isPaymentDue(s);
  };

  const todayPayments = students.filter(isÖdemeBekleyen);
  const raiseDueList = students.filter(isRaiseDue);
  const filtered = students.filter(s => {
    if (search.trim() && !s.name.toLowerCase().includes(search.toLowerCase().trim())) return false;
    if (filter==="active") return !s.frozen;
    if (filter==="frozen") return s.frozen;
    if (filter==="telafi") return s.telafi_records.some(r=>!r.done);
    if (filter==="odeme") return isÖdemeBekleyen(s);
    if (filter==="zam") return isRaiseDue(s);
    return true;
  });

  const stats = { total:students.length, active:students.filter(s=>!s.frozen).length, frozen:students.filter(s=>s.frozen).length, odeme:todayPayments.length, zam:raiseDueList.length };
  const telafiWarnList = students.filter(s => s.telafi_records.filter(r=>!r.done).length===5 && !s.frozen);

  if (!giris) {
    return (
      <div style={{ fontFamily:"sans-serif", background:"#111", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:"#fff", borderRadius:20, padding:"40px 32px", width:"100%", maxWidth:360, boxShadow:"0 8px 40px rgba(0,0,0,.3)" }}>
          <p style={{ fontSize:11, letterSpacing:3, color:"#999", margin:"0 0 6px" }}>Sonsuz Sanat</p>
          <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 28px", color:"#111" }}>Öğrenci Yönetimi</h1>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:6 }}>Şifre</label>
          <input
            type="password"
            value={sifre}
            onChange={e => { setSifre(e.target.value); setSifreHata(false); }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (sifre === SIFRE) { sessionStorage.setItem("crm_auth","ok"); setGiris(true); }
                else setSifreHata(true);
              }
            }}
            placeholder="Şifrenizi girin"
            style={{ width:"100%", border:sifreHata?"1.5px solid #ef4444":"1.5px solid #e5e7eb", borderRadius:10, padding:"12px 14px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", marginBottom:sifreHata?6:16 }}
          />
          {sifreHata && <p style={{ color:"#ef4444", fontSize:12, fontWeight:600, marginBottom:12 }}>Şifre hatalı</p>}
          <button
            onClick={() => {
              if (sifre === SIFRE) { sessionStorage.setItem("crm_auth","ok"); setGiris(true); }
              else setSifreHata(true);
            }}
            style={{ width:"100%", background:"#111", color:"#fff", border:"none", borderRadius:12, padding:"13px", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}
          >
            Giriş
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ fontFamily:"sans-serif", background:"#f4f4f0", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <p style={{ fontSize:32 }}>🎵</p>
          <p style={{ fontWeight:700, color:"#666" }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"sans-serif", background:"#f4f4f0", minHeight:"100vh" }}>
      <div style={{ background:"#111", color:"#fff", padding:"16px 20px 0" }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap", paddingBottom:12 }}>
          <div>
            <p style={{ fontSize:10, letterSpacing:3, color:"#666", margin:0 }}>Sonsuz Sanat</p>
            <h1 style={{ fontSize:20, fontWeight:800, margin:"2px 0 0", letterSpacing:-0.5 }}>Öğrenci Yönetimi</h1>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:"auto" }}>
            <button onClick={handleCalendarLinkCopy} style={{ background:"#dbeafe", color:"#1d4ed8", border:"none", borderRadius:12, padding:"9px 12px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Takvim Linki</button>
            <button onClick={handleGoogleCalendarExport} style={{ background:"#dcfce7", color:"#166534", border:"none", borderRadius:12, padding:"9px 12px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Google'a Aktar</button>
            <button onClick={()=>setShowAdd(true)} style={{ background:"#fff", color:"#111", border:"none", borderRadius:12, padding:"9px 18px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>+ Ekle</button>
          </div>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", gap:4 }}>
          {[{key:"bugün",label:"Bugün"},{key:"liste",label:"Liste"},{key:"takvim",label:"Takvim"},{key:"gelir",label:"Gelir"}].map(t=>(
            <button key={t.key} onClick={()=>setMainTab(t.key)} style={{ flex:1, background:mainTab===t.key?"#fff":"transparent", color:mainTab===t.key?"#111":"#888", border:"none", borderRadius:"10px 10px 0 0", padding:"10px 0", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"14px 14px 80px" }}>
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
            {(() => {
              const bugün = new Date();
              const bugünMD = (bugün.getMonth()+1)+"-"+bugün.getDate();
              const dogumGünleri = students.filter(s => {
                if (!s.dogum_tarihi) return false;
                const d = new Date(s.dogum_tarihi);
                return (d.getMonth()+1)+"-"+d.getDate() === bugünMD;
              });
              if (dogumGünleri.length === 0) return null;
              return (
                <div style={{ background:"#fdf4ff", border:"1.5px solid #e879f9", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                  <p style={{ margin:"0 0 8px", fontWeight:700, fontSize:13, color:"#86198f" }}>Bugün Doğum Günü</p>
                  {dogumGünleri.map(s => {
                    const yaş = new Date().getFullYear() - new Date(s.dogum_tarihi).getFullYear();
                    return (
                      <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0" }}>
                        <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                        <span style={{ fontSize:13, color:"#86198f", fontWeight:600 }}>{yaş} yaş</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <BugünDersleri students={students} onWA={handleWADers} onReminderToggle={handleReminderToggle} />
            {students.filter(s => calcBalance(s.schedule) === 0 && !s.frozen).length > 0 ? (
              <div style={{ background:"#faf5ff", border:"1.5px solid #d8b4fe", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#7e22ce" }}>Paketi Biten Öğrenciler</p>
                {students.filter(s => calcBalance(s.schedule) === 0 && !s.frozen).map(s => {
                  const info = lastCompletedPackageInfo(s);
                  const sent = summarySentInfo(s, info);
                  return (
                    <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f3e8ff" }}>
                      <div>
                        <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#111" }}>{s.name}</p>
                        <p style={{ margin:"2px 0 0", fontSize:12, color:"#7e22ce" }}>Dönem tamamlandı{info?.donem ? " · "+info.donem : ""}</p>
                        <p style={{ margin:"2px 0 0", fontSize:12, color:sent?"#059669":"#c2410c", fontWeight:700 }}>
                          {sent ? "Özet gönderildi · "+fmtMed(sent.sentAt) : "Özet gönderilmedi"}
                        </p>
                      </div>
                      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                        <button onClick={() => setMesajSt(s)} style={{ background:"#a855f7", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Özeti Aç</button>
                        {!sent ? <button onClick={() => handlePaketOzetiGonderildi(s.id)} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Gönderildi</button> : null}
                        <button onClick={() => handleRecharge(s.id, new Date().toISOString().split("T")[0])} style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Paket Yükle</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <BugünÖdemeleri students={students} onÖdemeAl={handleÖdemeKaydet} onMesaj={(s)=>setMesajSt(s)} />
            {students.filter(s=>{ if (s.frozen) return false; const l=s.schedule.find(x=>x.status==="upcoming"); return l&&isToday(l.date); }).length===0 && !students.some(s=>isÖdemeBekleyen(s)) ? (
              <div style={{ textAlign:"center", padding:"48px 20px" }}>
                <p style={{ fontSize:36 }}>☀️</p>
                <p style={{ fontWeight:600, color:"#aaa" }}>Bugün için bir şey yok</p>
              </div>
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
            {raiseDueList.length > 0 ? (
              <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#c2410c" }}>Zam zamanı gelen öğrenciler:</p>
                {raiseDueList.slice(0,5).map(s=>(<p key={s.id} style={{ margin:"4px 0 0", fontSize:13, color:"#9a3412" }}>· {s.name}</p>))}
              </div>
            ) : null}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:14 }}>
              {[
                { label:"Toplam", val:stats.total, bg:"#fff", color:"#111" },
                { label:"Aktif", val:stats.active, bg:"#ecfdf5", color:"#059669" },
                { label:"Donuk", val:stats.frozen, bg:"#eff6ff", color:"#3b82f6" },
                { label:"Ödeme", val:stats.odeme, bg:stats.odeme>0?"#fff7ed":"#f9fafb", color:stats.odeme>0?"#ea580c":"#999" },
                { label:"Zam", val:stats.zam, bg:stats.zam>0?"#fff7ed":"#f9fafb", color:stats.zam>0?"#ea580c":"#999" },
              ].map(s=>(
                <div key={s.label} onClick={()=>{ if(s.label==="Ödeme") setFilter("odeme"); if(s.label==="Zam") setFilter("zam"); }} style={{ background:s.bg, borderRadius:12, padding:"12px 6px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,.05)", cursor:["Ödeme","Zam"].includes(s.label)?"pointer":"default" }}>
                  <p style={{ fontSize:22, fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
                  <p style={{ fontSize:10, color:"#999", margin:"2px 0 0", fontWeight:600 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Öğrenci ara..." style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:12, padding:"11px 14px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", background:"#fff", color:"#111" }} />
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
              {[{key:"all",label:"Tümü"},{key:"active",label:"Aktif"},{key:"frozen",label:"Dondurulmuş"},{key:"telafi",label:"Telafi"},{key:"odeme",label:"Ödeme"},{key:"zam",label:"Zam"}].map(f=>(
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
                const payHabit = paymentHabitStats(s);
                const att = attendanceStats(s);
                const ekCount = (s.ek_dersler||[]).length;
                const unpaidEkCount = unpaidEkDersler(s).length;
                return (
                  <div key={s.id} style={{ background:s.frozen?"#f0f9ff":"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.07)", border:warn?"1.5px solid #fcd34d":payDue?"1.5px solid #fb923c":s.frozen?"1.5px solid #bfdbfe":"1.5px solid transparent" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setDetailSt(s)}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <p style={{ fontWeight:700, fontSize:15, margin:0, color:"#111" }}>{s.name}</p>
                          {s.frozen ? <Pill label="Donuk" bg="#dbeafe" color="#1d4ed8" /> : null}
                          {warn ? <Pill label="5/6 Telafi" bg="#fef3c7" color="#92400e" /> : null}
                          {payDue ? <Pill label="Ödeme" bg="#ffedd5" color="#c2410c" /> : null}
                          {isRaiseDue(s) ? <Pill label="Zam" bg="#fff7ed" color="#c2410c" /> : null}
                          {ekCount>0 ? <Pill label={"+"+ekCount+" ek"} bg="#ede9fe" color="#5b21b6" /> : null}
                          {unpaidEkCount>0 ? <Pill label={unpaidEkCount+" ek ödenmedi"} bg="#ffedd5" color="#c2410c" /> : null}
                        </div>
                        <p style={{ fontSize:12, color:"#999", margin:"3px 0 2px", fontWeight:500 }}>
                          {s.instrument} · {studentScheduleLabel(s)} · {lessonDurationLabel(s)}
                          {s.ucret ? <span style={{ marginLeft:8, color:"#059669", fontWeight:700 }}>{s.ucret.toLocaleString("tr-TR")} TL</span> : null}
                        </p>
                        {s.veli_adi ? <p style={{ fontSize:11, color:"#888", margin:"0 0 4px" }}>Veli: {s.veli_adi}</p> : null}
                        {nextL ? <p style={{ fontSize:12, color:"#0369a1", fontWeight:600, margin:"0 0 6px", background:"#f0f9ff", display:"inline-block", borderRadius:6, padding:"2px 8px" }}>{fmtDate(nextL.date)}</p> : null}
                        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                          <span style={{ fontSize:12, color:"#444" }}><strong>{bal}</strong> ders kaldı</span>
                          {np ? <span style={{ fontSize:12, color:"#6b7280" }}><strong>{fmtShort(np)}</strong> odeme</span> : null}
                          {(() => { const done = s.schedule.filter(l=>l.status==="completed").length; const total = s.schedule.filter(l=>l.status!=="upcoming").length; if(total===0) return null; const pct = Math.round(done/total*100); const color = pct>=80?"#059669":pct>=60?"#d97706":"#dc2626"; return <span style={{ fontSize:12, color }}><strong>{done}/{total}</strong> <strong>{pct}%</strong> devam</span>; })()}
                        </div>
                        {ac>0 ? <div style={{ marginTop:4 }}><span style={{ fontSize:12, color:ac>4?"#d97706":"#2563eb" }}><strong>{ac}/6</strong> aktif telafi</span></div> : null}
                        {(att || payHabit) ? <div style={{ marginTop:4, display:"flex", gap:8, flexWrap:"wrap" }}>
                          {att ? <span style={{ fontSize:12, color:"#047857" }}><strong>Devam {scoreLabel(att.score)}</strong></span> : null}
                          {payHabit ? <span style={{ fontSize:12, color:payHabit.avgDelay>0?"#be123c":"#059669" }}><strong>Ödeme {scoreLabel(payHabit.score)}</strong> · {paymentHabitLabel(payHabit)}</span> : null}
                        </div> : null}
                        {s.no_show>0 ? <div><span style={{ fontSize:12, color:"#dc2626" }}><strong>{s.no_show}</strong> no-show</span></div> : null}
                      </div>
                      <button onClick={()=>s.frozen ? setDetailSt(s) : setActionModal({student:s,lessonId:null})} style={{ background:s.frozen?"#e0f2fe":"#111", color:s.frozen?"#0369a1":"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", marginLeft:10, flexShrink:0, fontFamily:"inherit" }}>{s.frozen ? "Devam" : "İşlem"}</button>
                      {payDue ? <button onClick={()=>setÖdemeKaydetModal(s)} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:700, cursor:"pointer", marginLeft:6, flexShrink:0 }}>💳</button> : null}
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

      {actionModal ? <ActionSheet student={students.find(s=>s.id===actionModal.student.id)} lessonId={actionModal.lessonId} onClose={()=>setActionModal(null)} onAction={(a,n,l)=>handleAction(actionModal.student.id,a,n,l)} /> : null}
      {detailSt ? <DetailSheet student={students.find(s=>s.id===detailSt.id)} onClose={()=>setDetailSt(null)} onRecharge={handleRecharge} onUndoLastPackage={handleUndoLastPackage} onLessonClick={(st,lid)=>{ setDetailSt(null); setTimeout(()=>setActionModal({student:st,lessonId:lid}),100); }} onShift={handleShift} onMoveOne={handleMoveOneLesson} onTelafiDone={handleTelafiDone} onMesaj={(st)=>setMesajSt(st)} onÖdemeAl={handleÖdemeKaydet} onZamYap={handleZamYap} onDelete={handleDelete} onEkDersEkle={handleEkDersEkle} onEkDersOdeme={handleEkDersOdeme} onEkDersDurum={handleEkDersDurum} onDuzenle={handleDuzenle} onToggleFreeze={handleToggleFreeze} onPaymentEdit={handleÖdemeDuzenle} onPaymentDelete={handleÖdemeSil} /> : null}
      {showAdd ? <AddSheet onClose={()=>setShowAdd(false)} onAdd={handleAdd} /> : null}
      {mesajSt ? <MesajSheet student={mesajSt} onClose={()=>setMesajSt(null)} /> : null}
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
  );
}
