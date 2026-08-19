import React from 'react';

export default function BackButton({ onClick, children, color, className, style }) {
  return (
    <button
      onClick={onClick}
      className={`back-btn${className ? ' ' + className : ''}`}
      style={{ color: color || undefined, ...style }}
    >
      <svg width="36" height="20" viewBox="0 0 36 20" fill="none"
        stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="10" x2="34" y2="10" />
        <polyline points="16,2 8,10 16,18" />
      </svg>
      {children && <span>{children}</span>}
    </button>
  );
}
