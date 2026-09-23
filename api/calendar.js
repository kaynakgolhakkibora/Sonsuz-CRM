export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(410).send("Takvim abonelik bağlantısı güvenlik nedeniyle kapatıldı.");
}
