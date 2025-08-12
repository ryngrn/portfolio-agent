'use client';
import React, { useState } from 'react';

type Msg = { role: 'user'|'assistant'; content: string };

export default function AgentChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! I can answer questions about my experience, PM approach, design background, and projects.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

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
      setMsgs([...next, { role: 'assistant', content: data.reply }]);
    } catch (e:any) {
      setMsgs([...next, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally { setLoading(false); }
  }

  const bubble = (isUser:boolean) => ({
    display:'inline-block',
    padding:'10px 12px',
    borderRadius:'14px',
    background: isUser ? '#e0ecff' : '#f3f4f6',
    whiteSpace:'pre-wrap'
  } as React.CSSProperties);

  return (
    <div style={{margin:'0 auto', maxWidth:'900px', width:'100%'}}>
      <div style={{border:'1px solid #e5e7eb', borderRadius:'16px', padding:'12px'}}>
        <div style={{height:'420px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px'}}>
          {msgs.map((m, i) => (
            <div key={i} style={{textAlign: m.role==='user' ? 'right' : 'left'}}>
              <div style={bubble(m.role==='user')}>{m.content}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
          <input
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==='Enter') send(); }}
            placeholder="Ask about my experience, projects, or approach…"
            style={{flex:1, padding:'10px 12px', borderRadius:'12px', border:'1px solid #d1d5db'}}
          />
          <button onClick={send} disabled={loading} style={{borderRadius:'12px', padding:'10px 14px', background:'#2563eb', color:'white', opacity: loading?0.6:1}}>
            {loading ? '…' : 'Send'}
          </button>
        </div>
        <p style={{fontSize:'12px', color:'#6b7280', marginTop:'6px'}}>This agent answers from my curated knowledge base and cites sources at the end.</p>
      </div>
    </div>
  );
}
