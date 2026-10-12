import React from 'react';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  isSupplier?: boolean;
}

export default function Logo({ size = 32, showWordmark = true, className = '', isSupplier = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          <linearGradient id="skyGradComp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
          <linearGradient id="emeraldGradComp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="60%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <filter id="glowComp" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Arms */}
        <path d="M 120 110 L 210 110 L 392 402 L 302 402 Z" fill="url(#skyGradComp)" />
        <path d="M 392 110 L 302 110 L 120 402 L 210 402 Z" fill="url(#emeraldGradComp)" />

        {/* Center overlay */}
        <path d="M 230 220 L 282 220 L 256 260 Z" fill="#082f49" opacity="0.35" />

        {/* Circuit tracks */}
        <g stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.9">
          <line x1="200" y1="180" x2="312" y2="332" />
          <line x1="312" y1="180" x2="200" y2="332" />
        </g>

        {/* Nodes */}
        <circle cx="200" cy="180" r="14" fill="#38bdf8" stroke="#ffffff" strokeWidth="4" filter="url(#glowComp)" />
        <circle cx="312" cy="180" r="14" fill="#34d399" stroke="#ffffff" strokeWidth="4" filter="url(#glowComp)" />
        <circle cx="256" cy="256" r="16" fill="#ffffff" stroke="#0284c7" strokeWidth="5" />
        <circle cx="200" cy="332" r="14" fill="#38bdf8" stroke="#ffffff" strokeWidth="4" filter="url(#glowComp)" />
        <circle cx="312" cy="332" r="14" fill="#34d399" stroke="#ffffff" strokeWidth="4" filter="url(#glowComp)" />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <span className="font-extrabold tracking-tight text-xl leading-none flex items-center">
          <span className="text-white">Xup</span>
          <span className={isSupplier ? 'text-emerald-300' : 'text-sky-400'}>ply</span>
        </span>
      )}
    </div>
  );
}
