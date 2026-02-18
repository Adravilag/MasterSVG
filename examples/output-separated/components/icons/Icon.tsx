import React from 'react';
import type { IconData } from './types';

type Props = {
  name: string;
  size?: number;
  color?: string;
  variant?: string;
  animation?: string;
};

const Icon: React.FC<Props> = ({ name, size = 24, color = 'currentColor' }) => {
  // Simple placeholder wrapper: real implementation should map `name` to svg body
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <rect width="100%" height="100%" rx="4" fill="rgba(0,0,0,0.05)" />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="8" fill={color}>
        {name}
      </text>
    </svg>
  );
};

export default Icon;
