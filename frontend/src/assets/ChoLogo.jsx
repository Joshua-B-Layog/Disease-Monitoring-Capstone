// frontend/src/assets/ChoLogo.jsx
import React from 'react';

const ChoLogoIcon = ({ size = 28 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    {/* outer white ring */}
    <circle cx="50" cy="50" r="49" fill="#ffffff" />
    <circle cx="50" cy="50" r="49" fill="none" stroke="#000000" strokeWidth="1" />
    {/* navy blue inner circle */}
    <circle cx="50" cy="50" r="42" fill="#1E2A6E" />
    {/* yellow sun rays (8-point star) */}
    <g fill="#FFD400">
      <polygon points="50,14 56,34 44,34" />
      <polygon points="50,86 56,66 44,66" />
      <polygon points="14,50 34,44 34,56" />
      <polygon points="86,50 66,44 66,56" />
      <polygon points="25,25 40,32 32,40" />
      <polygon points="75,75 60,68 68,60" />
      <polygon points="75,25 68,40 60,32" />
      <polygon points="25,75 32,60 40,68" />
    </g>
    {/* yellow center disc */}
    <circle cx="50" cy="50" r="20" fill="#FFD400" />
    {/* caduceus staff */}
    <rect x="48.5" y="30" width="3" height="40" fill="#4FA8D8" stroke="#000" strokeWidth="0.5" />
    <circle cx="50" cy="29" r="3" fill="#4FA8D8" stroke="#000" strokeWidth="0.5" />
    {/* wings */}
    <path d="M50,36 C42,32 34,34 30,40 C36,40 42,39 50,42 Z" fill="#5FAE6E" stroke="#000" strokeWidth="0.5" />
    <path d="M50,36 C58,32 66,34 70,40 C64,40 58,39 50,42 Z" fill="#5FAE6E" stroke="#000" strokeWidth="0.5" />
    {/* snakes */}
    <path d="M50,34 C42,40 58,46 50,52 C42,58 58,64 50,70" fill="none" stroke="#4FA8D8" strokeWidth="2" />
    <path d="M50,34 C58,40 42,46 50,52 C58,58 42,64 50,70" fill="none" stroke="#5FAE6E" strokeWidth="2" />
  </svg>
);

export default ChoLogoIcon;