import type { CSSProperties, ReactNode } from 'react';

export interface TabBarItem {
  /**
   * Stable identifier. Doubles as the React key and as the value handed to
   * `onChange`. Must be unique within a tab bar.
   */
  id: string;

  /** Visible label. Also the default accessible name. */
  label: string;

  /** Icon node, typically an SVG sized to fill `.ios26-tabbar__glyph`. */
  icon: ReactNode;

  /**
   * Optional alternate glyph for the selected state, mirroring the iOS
   * filled/outline convention. Falls back to `icon` when omitted.
   */
  selectedIcon?: ReactNode;

  /**
   * When set, the item renders as an anchor instead of a button so browser
   * affordances (open in new tab, middle-click) work. Routing is still the
   * host app's job via `onChange`.
   */
  href?: string;

  /**
   * Badge content — a count or a short string. Rendered as a red capsule and
   * folded into the accessible name. Use sparingly; Apple reserves badges for
   * genuinely critical information.
   */
  badge?: string | number;

  /** Blocks interaction and dims the item. */
  disabled?: boolean;

  /**
   * Overrides the computed accessible name entirely, including any badge
   * text. Use when the icon carries meaning the label does not.
   */
  accessibilityLabel?: string;
}

export type TabBarVariant = 'glass' | 'solid';

export type TabBarLabels = 'always' | 'selected' | 'never';

export interface IOS26TabBarProps {
  /** Destinations, in display order. iOS supports a maximum of five. */
  items: readonly TabBarItem[];

  /** Id of the active tab. Controlled — routing owns this value. */
  activeId: string;

  /** Fired when the user activates a tab. */
  onChange: (id: string) => void;

  /**
   * `'glass'` renders the Liquid Glass material. `'solid'` swaps in an opaque
   * surface for very busy backgrounds or as a deliberate Reduce Transparency
   * fallback. Default `'glass'`.
   */
  variant?: TabBarVariant;

  /**
   * `'always'` shows every label (the iOS 26 expanded state, default).
   * `'selected'` shows only the active label — the bar narrows, which is the
   * resting appearance of iOS 26's minimise-on-scroll. `'never'` is icons only.
   */
  labels?: TabBarLabels;

  /** Accessible name for the tab list. Default `'Main'`. */
  label?: string;

  className?: string;
  style?: CSSProperties;
}
