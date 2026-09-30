'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: 'grid', 'placeItems': 'center', height: '100dvh', padding: 24, textAlign: 'center' } as React.CSSProperties}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 20, maxWidth: 460 }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button className="btn" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
