const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const session = require("express-session");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ✅ Cloud Run 프록시 뒤면 세션보다 먼저
app.set("trust proxy", 1);

const allowedOrigins = [
  "https://likelion-food-frontend-572489305334.us-central1.run.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

// ✅ health
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// ✅ 세션은 1번만
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: "none",
    },
  })
);

// ✅ Pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ✅ pool 테스트 (서버는 계속 살아야 하니까 죽이지 말고 로그만)
db.query("SELECT 1", (err) => {
  if (err) console.error("DB 풀 연결 테스트 실패:", err.message);
  else console.log("DB 풀 연결 OK");
});

// ================= 회원 관련 =================

// 회원가입
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ message: "필수 항목 누락" });
    }
    const hashed = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (username, password, name) VALUES (?, ?, ?)",
      [username, hashed, name],
      (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "회원가입 성공" });
      }
    );
  } catch {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 로그인
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE username=?",
    [username],
    async (err, results) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!results || results.length === 0)
        return res.status(400).json({ message: "존재하지 않는 아이디" });

      const match = await bcrypt.compare(password, results[0].password);
      if (!match) return res.status(400).json({ message: "비밀번호 불일치" });

      req.session.user = {
        id: results[0].id,
        username: results[0].username,
        name: results[0].name,
      };
      res.json({ message: "로그인 성공", user: req.session.user });
    }
  );
});

// 로그아웃
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "로그아웃 성공" });
  });
});

// 로그인 상태 확인
app.get("/api/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: "로그인 필요" });
  res.json(req.session.user);
});

// ================= 음식 검색/리스트 =================

// 음식 리스트/검색
app.get("/api/foods", (req, res) => {
  const search = (req.query.search || "").trim();

  if (search) {
    const sql = `
      SELECT DISTINCT food_name, MIN(id) AS id
      FROM foods
      WHERE food_name LIKE ? OR food_name LIKE ? OR food_name = ?
      GROUP BY food_name
      ORDER BY food_name ASC
    `;
    const keyword = `%${search}%`;
    db.query(sql, [keyword, `${search}%`, search], (err, results) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(results);
    });
  } else {
    const sql = `
      SELECT DISTINCT food_name, MIN(id) AS id
      FROM foods
      GROUP BY food_name
      ORDER BY food_name ASC
      LIMIT 100
    `;
    db.query(sql, [], (err, results) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(results);
    });
  }
});

// 자동완성
app.get("/api/foods/autocomplete", (req, res) => {
  const keyword = (req.query.q || "").trim();
  if (!keyword) return res.json([]);

  const sql = `
    SELECT DISTINCT food_name
    FROM foods
    WHERE food_name LIKE ?
    ORDER BY food_name ASC
    LIMIT 10
  `;
  db.query(sql, [`%${keyword}%`], (err, results) => {
    if (err) return res.status(500).json({ message: "DB 오류" });
    res.json(results.map((r) => r.food_name));
  });
});

// 초성별 검색
app.get("/api/foods/by-initial", (req, res) => {
  const initial = (req.query.initial || "").trim();
  if (!initial) return res.status(400).json({ message: "초성 필요" });

  const choIndexMap = {
    ㄱ: 0,
    ㄴ: 2,
    ㄷ: 3,
    ㄹ: 5,
    ㅁ: 6,
    ㅂ: 7,
    ㅅ: 9,
    ㅇ: 11,
    ㅈ: 12,
    ㅊ: 14,
    ㅋ: 15,
    ㅌ: 16,
    ㅍ: 17,
    ㅎ: 18,
  };
  const baseChoIndex = choIndexMap[initial];
  if (baseChoIndex === undefined) {
    return res.status(400).json({ message: "지원하지 않는 초성" });
  }

  const HANGUL_BASE = 0xac00;
  const JUNG_COUNT = 21;
  const JONG_COUNT = 28;

  const prefixes = [];
  for (let jung = 0; jung < JUNG_COUNT; jung++) {
    const codePoint =
      HANGUL_BASE + (baseChoIndex * JUNG_COUNT + jung) * JONG_COUNT;
    prefixes.push(String.fromCharCode(codePoint));
  }

  const likeClauses = prefixes.map(() => "food_name LIKE ?").join(" OR ");
  const likeParams = prefixes.map((p) => `${p}%`);

  const sql = `
    SELECT MIN(id) AS id, food_name
    FROM foods
    WHERE ${likeClauses}
    GROUP BY food_name
    ORDER BY food_name ASC
    LIMIT 500
  `;
  db.query(sql, likeParams, (err, rows) => {
    if (err) {
      console.error("초성별 검색 오류:", err);
      return res.status(500).json({ message: "DB 오류" });
    }
    res.json(Array.isArray(rows) ? rows : []);
  });
});

// 음식 상세 (내 DB foods 테이블 기준)
app.get("/api/foods/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      id,
      food_name,
      energy_kcal,
      carbohydrate_g,
      protein_g,
      fat_g,
      sugar_g,
      sodium_mg,
      calcium_mg,
      iron_mg,
      potassium_mg,
      vitamin_a_ug,
      vitamin_c_mg,
      vitamin_d_ug,
      cholesterol_mg,
      saturated_fat_g,
      trans_fat_g
    FROM foods
    WHERE id = ?
    LIMIT 1
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!results || results.length === 0)
      return res.status(404).json({ message: "음식을 찾을 수 없음" });

    res.json(results[0]);
  });
});

// ================= 섭취 기록 =================
app.post("/api/records/add", (req, res) => {
  const { user_id, food_id, quantity, record_date, meal_type } = req.body;
  if (!user_id || !food_id || !record_date || !meal_type)
    return res.status(400).json({ message: "필수 항목 누락" });

  const mealMap = {
    아침: "breakfast",
    점심: "lunch",
    저녁: "dinner",
    간식: "snack",
  };
  const dbMealType = mealMap[meal_type];
  if (!dbMealType) return res.status(400).json({ message: "잘못된 meal_type" });

  db.query(
    "INSERT INTO records (user_id, food_id, quantity, record_date, meal_type) VALUES (?, ?, ?, ?, ?)",
    [user_id, food_id, quantity || 1, record_date, dbMealType],
    (err, result) => {
      if (err) return res.status(500).json({ message: "DB 입력 오류" });
      res.json({ message: "추가 완료", id: result.insertId });
    }
  );
});

app.get("/api/records/list", (req, res) => {
  const { user_id, record_date } = req.query;
  if (!user_id || !record_date)
    return res.status(400).json({ message: "user_id와 record_date 필요" });

  db.query(
    `SELECT r.id, f.food_name, f.energy_kcal, r.meal_type 
     FROM records r 
     JOIN foods f ON r.food_id=f.id
     WHERE r.user_id=? AND r.record_date=?`,
    [user_id, record_date],
    (err, results) => {
      if (err) return res.status(500).json({ message: err.message });

      const mealMapReverse = {
        breakfast: "아침",
        lunch: "점심",
        dinner: "저녁",
        snack: "간식",
      };
      const mapped = (results || []).map((r) => ({
        ...r,
        meal_type: mealMapReverse[r.meal_type] || r.meal_type,
      }));
      res.json(mapped);
    }
  );
});

app.delete("/api/records/delete/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM records WHERE id=?", [id], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: "삭제 완료" });
  });
});

app.get("/api/records/summary", (req, res) => {
  const { user_id, record_date } = req.query;
  if (!user_id || !record_date)
    return res.status(400).json({ message: "user_id와 record_date 필요" });

  db.query(
    `SELECT 
       COALESCE(SUM(f.energy_kcal * r.quantity),0) AS total_kcal,
       COALESCE(SUM(f.carbohydrate_g * r.quantity),0) AS total_carbs,
       COALESCE(SUM(f.protein_g * r.quantity),0) AS total_protein,
       COALESCE(SUM(f.fat_g * r.quantity),0) AS total_fat
     FROM records r JOIN foods f ON r.food_id=f.id
     WHERE r.user_id=? AND r.record_date=?`,
    [user_id, record_date],
    (err, results) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(
        results && results[0]
          ? results[0]
          : { total_kcal: 0, total_carbs: 0, total_protein: 0, total_fat: 0 }
      );
    }
  );
});

app.get("/api/weekly-summary", (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ message: "user_id 필요" });

  const sql = `
    SELECT 
      DATE(record_date) AS date,
      ROUND(SUM(f.energy_kcal * r.quantity), 2) AS total_kcal
    FROM records r
    JOIN foods f ON r.food_id = f.id
    WHERE r.user_id = ?
      AND record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(record_date)
    ORDER BY date ASC;
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results || []);
  });
});

// =======================================================
// ✅ 레시피: "제일 쉬운" 해결책 (recipes.jsonl에서 seq로 조회)
// =======================================================

// 🔧 너 FastAPI가 쓰는 recipes.jsonl 위치로 맞춰줘
const RECIPES_JSONL_PATH = path.resolve(
  __dirname,
  "artifacts",
  "recipes.jsonl"
);

// seq -> 레시피 찾아서 반환
function findRecipeBySeqFromJsonl(seq) {
  if (!fs.existsSync(RECIPES_JSONL_PATH)) {
    throw new Error(`recipes.jsonl 파일이 없습니다: ${RECIPES_JSONL_PATH}`);
  }
  const content = fs.readFileSync(RECIPES_JSONL_PATH, "utf-8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      // 파일 구조가 { RCP_SEQ: "31", ... } 형태라고 가정
      if (String(obj.RCP_SEQ) === String(seq)) return obj;
    } catch {
      // 깨진 줄은 스킵
    }
  }
  return null;
}

// ✅ 프론트 RecipeDetail이 쓰는 API (이제 식약처 안감)
app.get("/api/recipes/by-seq/:seq", (req, res) => {
  const seq = String(req.params.seq || "").trim();
  if (!seq) return res.status(400).json({ message: "seq 필요" });

  try {
    const recipe = findRecipeBySeqFromJsonl(seq);
    if (!recipe) {
      return res
        .status(404)
        .json({ message: "해당 SEQ 레시피를 찾을 수 없습니다.", seq });
    }
    return res.json(recipe);
  } catch (e) {
    console.error("로컬 seq 조회 오류:", e.message);
    return res
      .status(500)
      .json({ message: "로컬 레시피 조회 오류", error: e.message });
  }
});

// ✅ 추천은 기존대로 FastAPI 사용 (그대로 유지)
app.post("/api/recommend", async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ message: "message가 필요합니다." });
  }

  if (!process.env.AI_SERVER_URL) {
    return res.status(500).json({
      message: "AI_SERVER_URL 환경변수가 설정되지 않았습니다.",
    });
  }

  try {
    const response = await axios.post(`${process.env.AI_SERVER_URL}/chat`, {
      message,
      top_k: 3,
    });

    return res.json(response.data);
  } catch (err) {
    console.error("AI 추천 오류:", err.message);
    return res.status(500).json({ message: "AI 서버 호출 실패" });
  }
});

// 서버 시작
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log("server listening on", PORT);
});
