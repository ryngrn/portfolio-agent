'use client';
import React, { useEffect, useRef, useState, CSSProperties } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

// --- helpers ---------------------------------------------------------------

const htmlMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => htmlMap[c]);
}

// Convert [label](https://url) markdown to safe <a> links (for trailing 🔗 etc.)
function linksToHtml(md: string) {
  const esc = escapeHtml(md);
  return esc.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );
}

// Remove the final “Sources: …” block that lists .md filenames
function stripSourcesFooter(s: string) {
  return s.replace(/\n+Sources:\s[\s\S]*$/i, '');
}

// Remove inline numeric citations like [1], [2]
function stripInlineCitations(s: string) {
  return s.replace(/\s*\[(\d+)\]/g, '');
}

// Heuristic: decide if the answer is a “real” answer (for logging only)
function isConfident(answer: string) {
  const t = (answer || '').toLowerCase();
  const badPhrases = [
    "i don't know","i dont know","i’m not sure","im not sure","i do not know",
    "i don't have enough","i don't have info","can't answer","cannot answer",
    "sorry, something went wrong","i don’t have that information","no sufficient information",
  ];
  if (badPhrases.some(p => t.includes(p))) return false;
  if (t.trim().length < 25) return false;
  return true;
}

function bubble(isUser: boolean): CSSProperties {
  return {
    display: 'inline-block',
    padding: '10px 12px',
    borderRadius: '14px',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
    maxWidth: '100%',
    background: isUser ? '#a6efbb' : '#f3f4f6', // your colors
  };
}

// session asked-questions helpers
function addAskedQuestion(q: string) {
  try {
    const raw = sessionStorage.getItem('askedQuestions');
    const arr = raw ? JSON.parse(raw) : [];
    const set = new Set<string>(Array.isArray(arr) ? arr : []);
    set.add(q.toLowerCase().trim());
    sessionStorage.setItem('askedQuestions', JSON.stringify(Array.from(set)));
  } catch {}
}

// --- component -------------------------------------------------------------

export default function AgentChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! I can answer questions about my experience, PM approach, design background, and projects.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-scroll to newest message
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  // Allow /agent?q=... to prefill and auto-send once
  const prefillOnce = useRef(false);
  useEffect(() => {
    if (prefillOnce.current) return;
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim()) {
      prefillOnce.current = true;
      send(q.trim()); // auto-send the prefilled question
    }
  }, []);

  async function send(override?: string) {
    const content = (override ?? input).trim();
    if (!content) return;
    setInput('');
    addAskedQuestion(content);

    const next = [...msgs, { role: 'user', content } as Msg];
    setMsgs(next);
    setLoading(true);
    try {
      const res = await fetch('/api/audit-feed', { // logging & feed live here
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // quick ping with placeholder to ensure route exists (no-op for POST errors)
        body: JSON.stringify({ question: '__preflight__', answer: '', confident: true, ts: new Date().toISOString(), path: '/agent' })
      }).catch(() => null);
      // ignore response; real log happens after we have the model reply

      const chatRes = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next })
      });
      const data = await chatRes.json();
      const reply = typeof data?.reply === 'string' ? data.reply : 'Sorry, something went wrong.';

      // Compute confidence for logging only (no red styling here)
      const confident = isConfident(reply);
      const finalMsgs = [...next, { role: 'assistant', content: reply } as Msg];
      setMsgs(finalMsgs);

      // Persistent log (does not affect UI if it fails)
      void fetch('/api/audit-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: content,
          answer: reply,
          confident,
          path: typeof window !== 'undefined' ? window.location.pathname : '/agent',
          ts: new Date().toISOString(),
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : ''
        })
      }).catch(() => {});
    } catch {
      const fallback = 'Sorry, something went wrong.';
      setMsgs([...next, { role: 'assistant', content: fallback }]);

      void fetch('/api/audit-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: content,
          answer: fallback,
          confident: false,
          path: typeof window !== 'undefined' ? window.location.pathname : '/agent',
          ts: new Date().toISOString(),
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : ''
        })
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ margin: '0 auto', maxWidth: '900px', width: '100%' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '16px', padding: '12px' }}>
        <div style={{ height: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {msgs.map((m, i) => {
            const isUser = m.role === 'user';
            if (isUser) {
              return (
                <div key={i} style={{ textAlign: 'right' }}>
                  <div style={bubble(true)}>{m.content}</div>
                </div>
              );
            }
            // Assistant: hide Sources footer + inline [1] citations; keep markdown links clickable
            const raw = m.content || '';
            const cleaned = stripInlineCitations(stripSourcesFooter(raw));
            const html = linksToHtml(cleaned);
            return (
              <div key={i} style={{ textAlign: 'left' }}>
                <div style={bubble(false)} dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Ask about my experience, projects, or approach…"
            style={{ flex: 1, padding: '10px 12px', borderRadius: '12px', border: '1px solid #d1d5db' }}
          />
          <button
            onClick={() => send()}
            disabled={loading}
            style={{
              borderRadius: '12px',
              padding: '10px 14px',
              background: '#219a44',
              color: 'white',
              fontWeight: 'bold',
              borderColor: '#219a44',
              borderWidth: 1,
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>

        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
          This agent answers from limited knowledge base. Where available, click <strong>🔗</strong> for source links.
        </p>
      </div>
    </div>
  );
}
