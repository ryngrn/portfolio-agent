import { NextRequest, NextResponse } from 'next/server';

const GH_TOKEN  = process.env.GH_TOKEN || process.env.GITHUB_TOKEN; // PAT with Contents: R/W
const GH_REPO   = process.env.GH_REPO!;    // e.g. "yourname/portfolio-agent"
const GH_BRANCH = process.env.GH_BRANCH || 'main';
const GH_API    = 'https://api.github.com';

async function ghGet(path: string) {
  const r = await fetch(`${GH_API}/repos/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${path} failed: ${r.status}`);
  return r.json();
}

type Entry = {
  ts: string;
  path?: string;
  question: string;
  answer: string;
  confident?: boolean;
  ua?: string;
};

function inferConfidence(ans: string | undefined) {
  if (!ans) return false;
  const t = ans.toLowerCase();
  const bad = [
    "i don't know","i dont know","i’m not sure","im not sure","i do not know",
    "sorry, something went wrong","can't answer","cannot answer","no sufficient information"
  ];
  if (bad.some(p => t.includes(p))) return false;
  return t.trim().length >= 25;
}

export async function GET(_req: NextRequest) {
  try {
    if (!GH_TOKEN || !GH_REPO) {
      return NextResponse.json({ items: [], error: 'Missing GH_TOKEN or GH_REPO' }, { status: 200 });
    }

    const days = 14;
    const files: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      files.push(`data/audit/audit-${d}.jsonl`);
    }

    const items: Entry[] = [];
    for (const path of files) {
      const obj = await ghGet(path);
      if (!obj?.content) continue;
      const text = Buffer.from(obj.content, 'base64').toString('utf8');
      for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        try {
          const e = JSON.parse(s);
          items.push({
            ts: e.ts || new Date().toISOString(),
            path: e.path,
            question: e.question || '',
            answer: e.answer || '',
            confident: typeof e.confident === 'boolean' ? e.confident : inferConfidence(e.answer),
            ua: e.ua || ''
          });
        } catch { /* ignore bad lines */ }
      }
    }

    items.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || 'feed error' }, { status: 200 });
  }
}
