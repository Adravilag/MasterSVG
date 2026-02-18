// Auto-generated example types for icons

export interface IconData {
  name: string;
  body: string;
  viewBox: string;
  animation?: {
    type: string;
    duration: number;
  };
}

export type IconName = string;

export declare const icons: Record<IconName, IconData>;

export declare class IconElement extends HTMLElement {
  name: string;
  size: string;
  color: string;
  animation: string;
}
