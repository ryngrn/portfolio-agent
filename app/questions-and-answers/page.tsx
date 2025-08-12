'use client';
import React, { useEffect, useMemo, useState } from 'react';

type QA = { ts: string; question: string; answer: string; confident?: boolean };

const GREEN = '#219a44';

const SUGGESTIONS = [
  "What is Ryan's design process like?",
  "How does Ryan measure success on a feature?",
  "Tell me about the Nstyle design system.",
  "How does Ryan partner with engineering?",
  "What are Ryan’s top projects to look at?",
  "How does Ryan approach discovery and research?",
  "What outcomes did Ryan drive at Ncontracts?",
  "What’s Ryan’s philosophy on design systems?",
  "How does Ryan de-risk ideas before shipping?"
];

function alreadyAskedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem('askedQuestions');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map((x: string) => x.toLowerCase().trim()) : []);
  } catch { return new Set(); }
}

function pickSuggestion(asked: Set<string>, avoid: string) {
  const avoidLC = (avoid || '').toLowerCase().trim();
  const pool = SUGGESTIONS.filter(s => {
    const lc = s.toLowerCase().trim();
    return lc !== avoidLC && !asked.has(lc);
  });
  if (pool.length === 0) return null;
  // rotate pseudo-randomly
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

export default function QuestionsAndAnswersPage() {
  const [data, setData] = useState<QA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch('/api/audit-feed', { cache: 'no-store' });
        const j = await r.json();
        setData(Array.isArray(j?.items) ? j.items : []);
      } catch { setData([]); }
      setLoading(false);
    };
    run();
  }, []);

  const asked = useMemo(() => alreadyAskedSet(), [data]); // refreshes when data changes

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Questions & Answers</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Live feed of user questions and the agent’s answers.</p>

      {loading ? <p>Loading…</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.map((item, i) => {
            const ts = new Date(item.ts);
            const date = isNaN(+ts) ? item.ts : ts.toLocaleString();
            const weak = item.confident === false;
            const sugg = weak ? pickSuggestion(asked, item.question) : null;

            return (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{date}</div>
                {/* Question */}
                <div style={{
                  background: weak ? '#fee2e2' : '#a6efbb',
                  color: weak ? '#991b1b' : 'inherit',
                  border: `1px solid ${weak ? '#ef4444' : 'transparent'}`,
                  borderRadius: 14,
                  padding: '10px 12px',
                  marginBottom: 6
                }}>
                  <strong>Q:</strong> {item.question}
                </div>
                {/* Answer */}
                <div style={{
                  background: '#f3f4f6',
                  borderRadius: 14,
                  padding: '10px 12px',
                  whiteSpace: 'pre-wrap'
                }}>
                  <strong>A:</strong> {item.answer}
                </div>

                {/* Suggest a follow-up if answer was weak */}
                {weak && sugg && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ color: '#6b7280', marginRight: 6 }}>
                      I don’t have info on that. Would you like to know
                    </span>
                    <a
                      href={`/agent?q=${encodeURIComponent(sugg)}`}
                      style={{ color: GREEN, textDecoration: 'underline', fontWeight: 600 }}
                    >
                      {sugg}
                    </a>
                    <span>?</span>
                  </div>
                )}
              </div>
            );
          })}
          {data.length === 0 && <p>No logs yet.</p>}
        </div>
      )}
    </main>
  );
}
