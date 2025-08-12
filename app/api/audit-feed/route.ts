import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GH_TOKEN  = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const GH_REPO   = process.env.GH_REPO;            // "owner/repo"
const GH_BRANCH = process.env.GH_BRANCH || 'main';
const GH_API    = 'https://api.github.com';

async function ghGet(path: string) {
  const url = `${GH_API}/repos/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    console.error('GH GET failed', { url, status: r.status, body: body?.slice(0,300) });
    throw new Error(`GitHub GET failed: ${r.status}`);
  }
  return r.json();
}

async function ghPut(path: string, content: string, sha?: string) {
  const url = `${GH_API}/repos/${GH_REPO}/contents/${encodeURIComponent(path)}`;
  const bodyObj: any = {
    message: `chore(audit): log Q&A ${new Date().toISOString()}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: GH_BRANCH
  };
  if (sha) bodyObj.sha = sha;

  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' },
    body: JSON.stringify(bodyObj)
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    console.error('GH PUT failed', { url, status: r.status, body: text?.slice(0,300) });
    throw new Error(`GitHub PUT failed: ${r.status}`);
  }
  return r.json();
}

/** POST = append a log line (question/answer) to data/audit/audit-YYYY-MM-DD.jsonl */
export async function POST(req: NextRequest) {
  try {
    if (!GH_TOKEN || !GH_REPO) {
      console.error('Audit missing env', { hasToken: !!GH_TOKEN, GH_REPO, GH_BRANCH });
      return NextResponse.json({ ok: true, skipped: 'Missing GH_TOKEN or GH_REPO' });
    }

    const { question, answer, confident, ts, path, ua } = await req.json();

    const line =
      JSON.stringify({
        ts: ts || new Date().toISOString(),
        path: path || '/agent',
        question,
        answer,
        confident: !!confident,
        ua: ua || ''
      }) + '\n';

    const day = (ts || new Date().toISOString()).slice(0,10);
    const filePath = `data/audit/audit-${day}.jsonl`;

    const existing = await ghGet(filePath);
    if (existing?.content) {
      const current = Buffer.from(existing.content, 'base64').toString('utf8');
      await ghPut(filePath, current + line, existing.sha);
    } else {
      await ghPut(filePath, line);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Audit error', { msg: e?.message, GH_REPO, GH_BRANCH, hasToken: !!GH_TOKEN });
    return NextResponse.json({ ok: true, error: e?.message || 'audit failed' });
  }
}

/** GET = return recent Q&A items (last ~14 days) for your /questions-and-answers page */
type Entry = { ts: string; path?: string; question: string; answer: string; confident?: boolean; ua?: string };

function inferConfidence(ans?: string) {
  if (!ans) return false;
  const t = ans.toLowerCase();
  const bad = [
    "i don't know","i dont know","i’m not sure","im not sure","i do not know",
    "sorry, something went wrong","can't answer","cannot answer","no sufficient information"
  ];
  if (bad.some(p => t.includes(p))) return false;
  return t.trim().length >= 25;
}

export async function GET() {
  try {
    if (!GH_TOKEN || !GH_REPO) {
      return NextResponse.json({ items: [], error: 'Missing GH_TOKEN or GH_REPO' }, { headers: { 'Cache-Control': 'no-store' } });
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
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || 'feed error' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
