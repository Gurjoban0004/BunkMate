/**
 * ResearchPrompt — the two things the research dataset needs from the student.
 *
 *   1. Consent, asked once, after the app already has real ERP data to show for itself.
 *   2. Why a class was missed, asked at most once per app open, only for absences the
 *      register revealed in the last few days.
 *
 * Both are bottom sheets, both are dismissible, neither ever blocks the app. Declining
 * either is remembered so it is not asked again. If the student never consents, this
 * component renders nothing and the app is exactly what it was.
 *
 * Mounted once at the app root next to ErpReauthModal.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, FONT_SIZES, RADIUS, SHADOWS } from '../../theme/theme';
import {
    getResearchId,
    hasAnsweredConsent,
    consentToResearch,
    declineResearch,
} from '../../storage/researchStorage';
import { researchLogReason } from '../../services/erpService';

const ASKED_KEY = '@presence_research_asked';   // "date:subjectId" pairs already answered
const RECENT_DAYS = 3;

export const REASON_OPTIONS = [
    { r: 'slept_in',      label: 'Slept in' },
    { r: 'sick',          label: 'Sick' },
    { r: 'travel',        label: 'Travel / commute' },
    { r: 'chose_to_skip', label: 'Chose to skip' },
    { r: 'clash',         label: 'Clashed with something' },
    { r: 'not_held',      label: 'Class not held' },
    { r: 'other',         label: 'Something else' },
];

const isoDay = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
};

/**
 * The most recent unexplained absence the ERP reported in the last few days.
 * Manual marks are excluded — the student already knows about those, and a
 * prompt about one reads as nagging rather than as a question worth answering.
 */
function findRecentAbsence(state, asked) {
    const recent = new Set(Array.from({ length: RECENT_DAYS }, (_, i) => isoDay(i)));
    const byId = Object.fromEntries((state.subjects || []).map(s => [s.id, s]));

    for (const date of [...recent].sort().reverse()) {
        const day = state.attendanceRecords?.[date];
        if (!day) continue;
        for (const [subjectId, rec] of Object.entries(day)) {
            if (rec.source !== 'erp' || rec.status !== 'absent') continue;
            if (asked.has(`${date}:${subjectId}`)) continue;
            const subject = byId[subjectId];
            if (!subject?.code) continue;
            return { date, subjectId, code: subject.code, name: subject.name };
        }
    }
    return null;
}

export default function ResearchPrompt() {
    const { state } = useApp();
    const [mode, setMode] = useState(null);          // null | 'consent' | 'reason'
    const [absence, setAbsence] = useState(null);
    const [busy, setBusy] = useState(false);

    const hasErpData = Boolean(state.setupComplete && (state.subjects || []).some(s => s.erpSubjectId));

    useEffect(() => {
        if (mode || !hasErpData) return;
        let cancelled = false;

        (async () => {
            if (!(await hasAnsweredConsent())) {
                if (!cancelled) setMode('consent');
                return;
            }
            if (!(await getResearchId())) return;   // declined, or withdrawn

            const raw = await AsyncStorage.getItem(ASKED_KEY);
            const asked = new Set(raw ? JSON.parse(raw) : []);
            const found = findRecentAbsence(state, asked);
            if (found && !cancelled) {
                setAbsence(found);
                setMode('reason');
            }
        })();

        return () => { cancelled = true; };
        // One prompt per app open: this runs when ERP data first lands and not again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasErpData]);

    const close = useCallback(() => { setMode(null); setAbsence(null); }, []);

    const onConsent = async (yes) => {
        setBusy(true);
        try {
            if (yes) await consentToResearch();
            else await declineResearch();
        } finally {
            setBusy(false);
            close();
        }
    };

    const onReason = async (r) => {
        setBusy(true);
        try {
            const researchId = await getResearchId();
            if (researchId && r) {
                await researchLogReason(researchId, { d: absence.date, s: absence.code, r });
            }
            // Remembered whether or not it was answered, so one skip is not asked twice.
            const raw = await AsyncStorage.getItem(ASKED_KEY);
            const asked = raw ? JSON.parse(raw) : [];
            asked.push(`${absence.date}:${absence.subjectId}`);
            await AsyncStorage.setItem(ASKED_KEY, JSON.stringify(asked.slice(-200)));
        } finally {
            setBusy(false);
            close();
        }
    };

    if (!mode) return null;

    return (
        <Modal visible transparent animationType="slide" onRequestClose={close}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {mode === 'consent' ? (
                        <>
                            <Text style={styles.title}>Help with a class project?</Text>
                            <Text style={styles.body}>
                                I'm studying when and why students miss class for a college AI/ML
                                project. If you say yes, your attendance record and timetable get
                                copied under a random ID — no name, no roll number, no login. There
                                is nothing in it that points back at you.
                                {'\n\n'}
                                Nothing about the app changes either way, and you can pull your data
                                out any time from Settings.
                            </Text>
                            <TouchableOpacity
                                style={[styles.primary, busy && styles.disabled]}
                                onPress={() => onConsent(true)}
                                disabled={busy}
                            >
                                <Text style={styles.primaryText}>Count me in</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => onConsent(false)} disabled={busy}>
                                <Text style={styles.decline}>No thanks</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>Missed {absence.name}</Text>
                            <Text style={styles.body}>
                                The portal marked you absent on {absence.date}. What happened?
                            </Text>
                            <View style={styles.options}>
                                {REASON_OPTIONS.map(({ r, label }) => (
                                    <TouchableOpacity
                                        key={r}
                                        style={[styles.option, busy && styles.disabled]}
                                        onPress={() => onReason(r)}
                                        disabled={busy}
                                    >
                                        <Text style={styles.optionText}>{label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity onPress={() => onReason(null)} disabled={busy}>
                                <Text style={styles.decline}>Skip</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.xxl,
        ...SHADOWS.large,
    },
    title: {
        fontWeight: '700',
        fontSize: FONT_SIZES.xl,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    body: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        lineHeight: 21,
        marginBottom: SPACING.xl,
    },
    primary: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    primaryText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: FONT_SIZES.md },
    options: { marginBottom: SPACING.md },
    option: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.sm,
    },
    optionText: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
    decline: {
        textAlign: 'center',
        color: COLORS.textMuted,
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        paddingVertical: SPACING.sm,
    },
    disabled: { opacity: 0.5 },
});
