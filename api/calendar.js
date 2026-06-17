const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";

function dateKey(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().split("T")[0];
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

function ekDersStatusLabel(status) {
  const m = { planned:"Planlandı", done:"Yapıldı", cancelled:"İptal" };
  return m[status] || "Planlandı";
}

function ekDersTypeLabel(type) {
  const m = { online:"Online", physical:"Fiziki" };
  return m[type] || "Fiziki";
}

function getLessonDuration(student, item) {
  const scheduleDuration = (student?.schedule || []).find(l => l.durationMinutes || l.duration_minutes);
  const n = parseInt(item?.durationMinutes || item?.duration_minutes || student?.lessonDuration || student?.lesson_duration || scheduleDuration?.durationMinutes || scheduleDuration?.duration_minutes || 45);
  return Number.isFinite(n) && n > 0 ? n : 45;
}

function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function setTimeOnDate(date, time = "10:00") {
  const d = new Date(date);
  const [h, m] = String(time || "10:00").split(":").map(Number);
  d.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function lessonStartDate(student, lesson) {
  const base = new Date(lesson?.date);
  const time = lesson?.time || student?.time;
  return time ? setTimeOnDate(base, time) : base;
}

function calendarEventsFromStudents(students) {
  const events = [];

  students.forEach(student => {
    (student.schedule || []).forEach(lesson => {
      if (!lesson.date) return;
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

function buildCalendar(students) {
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
  return lines.join("\r\n");
}

export default async function handler(req, res) {
  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/students?select=*", {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text || "Takvim verisi alınamadı");
      return;
    }

    const students = await response.json();
    const calendar = buildCalendar(students || []);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=sonsuz-sanat-dersleri.ics");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).send(calendar);
  } catch (error) {
    res.status(500).send("Takvim oluşturulamadı: " + error.message);
  }
}
