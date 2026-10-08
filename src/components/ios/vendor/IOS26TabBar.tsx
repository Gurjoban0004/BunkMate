import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { IOS26TabBarProps, TabBarItem } from './types';
import './IOS26TabBar.css';

/* useLayoutEffect warns during server rendering. This library targets PWAs,
   but keeping it SSR-safe costs one line and avoids a console error if a host
   app ever pre-renders a route. */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function accessibleNameFor(item: TabBarItem): string {
  if (item.accessibilityLabel) return item.accessibilityLabel;
  if (item.badge !== undefined && item.badge !== null && item.badge !== '') {
    return `${item.label}, ${item.badge} new`;
  }
  return item.label;
}

function hasBadge(item: TabBarItem): boolean {
  return item.badge !== undefined && item.badge !== null && item.badge !== '';
}

/**
 * IOS26TabBar — the iOS 26 floating-capsule tab bar.
 *
 * Controlled: `activeId` and `onChange` are owned by the host app, so the
 * component composes with any router without an adapter.
 *
 * See docs/TAB-BAR-SPEC.md for the provenance of every dimension.
 */
export function IOS26TabBar({
  items,
  activeId,
  onChange,
  variant = 'glass',
  labels = 'always',
  label = 'Main',
  className,
  style,
}: IOS26TabBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const [pill, setPill] = useState({ x: 0, w: 0 });

  // Stable identity for the current set of items, so effects do not re-run on
  // every render when the caller passes a fresh array literal.
  const itemKey = items.map((item) => item.id).join('|');

  /* ---------------------------------------------------------------------
     Pill geometry

     The pill is a sibling of the buttons rather than a child of the active
     one, which is what lets it animate between tabs instead of being torn
     down and rebuilt. Its position therefore has to be measured, since item
     widths are content-driven and differ per label.
     ------------------------------------------------------------------- */
  const measure = useCallback(() => {
    const bar = barRef.current;
    const item = itemRefs.current.get(activeId);
    if (!bar || !item) return;

    const barRect = bar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const insetX = Number.parseFloat(
      getComputedStyle(bar).getPropertyValue('--pill-inset-x'),
    ) || 0;

    const x = itemRect.left - barRect.left + insetX;
    const w = Math.max(0, itemRect.width - insetX * 2);

    setPill((prev) =>
      Math.abs(prev.x - x) < 0.5 && Math.abs(prev.w - w) < 0.5
        ? prev
        : { x, w },
    );
  }, [activeId]);

  // Measure before paint so the pill never appears at 0-width and slides in.
  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure, itemKey]);

  useIsomorphicLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    // ResizeObserver is available in every browser that can run this, but the
    // window-listener path keeps the component working if it is ever polyfilled
    // out of an exotic WebView.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', measure);
      return () => {
        window.removeEventListener('resize', measure);
        window.removeEventListener('orientationchange', measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    itemRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [measure, itemKey]);

  // Web fonts and Dynamic Type both settle after first paint and change label
  // widths, which would leave the pill misaligned until the next resize.
  useEffect(() => {
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready
        .then(() => {
          if (!cancelled) measure();
        })
        .catch(() => {
          /* font loading failed; the ResizeObserver path still applies */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [measure]);

  /* ---------------------------------------------------------------------
     Keyboard — WAI-ARIA tabs pattern with automatic activation.

     Roving tabindex: only the active tab is in the tab order, so Tab moves
     into the bar once and then the arrow keys move between tabs, which is
     what a VoiceOver or switch-control user expects.
     ------------------------------------------------------------------- */
  const handleKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    index: number,
  ) => {
    const total = items.length;
    if (total === 0) return;

    // Walk in the requested direction until an enabled tab is found, so a
    // disabled destination cannot trap keyboard focus.
    const findEnabled = (from: number, direction: 1 | -1): number => {
      let cursor = from;
      for (let step = 0; step < total; step += 1) {
        cursor = (cursor + direction + total) % total;
        const candidate = items[cursor];
        if (candidate && !candidate.disabled) return cursor;
      }
      return from;
    };

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = findEnabled(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = findEnabled(index, -1);
        break;
      case 'Home':
        nextIndex = items.findIndex((item) => !item.disabled);
        break;
      case 'End':
        nextIndex = total - 1 - [...items].reverse().findIndex((item) => !item.disabled);
        break;
      default:
        return;
    }

    const next = items[nextIndex];
    if (!next || nextIndex === index) return;

    event.preventDefault();
    onChange(next.id);
    itemRefs.current.get(next.id)?.focus();
  };

  /* ---------------------------------------------------------------------
     Render
     ------------------------------------------------------------------- */
  const pillStyle = {
    '--pill-x': `${pill.x}px`,
    '--pill-w': `${pill.w}px`,
  } as CSSProperties;

  const rootClassName = className
    ? `ios26-tabbar ${className}`
    : 'ios26-tabbar';

  return (
    <div className="ios26-tabbar-layer">
      <div
        ref={barRef}
        className={rootClassName}
        data-variant={variant}
        data-labels={labels}
        role="tablist"
        aria-label={label}
        style={style}
      >
        <span className="ios26-tabbar__pill" aria-hidden="true" style={pillStyle} />

        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const glyph: ReactNode = isActive
            ? (item.selectedIcon ?? item.icon)
            : item.icon;

          const shared = {
            role: 'tab' as const,
            className: 'ios26-tabbar__item',
            tabIndex: isActive ? 0 : -1,
            'aria-selected': isActive,
            'aria-label': accessibleNameFor(item),
            ref: (element: HTMLElement | null) => {
              itemRefs.current.set(item.id, element);
            },
            onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
              handleKeyDown(event, index),
            onClick: () => {
              if (item.disabled) return;
              onChange(item.id);
            },
          };

          const content = (
            <>
              <span className="ios26-tabbar__glyph">{glyph}</span>
              <span className="ios26-tabbar__label">{item.label}</span>
              {hasBadge(item) ? (
                <span className="ios26-tabbar__badge" aria-hidden="true">
                  {item.badge}
                </span>
              ) : null}
            </>
          );

          if (item.href) {
            return (
              <a
                key={item.id}
                {...shared}
                href={item.disabled ? undefined : item.href}
                aria-disabled={item.disabled || undefined}
              >
                {content}
              </a>
            );
          }

          return (
            <button key={item.id} type="button" {...shared} disabled={item.disabled}>
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
