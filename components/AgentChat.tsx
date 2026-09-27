'use client';
import React, { useEffect, useRef, useState, CSSProperties } from 'react';
import { chatThemes, ChatMode, ChatTheme } from '../config/chatThemes';

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

function bubble(isUser: boolean, theme: ChatTheme): CSSProperties {
  return {
    display: 'inline-block',
    padding: '11px 14px',
    borderRadius: '18px',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
    letterSpacing: '-0.01em',
    maxWidth: '100%',
    background: isUser ? theme.userBubbleBackground : theme.assistantBubbleBackground,
    color: isUser ? theme.userBubbleText : theme.assistantBubbleText,
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

export default function AgentChat({ mode = 'dark' }: { mode?: ChatMode }) {
  const theme = chatThemes[mode];
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! I can answer questions about my experience, PM approach, design background, and projects.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

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
    <div style={{ margin: '0 auto', maxWidth: '900px', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'clamp(320px, calc(100dvh - 32px), 680px)',
          boxSizing: 'border-box',
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: '24px',
          padding: '16px',
          backgroundColor: theme.panelBackground,
          boxShadow: theme.panelShadow,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '2px' }}>
          {msgs.map((m, i) => {
            const isUser = m.role === 'user';
            if (isUser) {
              return (
                <div key={i} style={{ textAlign: 'right' }}>
                  <div style={bubble(true, theme)}>{m.content}</div>
                </div>
              );
            }
            // Assistant: remove citations + tidy punctuation; keep markdown links clickable
            const raw = m.content || '';
            const cleaned = stripCitationsAndCleanup(stripSourcesFooter(raw));
            const html = linksToHtml(cleaned);
            return (
              <div key={i} style={{ textAlign: 'left' }}>
                <div
                  className="assistant-message"
                  style={bubble(false, theme)}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            );
          })}
          <div ref={endRef} />
        </div>



        <div style={{ position: 'relative', width: '100%', marginTop: '14px' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
            placeholder="Ask about my experience, projects, or approach…"
            style={{ 
              flex: 1, 
              width: '100%',
              boxSizing: 'border-box',
              minWidth: 0,
              minHeight: '48px',
              padding: '0 90px 0 18px',
              borderRadius: '999px',
              border: `1px solid ${focused ? theme.inputBorderFocused : theme.inputBorder}`,
              background: focused ? theme.inputBackgroundFocused : theme.inputBackground,
              color: theme.inputText,
              font: 'inherit',
              fontSize: '15px',
              outline: 'none',
              boxShadow: focused ? `0 0 0 3px ${theme.inputBorderFocused}20` : '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition: 'border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
            }}
          />
          <button
            className="submit-button"
            onClick={() => void send()}
            disabled={loading}
            aria-label={loading ? 'Sending question' : 'Send question'}
            title="Send question"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '40px',
              height: '40px',
              minHeight: '40px',
              borderRadius: '50%',
              borderStyle: 'solid',
              padding: 0,
              color: theme.buttonText,
              fontWeight: 'bold',
              borderColor: theme.buttonBackground,
              borderWidth: 1,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'default' : 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span className="submit-icon" aria-hidden="true">
              {loading ? (
                '…'
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 14V4M9 4L4.75 8.25M9 4l4.25 4.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>
        </div>

        <style jsx>{`
          input::placeholder {
            color: ${theme.inputPlaceholder};
          }

          .assistant-message :global(a) {
            color: ${theme.linkText};
          }

          .submit-button {
            background: ${theme.buttonBackground};
            box-shadow: 0 3px 9px rgba(0, 0, 0, 0.16);
            isolation: isolate;
            overflow: hidden;
            transform: translateY(0) scale(1);
            transition: box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease;
          }

          .submit-button::before {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 0;
            border-radius: inherit;
            background: ${theme.buttonGradient};
            opacity: 0;
            transition: opacity 180ms ease;
          }

          .submit-icon {
            display: grid;
            place-items: center;
            position: relative;
            z-index: 1;
          }

          .submit-button:not(:disabled):hover::before {
            opacity: 1;
          }

          .submit-button:not(:disabled):hover {
            box-shadow: 0 9px 18px rgba(0, 0, 0, 0.24);
            transform: translateY(0) scale(1);
          }

          .submit-button:not(:disabled):active {
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.16);
            transform: translateY(0) scale(0.98);
          }

          .submit-button:focus-visible {
            outline: 3px solid ${theme.inputBorderFocused};
            outline-offset: 2px;
          }
        `}</style>
      </div>
    </div>
  );
}
