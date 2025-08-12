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
  if (t.trim().len
