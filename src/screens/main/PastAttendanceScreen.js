import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    TouchableOpacity,
    Alert,
} from 'react-native';
import {} from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getUnmarkedByDate } from '../../utils/backlog';
import Button from '../../components/common/Button';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

export default function PastAttendanceScreen({ navigation }) {
    const { state, dispatch } = useApp();

    const unmarkedByDate = useMemo(() => getUnmarkedByDate(state), [state]);

    const markClass = (date, subjectId, status, units) => {
        dispatch({
            type: 'MARK_ATTENDANCE',
            payload: { date, subjectId, status, units },
        });
    };

    const markAllPresent = () => {
        unmarkedByDate.forEach((group) => {
            group.classes.forEach((c) => {
                dispatch({
                    type: 'MARK_ATTENDANCE',
                    payload: { date: c.date, subjectId: c.subjectId, status: 'present', units: c.units },
                });
            });
        });
    };

    const markAllAbsent = () => {
        unmarkedByDate.forEach((group) => {
            group.classes.forEach((c) => {
                dispatch({
                    type: 'MARK_ATTENDANCE',
                    payload: { date: c.date, subjectId: c.subjectId, status: 'absent', units: c.units },
                });
            });
        });
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}`;
    };

    const formatTime = (time24) => {
        const [h, m] = time24.split(':').map(Number);
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
    };

    if (unmarkedByDate.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>✅</Text>
                    <Text style={styles.emptyText}>All caught up!</Text>
                    <Text style={styles.emptySubtext}>No unmarked classes</Text>
                    <Button
                        title="Back to Today"
                        onPress={() => navigation.goBack()}
                        style={{ marginTop: SPACING.lg }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    const sections = unmarkedByDate.map((group) => ({
        title: `${group.dayName}, ${formatDate(group.date)}`,
        data: group.classes,
    }));

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <SectionList
                sections={sections}
                keyExtractor={(item, idx) => `${item.date}-${item.subjectId}-${idx}`}
                renderSectionHeader={({ section }) => (
                    <Text style={styles.sectionHeader}>{section.title}</Text>
                )}
                renderItem={({ item }) => {
                    const record = state.attendanceRecords[item.date]?.[item.subjectId];
                    const isMarked = !!record;
                    return (
                        <View style={[styles.classRow, isMarked && styles.classRowMarked]}>
                            <View style={styles.classInfo}>
                                <View style={styles.nameRow}>
                                    <View style={[styles.colorDot, { backgroundColor: item.color || COLORS.purple }]} />
                                    <Text style={styles.className}>{item.subjectName}</Text>
                                </View>
                                <Text style={styles.classTime}>
                                    {formatTime(item.startTime)} — {formatTime(item.endTime)} · {item.units} {item.units === 1 ? 'hr' : 'hrs'}
                                </Text>
                            </View>
                            {isMarked ? (
                                <Text style={styles.markedLabel}>
                                    {record.status === 'present' ? '✅' : '❌'} {record.status}
                                </Text>
                            ) : (
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={[styles.smallBtn, styles.presentSmallBtn]}
                                        onPress={() => markClass(item.date, item.subjectId, 'present', item.units)}
                                    >
                                        <Text style={styles.presentSmallText}>✅</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.smallBtn, styles.absentSmallBtn]}
                                        onPress={() => markClass(item.date, item.subjectId, 'absent', item.units)}
                                    >
                                        <Text style={styles.absentSmallText}>❌</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                }}
                ListFooterComponent={
                    <View style={styles.footer}>
                        <View style={styles.bulkActions}>
                            <Button
                                title="Mark All Present"
                                onPress={markAllPresent}
                                style={{ flex: 1 }}
                            />
                            <Button
                                title="Mark All Absent"
                                variant="secondary"
                                onPress={markAllAbsent}
                                style={{ flex: 1 }}
                            />
                        </View>
                        <Button
                            title="Done — Return to Today"
                            variant="secondary"
                            onPress={() => navigation.goBack()}
                            style={{ marginTop: SPACING.sm }}
                        />
                    </View>
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screenPadding,
    },
    listContent: {
        paddingBottom: SPACING.xxl,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    emptyText: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
    },
    emptySubtext: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    sectionHeader: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    classRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    classRowMarked: {
        opacity: 0.6,
    },
    classInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    className: {
        ...TYPOGRAPHY.body,
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    classTime: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 2,
        marginLeft: 12,
    },
    markedLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        textTransform: 'capitalize',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    smallBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    presentSmallBtn: {
        borderColor: COLORS.success,
        backgroundColor: COLORS.successBg,
    },
    absentSmallBtn: {
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerBg,
    },
    presentSmallText: {
        fontSize: 14,
    },
    absentSmallText: {
        fontSize: 14,
    },
    footer: {
        marginTop: SPACING.lg,
    },
    bulkActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
});
