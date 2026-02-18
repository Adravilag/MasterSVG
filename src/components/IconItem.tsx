import * as React from 'react';
import '../styles/icons.css';

export type IconItemProps = {
  iconId: string;
  label?: string;
  size?: number | string; // e.g. 24 | '1.5rem' | '24px'
  className?: string;
};

export const IconItem: React.FC<IconItemProps> = ({ iconId, label, size = 24, className }) => {
  const sizeVal = typeof size === 'number' ? `${size}px` : size;

  // Inline style for custom CSS variable usage
  const style = { ['--icon-size' as any]: sizeVal } as React.CSSProperties;

  return (
    <div className={`icon-item ${className || ''}`} style={style}>
      <svg aria-hidden="true" role="img">
        <use href={`sprite.svg#${iconId}`} />
      </svg>
      {label && <span>{label}</span>}
    </div>
  );
};

export default IconItem;
