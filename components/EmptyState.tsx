'use client';

import { IconBolt } from './Icons';

const SUGGESTIONS: { emoji: string; title: string; sub: string; prompt: string }[] = [
  {
    emoji: '🌐',
    title: 'Build a landing page',
    sub: 'A complete, modern single-file website I can preview instantly',
    prompt:
      "Build a complete, modern landing page for a coffee shop called “Bean There” — hero section, menu with prices, about section and a contact form. Single self-contained HTML file with inline CSS and JS, smooth animations, responsive design.",
  },
  {
    emoji: '🎮',
    title: 'Make a playable game',
    sub: 'Snake, 2048, memory match — your pick, all in the preview',
    prompt:
      'Create a fully playable Snake game in a single HTML file: keyboard controls, score tracking, high score saved in localStorage, pause on space, and a polished neon design.',
  },
  {
    emoji: '🧠',
    title: 'Explain something',
    sub: 'From NVIDIA NIM microservices to quantum computing',
    prompt:
      'Explain what NVIDIA NIM microservices are and how developers use them, in simple terms with a few concrete examples.',
  },
  {
    emoji: '🐍',
    title: 'Write a script',
    sub: 'Python, bash, TypeScript — with comments and usage examples',
    prompt:
      'Write a Python script that watches a folder and renames every new image file to a kebab-case name with a timestamp prefix. Include comments and a usage example.',
  },
];

export default function EmptyState({ onPick, modelName }: { onPick: (prompt: string) => void; modelName: string }) {
  return (
    <div className="hero">
      <div className="hero-logo">
        <IconBolt size={28} />
      </div>
      <h1>How can I help you today?</h1>
      <p className="hero-sub">
        Chatting with <strong>{modelName}</strong> — powered by the NVIDIA NIM API. Ask anything, or start with one of
        these:
      </p>
      <div className="suggest-grid">
        {SUGGESTIONS.map((s) => (
          <button className="suggest-card" key={s.title} onClick={() => onPick(s.prompt)}>
            <span className="suggest-emoji">{s.emoji}</span>
            <span>
              <span className="suggest-title">{s.title}</span>
              <br />
              <span className="suggest-sub">{s.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
