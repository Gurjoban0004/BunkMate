import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

/**
 * One banner at a time.
 *
 * Today can produce four interruptions at once — account-deletion warning, a
 * sign-in card, admin announcement, first-sync welcome — and each one decides for itself
 * whether it has something to say (two of them behind async fetches). Stacked,
 * they push today's actual classes several screens down.
 *
 * So each banner claims a slot instead of rendering directly. The lowest
 * priority number wins; everyone else waits until it's dismissed or resolves.
 * Nothing is lost, it just queues.
 */

const BannerSlotContext = createContext(null);

export const BANNER_PRIORITY = {
    deletion:     0,   // account is going away — outranks everything
    reconnect:    1,   // the college signed us out; syncing is paused until tapped
    announcement: 2,   // admin broadcast
    erpWelcome:   3,   // one-time onboarding; can always wait
};

export function BannerHost({ children }) {
    const [claims, setClaims] = useState([]);

    const value = useMemo(() => ({
        claim: (priority) => setClaims(c => (c.includes(priority) ? c : [...c, priority])),
        release: (priority) => setClaims(c => c.filter(p => p !== priority)),
        winner: claims.length ? Math.min(...claims) : null,
    }), [claims]);

    return <BannerSlotContext.Provider value={value}>{children}</BannerSlotContext.Provider>;
}

/**
 * @param priority one of BANNER_PRIORITY
 * @param wantsToRender false when the banner has nothing to say, so it doesn't
 *        hold the slot shut against lower-priority banners
 * @returns whether this banner is the one allowed to render right now
 */
export function useBannerSlot(priority, wantsToRender) {
    const ctx = useContext(BannerSlotContext);

    useEffect(() => {
        if (!ctx) return;
        if (wantsToRender) {
            ctx.claim(priority);
            return () => ctx.release(priority);
        }
        ctx.release(priority);
        return undefined;
        // ctx identity changes on every claim; depending on it would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [priority, wantsToRender]);

    // Outside a host (other screens reusing these banners) everyone renders.
    if (!ctx) return wantsToRender;
    return wantsToRender && ctx.winner === priority;
}
