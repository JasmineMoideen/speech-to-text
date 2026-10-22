const { Pool } = require("pg");

let pool;
const fix = (r) => r && { ...r, id: String(r.id) };
const valid = (id) => /^\d+$/.test(id);

module.exports = {
  async init() {
    // Neon connection string already includes ?sslmode=require
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id           SERIAL PRIMARY KEY,
        text         TEXT NOT NULL,
        language     TEXT NOT NULL DEFAULT 'hi+en',
        engine       TEXT NOT NULL DEFAULT 'deepgram',
        duration_sec INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    console.log("Connected to Neon Postgres");
  },
  async list(q) {
    const r = q
      ? await pool.query("SELECT * FROM transcriptions WHERE text ILIKE $1 ORDER BY id DESC", [`%${q}%`])
      : await pool.query("SELECT * FROM transcriptions ORDER BY id DESC");
    return r.rows.map(fix);
  },
  async get(id) {
    if (!valid(id)) return null;
    return fix((await pool.query("SELECT * FROM transcriptions WHERE id = $1", [id])).rows[0]);
  },
  async create({ text, language, engine, duration_sec }) {
    const r = await pool.query(
      "INSERT INTO transcriptions (text, language, engine, duration_sec) VALUES ($1,$2,$3,$4) RETURNING *",
      [text, language, engine, duration_sec]
    );
    return fix(r.rows[0]);
  },
  async update(id, text) {
    if (!valid(id)) return null;
    const r = await pool.query(
      "UPDATE transcriptions SET text = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [text, id]
    );
    return fix(r.rows[0]);
  },
  async remove(id) {
    if (!valid(id)) return false;
    return (await pool.query("DELETE FROM transcriptions WHERE id = $1", [id])).rowCount > 0;
  },
};
