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

/**
 * Strip numeric bracket citations completely and tidy punctuation.
 * - Removes [1], [1, 2, 3], [1-3], [1–3]
 * - Removes optional preceding comma/colon/semicolon/dash and spaces
 * - Fixes leftover ", ." and trailing commas at line ends
 * - Removes empty parentheses "()" created by citation removal
 */
function stripCitationsAndCleanup(s: string) {
  let out = s;

  // 1) Remove citations (with optional leading punctuation/spaces)
  out = out.replace(
    /\s*[,;:–-]?\s*\[\s*\d+(?:\s*[-–]\s*\d+|\s*(?:,\s*\d+)+)?\s*\]/g,
    ''
  );

  // 2) Remove commas left immediately before sentence punctuation
  out = out.replace(/,\s*(?=[.!?;:])/g, '');

  // 3) Remove trailing commas at EOL / end of string
  out = out.replace(/,\s*(?=\n|$)/g, '');

  // 4) Remove empty parentheses created by deletions
  out = out.replace(/\(\s*\)/g, '');

  // 5) Normalize spaces around punctuation and collapse doubles
  out = out.replace(/\s+([,.!?;:])/g, '$1'); // no space before punctuation
  out = out.replace(/\s{2,}/g, ' ').trim();

  return out;
}

// Heuristic: decide if the answer is a “real” answer (for logging only)
function isConfident(answer: string) {
  const t = (answer || '').toLowerCase();
  const badPhrases = [
    "i don't know",
    "i dont know",
    "i'm not sure",
    "im not sure",
    "i do not know",
    "i don't have enough",
    "i don't have info",
    "can't answer",
    "cannot answer",
    "sorry, something went wrong",
    "i don't have that information",
    "no sufficient information",
  ];
  if (badPhrases.some((p) => t.includes(p))) return false;
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
    background: isUser ? '#a6efbb' : 'rgba(19,19,19,0.8)',
    color: isUser ? '#131313' : '#ffffff',
  };
}

// Track questions asked this session (for suggestion logic elsewhere)
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
    { role: 'assistant', content: 'Hi! I can answer questions about my experience, PM approach, design background, and projects.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-scroll to newest message
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs]);

  // Allow /agent?q=... to prefill and auto-send once
  const prefillOnce = useRef(false);
  useEffect(() => {
    if (prefillOnce.current) return;
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim()) {
      prefillOnce.current = true;
      void send(q.trim()); // auto-send the prefilled question
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
      // Get agent reply
      const chatRes = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await chatRes.json();
      const reply = typeof data?.reply === 'string' ? data.reply : 'Sorry, something went wrong.';

      // Log confidence (no red styling here in /agent)
      const confident = isConfident(reply);
      const finalMsgs = [...next, { role: 'assistant', content: reply } as Msg];
      setMsgs(finalMsgs);

      // Persistent audit log (POST to your combined route)
      void fetch('/api/audit-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: content,
          answer: reply,
          confident,
          path: typeof window !== 'undefined' ? window.location.pathname : '/agent',
          ts: new Date().toISOString(),
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
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
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ margin: '0 auto', maxWidth: '900px', width: '100%' }}>
      <div style={{ border: '1px solid #666666', borderRadius: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.3)' }}>
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
            // Assistant: remove citations + tidy punctuation; keep markdown links clickable
            const raw = m.content || '';
            const cleaned = stripCitationsAndCleanup(stripSourcesFooter(raw));
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
            placeholder="Ask about my experience, projects, or approach…"
            style={{ flex: 1, padding: '10px 12px', borderRadius: '12px', border: '1px solid #d1d5db' }}
          />
          <button
            onClick={() => void send()}
            disabled={loading}
            style={{
              borderRadius: '12px',
              padding: '10px 14px',
              background: '#219a44',
              color: 'white',
              fontWeight: 'bold',
              borderColor: '#219a44',
              borderWidth: 1,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '…' : 'Ask'}
          </button>
        </div>

        <p style={{ 
          fontSize: '12px',
          color: '#EEEEEE',
          marginTop: '12px',
          textAlign: 'center' as const,
          marginBottom: '2px', }}>
          This agent answers from limited knowledge base. Where available, click <strong>🔗</strong> for source links.
        </p>
      </div>
    </div>
  );
}
