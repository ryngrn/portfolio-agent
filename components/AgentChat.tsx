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

function bubble(isUser: boolean): CSSProperties {
  return {
    display: 'inline-block',
    padding: '10px 12px',
    borderRadius: '14px',
    background: isUser ? '#a6efbb' : '#f3f4f6',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
    maxWidth: '100%',
  };
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
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs]);

  async function send() {
    const content = input.trim();
    if (!content) return;
    setInput('');
    const next = [...msgs, { role: 'user', content } as Msg];
    setMsgs(next);
    setLoading(true);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next })
      });
      const data = await res.json();
      const reply = typeof data?.reply === 'string' ? data.reply : 'Sorry, something went wrong.';
      setMsgs([...next, { role: 'assistant', content: reply }]);
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
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
            onClick={send}
            disabled={loading}
            style={{
              borderRadius: '12px',
              padding: '10px 14px',
              background: '#219a44',
              color: 'white',
              fontWeight: 'bold',
              borderColor: '#219a44',
              borderWidth: '1',
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
