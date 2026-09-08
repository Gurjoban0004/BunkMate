import React from 'react';
import { useNavigation } from '@react-navigation/native';
import PaperScreenHeader from './PaperScreenHeader';

/**
 * The pushed-screen header, with the navigation wiring.
 *
 * Render it as the FIRST CHILD OF THE SCROLLVIEW, not as a sibling above it —
 * a pinned header stays put while the page slides underneath, which reads as
 * two pages sharing a window. Pass `bleed` with whatever horizontal/top padding
 * that scroll container applies, so the sheet still reaches both edges.
 */
export default function ScreenHeader({ title, onPress, showBack = true, bleed }) {
    const navigation = useNavigation();
    const canGoBack = showBack && navigation.canGoBack();

    return (
        <PaperScreenHeader
            title={title}
            bleed={bleed}
            onBack={canGoBack ? (onPress || (() => navigation.goBack())) : null}
        />
    );
}
