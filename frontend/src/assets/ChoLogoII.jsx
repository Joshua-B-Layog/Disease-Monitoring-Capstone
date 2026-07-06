import React from 'react';

const ChoLogoIconII = ({ size = 28 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <circle cx="50" cy="50" r="49" fill="#ffffff" />
    <circle cx="50" cy="50" r="47" fill="none" stroke="#2E9E4C" strokeWidth="4" />
    <circle cx="50" cy="50" r="40" fill="none" stroke="#F0C93E" strokeWidth="1.5" strokeDasharray="2,2" />
    <circle cx="50" cy="50" r="36" fill="#ffffff" stroke="#000000" strokeWidth="1" />

    <g>
      <circle cx="50" cy="26" r="3" fill="none" stroke="#000" strokeWidth="1.2" />
      <rect x="48.5" y="28" width="3" height="4" fill="#D4A017" stroke="#000" strokeWidth="0.5" />
      <path
        d="M50,32
           C40,32 36,42 36,52
           C36,58 34,62 30,66
           L70,66
           C66,62 64,58 64,52
           C64,42 60,32 50,32 Z"
        fill="#F5C518" stroke="#000000" strokeWidth="1.2"
      />
      <path d="M28,66 L72,66 L74,72 L26,72 Z" fill="#E0AE0F" stroke="#000" strokeWidth="1" />
      <ellipse cx="50" cy="72" rx="24" ry="3" fill="#D4A017" stroke="#000" strokeWidth="0.8" />
      <line x1="50" y1="72" x2="50" y2="80" stroke="#000" strokeWidth="1" />
      <circle cx="50" cy="82" r="2" fill="#D4A017" stroke="#000" strokeWidth="0.5" />
    </g>

    <g>
      <rect x="48.7" y="38" width="2.6" height="22" fill="#000000" />
      <path d="M50,38 C44,34 38,36 35,41 C40,41 44,40.5 50,43 Z" fill="#000000" />
      <path d="M50,38 C56,34 62,36 65,41 C60,41 56,40.5 50,43 Z" fill="#000000" />
      <path d="M50,40 C44,45 56,50 50,55 C44,60 56,65 50,68" fill="none" stroke="#000000" strokeWidth="1.6" />
    </g>

    <defs>
      <path id="choTopArcII" d="M 15,50 A 35,35 0 1 1 85,50" />
      <path id="choBottomArcII" d="M 20,68 A 32,32 0 0 0 80,68" />
    </defs>
    <text fontSize="7.2" fontWeight="700" fill="#000000" letterSpacing="0.5">
      <textPath href="#choTopArcII" startOffset="50%" textAnchor="middle">
        CITY HEALTH OFFICE II
      </textPath>
    </text>
    <text fontSize="7.2" fontWeight="700" fill="#000000" letterSpacing="0.5">
      <textPath href="#choBottomArcII" startOffset="50%" textAnchor="middle">
        CITY OF CABUYAO
      </textPath>
    </text>

    <text x="50" y="79" fontSize="6" fontWeight="700" fill="#000000" textAnchor="middle">2012</text>
  </svg>
);

export default ChoLogoIconII;
