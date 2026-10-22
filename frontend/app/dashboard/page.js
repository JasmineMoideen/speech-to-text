"use client";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newText, setNewText] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/transcriptions?q=${encodeURIComponent(q)}`);
      setItems(await res.json());
      setError("");
    } catch {
      setError("Cannot reach the backend. Is it running on port 4000?");
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!newText.trim()) return;
    await fetch(`${API}/api/transcriptions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText, engine: "manual" }),
    });
    setNewText(""); load();
  }

  async function save(id) {
    await fetch(`${API}/api/transcriptions/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft }),
    });
    setEditId(null); load();
  }

  async function remove(id) {
    if (!confirm("Delete this transcription?")) return;
    await fetch(`${API}/api/transcriptions/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="wrap">
      <h1>Transcription history</h1>
      <p className="sub">Search, correct, add, or delete saved transcriptions.</p>
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <textarea className="search" rows={2} placeholder="Add a transcription manually" value={newText} onChange={(e) => setNewText(e.target.value)} />
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="primary" onClick={create}>Add transcription</button>
        </div>
      </section>

      <input className="search" style={{ marginBottom: 16 }} placeholder="Search transcriptions" value={q} onChange={(e) => setQ(e.target.value)} />

      <section className="panel">
        {items.length === 0 && <p className="hint">No transcriptions yet. Record one from the Record page.</p>}
        {items.map((t) => (
          <div className="row" key={t.id}>
            <div className="meta">
              #{t.id} · {new Date(t.created_at).toLocaleString()} · {t.duration_sec}s · {t.engine}
              {t.updated_at !== t.created_at && " · edited"}
            </div>
            {editId === t.id ? (
              <>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div className="actions">
                  <button className="primary" onClick={() => save(t.id)}>Save changes</button>
                  <button onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p>{t.text}</p>
                <div className="actions">
                  <button onClick={() => { setEditId(t.id); setDraft(t.text); }}>Edit</button>
                  <button className="danger" onClick={() => remove(t.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
