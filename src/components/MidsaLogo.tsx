import React from 'react';

interface MidsaLogoProps {
  className?: string;
  size?: number;
}

export const MidsaLogo: React.FC<MidsaLogoProps> = ({ className = 'w-10 h-10', size }) => {
  const blue = '#0062C4';
  const charcoal = '#242424';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      className={className}
      width={size}
      height={size}
      fill="none"
      aria-label="MIDSA Logo"
    >
      <defs>
        {/* Clip paths for the three trefoil circles */}
        <clipPath id="midsa-top-circle">
          <circle cx="500" cy="252" r="215" />
        </clipPath>
        <clipPath id="midsa-bl-circle">
          <circle cx="285" cy="624" r="215" />
        </clipPath>
        <clipPath id="midsa-br-circle">
          <circle cx="715" cy="624" r="215" />
        </clipPath>
      </defs>

      {/* 1. TOP CIRCLE (Left: Blue, Right: Charcoal) */}
      <g clipPath="url(#midsa-top-circle)">
        <rect x="250" y="0" width="500" height="500" fill={blue} />
        {/* Charcoal right half, slanted along triangle's right axis */}
        <polygon points="350,-10 750,-10 750,520 650,520" fill={charcoal} />
      </g>

      {/* 2. BOTTOM-LEFT CIRCLE (Lower-Left: Blue, Upper-Right: Charcoal) */}
      <g clipPath="url(#midsa-bl-circle)">
        <rect x="50" y="380" width="500" height="500" fill={blue} />
        {/* Charcoal upper-right half, slanted along triangle's left axis */}
        <polygon points="120,890 510,890 510,380 410,380" fill={charcoal} />
      </g>

      {/* 3. BOTTOM-RIGHT CIRCLE (Top: Blue, Bottom: Charcoal) */}
      <g clipPath="url(#midsa-br-circle)">
        {/* Top half is Blue */}
        <rect x="480" y="380" width="500" height="270" fill={blue} />
        {/* Bottom half is Charcoal */}
        <rect x="480" y="650" width="500" height="250" fill={charcoal} />
      </g>

      {/* 4. CENTRAL GAP (curved negative space) */}
      {/* Mutually tangent circles naturally create the central white/transparent trefoil opening */}

      {/* 5. WHITE STYLIZED "A" / DELTA OVERLAY */}
      {/* Left leg extends from bottom-left through apex */}
      <line
        x1="125"
        y1="895"
        x2="500"
        y2="75"
        stroke="#FFFFFF"
        strokeWidth="60"
        strokeLinecap="butt"
      />

      {/* Right leg from apex down to horizontal crossbar */}
      <line
        x1="500"
        y1="75"
        x2="728"
        y2="685"
        stroke="#FFFFFF"
        strokeWidth="60"
        strokeLinecap="butt"
      />

      {/* Horizontal crossbar extending from left leg across right circle to its rightmost edge */}
      <line
        x1="335"
        y1="685"
        x2="930"
        y2="685"
        stroke="#FFFFFF"
        strokeWidth="60"
        strokeLinecap="butt"
      />

      {/* Sharp white apex cap for clean geometric triangular tip */}
      <polygon points="500,38 468,110 532,110" fill="#FFFFFF" />

      {/* Smooth junction filler where left leg meets horizontal bar */}
      <circle cx="340" cy="685" r="30" fill="#FFFFFF" />
      {/* Smooth junction filler where right leg meets horizontal bar */}
      <circle cx="725" cy="685" r="30" fill="#FFFFFF" />
    </svg>
  );
};
