import React from 'react';
import BackArrowSvg from '../assets/back-arrow-thin.svg?react';

export default function BackButton({ onClick, children, color, className, style }) {
  return (
    <button
      onClick={onClick}
      className={`back-btn${className ? ' ' + className : ''}`}
      style={{ color: color || undefined, ...style }}
    >
      <BackArrowSvg width="24" height="24" style={{ fill: 'currentColor' }} />
      {children && <span style={{ fontSize: '18px' }}>{children}</span>}
    </button>
  );
}
