import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Switch, ActivityIndicator, Platform, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import {
    getAdminConfig, updateAdminConfig,
    fetchActiveUserMetrics, fetchSubjectDifficulty,
    fetchBunkCultureIndex, fetchBatchDistribution,
    fetchEndpointHealth, fetchParserFailures,
    fetchDowntime, fetchRateLimitData, fetchUserRoster,
    getActiveAnnouncements, publishAnnouncement, deleteAnnouncement,
    getRevokedUsers, revokeUser, unrevokeUser,
} from '../../services/adminService';
import { showAlert, confirmAction } from '../../utils/alert';

const CATEGORIES = [
    { key: 'analytics', label: 'Analytics' },
    { key: 'users', label: 'Users' },
    { key: 'operations', label: 'Operations' },
    { key: 'controls', label: 'Controls' },
];

// ─── PANEL ICONS (SVG, stroke — render identically on web PWA and native Android) ──
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
    };
    return <Svg width={size} height={size} viewBox="0 0 24 24">{glyphs[name] || null}</Svg>;
}

// ─── SECTION PANEL ──────────────────────────────────────────────
function Panel({ icon, title, accent, statusText, children }) {
    const styles = getStyles();
    const a = accent || COLORS.primary;
    return (
        <View style={styles.panel}>
            <View style={styles.panelHeader}>
                <View style={[styles.panelIcon, { backgroundColor: a + '1F' }]}>
                    <PanelIcon name={icon} color={a} size={16} />
                </View>
                <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
                {!!statusText && (
                    <View style={[styles.panelPill, { borderColor: a + '55' }]}>
                        <Text style={[styles.panelPillText, { color: a }]}>{statusText}</Text>
                    </View>
                )}
            </View>
            <View style={styles.panelBody}>{children}</View>
        </View>
    );
}

// ─── SPARKLINE (SVG) ────────────────────────────────────────────
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

// ─── PROGRESS BAR ───────────────────────────────────────────────
function BarProgress({ value, maxVal, color, label }) {
    const styles = getStyles();
    const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
    return (
        <View style={styles.barRow}>
            <Text style={styles.barLabel}>{label}</Text>
            <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.barValue}>{value.toFixed(1)}%</Text>
        </View>
    );
}

// ─── MAIN ADMIN SCREEN ─────────────────────────────────────────
export default function AdminScreen() {
    const styles = getStyles();
    const { state } = useApp();
    const [refreshing, setRefreshing] = useState(false);
    const [forceRefreshing, setForceRefreshing] = useState(false);
    const [category, setCategory] = useState('analytics');

    // Config state
    const [config, setConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [configError, setConfigError] = useState(null);

    // Analytics
    const [metrics, setMetrics] = useState(null);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [metricsError, setMetricsError] = useState(null);

    // Subject difficulty
    const [subjects, setSubjects] = useState(null);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [subjectsError, setSubjectsError] = useState(null);

    // Bunk culture
    const [bunkIndex, setBunkIndex] = useState(null);
    const [bunkLoading, setBunkLoading] = useState(false);
    const [bunkError, setBunkError] = useState(null);

    // Batches
    const [batches, setBatches] = useState(null);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchError, setBatchError] = useState(null);

    // User Roster
    const [roster, setRoster] = useState(null);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [rosterError, setRosterError] = useState(null);
    const [rosterQuery, setRosterQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    // Endpoint health
    const [endpoints, setEndpoints] = useState(null);
    const [endpointsLoading, setEndpointsLoading] = useState(false);
    const [endpointsError, setEndpointsError] = useState(null);

    // Parser failures
    const [failures, setFailures] = useState(null);
    const [failuresLoading, setFailuresLoading] = useState(false);
    const [failuresError, setFailuresError] = useState(null);

    // Downtime
    const [downtimeEvents, setDowntimeEvents] = useState(null);
    const [downtimeLoading, setDowntimeLoading] = useState(false);
    const [downtimeError, setDowntimeError] = useState(null);

    // Rate limiting
    const [rateData, setRateData] = useState(null);
    const [rateLoading, setRateLoading] = useState(false);
    const [rateError, setRateError] = useState(null);

    // Announcements
    const [announcements, setAnnouncements] = useState(null);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [announcementsError, setAnnouncementsError] = useState(null);
    const [annTitle, setAnnTitle] = useState('');
    const [annBody, setAnnBody] = useState('');
    const [annType, setAnnType] = useState('info');

    // Revoked users
    const [revoked, setRevoked] = useState(null);
    const [revokedLoading, setRevokedLoading] = useState(false);
    const [revokedError, setRevokedError] = useState(null);
    const [revokeRoll, setRevokeRoll] = useState('');
    const [revokeReason, setRevokeReason] = useState('');

    // Feature flags
    const [flags, setFlags] = useState({});

    // Forced update
    const [minVersion, setMinVersion] = useState('');

    // Maintenance
    const [maintMode, setMaintMode] = useState(false);
    const [maintMsg, setMaintMsg] = useState('');

    // ─── LOAD CONFIG + HERO METRICS ON MOUNT ────────────────────
    useEffect(() => {
        loadConfig();
        loadMetrics(false);
    }, []);

    const loadConfig = async () => {
        setConfigLoading(true);
        setConfigError(null);
        try {
            const c = await getAdminConfig();
            setConfig(c);
            setFlags(c.featureFlags || {});
            setMinVersion(c.minVersion || '2.0.0');
            setMaintMode(c.maintenanceMode || false);
            setMaintMsg(c.maintenanceMessage || '');
        } catch (e) {
            setConfigError(e?.message || 'Failed to load admin config');
            showAlert('Admin config', 'Could not load the remote config. Pull to retry.');
        } finally {
            setConfigLoading(false);
        }
    };

    // Every loader swallows its own error, so Promise.all can never reject and
    // the old code reported success even when every panel failed. Report what
    // actually loaded instead.
    const refreshAll = useCallback(async (loaders, force) => {
        const results = await Promise.all(loaders.map(async (load) => {
            try {
                await load(force);
                return true;
            } catch {
                return false;
            }
        }));
        return results.filter(Boolean).length;
    }, []);

    // Pull-to-refresh used to reload only the config, so it looked broken on
    // every tab but Controls. Refresh what the admin is actually looking at.
    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([loadConfig(), refreshAll(categoryLoaders[category] || [], true)]);
        } finally {
            setRefreshing(false);
        }
    };

    const handleForceRefreshAll = async () => {
        setForceRefreshing(true);
        const loaders = [
            loadMetrics, loadSubjects, loadBunk, loadBatches,
            loadRoster, loadRevoked, loadEndpoints, loadFailures,
            loadDowntime, loadRate, loadAnnouncements,
        ];
        try {
            const ok = await refreshAll(loaders, true);
            if (ok === loaders.length) {
                showAlert('Cache refreshed', 'All panels reloaded from the server.');
            } else {
                showAlert('Partial refresh', `Refreshed ${ok} of ${loaders.length} panels. The rest show their own error.`);
            }
        } finally {
            setForceRefreshing(false);
        }
    };

    // ─── LAZY LOADERS ───────────────────────────────────────────
    const roll = state.erpRollNumber;

    const loadMetrics = useCallback(async (force = false) => {
        if ((metrics && !force) || metricsLoading) return;
        setMetricsLoading(true);
        setMetricsError(null);
        try {
            setMetrics(await fetchActiveUserMetrics(force));
        } catch (e) {
            setMetricsError(e?.message || 'Failed to fetch metrics');
        } finally {
            setMetricsLoading(false);
        }
    }, [metrics, metricsLoading]);

    const loadSubjects = useCallback(async (force = false) => {
        if ((subjects && !force) || subjectsLoading) return;
        setSubjectsLoading(true);
        setSubjectsError(null);
        try {
            setSubjects(await fetchSubjectDifficulty(roll, force));
        } catch (e) {
            setSubjectsError(e?.message || 'Failed to fetch subject difficulty');
        } finally {
            setSubjectsLoading(false);
        }
    }, [subjects, subjectsLoading, roll]);

    const loadBunk = useCallback(async (force = false) => {
        if ((bunkIndex && !force) || bunkLoading) return;
        setBunkLoading(true);
        setBunkError(null);
        try {
            setBunkIndex(await fetchBunkCultureIndex(roll, force));
        } catch (e) {
            setBunkError(e?.message || 'Failed to fetch bunk index');
        } finally {
            setBunkLoading(false);
        }
    }, [bunkIndex, bunkLoading, roll]);

    const loadBatches = useCallback(async (force = false) => {
        if ((batches && !force) || batchLoading) return;
        setBatchLoading(true);
        setBatchError(null);
        try {
            setBatches(await fetchBatchDistribution(force));
        } catch (e) {
            setBatchError(e?.message || 'Failed to fetch batch distribution');
        } finally {
            setBatchLoading(false);
        }
    }, [batches, batchLoading]);

    const loadRoster = useCallback(async (force = false) => {
        if ((roster && !force) || rosterLoading) return;
        setRosterLoading(true);
        setRosterError(null);
        try {
            setRoster(await fetchUserRoster(roll, force));
        } catch (e) {
            setRosterError(e?.message || 'Failed to fetch user roster');
        } finally {
            setRosterLoading(false);
        }
    }, [roster, rosterLoading, roll]);

    const loadEndpoints = useCallback(async (force = false) => {
        if ((endpoints && !force) || endpointsLoading) return;
        setEndpointsLoading(true);
        setEndpointsError(null);
        try {
            setEndpoints(await fetchEndpointHealth(roll, force));
        } catch (e) {
            setEndpointsError(e?.message || 'Failed to fetch endpoint health');
        } finally {
            setEndpointsLoading(false);
        }
    }, [endpoints, endpointsLoading, roll]);

    const loadFailures = useCallback(async (force = false) => {
        if ((failures && !force) || failuresLoading) return;
        setFailuresLoading(true);
        setFailuresError(null);
        try {
            setFailures(await fetchParserFailures(roll, force));
        } catch (e) {
            setFailuresError(e?.message || 'Failed to fetch parser failures');
        } finally {
            setFailuresLoading(false);
        }
    }, [failures, failuresLoading, roll]);

    const loadDowntime = useCallback(async (force = false) => {
        if ((downtimeEvents && !force) || downtimeLoading) return;
        setDowntimeLoading(true);
        setDowntimeError(null);
        try {
            setDowntimeEvents(await fetchDowntime(roll, force));
        } catch (e) {
            setDowntimeError(e?.message || 'Failed to fetch downtime events');
        } finally {
            setDowntimeLoading(false);
        }
    }, [downtimeEvents, downtimeLoading, roll]);

    const loadRate = useCallback(async (force = false) => {
        if ((rateData && !force) || rateLoading) return;
        setRateLoading(true);
        setRateError(null);
        try {
            setRateData(await fetchRateLimitData(roll, force));
        } catch (e) {
            setRateError(e?.message || 'Failed to fetch rate limit data');
        } finally {
            setRateLoading(false);
        }
    }, [rateData, rateLoading, roll]);

    const loadAnnouncements = useCallback(async (force = false) => {
        if ((announcements && !force) || announcementsLoading) return;
        setAnnouncementsLoading(true);
        setAnnouncementsError(null);
        try {
            setAnnouncements(await getActiveAnnouncements());
        } catch (e) {
            setAnnouncementsError(e?.message || 'Failed to fetch announcements');
        } finally {
            setAnnouncementsLoading(false);
        }
    }, [announcements, announcementsLoading]);

    const loadRevoked = useCallback(async (force = false) => {
        if ((revoked && !force) || revokedLoading) return;
        setRevokedLoading(true);
        setRevokedError(null);
        try {
            setRevoked(await getRevokedUsers());
        } catch (e) {
            setRevokedError(e?.message || 'Failed to fetch revoked users');
        } finally {
            setRevokedLoading(false);
        }
    }, [revoked, revokedLoading]);

    // The roster marks revoked accounts, so it needs the revocation list too —
    // without this every user on the Users tab renders as ACTIVE until the admin
    // happens to visit Controls.
    const loadUsersTab = useCallback(async (force = false) => {
        await Promise.all([loadRoster(force), loadRevoked(force)]);
    }, [loadRoster, loadRevoked]);

    // What each tab is responsible for, so pull-to-refresh reloads exactly the
    // panels on screen.
    const categoryLoaders = {
        analytics: [loadMetrics, loadSubjects, loadBunk, loadBatches],
        users: [loadRoster, loadRevoked],
        operations: [loadEndpoints, loadFailures, loadDowntime, loadRate],
        controls: [loadAnnouncements, loadRevoked],
    };

    // ─── HANDLERS ───────────────────────────────────────────────
    const run = async (mutate, successMessage) => {
        try {
            const result = await mutate();
            if (successMessage) showAlert(successMessage);
            return result ?? true;
        } catch (e) {
            showAlert('Action failed', e?.message || 'The server rejected the request.');
            return undefined;
        }
    };

    const handleToggleFlag = async (key, val) => {
        const previous = flags;
        const newFlags = { ...flags, [key]: val };
        setFlags(newFlags);
        const ok = await run(() => updateAdminConfig(roll, { featureFlags: newFlags }));
        if (!ok) setFlags(previous);
    };

    const handlePublishVersion = async () => {
        const version = minVersion.trim();
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
            return showAlert('Invalid version', 'Use three numbers, like 2.1.0.');
        }
        // Gating above the running build would lock the admin out too.
        const confirmed = await confirmAction(
            'Publish version gate?',
            `Everyone below v${version} will be blocked until they update.`,
            'Publish',
        );
        if (!confirmed) return;
        await run(() => updateAdminConfig(roll, { minVersion: version }), 'Version gate updated');
    };

    const handleToggleMaintenance = async (val) => {
        if (val) {
            const confirmed = await confirmAction(
                'Enable maintenance mode?',
                'Every non-admin user will be locked out until you turn this off.',
                'Enable',
            );
            if (!confirmed) return;
        }
        const previous = maintMode;
        setMaintMode(val);
        const ok = await run(
            () => updateAdminConfig(roll, { maintenanceMode: val, maintenanceMessage: maintMsg }),
            val ? 'Maintenance mode ON' : 'Maintenance mode OFF',
        );
        if (!ok) setMaintMode(previous);
    };

    const handleSaveMaintMsg = async () => {
        await run(() => updateAdminConfig(roll, { maintenanceMessage: maintMsg }), 'Message updated');
    };

    const handlePublishAnnouncement = async () => {
        if (!annTitle.trim() || !annBody.trim()) {
            return showAlert('Incomplete', 'Both a title and a message are required.');
        }
        const ann = await run(
            () => publishAnnouncement(roll, { title: annTitle, message: annBody, type: annType, expiryHours: 72 }),
            'Announcement published',
        );
        if (!ann) return;
        setAnnouncements(prev => [ann, ...(prev || [])]);
        setAnnTitle('');
        setAnnBody('');
    };

    const handleDeleteAnnouncement = async (id) => {
        if (!await run(() => deleteAnnouncement(roll, id), 'Announcement removed')) return;
        setAnnouncements(prev => (prev || []).filter(a => a.id !== id));
    };

    const handleRevokeUser = async (targetRoll = null, reasonText = null) => {
        const target = (targetRoll || revokeRoll).trim();
        const reason = (reasonText || revokeReason).trim();
        if (!target) return showAlert('Nothing to revoke', 'Enter a roll number first.');
        if (target === String(roll || '').trim()) {
            return showAlert('Not allowed', 'You cannot revoke your own access.');
        }

        // Locks the student out of the app on their next launch — worth a beat.
        const confirmed = await confirmAction(
            'Revoke access?',
            `${target} will be locked out of Presence until reinstated.`,
        );
        if (!confirmed) return;

        if (!await run(() => revokeUser(roll, target, reason), 'User revoked')) return;
        setRevoked(prev => [
            ...(prev || []).filter(r => r.rollNumber !== target),
            { rollNumber: target, reason: reason || 'No reason provided' },
        ]);
        if (!targetRoll) {
            setRevokeRoll('');
            setRevokeReason('');
        }
    };

    const handleUnrevokeUser = async (targetRollNumber) => {
        if (!await run(() => unrevokeUser(roll, targetRollNumber), 'User reinstated')) return;
        setRevoked(prev => (prev || []).filter(r => r.rollNumber !== targetRollNumber));
    };

    // ─── COLOR HELPERS ──────────────────────────────────────────
    const difficultyColor = (rate) => rate >= 35 ? COLORS.danger : rate >= 15 ? COLORS.warning : COLORS.success;
    const endpointColor = (rate) => rate >= 95 ? COLORS.success : rate >= 85 ? COLORS.warning : COLORS.danger;
    const rateStatusColor = (status) => status === 'restricted' ? COLORS.danger : status === 'warning' ? COLORS.warning : COLORS.success;

    // ─── RENDER ─────────────────────────────────────────────────
    if (configLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingCenter}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingCenterText}>Connecting to Admin Service...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const adminName = (state.userName || 'Admin').split(' ')[0];

    const filteredRoster = (roster || []).filter(u => {
        if (!rosterQuery.trim()) return true;
        const q = rosterQuery.toLowerCase().trim();
        return (u.rollNumber && u.rollNumber.toLowerCase().includes(q)) ||
               (u.studentName && u.studentName.toLowerCase().includes(q));
    });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textMuted} />}
            >
                {/* ── HERO ─────────────────────────────────────────── */}
                <View style={styles.hero}>
                    {/* Controls on their own row so the greeting keeps the full width —
                       a long first name in the serif title was wrapping mid-word. */}
                    <View style={styles.heroControlsRow}>
                        <TouchableOpacity
                            style={styles.refreshBtn}
                            onPress={handleForceRefreshAll}
                            disabled={forceRefreshing}
                            activeOpacity={0.7}
                        >
                            {forceRefreshing
                                ? <ActivityIndicator size="small" color={COLORS.primary} />
                                : <PanelIcon name="refresh" color={COLORS.primary} size={14} />}
                            <Text style={styles.refreshBtnText}>{forceRefreshing ? 'Syncing...' : 'Refresh Cache'}</Text>
                        </TouchableOpacity>

                        <View style={styles.livePill}>
                            <View style={styles.liveDot} />
                            <Text style={styles.livePillText}>LIVE</Text>
                        </View>
                    </View>

                    <Text style={styles.heroEyebrow}>COMMAND CENTER</Text>
                    <Text style={styles.heroTitle}>Welcome back, {adminName}</Text>

                    {/* KPI strip — always visible */}
                    <View style={styles.kpiRow}>
                        <KpiCell label="DAU" value={metrics?.dau} loading={metricsLoading} />
                        <KpiCell label="WAU" value={metrics?.wau} loading={metricsLoading} />
                        <KpiCell label="MAU" value={metrics?.mau} loading={metricsLoading} />
                        <KpiCell label="TOTAL USERS" value={metrics?.total} loading={metricsLoading} />
                    </View>

                    {metrics?.sparkline?.length > 1 && (
                        <View style={styles.heroSpark}>
                            <Text style={styles.heroSparkLabel}>DAILY ACTIVE USERS — LAST 7 DAYS</Text>
                            <Sparkline data={metrics.sparkline} color={COLORS.primary} width={320} height={44} />
                        </View>
                    )}
                </View>

                {/* ── CATEGORY SWITCHER ────────────────────────────── */}
                <View style={styles.catRow}>
                    {CATEGORIES.map(c => (
                        <TouchableOpacity
                            key={c.key}
                            style={[styles.catTab, category === c.key && styles.catTabActive]}
                            onPress={() => setCategory(c.key)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.catTabText, category === c.key && styles.catTabTextActive]}>{c.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ══ ANALYTICS ════════════════════════════════════ */}
                {category === 'analytics' && (
                    <>
                        <Panel icon="difficulty" title="Subject Difficulty Heatmap" accent={COLORS.warning} statusText="Heatmap">
                            <LazyLoad onVisible={loadSubjects} loading={subjectsLoading} error={subjectsError} onRetry={() => loadSubjects(true)}>
                                {subjects && subjects.map((s, i) => (
                                    <View key={i} style={styles.difficultyRow}>
                                        <View style={styles.difficultyInfo}>
                                            <Text style={styles.difficultyName} numberOfLines={1}>{s.name}</Text>
                                            <Text style={styles.difficultyMeta}>{s.students} students tracked</Text>
                                        </View>
                                        <View style={styles.barTrack}>
                                            <View style={[styles.barFill, { width: `${Math.min(s.bunkRate, 100)}%`, backgroundColor: difficultyColor(s.bunkRate) }]} />
                                        </View>
                                        <Text style={[styles.difficultyPct, { color: difficultyColor(s.bunkRate) }]}>{s.bunkRate.toFixed(0)}% bunked</Text>
                                    </View>
                                ))}
                                {subjects && subjects.length === 0 && <Text style={styles.emptyText}>Not enough data collected yet</Text>}
                            </LazyLoad>
                        </Panel>

                        <Panel icon="trending-down" title="Bunk Culture Index" accent={COLORS.danger} statusText="Weekly">
                            <LazyLoad onVisible={loadBunk} loading={bunkLoading} error={bunkError} onRetry={() => loadBunk(true)}>
                                {bunkIndex && bunkIndex.map((d, i) => (
                                    <BarProgress key={i} label={d.day} value={d.bunkRate} maxVal={100} color={d.bunkRate >= 30 ? COLORS.danger : d.bunkRate >= 15 ? COLORS.warning : COLORS.success} />
                                ))}
                                {bunkIndex && bunkIndex.length === 0 && <Text style={styles.emptyText}>No data yet</Text>}
                            </LazyLoad>
                        </Panel>

                        <Panel icon="users" title="Batch Distribution" accent={COLORS.success} statusText="Cohorts">
                            <LazyLoad onVisible={loadBatches} loading={batchLoading} error={batchError} onRetry={() => loadBatches(true)}>
                                {batches && batches.map((b, i) => (
                                    <View key={i} style={styles.batchRow}>
                                        <Text style={styles.batchLabel}>{b.batch}</Text>
                                        <View style={styles.barTrack}>
                                            <View style={[styles.barFill, { width: `${b.percentage}%`, backgroundColor: COLORS.primary }]} />
                                        </View>
                                        <Text style={styles.batchCount}>{b.count} users ({b.percentage.toFixed(0)}%)</Text>
                                    </View>
                                ))}
                                {batches && batches.length === 0 && <Text style={styles.emptyText}>No batch data available</Text>}
                            </LazyLoad>
                        </Panel>
                    </>
                )}

                {/* ══ USERS & ROSTER (NEW) ═════════════════════════ */}
                {category === 'users' && (
                    <Panel icon="users" title="User Roster & Information Explorer" accent={COLORS.primary} statusText={`${roster ? roster.length : 0} Accounts`}>
                        <LazyLoad onVisible={loadUsersTab} loading={rosterLoading} error={rosterError} onRetry={() => loadUsersTab(true)}>
                            <View style={styles.searchBar}>
                                <PanelIcon name="search" color={COLORS.textMuted} size={16} />
                                <TextInput
                                    style={styles.searchInput}
                                    value={rosterQuery}
                                    onChangeText={setRosterQuery}
                                    placeholder="Search by Roll Number or Name..."
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>

                            {filteredRoster.map((u, i) => {
                                const lastActiveStr = u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Never';
                                const isRevoked = revoked?.some(r => r.rollNumber === u.rollNumber);
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.userCard}
                                        onPress={() => setSelectedUser(u)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.userCardHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.userCardTitle}>{u.studentName}</Text>
                                                <Text style={styles.userCardSub}>Roll: {u.rollNumber} • Last Active: {lastActiveStr}</Text>
                                            </View>
                                            <View style={[styles.userBadge, { backgroundColor: isRevoked ? COLORS.dangerLight : u.setupComplete ? COLORS.successLight : COLORS.warningLight }]}>
                                                <Text style={[styles.userBadgeText, { color: isRevoked ? COLORS.dangerDark : u.setupComplete ? COLORS.successDark : COLORS.warningDark }]}>
                                                    {isRevoked ? 'REVOKED' : u.setupComplete ? 'ACTIVE' : 'SETUP PENDING'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.userStatsRow}>
                                            <View style={styles.userStatCell}>
                                                <Text style={styles.userStatVal}>{u.totalSubjects}</Text>
                                                <Text style={styles.userStatLbl}>Subjects</Text>
                                            </View>
                                            <View style={styles.userStatCell}>
                                                <Text style={styles.userStatVal}>{u.totalClasses || 0}</Text>
                                                <Text style={styles.userStatLbl}>Classes</Text>
                                            </View>
                                            <View style={styles.userStatCell}>
                                                <Text style={[styles.userStatVal, { color: u.overallAttendancePct >= 75 ? COLORS.success : COLORS.danger }]}>
                                                    {u.overallAttendancePct != null ? `${u.overallAttendancePct}%` : '—'}
                                                </Text>
                                                <Text style={styles.userStatLbl}>Attendance</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {filteredRoster.length === 0 && <Text style={styles.emptyText}>No matching users found</Text>}
                        </LazyLoad>
                    </Panel>
                )}

                {/* ══ OPERATIONS ═══════════════════════════════════ */}
                {category === 'operations' && (
                    <>
                        <Panel icon="activity" title="Endpoint Health" accent={COLORS.success} statusText="24h Telemetry">
                            <LazyLoad onVisible={loadEndpoints} loading={endpointsLoading} error={endpointsError} onRetry={() => loadEndpoints(true)}>
                                {endpoints && endpoints.map((ep, i) => (
                                    <View key={i} style={styles.endpointRow}>
                                        <View style={[styles.statusDot, { backgroundColor: endpointColor(ep.successRate) }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.endpointName}>{ep.name}</Text>
                                            <Text style={styles.endpointMeta}>{ep.avgDuration}ms avg latency • {ep.count} calls</Text>
                                        </View>
                                        <Text style={[styles.endpointRate, { color: endpointColor(ep.successRate) }]}>{ep.successRate.toFixed(1)}%</Text>
                                    </View>
                                ))}
                                {endpoints && endpoints.length === 0 && <Text style={styles.emptyText}>No telemetry data yet</Text>}
                            </LazyLoad>
                        </Panel>

                        <Panel icon="alert" title="Parser Failures Log" accent={COLORS.danger} statusText="Recent Errors">
                            <LazyLoad onVisible={loadFailures} loading={failuresLoading} error={failuresError} onRetry={() => loadFailures(true)}>
                                {failures && failures.map((f, i) => (
                                    <FailureCard key={i} failure={f} />
                                ))}
                                {failures && failures.length === 0 && <Text style={styles.emptyText}>No recent parser failures</Text>}
                            </LazyLoad>
                        </Panel>

                        <Panel
                            icon="zap"
                            title="ERP Outage Monitor"
                            accent={downtimeEvents?.length ? COLORS.danger : COLORS.success}
                            statusText={downtimeEvents?.length ? `${downtimeEvents.length} active` : 'All clear'}
                        >
                            <LazyLoad onVisible={loadDowntime} loading={downtimeLoading} error={downtimeError} onRetry={() => loadDowntime(true)}>
                                {downtimeEvents && downtimeEvents.map((ev) => (
                                    <View key={ev.id} style={styles.downtimeRow}>
                                        <View style={[styles.statusDot, { backgroundColor: COLORS.danger }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.downtimeType}>{ev.type}</Text>
                                            <Text style={styles.downtimeMeta}>
                                                {ev.failures}/{ev.attempts} calls failed • {ev.affectedUsers} user{ev.affectedUsers === 1 ? '' : 's'} hit
                                                {ev.startedAt ? ` • since ${new Date(ev.startedAt).toLocaleTimeString()}` : ''}
                                            </Text>
                                            {!!ev.sampleError && (
                                                <Text style={styles.downtimeMeta} numberOfLines={2}>{ev.sampleError}</Text>
                                            )}
                                        </View>
                                        <Text style={[styles.endpointRate, { color: COLORS.danger }]}>{ev.failRate.toFixed(0)}%</Text>
                                    </View>
                                ))}
                                {downtimeEvents && downtimeEvents.length === 0 && (
                                    <Text style={styles.emptyText}>No endpoint is failing right now. Outages appear here automatically and clear when the endpoint recovers.</Text>
                                )}
                            </LazyLoad>
                        </Panel>

                        <Panel icon="gauge" title="Rate Limiting & Sync Frequency" accent={COLORS.warning} statusText="Monitor">
                            <LazyLoad onVisible={loadRate} loading={rateLoading} error={rateError} onRetry={() => loadRate(true)}>
                                {rateData && rateData.length > 0 && (
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.tableCell, { flex: 2 }]}>Roll Number</Text>
                                        <Text style={styles.tableCell}>Hourly</Text>
                                        <Text style={styles.tableCell}>Daily</Text>
                                        <Text style={styles.tableCell}>Status</Text>
                                    </View>
                                )}
                                {rateData && rateData.map((r, i) => (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{r.rollNumber}</Text>
                                        <Text style={styles.tableCell}>{r.hourly}</Text>
                                        <Text style={styles.tableCell}>{r.daily}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: rateStatusColor(r.status) + '22' }]}>
                                            <Text style={[styles.statusBadgeText, { color: rateStatusColor(r.status) }]}>
                                                {r.status}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                                {rateData && rateData.length === 0 && <Text style={styles.emptyText}>No sync activity recorded</Text>}
                            </LazyLoad>
                        </Panel>
                    </>
                )}

                {/* ══ CONTROLS ═════════════════════════════════════ */}
                {category === 'controls' && (
                    <>
                        <Panel icon="megaphone" title="Broadcast Announcements" accent={COLORS.primary} statusText="Publish">
                            <LazyLoad onVisible={loadAnnouncements} loading={announcementsLoading} error={announcementsError} onRetry={loadAnnouncements}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>TITLE</Text>
                                    <TextInput style={styles.input} value={annTitle} onChangeText={setAnnTitle} placeholder="Announcement title" placeholderTextColor={COLORS.textMuted} />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>MESSAGE</Text>
                                    <TextInput style={[styles.input, { minHeight: 60 }]} value={annBody} onChangeText={setAnnBody} placeholder="Announcement body..." placeholderTextColor={COLORS.textMuted} multiline />
                                </View>
                                <View style={styles.typeRow}>
                                    {['info', 'warning', 'danger'].map(t => (
                                        <TouchableOpacity key={t} style={[styles.typePill, annType === t && styles.typePillActive]} onPress={() => setAnnType(t)}>
                                            <Text style={[styles.typePillText, annType === t && styles.typePillTextActive]}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity style={styles.actionBtn} onPress={handlePublishAnnouncement} activeOpacity={0.8}>
                                    <Text style={styles.actionBtnText}>Publish Announcement</Text>
                                </TouchableOpacity>

                                {announcements && announcements.length > 0 && (
                                    <View style={{ marginTop: SPACING.md }}>
                                        <Text style={styles.subSectionLabel}>ACTIVE BROADCASTS</Text>
                                        {announcements.map((a, i) => (
                                            <View key={i} style={styles.announcementCard}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.announcementTitle}>{a.title}</Text>
                                                    <Text style={styles.announcementBody} numberOfLines={2}>{a.message}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => handleDeleteAnnouncement(a.id)}>
                                                    <Text style={{ color: COLORS.dangerText, fontWeight: '700', fontSize: 16, padding: 4 }}>✕</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </LazyLoad>
                        </Panel>

                        <Panel icon="sliders" title="Remote Feature Flags" accent={COLORS.success} statusText="App Config">
                            {Object.keys(flags).length === 0
                                ? <Text style={styles.emptyText}>No feature flags configured</Text>
                                : Object.entries(flags).map(([key, val]) => (
                                    <View key={key} style={styles.flagRow}>
                                        <Text style={styles.flagLabel}>{key}</Text>
                                        <Switch
                                            value={val}
                                            onValueChange={(v) => handleToggleFlag(key, v)}
                                            trackColor={{ false: COLORS.inputBackground, true: COLORS.success + '66' }}
                                            thumbColor={val ? COLORS.success : COLORS.textMuted}
                                        />
                                    </View>
                                ))}
                        </Panel>

                        <Panel icon="shield" title="Minimum Version Gate" accent={COLORS.warning} statusText={`v${minVersion}`}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>MINIMUM REQUIRED VERSION</Text>
                                <TextInput style={styles.input} value={minVersion} onChangeText={setMinVersion} placeholder="e.g. 2.1.0" placeholderTextColor={COLORS.textMuted} />
                            </View>
                            <TouchableOpacity style={styles.actionBtn} onPress={handlePublishVersion} activeOpacity={0.8}>
                                <Text style={styles.actionBtnText}>Publish Version Gate</Text>
                            </TouchableOpacity>
                        </Panel>

                        <Panel icon="wrench" title="Emergency Maintenance Mode" accent={maintMode ? COLORS.danger : COLORS.success} statusText={maintMode ? 'Active' : 'Off'}>
                            <View style={styles.flagRow}>
                                <Text style={styles.flagLabel}>Enable Maintenance Mode</Text>
                                <Switch
                                    value={maintMode}
                                    onValueChange={handleToggleMaintenance}
                                    trackColor={{ false: COLORS.inputBackground, true: COLORS.danger + '66' }}
                                    thumbColor={maintMode ? COLORS.danger : COLORS.textMuted}
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>PUBLIC MAINTENANCE MESSAGE</Text>
                                <TextInput style={[styles.input, { minHeight: 60 }]} value={maintMsg} onChangeText={setMaintMsg} placeholder="Maintenance message..." placeholderTextColor={COLORS.textMuted} multiline />
                            </View>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.inputBackground }]} onPress={handleSaveMaintMsg} activeOpacity={0.8}>
                                <Text style={[styles.actionBtnText, { color: COLORS.textPrimary }]}>Save Maintenance Message</Text>
                            </TouchableOpacity>
                        </Panel>

                        <Panel icon="lock" title="User Revocation List" accent={COLORS.danger} statusText="Access Lock">
                            <LazyLoad onVisible={loadRevoked} loading={revokedLoading} error={revokedError} onRetry={loadRevoked}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>TARGET ROLL NUMBER</Text>
                                    <TextInput style={styles.input} value={revokeRoll} onChangeText={setRevokeRoll} placeholder="e.g. 2410990123" placeholderTextColor={COLORS.textMuted} />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>REASON FOR REVOCATION</Text>
                                    <TextInput style={styles.input} value={revokeReason} onChangeText={setRevokeReason} placeholder="Reason for revoking access..." placeholderTextColor={COLORS.textMuted} />
                                </View>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={() => handleRevokeUser()} activeOpacity={0.8}>
                                    <Text style={styles.actionBtnText}>Revoke Access</Text>
                                </TouchableOpacity>

                                {revoked && revoked.length > 0 && (
                                    <View style={{ marginTop: SPACING.md }}>
                                        <Text style={styles.subSectionLabel}>REVOKED ROLL NUMBERS</Text>
                                        {revoked.map((r, i) => (
                                            <View key={i} style={styles.revokedRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.revokedRoll}>{r.rollNumber}</Text>
                                                    <Text style={styles.revokedReason}>{r.reason}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => handleUnrevokeUser(r.rollNumber)} style={styles.resolveBtn}>
                                                    <Text style={styles.resolveBtnText}>Reinstate</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </LazyLoad>
                        </Panel>
                    </>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ══ USER DETAILS MODAL ═════════════════════════════ */}
            {selectedUser && (
                <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedUser(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>{selectedUser.studentName}</Text>
                                    <Text style={styles.modalSub}>Roll: {selectedUser.rollNumber} • App v{selectedUser.version}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.modalCloseBtn}>
                                    <Text style={styles.modalCloseText}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
                                <View style={styles.userModalMetaRow}>
                                    <View style={styles.userStatCell}>
                                        <Text style={styles.userStatVal}>{selectedUser.semesterCount}</Text>
                                        <Text style={styles.userStatLbl}>Semesters</Text>
                                    </View>
                                    <View style={styles.userStatCell}>
                                        <Text style={styles.userStatVal}>{selectedUser.totalAttended}/{selectedUser.totalClasses}</Text>
                                        <Text style={styles.userStatLbl}>Attended/Total</Text>
                                    </View>
                                    <View style={styles.userStatCell}>
                                        <Text style={[styles.userStatVal, { color: (selectedUser.overallAttendancePct || 0) >= 75 ? COLORS.success : COLORS.danger }]}>
                                            {selectedUser.overallAttendancePct != null ? `${selectedUser.overallAttendancePct}%` : '—'}
                                        </Text>
                                        <Text style={styles.userStatLbl}>Overall %</Text>
                                    </View>
                                </View>

                                <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>TRACKED SUBJECTS ({selectedUser.subjects?.length || 0})</Text>
                                {(selectedUser.subjects || []).map((sub, i) => (
                                    <View key={i} style={styles.userSubjectRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.userSubName}>{sub.name}</Text>
                                            <Text style={styles.userSubMeta}>{sub.attended}/{sub.total} classes • Target {sub.target}%</Text>
                                        </View>
                                        <Text style={[styles.userSubPct, { color: sub.pct >= sub.target ? COLORS.success : COLORS.danger }]}>
                                            {sub.pct.toFixed(1)}%
                                        </Text>
                                    </View>
                                ))}
                                {(!selectedUser.subjects || selectedUser.subjects.length === 0) && (
                                    <Text style={styles.emptyText}>No subject details available for this user.</Text>
                                )}
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: COLORS.danger, flex: 1 }]}
                                    onPress={async () => {
                                        const target = selectedUser.rollNumber;
                                        setSelectedUser(null);
                                        await handleRevokeUser(target, 'Revoked from User Explorer');
                                    }}
                                >
                                    <Text style={styles.actionBtnText}>Revoke User Access</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

// ─── LAZY LOAD WRAPPER ──────────────────────────────────────────
function LazyLoad({ onVisible, loading, error, onRetry, children }) {
    const styles = getStyles();
    useEffect(() => { onVisible(); }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Fetching data...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText} numberOfLines={2}>Failed to load: {error}</Text>
                {onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return <>{children}</>;
}

// ─── KPI CELL ───────────────────────────────────────────────────
function KpiCell({ label, value, loading }) {
    const styles = getStyles();
    return (
        <View style={styles.kpiCell}>
            {loading && value == null
                ? <ActivityIndicator size="small" color={COLORS.primary} style={{ height: 30 }} />
                : <Text style={styles.kpiValue}>{value != null ? value : '—'}</Text>}
            <Text style={styles.kpiLabel}>{label}</Text>
        </View>
    );
}

// ─── FAILURE CARD ───────────────────────────────────────────────
function FailureCard({ failure }) {
    const [expanded, setExpanded] = useState(false);
    const styles = getStyles();
    const ts = Number.isFinite(failure.timestampMs)
        ? new Date(failure.timestampMs).toLocaleString()
        : 'Unknown';

    return (
        <TouchableOpacity style={styles.failureCard} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
            <View style={styles.failureHeader}>
                <Text style={styles.failureUser}>{failure.rollNumber}</Text>
                <Text style={styles.failureTime}>{ts}</Text>
            </View>
            {expanded && (failure.errors || []).map((err, i) => (
                <View key={i} style={styles.failureDetail}>
                    <Text style={styles.failureComponent}>{err.component}</Text>
                    <Text style={styles.failureError}>{err.error}</Text>
                </View>
            ))}
        </TouchableOpacity>
    );
}

// ─── STYLES ─────────────────────────────────────────────────────
const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingHorizontal: SPACING.screenPadding, paddingTop: SPACING.sm },
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingCenterText: { marginTop: SPACING.sm, color: COLORS.textMuted, fontSize: 14 },

    loadingContainer: { padding: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACING.xs },
    loadingText: { color: COLORS.textMuted, fontSize: 13 },
    errorContainer: { padding: SPACING.md, alignItems: 'center', backgroundColor: COLORS.dangerLight, borderRadius: BORDER_RADIUS.md, gap: SPACING.xs },
    errorText: { color: COLORS.dangerDark, fontSize: 13, textAlign: 'center' },
    retryBtn: { backgroundColor: COLORS.danger, paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: BORDER_RADIUS.sm },
    retryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BORDER_RADIUS.full },
    refreshBtnText: { ...TYPOGRAPHY.micro, color: COLORS.primary, fontWeight: '700' },

    // Hero
    hero: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.medium,
    },
    heroControlsRow: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'center', justifyContent: 'flex-end', marginBottom: SPACING.sm },
    heroEyebrow: { ...TYPOGRAPHY.micro, color: COLORS.primary, letterSpacing: 1.2, fontWeight: '800' },
    heroTitle: { ...TYPOGRAPHY.headingLarge, color: COLORS.textPrimary, fontSize: 22, marginTop: 4 },
    livePill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.successLight,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
    livePillText: { ...TYPOGRAPHY.micro, color: COLORS.successDark, fontWeight: '800', letterSpacing: 0.5 },

    // KPI strip
    kpiRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.lg },
    kpiCell: {
        flex: 1, alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.sm,
    },
    kpiValue: { ...TYPOGRAPHY.displayLarge, color: COLORS.textPrimary, fontSize: 22 },
    kpiLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 2, letterSpacing: 0.5, fontWeight: '700', fontSize: 9 },
    heroSpark: {
        marginTop: SPACING.md, alignItems: 'center',
        borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: SPACING.md,
    },
    heroSparkLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: SPACING.sm, letterSpacing: 0.8 },

    // Category tabs
    catRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    catTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
    catTabActive: { backgroundColor: COLORS.cardBackground, ...SHADOWS.small },
    catTabText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted, fontWeight: '600' },
    catTabTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

    // Panel
    panel: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.md,
        overflow: 'hidden',
        ...SHADOWS.small,
    },
    panelHeader: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
        borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
    },
    panelIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    panelTitle: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary, flex: 1 },
    panelPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
    panelPillText: { ...TYPOGRAPHY.micro, fontWeight: '700' },
    panelBody: { padding: SPACING.md },

    statusDot: { width: 8, height: 8, borderRadius: 4 },

    // Difficulty
    difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
    difficultyInfo: { width: 120 },
    difficultyName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
    difficultyMeta: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
    difficultyPct: { ...TYPOGRAPHY.labelSmall, width: 75, textAlign: 'right', fontWeight: '700' },

    // Bar / Progress
    barRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
    barLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, width: 80, fontWeight: '600' },
    barTrack: { flex: 1, height: 8, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    barValue: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary, width: 45, textAlign: 'right', fontWeight: '700' },

    // Batch
    batchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
    batchLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, width: 90, fontWeight: '600' },
    batchCount: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted, width: 90, textAlign: 'right' },

    // User Roster
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
    userCard: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderSubtle },
    userCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    userCardTitle: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary, fontWeight: '700' },
    userCardSub: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 2 },
    userBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
    userBadgeText: { ...TYPOGRAPHY.micro, fontWeight: '800' },
    userStatsRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: SPACING.xs },
    userStatCell: { flex: 1, alignItems: 'center' },
    userStatVal: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary, fontWeight: '800' },
    userStatLbl: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, fontSize: 10 },

    // Endpoints
    endpointRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8 },
    endpointName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
    endpointMeta: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
    endpointRate: { ...TYPOGRAPHY.labelSmall, fontWeight: '700' },

    // Downtime
    downtimeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8 },
    downtimeType: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
    downtimeMeta: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
    resolveBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm },
    resolveBtnText: { ...TYPOGRAPHY.micro, color: COLORS.primary, fontWeight: '700' },

    // Failures
    failureCard: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.xs },
    failureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    failureUser: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary, fontWeight: '700' },
    failureTime: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
    failureDetail: { marginTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: 4 },
    failureComponent: { ...TYPOGRAPHY.micro, color: COLORS.dangerText, fontWeight: '700' },
    failureError: { ...TYPOGRAPHY.micro, color: COLORS.textSecondary },

    // Rate Limit Table
    tableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    tableCell: { flex: 1, ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontSize: 12 },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
    statusBadgeText: { ...TYPOGRAPHY.micro, fontWeight: '700' },

    // Controls Inputs
    inputGroup: { marginBottom: SPACING.sm },
    inputLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: 4, fontWeight: '700' },
    input: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
    typeRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm },
    typePill: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border },
    typePillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    typePillText: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase' },
    typePillTextActive: { color: '#FFF' },
    actionBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.xs },
    actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    flagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    flagLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
    subSectionLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, letterSpacing: 0.8, fontWeight: '800', marginBottom: SPACING.xs },
    announcementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
    announcementTitle: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary, fontWeight: '700' },
    announcementBody: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 2 },
    revokedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
    revokedRoll: { ...TYPOGRAPHY.labelSmall, color: COLORS.dangerText, fontWeight: '700' },
    revokedReason: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SPACING.lg },
    modalCard: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, maxHeight: '80%', ...SHADOWS.large },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle, paddingBottom: SPACING.sm, marginBottom: SPACING.md },
    modalTitle: { ...TYPOGRAPHY.headingMedium, color: COLORS.textPrimary, fontSize: 18 },
    modalSub: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 2 },
    modalCloseBtn: { padding: 4 },
    modalCloseText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700' },
    userModalMetaRow: { flexDirection: 'row', gap: SPACING.xs, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
    userSubjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    userSubName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
    userSubMeta: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
    userSubPct: { ...TYPOGRAPHY.labelSmall, fontWeight: '800' },
    modalFooter: { marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },

    emptyText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },
});
