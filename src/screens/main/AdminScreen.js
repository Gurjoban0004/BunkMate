import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Switch, ActivityIndicator, Platform, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, TABULAR } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import {
    getAdminConfig, updateAdminConfig,
    fetchOverview, fetchSessionEvents, fetchSubjectDifficulty,
    fetchBunkCultureIndex, fetchBatchDistribution,
    fetchEndpointHealth, fetchParserFailures,
    fetchDowntime, fetchRateLimitData, fetchUserRoster,
    getActiveAnnouncements, publishAnnouncement, deleteAnnouncement,
    getRevokedUsers, revokeUser, unrevokeUser, listAuditLog, purgeUnfinishedSignups,
} from '../../services/adminService';
import { showAlert, confirmAction } from '../../utils/alert';
import { formatRelativeTime } from '../../utils/dateHelpers';

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'students', label: 'Students' },
    { key: 'health', label: 'Health' },
    { key: 'controls', label: 'Controls' },
];

const REASON_COPY = {
    dead: 'college ended the session',
    stale: 'session older than a year',
    invalid_token: 'token from an older app version',
    no_persistent: 'no saved sign-in on the device',
    expired: 'saved sign-in expired',
};

// ─── Small pieces ────────────────────────────────────────────────────
function PanelIcon({ name, color, size = 16 }) {
    const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
    const glyphs = {
        difficulty: <><Circle cx="12" cy="12" r="8.5" {...p} /><Circle cx="12" cy="12" r="3.5" {...p} /></>,
        'trending-down': <><Polyline points="3 7 10 14 14 10 21 17" {...p} /><Polyline points="21 12 21 17 16 17" {...p} /></>,
        users: <><Path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" {...p} /><Circle cx="9" cy="7" r="3.2" {...p} /><Path d="M16.5 6.3a3.2 3.2 0 0 1 0 5.4" {...p} /><Path d="M22 19v-1a4 4 0 0 0-3-3.8" {...p} /></>,
        activity: <Polyline points="3 12 7 12 10 4 14 20 17 12 21 12" {...p} />,
        alert: <><Path d="M12 3.5 21 19H3z" {...p} /><Line x1="12" y1="10" x2="12" y2="14" {...p} /><Line x1="12" y1="16.6" x2="12" y2="16.6" {...p} /></>,
        zap: <Path d="M13 2 4 14h7l-1 8 9-12h-7z" {...p} />,
        gauge: <><Path d="M4 18a8 8 0 1 1 16 0" {...p} /><Line x1="12" y1="18" x2="16" y2="11" {...p} /></>,
        megaphone: <><Path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" {...p} /><Path d="M14 8a4 4 0 0 1 0 8" {...p} /></>,
        sliders: <><Line x1="4" y1="8" x2="20" y2="8" {...p} /><Line x1="4" y1="16" x2="20" y2="16" {...p} /><Circle cx="9" cy="8" r="2.6" {...p} fill={color} /><Circle cx="15" cy="16" r="2.6" {...p} fill={color} /></>,
        shield: <Path d="M12 3l7 3v5c0 4-3 7.4-7 8-4-.6-7-4-7-8V6z" {...p} />,
        wrench: <Path d="M14.6 6.4a3.6 3.6 0 0 0-4.9 4.2l-5.4 5.4a1.5 1.5 0 0 0 2.1 2.1l5.4-5.4a3.6 3.6 0 0 0 4.2-4.9l-2.1 2.1-1.4-1.4z" {...p} />,
        lock: <><Rect x="5" y="11" width="14" height="9" rx="2" {...p} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} /></>,
        search: <><Circle cx="11" cy="11" r="7" {...p} /><Line x1="16" y1="16" x2="21" y2="21" {...p} /></>,
        refresh: <><Path d="M23 4v6h-6" {...p} /><Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" {...p} /></>,
        key: <><Circle cx="8" cy="15" r="4" {...p} /><Path d="M10.8 12.2 20 3l2 2-3 3-2-2 2-2" {...p} /></>,
        list: <><Line x1="8" y1="6" x2="21" y2="6" {...p} /><Line x1="8" y1="12" x2="21" y2="12" {...p} /><Line x1="8" y1="18" x2="21" y2="18" {...p} /><Circle cx="4" cy="6" r="1" {...p} fill={color} /><Circle cx="4" cy="12" r="1" {...p} fill={color} /><Circle cx="4" cy="18" r="1" {...p} fill={color} /></>,
    };
    return <Svg width={size} height={size} viewBox="0 0 24 24">{glyphs[name] || null}</Svg>;
}

function Panel({ icon, title, accent, statusText, children }) {
    const styles = getStyles();
    const a = accent || COLORS.primary;
    return (
        <View style={styles.panel}>
            <View style={styles.panelHeader}>
                <View style={[styles.panelIcon, { backgroundColor: a + '1F' }]}><PanelIcon name={icon} color={a} size={16} /></View>
                <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
                {!!statusText && (
                    <View style={[styles.panelPill, { borderColor: a + '55' }]}><Text style={[styles.panelPillText, { color: a }]}>{statusText}</Text></View>
                )}
            </View>
            <View style={styles.panelBody}>{children}</View>
        </View>
    );
}

function Sparkline({ data, color, width = 300, height = 40 }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const step = width / (data.length - 1);
    const points = data.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');
    return (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={points} />
        </Svg>
    );
}

function Bar({ value, maxVal, color, label, right }) {
    const styles = getStyles();
    const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
    return (
        <View style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
            <Text style={styles.barValue}>{right ?? `${value.toFixed(0)}%`}</Text>
        </View>
    );
}

function Loadable({ load, loading, error, onRetry, children }) {
    const styles = getStyles();
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="small" color={COLORS.primary} /><Text style={styles.loadingText}>Loading…</Text></View>;
    }
    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
                {onRetry && <TouchableOpacity onPress={onRetry} style={styles.retryBtn}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity>}
            </View>
        );
    }
    return <>{children}</>;
}

function Kpi({ label, value, tone }) {
    const styles = getStyles();
    const color = tone === 'good' ? COLORS.successText : tone === 'bad' ? COLORS.dangerText : tone === 'warn' ? COLORS.warningText : COLORS.textPrimary;
    return (
        <View style={styles.kpiCell}>
            <Text style={[styles.kpiValue, TABULAR, { color }]}>{value ?? '—'}</Text>
            <Text style={styles.kpiLabel}>{label}</Text>
        </View>
    );
}

function Empty({ children }) {
    const styles = getStyles();
    return <Text style={styles.emptyText}>{children}</Text>;
}

// A metric with its own loading/error state, re-usable per panel.
function useMetric(fetcher) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const load = useCallback(async (force = false) => {
        if (loading) return;
        if (data && !force) return;
        setLoading(true);
        setError(null);
        try {
            setData(await fetcher(force));
        } catch (e) {
            setError(e?.message || 'Failed to load');
            throw e;
        } finally {
            setLoading(false);
        }
    }, [fetcher, data, loading]);
    return { data, setData, loading, error, load };
}

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : 'Never');
const fmtWhen = (ms) => (ms ? formatRelativeTime(ms) : '—');

// ─── Screen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
    const styles = getStyles();
    const { state } = useApp();
    const roll = state.erpRollNumber;
    const [tab, setTab] = useState('overview');
    const [refreshing, setRefreshing] = useState(false);
    const [forceRefreshing, setForceRefreshing] = useState(false);

    // Config
    const [config, setConfig] = useState(null);
    const [configError, setConfigError] = useState(null);
    const [flags, setFlags] = useState({});
    const [minVersion, setMinVersion] = useState('');
    const [maintMode, setMaintMode] = useState(false);
    const [maintMsg, setMaintMsg] = useState('');

    // Metrics
    const overview = useMetric(useCallback((f) => fetchOverview(f), []));
    const roster = useMetric(useCallback((f) => fetchUserRoster(roll, f), [roll]));
    const sessions = useMetric(useCallback((f) => fetchSessionEvents(f), []));
    const difficulty = useMetric(useCallback((f) => fetchSubjectDifficulty(roll, f), [roll]));
    const bunk = useMetric(useCallback((f) => fetchBunkCultureIndex(roll, f), [roll]));
    const batches = useMetric(useCallback((f) => fetchBatchDistribution(f), []));
    const endpoints = useMetric(useCallback((f) => fetchEndpointHealth(roll, f), [roll]));
    const failures = useMetric(useCallback((f) => fetchParserFailures(roll, f), [roll]));
    const downtime = useMetric(useCallback((f) => fetchDowntime(roll, f), [roll]));
    const rate = useMetric(useCallback((f) => fetchRateLimitData(roll, f), [roll]));
    const announcements = useMetric(useCallback(() => getActiveAnnouncements(), []));
    const revoked = useMetric(useCallback(() => getRevokedUsers(), []));
    const audit = useMetric(useCallback(() => listAuditLog(), []));

    // Students tab
    const [query, setQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [purging, setPurging] = useState(false);

    // Controls forms
    const [annTitle, setAnnTitle] = useState('');
    const [annBody, setAnnBody] = useState('');
    const [annType, setAnnType] = useState('info');
    const [revokeRoll, setRevokeRoll] = useState('');
    const [revokeReason, setRevokeReason] = useState('');

    const loadConfig = useCallback(async () => {
        setConfigError(null);
        try {
            const c = await getAdminConfig();
            setConfig(c);
            setFlags(c.featureFlags || {});
            setMinVersion(c.minVersion || '2.0.0');
            setMaintMode(!!c.maintenanceMode);
            setMaintMsg(c.maintenanceMessage || '');
        } catch (e) {
            setConfigError(e?.message || 'Could not load the remote config.');
        }
    }, []);

    useEffect(() => { loadConfig(); overview.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const tabMetrics = {
        overview: [overview, difficulty, bunk, batches],
        students: [roster, revoked],
        health: [endpoints, downtime, sessions, failures, rate],
        controls: [announcements, revoked, audit],
    };

    const reloadMany = async (metrics, force) => {
        const results = await Promise.all(metrics.map((m) => m.load(force).then(() => true).catch(() => false)));
        return results.filter(Boolean).length;
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try { await Promise.all([loadConfig(), reloadMany(tabMetrics[tab] || [], true)]); } finally { setRefreshing(false); }
    };

    const handleForceRefreshAll = async () => {
        setForceRefreshing(true);
        const all = [overview, roster, sessions, difficulty, bunk, batches, endpoints, failures, downtime, rate, announcements, revoked, audit];
        try {
            const ok = await reloadMany(all, true);
            showAlert(ok === all.length ? 'Refreshed' : 'Partly refreshed', ok === all.length ? 'Every panel reloaded from the server.' : `${ok} of ${all.length} panels reloaded; the rest show their own error.`);
        } finally {
            setForceRefreshing(false);
        }
    };

    // ── Actions ──────────────────────────────────────────────────
    const run = async (mutate, successMessage) => {
        try {
            const result = await mutate();
            if (successMessage) showAlert(successMessage);
            audit.load(true).catch(() => {});
            return result ?? true;
        } catch (e) {
            showAlert('Action failed', e?.message || 'The server rejected the request.');
            return undefined;
        }
    };

    const handleToggleFlag = async (key, val) => {
        const previous = flags;
        const next = { ...flags, [key]: val };
        setFlags(next);
        const ok = await run(() => updateAdminConfig(roll, { featureFlags: next }));
        if (!ok) setFlags(previous);
    };

    const handlePublishVersion = async () => {
        const version = minVersion.trim();
        if (!/^\d+\.\d+\.\d+$/.test(version)) return showAlert('Invalid version', 'Use three numbers, like 2.1.0.');
        if (!await confirmAction('Publish version gate?', `Everyone below v${version} will be blocked until they update.`, 'Publish')) return;
        await run(() => updateAdminConfig(roll, { minVersion: version }), 'Version gate updated');
    };

    const handleToggleMaintenance = async (val) => {
        if (val && !await confirmAction('Enable maintenance mode?', 'Every non-admin user will be locked out until you turn this off.', 'Enable')) return;
        const previous = maintMode;
        setMaintMode(val);
        const ok = await run(() => updateAdminConfig(roll, { maintenanceMode: val, maintenanceMessage: maintMsg }), val ? 'Maintenance mode ON' : 'Maintenance mode OFF');
        if (!ok) setMaintMode(previous);
    };

    const handlePublishAnnouncement = async () => {
        if (!annTitle.trim() || !annBody.trim()) return showAlert('Incomplete', 'Both a title and a message are required.');
        const ann = await run(() => publishAnnouncement(roll, { title: annTitle, message: annBody, type: annType, expiryHours: 72 }), 'Announcement published');
        if (!ann) return;
        announcements.setData((prev) => [ann, ...(prev || [])]);
        setAnnTitle(''); setAnnBody('');
    };

    const handleDeleteAnnouncement = async (id) => {
        if (!await run(() => deleteAnnouncement(roll, id), 'Announcement removed')) return;
        announcements.setData((prev) => (prev || []).filter((a) => a.id !== id));
    };

    const handleRevoke = async (targetRoll = null, reasonText = null) => {
        const target = (targetRoll || revokeRoll).trim();
        const reason = (reasonText || revokeReason).trim();
        if (!target) return showAlert('Nothing to revoke', 'Enter a roll number first.');
        if (target === String(roll || '').trim()) return showAlert('Not allowed', 'You cannot revoke your own access.');
        if (!await confirmAction('Revoke access?', `${target} will be locked out of Presence until reinstated.`)) return;
        if (!await run(() => revokeUser(roll, target, reason), 'Access revoked')) return;
        revoked.setData((prev) => [...(prev || []).filter((r) => r.rollNumber !== target), { rollNumber: target, reason: reason || 'No reason provided' }]);
        if (!targetRoll) { setRevokeRoll(''); setRevokeReason(''); }
    };

    const handleUnrevoke = async (target) => {
        if (!await run(() => unrevokeUser(roll, target), 'Access reinstated')) return;
        revoked.setData((prev) => (prev || []).filter((r) => r.rollNumber !== target));
    };

    const handlePurge = async () => {
        const count = roster.data?.unfinished?.olderThan7d ?? overview.data?.unfinishedOlderThan7d ?? 0;
        if (!await confirmAction(
            'Delete unfinished sign-ups?',
            `${count} login code${count === 1 ? '' : 's'} never connected a college account and ${count === 1 ? 'has' : 'have'} been idle for over a week. They hold no attendance data. A student who comes back simply starts onboarding again.`,
            'Delete',
        )) return;
        setPurging(true);
        try {
            const result = await run(() => purgeUnfinishedSignups(7));
            if (result) {
                showAlert('Cleaned up', `Deleted ${result.deleted}. ${result.remaining > 0 ? `${result.remaining} more are newer than a week or beyond this batch.` : 'Nothing left to clean.'}`);
                await Promise.all([roster.load(true).catch(() => {}), overview.load(true).catch(() => {})]);
            }
        } finally {
            setPurging(false);
        }
    };

    // ── Derived ──────────────────────────────────────────────────
    const revokedSet = useMemo(() => new Set((revoked.data || []).map((r) => r.rollNumber)), [revoked.data]);
    const students = roster.data?.users || [];
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return students;
        return students.filter((u) => String(u.rollNumber).toLowerCase().includes(q) || String(u.studentName).toLowerCase().includes(q));
    }, [students, query]);

    const adminName = (state.userName || 'Admin').split(' ')[0];
    const o = overview.data;
    const unfinishedOld = roster.data?.unfinished?.olderThan7d ?? o?.unfinishedOlderThan7d ?? 0;
    const unfinishedAll = roster.data?.unfinished?.count ?? o?.unfinishedSignups ?? 0;

    const endpointColor = (r) => (r >= 95 ? COLORS.success : r >= 85 ? COLORS.warning : COLORS.danger);
    const difficultyColor = (r) => (r >= 35 ? COLORS.danger : r >= 15 ? COLORS.warning : COLORS.success);
    const rateColor = (s) => (s === 'restricted' ? COLORS.danger : s === 'warning' ? COLORS.warning : COLORS.success);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textMuted} />}
            >
                {/* Header */}
                <View style={styles.hero}>
                    <View style={styles.heroControlsRow}>
                        <TouchableOpacity style={styles.refreshBtn} onPress={handleForceRefreshAll} disabled={forceRefreshing} activeOpacity={0.7}>
                            {forceRefreshing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <PanelIcon name="refresh" color={COLORS.primary} size={14} />}
                            <Text style={styles.refreshBtnText}>{forceRefreshing ? 'Refreshing…' : 'Refresh all'}</Text>
                        </TouchableOpacity>
                        <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.livePillText}>LIVE</Text></View>
                    </View>
                    <Text style={styles.heroEyebrow}>ADMIN</Text>
                    <Text style={styles.heroTitle}>Hello, {adminName}</Text>

                    <View style={styles.kpiRow}>
                        <Kpi label="STUDENTS" value={o?.students} />
                        <Kpi label="CONNECTED" value={o?.connected} />
                        <Kpi label="TODAY" value={o?.dau} />
                        <Kpi label="THIS WEEK" value={o?.wau} />
                    </View>
                    {overview.loading && !o && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: SPACING.sm }} />}
                    {overview.error && <Text style={styles.heroError}>{overview.error}</Text>}
                    {o?.sparkline?.length > 1 && (
                        <View style={styles.heroSpark}>
                            <Text style={styles.heroSparkLabel}>STUDENTS SYNCING PER DAY — LAST 7 DAYS</Text>
                            <Sparkline data={o.sparkline} color={COLORS.primary} width={320} height={44} />
                        </View>
                    )}
                </View>

                {/* Tabs */}
                <View style={styles.catRow}>
                    {TABS.map((t) => (
                        <TouchableOpacity key={t.key} style={[styles.catTab, tab === t.key && styles.catTabActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
                            <Text style={[styles.catTabText, tab === t.key && styles.catTabTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ══ OVERVIEW ══ */}
                {tab === 'overview' && (
                    <>
                        <Panel icon="activity" title="Right now" accent={COLORS.primary} statusText={o ? `cached ${fmtWhen(overview.data && Date.now())}` : ''}>
                            <Loadable load={overview.load} loading={overview.loading && !o} error={overview.error} onRetry={() => overview.load(true)}>
                                {o && (
                                    <>
                                        <View style={styles.kpiRow}>
                                            <Kpi label="AVG ATTENDANCE" value={o.avgAttendancePct != null ? `${o.avgAttendancePct}%` : '—'} tone={o.avgAttendancePct != null && o.avgAttendancePct < 75 ? 'bad' : 'good'} />
                                            <Kpi label="BELOW GOAL" value={o.belowGoalStudents} tone={o.belowGoalStudents > 0 ? 'warn' : 'good'} />
                                            <Kpi label="SYNCS 24H" value={o.syncs24h} />
                                            <Kpi label="SUCCESS 24H" value={o.successRate24h != null ? `${o.successRate24h.toFixed(0)}%` : '—'} tone={o.successRate24h == null ? undefined : o.successRate24h >= 95 ? 'good' : o.successRate24h >= 85 ? 'warn' : 'bad'} />
                                        </View>
                                        <View style={[styles.kpiRow, { marginTop: SPACING.xs }]}>
                                            <Kpi label="ACTIVE 30D" value={o.mau} />
                                            <Kpi label="SIGN-IN ASKS 7D" value={o.signInPrompts7d} tone={o.signInPrompts7d > 0 ? 'warn' : 'good'} />
                                            <Kpi label="LOST SIGN-INS 7D" value={o.signInLost7d} tone={o.signInLost7d > 0 ? 'bad' : 'good'} />
                                            <Kpi label="WITH NUMBERS" value={o.studentsWithNumbers} />
                                        </View>
                                        <Text style={styles.noteText}>
                                            {o.unfinishedSignups > 0
                                                ? `${o.unfinishedSignups} login code${o.unfinishedSignups === 1 ? '' : 's'} never connected a college account (${o.unfinishedOlderThan7d} idle over a week). They are not counted above.`
                                                : 'No unfinished sign-ups.'}
                                        </Text>
                                        {o.unfinishedOlderThan7d > 0 && (
                                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.inputBackground }]} onPress={handlePurge} disabled={purging}>
                                                <Text style={[styles.actionBtnText, { color: COLORS.textPrimary }]}>{purging ? 'Deleting…' : `Delete ${o.unfinishedOlderThan7d} idle sign-ups`}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </Loadable>
                        </Panel>

                        <Panel icon="difficulty" title="Subjects by miss rate" accent={COLORS.warning} statusText="all students">
                            <Loadable load={difficulty.load} loading={difficulty.loading} error={difficulty.error} onRetry={() => difficulty.load(true)}>
                                {(difficulty.data || []).map((s, i) => (
                                    <View key={i} style={styles.difficultyRow}>
                                        <View style={styles.difficultyInfo}>
                                            <Text style={styles.difficultyName} numberOfLines={1}>{s.name}</Text>
                                            <Text style={styles.difficultyMeta}>{s.students} students</Text>
                                        </View>
                                        <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.min(s.bunkRate, 100)}%`, backgroundColor: difficultyColor(s.bunkRate) }]} /></View>
                                        <Text style={[styles.difficultyPct, { color: difficultyColor(s.bunkRate) }]}>{s.bunkRate.toFixed(0)}% missed</Text>
                                    </View>
                                ))}
                                {difficulty.data && difficulty.data.length === 0 && <Empty>Needs at least two students on a subject.</Empty>}
                            </Loadable>
                        </Panel>

                        <Panel icon="trending-down" title="Misses by weekday" accent={COLORS.danger} statusText="register">
                            <Loadable load={bunk.load} loading={bunk.loading} error={bunk.error} onRetry={() => bunk.load(true)}>
                                {(bunk.data || []).map((d, i) => (
                                    <Bar key={i} label={d.day} value={d.bunkRate} maxVal={100} color={d.bunkRate >= 30 ? COLORS.danger : d.bunkRate >= 15 ? COLORS.warning : COLORS.success} />
                                ))}
                                {bunk.data && bunk.data.every((d) => d.total === 0) && <Empty>No register data yet.</Empty>}
                            </Loadable>
                        </Panel>

                        <Panel icon="users" title="Batches" accent={COLORS.success} statusText="cohorts">
                            <Loadable load={batches.load} loading={batches.loading} error={batches.error} onRetry={() => batches.load(true)}>
                                {(batches.data || []).map((b, i) => (
                                    <Bar key={i} label={b.batch} value={b.percentage} maxVal={100} color={COLORS.primary} right={`${b.count} (${b.percentage.toFixed(0)}%)`} />
                                ))}
                                {batches.data && batches.data.length === 0 && <Empty>No students yet.</Empty>}
                            </Loadable>
                        </Panel>
                    </>
                )}

                {/* ══ STUDENTS ══ */}
                {tab === 'students' && (
                    <Panel icon="users" title="Students" accent={COLORS.primary} statusText={`${students.length}`}>
                        <Loadable load={() => Promise.all([roster.load(), revoked.load()])} loading={roster.loading && !roster.data} error={roster.error} onRetry={() => roster.load(true)}>
                            {unfinishedAll > 0 && (
                                <View style={styles.noticeBox}>
                                    <Text style={styles.noticeText}>
                                        {unfinishedAll} login code{unfinishedAll === 1 ? '' : 's'} never connected a college account — not shown here.
                                        {unfinishedOld > 0 ? ` ${unfinishedOld} idle over a week.` : ''}
                                    </Text>
                                    {unfinishedOld > 0 && (
                                        <TouchableOpacity onPress={handlePurge} disabled={purging} style={styles.noticeBtn}>
                                            <Text style={styles.noticeBtnText}>{purging ? 'Deleting…' : 'Delete idle'}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                            <View style={styles.searchBar}>
                                <PanelIcon name="search" color={COLORS.textMuted} size={16} />
                                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Roll number or name" placeholderTextColor={COLORS.textMuted} />
                            </View>
                            {filtered.map((u) => {
                                const isRevoked = revokedSet.has(String(u.rollNumber));
                                const badge = isRevoked ? ['REVOKED', COLORS.dangerLight, COLORS.dangerDark]
                                    : !u.erpConnected ? ['DISCONNECTED', COLORS.warningLight, COLORS.warningDark]
                                        : ['ACTIVE', COLORS.successLight, COLORS.successDark];
                                return (
                                    <TouchableOpacity key={u.userId} style={styles.userCard} onPress={() => setSelectedUser(u)} activeOpacity={0.7}>
                                        <View style={styles.userCardHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.userCardTitle}>{u.studentName}</Text>
                                                <Text style={styles.userCardSub}>{u.rollNumber}{u.batchGroup ? ` · ${u.batchGroup}` : ''} · seen {fmtWhen(u.lastActive)}{u.version ? ` · v${u.version}` : ''}</Text>
                                            </View>
                                            <View style={[styles.userBadge, { backgroundColor: badge[1] }]}><Text style={[styles.userBadgeText, { color: badge[2] }]}>{badge[0]}</Text></View>
                                        </View>
                                        <View style={styles.userStatsRow}>
                                            <View style={styles.userStatCell}><Text style={styles.userStatVal}>{u.totalSubjects}</Text><Text style={styles.userStatLbl}>Subjects</Text></View>
                                            <View style={styles.userStatCell}><Text style={[styles.userStatVal, { color: u.belowGoal > 0 ? COLORS.dangerText : COLORS.successText }]}>{u.belowGoal}</Text><Text style={styles.userStatLbl}>Below goal</Text></View>
                                            <View style={styles.userStatCell}>
                                                <Text style={[styles.userStatVal, TABULAR, { color: u.overallAttendancePct == null ? COLORS.textMuted : u.overallAttendancePct >= u.goal ? COLORS.successText : COLORS.dangerText }]}>
                                                    {u.overallAttendancePct != null ? `${u.overallAttendancePct}%` : '—'}
                                                </Text>
                                                <Text style={styles.userStatLbl}>Overall</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {roster.data && filtered.length === 0 && <Empty>{students.length === 0 ? 'No student has connected a college account yet.' : 'No match.'}</Empty>}
                        </Loadable>
                    </Panel>
                )}

                {/* ══ HEALTH ══ */}
                {tab === 'health' && (
                    <>
                        <Panel icon="zap" title="College outages" accent={downtime.data?.length ? COLORS.danger : COLORS.success} statusText={downtime.data?.length ? `${downtime.data.length} active` : 'all clear'}>
                            <Loadable load={downtime.load} loading={downtime.loading} error={downtime.error} onRetry={() => downtime.load(true)}>
                                {(downtime.data || []).map((ev) => (
                                    <View key={ev.id} style={styles.endpointRow}>
                                        <View style={[styles.statusDot, { backgroundColor: COLORS.danger }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.endpointName}>{ev.type}</Text>
                                            <Text style={styles.endpointMeta}>{ev.failures}/{ev.attempts} calls failed · {ev.affectedUsers} student{ev.affectedUsers === 1 ? '' : 's'}{ev.startedAt ? ` · since ${new Date(ev.startedAt).toLocaleTimeString()}` : ''}</Text>
                                            {!!ev.sampleError && <Text style={styles.endpointMeta} numberOfLines={2}>{ev.sampleError}</Text>}
                                        </View>
                                        <Text style={[styles.endpointRate, { color: COLORS.danger }]}>{ev.failRate.toFixed(0)}%</Text>
                                    </View>
                                ))}
                                {downtime.data && downtime.data.length === 0 && <Empty>Nothing is failing in the last hour. Outages appear here on their own and clear when the college recovers.</Empty>}
                            </Loadable>
                        </Panel>

                        <Panel icon="key" title="Sign-in prompts" accent={sessions.data?.total ? COLORS.warning : COLORS.success} statusText="last 7 days">
                            <Loadable load={sessions.load} loading={sessions.loading} error={sessions.error} onRetry={() => sessions.load(true)}>
                                {sessions.data && (
                                    <>
                                        <Text style={styles.noteText}>
                                            {sessions.data.total === 0
                                                ? 'Nobody was asked to sign in again this week.'
                                                : `${sessions.data.total} prompt${sessions.data.total === 1 ? '' : 's'} across ${sessions.data.affectedStudents} student${sessions.data.affectedStudents === 1 ? '' : 's'} — ${sessions.data.byType.needsOtp || 0} needed a code, ${sessions.data.byType.needsLogin || 0} had to sign in from scratch.`}
                                        </Text>
                                        {Object.entries(sessions.data.byReason || {}).map(([reason, n]) => (
                                            <View key={reason} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { flex: 3 }]}>{REASON_COPY[reason] || reason}</Text>
                                                <Text style={[styles.tableCell, { textAlign: 'right' }]}>{n}</Text>
                                            </View>
                                        ))}
                                        {(sessions.data.recent || []).slice(0, 15).map((ev, i) => (
                                            <View key={i} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{ev.rollNumber || ev.userId}</Text>
                                                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{REASON_COPY[ev.reason] || ev.reason}</Text>
                                                <Text style={[styles.tableCell, { textAlign: 'right' }]}>{fmtWhen(ev.at)}</Text>
                                            </View>
                                        ))}
                                    </>
                                )}
                            </Loadable>
                        </Panel>

                        <Panel icon="activity" title="Endpoint health" accent={COLORS.success} statusText="24h">
                            <Loadable load={endpoints.load} loading={endpoints.loading} error={endpoints.error} onRetry={() => endpoints.load(true)}>
                                {(endpoints.data || []).map((ep, i) => (
                                    <View key={i} style={styles.endpointRow}>
                                        <View style={[styles.statusDot, { backgroundColor: endpointColor(ep.successRate) }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.endpointName}>{ep.name}</Text>
                                            <Text style={styles.endpointMeta}>{ep.avgDuration}ms avg · {ep.count} calls</Text>
                                        </View>
                                        <Text style={[styles.endpointRate, { color: endpointColor(ep.successRate) }]}>{ep.successRate.toFixed(1)}%</Text>
                                    </View>
                                ))}
                                {endpoints.data && endpoints.data.length === 0 && <Empty>No syncs in the last 24 hours.</Empty>}
                            </Loadable>
                        </Panel>

                        <Panel icon="alert" title="Parser failures" accent={COLORS.danger} statusText="recent">
                            <Loadable load={failures.load} loading={failures.loading} error={failures.error} onRetry={() => failures.load(true)}>
                                {(failures.data || []).map((f, i) => <FailureCard key={i} failure={f} />)}
                                {failures.data && failures.data.length === 0 && <Empty>No parser errors in the recent syncs.</Empty>}
                            </Loadable>
                        </Panel>

                        <Panel icon="gauge" title="Sync frequency" accent={COLORS.warning} statusText="24h">
                            <Loadable load={rate.load} loading={rate.loading} error={rate.error} onRetry={() => rate.load(true)}>
                                {rate.data && rate.data.length > 0 && (
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.tableCell, { flex: 2 }]}>Student</Text>
                                        <Text style={styles.tableCell}>Hour</Text>
                                        <Text style={styles.tableCell}>Day</Text>
                                        <Text style={styles.tableCell}>Status</Text>
                                    </View>
                                )}
                                {(rate.data || []).map((r, i) => (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{r.rollNumber}</Text>
                                        <Text style={styles.tableCell}>{r.hourly}</Text>
                                        <Text style={styles.tableCell}>{r.daily}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: rateColor(r.status) + '22' }]}><Text style={[styles.statusBadgeText, { color: rateColor(r.status) }]}>{r.status}</Text></View>
                                    </View>
                                ))}
                                {rate.data && rate.data.length === 0 && <Empty>No syncs recorded today.</Empty>}
                            </Loadable>
                        </Panel>
                    </>
                )}

                {/* ══ CONTROLS ══ */}
                {tab === 'controls' && (
                    <>
                        {configError && <View style={styles.errorContainer}><Text style={styles.errorText}>{configError}</Text><TouchableOpacity onPress={loadConfig} style={styles.retryBtn}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity></View>}

                        <Panel icon="megaphone" title="Announcements" accent={COLORS.primary} statusText="72h">
                            <Loadable load={announcements.load} loading={announcements.loading} error={announcements.error} onRetry={() => announcements.load(true)}>
                                <View style={styles.inputGroup}><Text style={styles.inputLabel}>TITLE</Text><TextInput style={styles.input} value={annTitle} onChangeText={setAnnTitle} placeholder="Short and clear" placeholderTextColor={COLORS.textMuted} /></View>
                                <View style={styles.inputGroup}><Text style={styles.inputLabel}>MESSAGE</Text><TextInput style={[styles.input, { minHeight: 60 }]} value={annBody} onChangeText={setAnnBody} placeholder="What students should know" placeholderTextColor={COLORS.textMuted} multiline /></View>
                                <View style={styles.typeRow}>
                                    {['info', 'warning', 'danger'].map((t) => (
                                        <TouchableOpacity key={t} style={[styles.typePill, annType === t && styles.typePillActive]} onPress={() => setAnnType(t)}>
                                            <Text style={[styles.typePillText, annType === t && styles.typePillTextActive]}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity style={styles.actionBtn} onPress={handlePublishAnnouncement} activeOpacity={0.8}><Text style={styles.actionBtnText}>Publish to every student</Text></TouchableOpacity>
                                {(announcements.data || []).length > 0 && (
                                    <View style={{ marginTop: SPACING.md }}>
                                        <Text style={styles.subSectionLabel}>LIVE NOW</Text>
                                        {announcements.data.map((a) => (
                                            <View key={a.id} style={styles.announcementCard}>
                                                <View style={{ flex: 1 }}><Text style={styles.announcementTitle}>{a.title}</Text><Text style={styles.announcementBody} numberOfLines={2}>{a.message}</Text></View>
                                                <TouchableOpacity onPress={() => handleDeleteAnnouncement(a.id)} accessibilityLabel="Remove announcement"><Text style={styles.removeGlyph}>✕</Text></TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </Loadable>
                        </Panel>

                        <Panel icon="sliders" title="Feature flags" accent={COLORS.success} statusText="live">
                            {Object.keys(flags).length === 0
                                ? <Empty>{config ? 'No flags configured.' : 'Loading config…'}</Empty>
                                : Object.entries(flags).map(([key, val]) => (
                                    <View key={key} style={styles.flagRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.flagLabel}>{key === 'autoSync' ? 'Automatic sync' : key === 'calendarSync' ? 'Day-by-day register' : key}</Text>
                                            <Text style={styles.flagHint}>{key === 'autoSync' ? 'Off pauses background syncing for everyone; manual refresh still works.' : key === 'calendarSync' ? 'Off skips the register step; totals still sync.' : ''}</Text>
                                        </View>
                                        <Switch value={!!val} onValueChange={(v) => handleToggleFlag(key, v)} trackColor={{ false: COLORS.inputBackground, true: COLORS.success + '66' }} thumbColor={val ? COLORS.success : COLORS.textMuted} />
                                    </View>
                                ))}
                        </Panel>

                        <Panel icon="shield" title="Minimum version" accent={COLORS.warning} statusText={`v${minVersion || '—'}`}>
                            <View style={styles.inputGroup}><Text style={styles.inputLabel}>REQUIRED VERSION</Text><TextInput style={styles.input} value={minVersion} onChangeText={setMinVersion} placeholder="e.g. 2.1.0" placeholderTextColor={COLORS.textMuted} /></View>
                            <TouchableOpacity style={styles.actionBtn} onPress={handlePublishVersion} activeOpacity={0.8}><Text style={styles.actionBtnText}>Publish version gate</Text></TouchableOpacity>
                        </Panel>

                        <Panel icon="wrench" title="Maintenance mode" accent={maintMode ? COLORS.danger : COLORS.success} statusText={maintMode ? 'ON' : 'off'}>
                            <View style={styles.flagRow}>
                                <Text style={styles.flagLabel}>Lock everyone out</Text>
                                <Switch value={maintMode} onValueChange={handleToggleMaintenance} trackColor={{ false: COLORS.inputBackground, true: COLORS.danger + '66' }} thumbColor={maintMode ? COLORS.danger : COLORS.textMuted} />
                            </View>
                            <View style={styles.inputGroup}><Text style={styles.inputLabel}>MESSAGE STUDENTS SEE</Text><TextInput style={[styles.input, { minHeight: 60 }]} value={maintMsg} onChangeText={setMaintMsg} placeholder="Back in an hour" placeholderTextColor={COLORS.textMuted} multiline /></View>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.inputBackground }]} onPress={() => run(() => updateAdminConfig(roll, { maintenanceMessage: maintMsg }), 'Message saved')} activeOpacity={0.8}>
                                <Text style={[styles.actionBtnText, { color: COLORS.textPrimary }]}>Save message</Text>
                            </TouchableOpacity>
                        </Panel>

                        <Panel icon="lock" title="Revoked access" accent={COLORS.danger} statusText={`${(revoked.data || []).length}`}>
                            <Loadable load={revoked.load} loading={revoked.loading} error={revoked.error} onRetry={() => revoked.load(true)}>
                                <View style={styles.inputGroup}><Text style={styles.inputLabel}>ROLL NUMBER</Text><TextInput style={styles.input} value={revokeRoll} onChangeText={setRevokeRoll} placeholder="e.g. 2410990123" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" /></View>
                                <View style={styles.inputGroup}><Text style={styles.inputLabel}>REASON</Text><TextInput style={styles.input} value={revokeReason} onChangeText={setRevokeReason} placeholder="Shown to the student" placeholderTextColor={COLORS.textMuted} /></View>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={() => handleRevoke()} activeOpacity={0.8}><Text style={styles.actionBtnText}>Revoke access</Text></TouchableOpacity>
                                {(revoked.data || []).map((r) => (
                                    <View key={r.rollNumber} style={styles.revokedRow}>
                                        <View style={{ flex: 1 }}><Text style={styles.revokedRoll}>{r.rollNumber}</Text><Text style={styles.revokedReason}>{r.reason}</Text></View>
                                        <TouchableOpacity onPress={() => handleUnrevoke(r.rollNumber)} style={styles.resolveBtn}><Text style={styles.resolveBtnText}>Reinstate</Text></TouchableOpacity>
                                    </View>
                                ))}
                            </Loadable>
                        </Panel>

                        <Panel icon="list" title="Audit log" accent={COLORS.textMuted} statusText="last 60">
                            <Loadable load={audit.load} loading={audit.loading} error={audit.error} onRetry={() => audit.load(true)}>
                                {(audit.data || []).map((e) => (
                                    <View key={e.id} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={2}>{e.action}{e.detail ? ` · ${summariseDetail(e.detail)}` : ''}</Text>
                                        <Text style={[styles.tableCell, { textAlign: 'right' }]}>{fmtWhen(e.at)}</Text>
                                    </View>
                                ))}
                                {audit.data && audit.data.length === 0 && <Empty>No admin actions recorded yet.</Empty>}
                            </Loadable>
                        </Panel>
                    </>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Student detail */}
            {selectedUser && (
                <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedUser(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>{selectedUser.studentName}</Text>
                                    <Text style={styles.modalSub}>{selectedUser.rollNumber}{selectedUser.batchGroup ? ` · ${selectedUser.batchGroup}` : ''}{selectedUser.version ? ` · v${selectedUser.version}` : ''}</Text>
                                    <Text style={styles.modalSub}>Seen {fmtWhen(selectedUser.lastActive)} · synced {fmtWhen(selectedUser.lastErpSync)} · college updated through {selectedUser.latestErpDate || '—'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.modalCloseBtn} accessibilityLabel="Close"><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
                            </View>
                            <ScrollView style={{ maxHeight: 400 }}>
                                <View style={styles.userModalMetaRow}>
                                    <View style={styles.userStatCell}><Text style={styles.userStatVal}>{selectedUser.totalAttended}/{selectedUser.totalClasses}</Text><Text style={styles.userStatLbl}>Hours</Text></View>
                                    <View style={styles.userStatCell}><Text style={[styles.userStatVal, { color: selectedUser.belowGoal > 0 ? COLORS.dangerText : COLORS.successText }]}>{selectedUser.belowGoal}</Text><Text style={styles.userStatLbl}>Below goal</Text></View>
                                    <View style={styles.userStatCell}><Text style={[styles.userStatVal, TABULAR, { color: (selectedUser.overallAttendancePct || 0) >= selectedUser.goal ? COLORS.successText : COLORS.dangerText }]}>{selectedUser.overallAttendancePct != null ? `${selectedUser.overallAttendancePct}%` : '—'}</Text><Text style={styles.userStatLbl}>Overall</Text></View>
                                </View>
                                <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>SUBJECTS ({selectedUser.subjects?.length || 0})</Text>
                                {(selectedUser.subjects || []).map((sub, i) => (
                                    <View key={i} style={styles.userSubjectRow}>
                                        <View style={{ flex: 1 }}><Text style={styles.userSubName}>{sub.name}</Text><Text style={styles.userSubMeta}>{sub.attended}/{sub.total} hours · goal {sub.target}%</Text></View>
                                        <Text style={[styles.userSubPct, TABULAR, { color: sub.pct >= sub.target ? COLORS.successText : COLORS.dangerText }]}>{sub.pct.toFixed(1)}%</Text>
                                    </View>
                                ))}
                                {(!selectedUser.subjects || selectedUser.subjects.length === 0) && <Empty>No subjects synced yet.</Empty>}
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger, flex: 1 }]} onPress={async () => { const t = selectedUser.rollNumber; setSelectedUser(null); await handleRevoke(t, 'Revoked from the student list'); }}>
                                    <Text style={styles.actionBtnText}>Revoke access</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

function summariseDetail(detail) {
    if (!detail || typeof detail !== 'object') return String(detail || '');
    return Object.entries(detail).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ').slice(0, 120);
}

function FailureCard({ failure }) {
    const [expanded, setExpanded] = useState(false);
    const styles = getStyles();
    const ts = Number.isFinite(failure.timestampMs) ? new Date(failure.timestampMs).toLocaleString() : 'Unknown';
    return (
        <TouchableOpacity style={styles.failureCard} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
            <View style={styles.failureHeader}>
                <Text style={styles.failureUser}>{failure.rollNumber}</Text>
                <Text style={styles.failureTime}>{ts}</Text>
            </View>
            {expanded && (failure.errors || []).map((err, i) => (
                <View key={i} style={styles.failureDetail}>
                    <Text style={styles.failureComponent}>{err.endpoint || err.component || 'sync'}</Text>
                    <Text style={styles.failureError}>{err.message || err.error}</Text>
                </View>
            ))}
        </TouchableOpacity>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────
const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingHorizontal: SPACING.screenPadding, paddingTop: SPACING.sm },
    loadingContainer: { padding: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACING.xs },
    loadingText: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted },
    errorContainer: { padding: SPACING.md, alignItems: 'center', backgroundColor: COLORS.dangerLight, borderRadius: BORDER_RADIUS.md, gap: SPACING.xs, marginBottom: SPACING.md },
    errorText: { ...TYPOGRAPHY.captionMedium, color: COLORS.dangerDark, textAlign: 'center' },
    retryBtn: { backgroundColor: COLORS.danger, paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: BORDER_RADIUS.sm },
    retryBtnText: { ...TYPOGRAPHY.labelSmall, color: '#FFF' },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BORDER_RADIUS.full },
    refreshBtnText: { ...TYPOGRAPHY.micro, color: COLORS.primary },

    hero: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.medium },
    heroControlsRow: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'center', justifyContent: 'flex-end', marginBottom: SPACING.sm },
    heroEyebrow: { ...TYPOGRAPHY.micro, color: COLORS.primary, letterSpacing: 1.2 },
    heroTitle: { ...TYPOGRAPHY.headingLarge, color: COLORS.textPrimary, marginTop: 4 },
    heroError: { ...TYPOGRAPHY.captionMedium, color: COLORS.dangerText, marginTop: SPACING.sm },
    livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.successLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
    livePillText: { ...TYPOGRAPHY.micro, color: COLORS.successDark, letterSpacing: 0.5 },
    kpiRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.md },
    kpiCell: { flex: 1, alignItems: 'center', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: 2 },
    kpiValue: { ...TYPOGRAPHY.displaySmall, fontSize: 18 },
    kpiLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 2, fontSize: 8, textAlign: 'center' },
    heroSpark: { marginTop: SPACING.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: SPACING.md },
    heroSparkLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: SPACING.sm, letterSpacing: 0.8 },

    catRow: { flexDirection: 'row', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: 4, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    catTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
    catTabActive: { backgroundColor: COLORS.cardBackground, ...SHADOWS.small },
    catTabText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted },
    catTabTextActive: { color: COLORS.textPrimary },

    panel: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.small },
    panelHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    panelIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    panelTitle: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary, flex: 1 },
    panelPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
    panelPillText: { ...TYPOGRAPHY.micro },
    panelBody: { padding: SPACING.md },
    noteText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.xs },
    noticeBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.warningLight, borderWidth: 1, borderColor: COLORS.warning, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md },
    noticeText: { ...TYPOGRAPHY.captionMedium, color: COLORS.warningDark, flex: 1 },
    noticeBtn: { backgroundColor: COLORS.warning, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: BORDER_RADIUS.sm },
    noticeBtnText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textOnPrimary },

    statusDot: { width: 8, height: 8, borderRadius: 4 },
    difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
    difficultyInfo: { width: 120 },
    difficultyName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
    difficultyMeta: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
    difficultyPct: { ...TYPOGRAPHY.labelSmall, width: 75, textAlign: 'right' },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
    barLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, width: 90 },
    barTrack: { flex: 1, height: 8, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    barValue: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary, width: 70, textAlign: 'right' },

    searchBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    searchInput: { flex: 1, color: COLORS.textPrimary, ...TYPOGRAPHY.bodyMedium },
    userCard: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderSubtle },
    userCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    userCardTitle: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary },
    userCardSub: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 2, textTransform: 'none', letterSpacing: 0 },
    userBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
    userBadgeText: { ...TYPOGRAPHY.micro },
    userStatsRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: SPACING.xs },
    userStatCell: { flex: 1, alignItems: 'center' },
    userStatVal: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary },
    userStatLbl: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, fontSize: 9 },

    endpointRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8 },
    endpointName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
    endpointMeta: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, textTransform: 'none', letterSpacing: 0 },
    endpointRate: { ...TYPOGRAPHY.labelSmall },
    resolveBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm },
    resolveBtnText: { ...TYPOGRAPHY.micro, color: COLORS.primary },

    failureCard: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.xs },
    failureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    failureUser: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary },
    failureTime: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, textTransform: 'none' },
    failureDetail: { marginTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: 4 },
    failureComponent: { ...TYPOGRAPHY.micro, color: COLORS.dangerText },
    failureError: { ...TYPOGRAPHY.captionMedium, color: COLORS.textSecondary },

    tableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    tableCell: { flex: 1, ...TYPOGRAPHY.bodySmall, color: COLORS.textPrimary },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
    statusBadgeText: { ...TYPOGRAPHY.micro },

    inputGroup: { marginBottom: SPACING.sm },
    inputLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: 4 },
    input: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, color: COLORS.textPrimary, ...TYPOGRAPHY.bodyMedium, borderWidth: 1, borderColor: COLORS.border },
    typeRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm },
    typePill: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border },
    typePillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    typePillText: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
    typePillTextActive: { color: COLORS.textOnPrimary },
    actionBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.xs },
    actionBtnText: { ...TYPOGRAPHY.labelMedium, color: COLORS.textOnPrimary },
    flagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: SPACING.sm },
    flagLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
    flagHint: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },
    subSectionLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: SPACING.xs },
    announcementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
    announcementTitle: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary },
    announcementBody: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },
    removeGlyph: { color: COLORS.dangerText, fontWeight: '700', fontSize: 16, padding: 4 },
    revokedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.xs },
    revokedRoll: { ...TYPOGRAPHY.labelSmall, color: COLORS.dangerText },
    revokedReason: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted },

    modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', padding: SPACING.lg },
    modalCard: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, maxHeight: '85%', ...SHADOWS.large },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle, paddingBottom: SPACING.sm, marginBottom: SPACING.md },
    modalTitle: { ...TYPOGRAPHY.headingMedium, color: COLORS.textPrimary, fontSize: 18 },
    modalSub: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },
    modalCloseBtn: { padding: 4 },
    modalCloseText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700' },
    userModalMetaRow: { flexDirection: 'row', gap: SPACING.xs, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
    userSubjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    userSubName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
    userSubMeta: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted },
    userSubPct: { ...TYPOGRAPHY.labelSmall },
    modalFooter: { marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },

    emptyText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },
});
