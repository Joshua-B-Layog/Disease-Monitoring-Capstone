import React from 'react';

export default function BackButton({ onClick, children, color, className, style }) {
  return (
    <button
      onClick={onClick}
      className={`back-btn${className ? ' ' + className : ''}`}
      style={{ color: color || undefined, ...style }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.943,5.606,1.024,9.525a3.585,3.585,0,0,0,0,4.95l3.919,3.919a1.5,1.5,0,1,0,2.121-2.121L4.285,13.492l18.25-.023a1.5,1.5,0,0,0,1.5-1.5v0a1.5,1.5,0,0,0-1.5-1.5L4.3,10.492,7.064,7.727A1.5,1.5,0,0,0,4.943,5.606Z"/>
      </svg>
      {children && <span style={{ fontSize: '18px' }}>{children}</span>}
    </button>
  );
}
