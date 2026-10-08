import React from 'react';
import { IOS26TabBar } from './vendor/IOS26TabBar';
import TabIcon from '../../navigation/TabIcon';
import { COLORS, TYPOGRAPHY } from '../../theme/theme';
import './vendor/ios-tokens.css';
import './presence-tabbar.css';

/** The supplied controlled tab bar, themed by Presence rather than OS appearance. */
export default function PresenceTabBar({ tabs, activeTab, onSelect }) {
    return <IOS26TabBar
        items={tabs.map((id) => ({
            id, label: id,
            icon: <TabIcon label={id} focused={activeTab === id} color={activeTab === id ? COLORS.textPrimary : COLORS.textSecondary} />,
        }))}
        activeId={activeTab}
        onChange={onSelect}
        label="Presence main navigation"
        className="presence-main-tabs"
        style={{
            '--ios-font-family': TYPOGRAPHY.captionMedium.fontFamily,
            '--ios-accent': COLORS.textPrimary,
            '--ios-text-secondary': COLORS.textSecondary,
            '--ios-surface-elevated': COLORS.cardBackground,
            '--ios-separator': COLORS.border,
            '--ios-glass-tint': `color-mix(in srgb, ${COLORS.cardBackground} 86%, transparent)`,
            '--ios-glass-rim': COLORS.border,
            '--ios-glass-specular': `color-mix(in srgb, ${COLORS.cardBackground} 80%, transparent)`,
            '--ios-glass-shadow': `0 4px 24px color-mix(in srgb, ${COLORS.shadow} 12%, transparent)`,
            '--presence-selected-surface': COLORS.inputBackground,
            '--pill-rim': COLORS.border,
        }}
    />;
}
