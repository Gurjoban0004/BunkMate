import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import KeyboardWrapper from '../../components/common/KeyboardWrapper';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/theme';

export default function TeacherNamesScreen({ navigation }) {
    const { state, dispatch } = useApp();

    const [teachers, setTeachers] = useState(
        state.subjects.map((sub) => ({
            id: sub.id, name: sub.name, teacher: sub.teacher || '',
        }))
    );

    const updateTeacher = (id, value) => {
        setTeachers((prev) =>
            prev.map((t) => (t.id === id ? { ...t, teacher: value } : t))
        );
    };

    const handleSave = () => {
        teachers.forEach((t) => {
            if (t.teacher.trim()) {
                dispatch({
                    type: 'UPDATE_SUBJECT_TEACHER',
                    payload: { id: t.id, teacher: t.teacher.trim() },
                });
            }
        });
        navigation.navigate('SetupComplete');
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardWrapper contentContainerStyle={styles.scrollContent}>
                <Text style={styles.header}>Teacher Names</Text>
                <Text style={styles.subtitle}>
                    Optional — helps you remember who teaches what
                </Text>

                {teachers.map((item) => (
                    <Card key={item.id} style={styles.card}>
                        <Text style={styles.subjectName}>{item.name}</Text>
                        <Input
                            placeholder="e.g. Prof. Sharma"
                            value={item.teacher}
                            onChangeText={(val) => updateTeacher(item.id, val)}
                        />
                    </Card>
                ))}

                <View style={styles.buttons}>
                    <Button
                        title="Skip"
                        variant="secondary"
                        onPress={() => navigation.navigate('SetupComplete')}
                        style={styles.buttonHalf}
                    />
                    <Button
                        title="Continue"
                        onPress={handleSave}
                        style={styles.buttonHalf}
                    />
                </View>
            </KeyboardWrapper>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xxl,
    },
    header: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
    },
    card: {
        marginBottom: SPACING.cardGap,
    },
    subjectName: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    buttons: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    buttonHalf: {
        flex: 1,
    },
});
