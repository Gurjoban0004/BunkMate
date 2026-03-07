import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

// Colors now fetched dynamically from COLORS.subjectPalette

export default function SubjectListScreen({ navigation }) {
    const styles = getStyles();
    const { dispatch } = useApp();
    const [subjects, setSubjects] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);

    // Auto-focus on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    const handleAddSubject = (submitText) => {
        const textToUse = typeof submitText === 'string' ? submitText : inputValue;
        const trimmed = textToUse.trim();
        if (!trimmed) {
            if (inputRef.current) inputRef.current.focus();
            return;
        }

        // Prevent exact duplicates
        if (subjects.find(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
            setTimeout(() => setInputValue(''), 0);
            return;
        }

        const newSubject = {
            id: Date.now().toString(),
            name: trimmed,
            color: COLORS.subjectPalette[subjects.length % COLORS.subjectPalette.length],
        };

        setSubjects(prev => [...prev, newSubject]);
        setTimeout(() => setInputValue(''), 0); // Web async safety

        // Keep focus for rapid entry
        if (inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const handleRemoveSubject = (id) => {
        setSubjects(prev => prev.filter(s => s.id !== id));
    };

    const handleContinue = () => {
        if (subjects.length > 0) {
            // Include default stats for now, though they will be handled later
            const subjectsWithStats = subjects.map(s => ({
                ...s,
                initialTotal: 0,
                initialAttended: 0,
            }));

            dispatch({ type: 'SET_SUBJECTS', payload: subjectsWithStats });
            navigation.navigate('TimetableBuilder');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>What subjects do you have?</Text>
                    <Text style={styles.subtitle}>(Type and hit enter)</Text>
                </View>

                {/* List portion */}
                <ScrollView
                    style={styles.listContainer}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                >
                    {subjects.map((subject, index) => (
                        <View key={subject.id} style={styles.subjectRow}>
                            <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                            <Text style={styles.subjectName}>{subject.name}</Text>
                            <TouchableOpacity
                                onPress={() => handleRemoveSubject(subject.id)}
                                style={styles.deleteButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.deleteIcon}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* The Input Row */}
                    <View style={[styles.inputContainer, subjects.length === 0 && styles.inputContainerEmpty]}>
                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder="Add subject..."
                            placeholderTextColor={COLORS.textMuted}
                            value={inputValue}
                            onChangeText={setInputValue}
                            onSubmitEditing={(e) => handleAddSubject(e.nativeEvent.text)}
                            returnKeyType="done"
                            autoCapitalize="words"
                            blurOnSubmit={false} // Prevents keyboard from closing
                        />
                        <TouchableOpacity style={styles.addButton} onPress={handleAddSubject}>
                            <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                    </View>

                    {subjects.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>📝</Text>
                            <Text style={styles.emptyText}>Start typing to build your subject list</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.continueButton,
                            subjects.length === 0 && styles.continueButtonDisabled,
                        ]}
                        onPress={handleContinue}
                        disabled={subjects.length === 0}
                    >
                        <Text style={styles.continueText}>NEXT →</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    title: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
    },
    listContainer: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xl,
    },
    subjectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,


        ...SHADOWS.small,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: SPACING.md,
    },
    subjectName: {
        flex: 1,
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    deleteButton: {
        padding: SPACING.xs,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteIcon: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: 'bold',
    },
    inputContainer: {
        marginTop: SPACING.xs,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,

        borderColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputContainerEmpty: {


        backgroundColor: COLORS.cardBackground,
    },
    input: {
        flex: 1,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    addButton: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 10,
        marginRight: SPACING.xs,
    },
    addButtonText: {
        color: COLORS.textOnPrimary,
        fontWeight: 'bold',
        fontSize: FONT_SIZES.sm,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: SPACING.xxl,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: SPACING.md,
        opacity: 0.8,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
    },
    footer: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xl,
        paddingTop: SPACING.md,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    continueButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: COLORS.border,
    },
    continueText: {
        color: COLORS.textOnPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
});
