#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

async function mdToText(md) {
  const tree = unified().use(remarkParse).parse(md);
  let text = '';
  visit(tree, (node) => {
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') {
      text += node.value + '\n';
    }
  });
  return text.replace(/\n{2,}/g, '\n').trim();
}

function chunk(text, max = 900, overlap = 150) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += (max - overlap)) {
    const slice = words.slice(i, i + max).join(' ');
    if (slice.trim().length > 0) chunks.push(slice);
  }
  return chunks;
}

async function embedAll(chunks) {
  if (!OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in environment');
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const inputs = chunks.map((c) => c.text);
  const res = await client.embeddings.create({ model: OPENAI_EMBEDDING_MODEL, input: inputs });
  return res.data.map((d, i) => ({ ...chunks[i], embedding: d.embedding }));
}

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.isFile() && /\.(md|mdx)$/i.test(e.name)) files.push(full);
  }
  return files;
}

(async () => {
  const root = path.resolve('knowledge');
  const files = fs.existsSync(root) ? await walk(root) : [];
  const chunks = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { content } = matter(raw);
    const text = await mdToText(content);
    const parts = chunk(text);
    parts.forEach((p, idx) => {
      chunks.push({ id: `${path.basename(file)}::${idx}`, text: p, source: file });
    });
  }

  if (chunks.length === 0) {
    console.log('No markdown files found in /knowledge. Creating empty embeddings set.');
  }

  const withEmbeddings = chunks.length ? await embedAll(chunks) : [];
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/embeddings.json', JSON.stringify(withEmbeddings, null, 2));
  console.log(`Wrote data/embeddings.json with ${withEmbeddings.length} chunks.`);
})();
