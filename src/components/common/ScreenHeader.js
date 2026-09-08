import React from 'react';
import { useNavigation } from '@react-navigation/native';
import PaperScreenHeader from './PaperScreenHeader';

/**
 * The pushed-screen header. It used to be its own thing — a flat grey band with
 * a sans title and a bottom rule — which is why Subject detail, Edit timetable
 * and the rest read as a different app from Today.
 *
 * It is now just PaperScreenHeader with the navigation wiring, so every screen
 * in the app sits on the same sheet of paper. The prop shape is unchanged, so
 * none of the five callers needed touching.
 */
export default function ScreenHeader({ title, onPress, showBack = true }) {
    const navigation = useNavigation();
    const canGoBack = showBack && navigation.canGoBack();

    return (
        <PaperScreenHeader
            title={title}
            onBack={canGoBack ? (onPress || (() => navigation.goBack())) : null}
        />
    );
}
