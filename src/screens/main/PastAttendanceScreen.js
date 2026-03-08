import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    TouchableOpacity,
    Alert,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getUnmarkedByDate } from '../../utils/backlog';
import { getSubjectAttendance } from '../../utils/attendance';
import Button from '../../components/common/Button';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import FloatingBackButton from '../../components/common/FloatingBackButton';

export default function PastAttendanceScreen({ navigation }) {
    const styles = getStyles();
    const { state, dispatch } = useApp();

    const unmarkedByDate = useMemo(() => {
        return getUnmarkedByDate(state, true);
    }, [state]);

    const markClass = (date, subjectId, status, units) => {
        dispatch({
            type: 'MARK_ATTENDANCE',
            payload: { date, subjectId, status, units },
        });
        // If it was auto-marked, manual mark also confirms it
        if (state.attendanceRecords[date]?.[subjectId]?.autoMarked) {
            dispatch({ type: 'CONFIRM_AUTO_MARK', payload: { date, subjectId } });
        }
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

    // Calculate metrics for the Summary Card
    const autoMarkedClasses = useMemo(() => {
        const auto = [];
        unmarkedByDate.forEach(group => {
            group.classes.forEach(c => {
                const record = state.attendanceRecords[c.date]?.[c.subjectId];
                if (record?.autoMarked) {
                    auto.push({ ...c, record });
                }
            });
        });
        return auto;
    }, [unmarkedByDate, state.attendanceRecords]);

    const presentCount = autoMarkedClasses.filter(c => c.record.status === 'present').length;
    const totalAutoCount = autoMarkedClasses.length;
    const presentPercentage = totalAutoCount > 0 ? Math.round((presentCount / totalAutoCount) * 100) : 0;

    const handleApproveAll = () => {
        dispatch({ type: 'CONFIRM_ALL_AUTO_MARK' });
        navigation.goBack();
    };

    const handleBulkUpdate = (status) => {
        unmarkedByDate.forEach((group) => {
            group.classes.forEach((c) => {
                dispatch({
                    type: 'MARK_ATTENDANCE',
                    payload: { date: c.date, subjectId: c.subjectId, status, units: c.units },
                });
            });
        });
        // Also confirm any auto-marked ones if we are doing bulk update
        dispatch({ type: 'CONFIRM_ALL_AUTO_MARK' });
        navigation.goBack();
    };

    const handleApproveSingle = (date, subjectId) => {
        dispatch({ type: 'CONFIRM_AUTO_MARK', payload: { date, subjectId } });
    };

    const handleSkipAll = () => {
        dispatch({ type: 'DISMISS_AUTOPILOT_REVIEW' });
        navigation.goBack();
    };

    if (unmarkedByDate.length === 0 && totalAutoCount === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <FloatingBackButton />
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

    if (totalAutoCount > 0 && unmarkedByDate.length === 0) { // All auto-marked are now confirmed and no regular unmarked left
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <FloatingBackButton />
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>🎉</Text>
                    <Text style={styles.emptyText}>All Reviewed!</Text>
                    <Text style={styles.emptySubtext}>Your schedule is up to date.</Text>
                    <Button
                        title="Done — Return to Today"
                        onPress={handleSkipAll}
                        style={{ marginTop: SPACING.xl }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    const holidays = state.holidays || [];

    const toggleHoliday = (dateKey) => {
        if (holidays.includes(dateKey)) {
            dispatch({ type: 'UNDO_HOLIDAY', payload: dateKey });
        } else {
            dispatch({ type: 'MARK_HOLIDAY', payload: dateKey });
        }
    };

    const sections = unmarkedByDate.map((group) => ({
        title: `${group.dayName}, ${formatDate(group.date)}`,
        date: group.date,
        data: group.classes,
    }));

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <FloatingBackButton />
            <SectionList
                sections={sections}
                keyExtractor={(item, idx) => `${item.date}-${item.subjectId}-${idx}`}
                renderSectionHeader={({ section }) => {
                    const isHoliday = holidays.includes(section.date);
                    return (
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionHeader}>{section.title}</Text>
                            <TouchableOpacity
                                style={[styles.holidayBtn, isHoliday && styles.holidayBtnActive]}
                                onPress={() => toggleHoliday(section.date)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.holidayBtnText}>
                                    {isHoliday ? '🏖️ Holiday' : '🏖️'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    );
                }}
                ListHeaderComponent={
                    totalAutoCount > 0 ? (
                        <View style={styles.reviewHero}>
                            <View style={styles.heroRow}>
                                <Text style={styles.heroTitle}>🤖 Autopilot Review</Text>
                                <TouchableOpacity onPress={handleApproveAll} style={styles.heroActionBtn}>
                                    <Text style={styles.heroActionText}>Confirm All</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.heroSubtitle}>Automatically marked {totalAutoCount} classes. Tap cards to adjust.</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => {
                    const record = state.attendanceRecords[item.date]?.[item.subjectId];
                    const isMarked = !!record;
                    const isAutoMarked = record?.autoMarked;

                    if (isAutoMarked) {
                        // Needs Review Card
                        return (
                            <View style={styles.reviewCardItem}>
                                <View style={styles.reviewCardHeader}>
                                    <View style={styles.nameRow}>
                                        <View style={[styles.colorDot, { backgroundColor: item.color || COLORS.primary }]} />
                                        <Text style={styles.className}>{item.subjectName}</Text>
                                    </View>
                                    <View style={styles.autoMarkedBadge}>
                                        <Text style={styles.autoMarkedText}>🤖 Autopilot</Text>
                                    </View>
                                </View>
                                <Text style={styles.classTime}>
                                    {formatTime(item.startTime)} — {formatTime(item.endTime)}
                                </Text>

                                <View style={styles.reviewCardBody}>
                                    <View style={styles.statusSection}>
                                        <Text style={styles.statusLabel}>Marked as</Text>
                                        <View style={[styles.currentStatusBox, record.status === 'present' ? styles.statusPresent : styles.statusAbsent]}>
                                            <Text style={[styles.statusBoxChar, record.status === 'present' ? styles.textPresent : styles.textAbsent]}>
                                                {record.status === 'present' ? 'Present' : 'Absent'}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <TouchableOpacity
                                        style={styles.approveQuickBtn}
                                        onPress={() => handleApproveSingle(item.date, item.subjectId)}
                                    >
                                        <Text style={styles.approveQuickText}>Confirm ✓</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.reviewCardActions}>
                                    <TouchableOpacity
                                        style={[styles.reviewActionBtn, record.status === 'absent' && styles.actionBtnOutline]}
                                        onPress={() => {
                                            markClass(item.date, item.subjectId, 'present', item.units);
                                            handleApproveSingle(item.date, item.subjectId);
                                        }}
                                    >
                                        <Text style={[styles.reviewActionText, record.status === 'present' ? styles.textPresent : {color: COLORS.textPrimary}]}>
                                            {record.status === 'present' ? 'Keep Present' : 'Change to Present'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.reviewActionBtn, record.status === 'present' && styles.actionBtnOutline]}
                                        onPress={() => {
                                            markClass(item.date, item.subjectId, 'absent', item.units);
                                            handleApproveSingle(item.date, item.subjectId);
                                        }}
                                    >
                                        <Text style={[styles.reviewActionText, record.status === 'absent' ? styles.textAbsent : {color: COLORS.textPrimary}]}>
                                            {record.status === 'absent' ? 'Keep Absent' : 'Change to Absent'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }

                    // Normal Unmarked Class
                    return (
                        <View style={[styles.classRow, isMarked && styles.classRowMarked]}>
                            <View style={styles.classInfo}>
                                <View style={styles.nameRow}>
                                    <View style={[styles.colorDot, { backgroundColor: item.color || COLORS.primary }]} />
                                    <Text style={styles.className}>{item.subjectName}</Text>
                                </View>
                                <Text style={styles.classTime}>
                                    {formatTime(item.startTime)} — {formatTime(item.endTime)} · {item.units} {item.units === 1 ? 'hr' : 'hrs'}
                                </Text>
                            </View>
                            {isMarked ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, paddingLeft: SPACING.sm }}>
                                    <View style={styles.markedContainer}>
                                        <Text style={styles.markedLabel}>
                                            {record.status === 'present' ? '✅' : '❌'} {record.status}
                                        </Text>
                                    </View>
                                </View>
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
                        {unmarkedByDate.length > 0 && (
                            <View style={styles.bulkActions}>
                                <TouchableOpacity 
                                    style={[styles.bulkBtn, styles.bulkBtnPresent]} 
                                    onPress={() => handleBulkUpdate('present')}
                                >
                                    <Text style={styles.bulkBtnText}>All Present</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.bulkBtn, styles.bulkBtnAbsent]} 
                                    onPress={() => handleBulkUpdate('absent')}
                                >
                                    <Text style={styles.bulkBtnText}>All Absent</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <Button
                            title="Done — Return"
                            variant="secondary"
                            onPress={() => navigation.goBack()}
                            style={{ marginTop: SPACING.md }}
                        />
                    </View>
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
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
        paddingHorizontal: SPACING.xl,
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
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    sectionHeader: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
    },
    holidayBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.inputBackground,
    },
    holidayBtnActive: {
        backgroundColor: COLORS.successLight,
    },
    holidayBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    classRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.sm,


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

    },
    presentSmallBtn: {
        backgroundColor: COLORS.successLight,
    },
    absentSmallBtn: {
        backgroundColor: COLORS.dangerLight,
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
    markedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    autoMarkedBadge: {
        marginLeft: SPACING.sm,
        paddingHorizontal: 4,
        paddingVertical: 2,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.sm,
    },
    autoMarkedText: {
        fontSize: 12,
    },

    // Gamified UI Styles
    reviewHero: {
        backgroundColor: COLORS.primaryLight,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.lg,
    },
    heroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    heroTitle: {
        ...TYPOGRAPHY.headerSmall,
        fontWeight: '700',
        color: COLORS.primary,
    },
    heroActionBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.sm,
    },
    heroActionText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    heroSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    skipText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        textDecorationLine: 'underline', 
    },
    bulkActions: {
        flexDirection: 'row', 
        gap: SPACING.md,
        marginBottom: SPACING.sm,
    },
    bulkBtn: {
        flex: 1,
        height: 48,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center', 
        ...SHADOWS.small,
    },
    bulkBtnPresent: {
        backgroundColor: COLORS.success,
    },
    bulkBtnAbsent: {
        backgroundColor: COLORS.danger,
    },
    bulkBtnText: {
        fontSize: 14, 
        fontWeight: '700',
        color: '#FFFFFF',
    },
    reviewCardItem: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.warning,
        ...SHADOWS.medium,
    },
    reviewCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    reviewCardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.background,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
    },
    statusSection: {
        flex: 1,
    },
    statusLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    currentStatusBox: {
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },
    statusPresent: {
        backgroundColor: COLORS.successLight,
    },
    statusAbsent: {
        backgroundColor: COLORS.dangerLight,
    },
    statusBoxChar: {
        fontSize: 14,
        fontWeight: '700',
    },
    textPresent: {
        color: COLORS.success,
    },
    textAbsent: {
        color: COLORS.danger,
    },
    approveQuickBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 8,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.full,
    },
    approveQuickText: {
        color: COLORS.textOnPrimary,
        fontWeight: '700',
        fontSize: 14,
    },
    reviewCardActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    reviewActionBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
    },
    actionBtnOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    reviewActionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    undoBtn: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
    undoBtnText: {
        color: COLORS.textSecondary,
        ...TYPOGRAPHY.caption,
        textDecorationLine: 'underline',
    },
    approvedRow: {
        backgroundColor: COLORS.background,
        borderColor: COLORS.successLight,
        borderWidth: 1,
        opacity: 0.8,
    },
    approvedEmoji: {
        marginRight: SPACING.xs,
    },
    approveAllBanner: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        marginBottom: SPACING.lg,
        ...SHADOWS.medium,
    },
    approveAllText: {
        color: COLORS.textOnPrimary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    summaryCard: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.lg,
        ...SHADOWS.small,
    },
    summaryTitle: {
        ...TYPOGRAPHY.headerSmall,
        marginBottom: SPACING.sm,
    },
    summaryStat: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
});
