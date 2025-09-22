import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const { uid, ts } = req.query;

    if (!uid || !ts) {
      return res.status(400).json({ error: "缺少必要參數" });
    }

    // 讀取 JSON 檔
    const filePath = path.join(process.cwd(), "data", "book_of_answers_384_full.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    // 建立 session (簡單存在 tmpDir 或 memory，正式版可改 DB)
    const sessionFile = path.join(process.cwd(), "data", `session_${uid}.json`);
    let session = { date: null, count: 0, used: [], lastTS: 0 };

    if (fs.existsSync(sessionFile)) {
      session = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    }

    const today = new Date().toISOString().slice(0, 10);

    // 如果不是今天，重置
    if (session.date !== today) {
      session = { date: today, count: 0, used: [], lastTS: 0 };
    }

    const tsVal = parseInt(ts, 16);

    // 檢查 TS 遞增
    if (tsVal <= session.lastTS) {
      return res.status(403).json({ error: "⚠️ Token 無效或重複使用" });
    }

    // 檢查每日次數限制
    if (session.count >= 3) {
      return res.status(403).json({ error: "⚠️ 今日抽籤次數已達上限 (3次)" });
    }

    // 避免重複，從剩下的抽
    let available = data.filter(d => !session.used.includes(d.id));
    if (available.length === 0) {
      available = [...data];
      session.used = [];
    }

    const pick = available[Math.floor(Math.random() * available.length)];

    // 更新 session
    session.count++;
    session.lastTS = tsVal;
    session.used.push(pick.id);

    fs.writeFileSync(sessionFile, JSON.stringify(session));

    // 回傳結果
    res.status(200).json({
      zh: pick.answer_tw,
      en: pick.answer_en,
      id: pick.id,
      remaining: 3 - session.count
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
}