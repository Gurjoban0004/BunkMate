import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Switch, ActivityIndicator, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, TABULAR } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getAdminConfig, getActiveAnnouncements } from '../../services/adminService';
import {
    updateAdminConfig,
    fetchLive, fetchDaily, fetchUsage, fetchStudent, fetchLoginEvents, fetchUserRoster,
    fetchOverview, fetchSessionEvents, fetchSubjectDifficulty, fetchBunkCultureIndex, fetchBatchDistribution,
    fetchEndpointHealth, fetchParserFailures, fetchDowntime,
    publishAnnouncement, deleteAnnouncement,
    getRevokedUsers, revokeUser, unrevokeUser, listAuditLog, purgeUnfinishedSignups,
} from '../../services/adminApi';
import { showAlert, confirmAction } from '../../utils/alert';
import { formatRelativeTime } from '../../utils/dateHelpers';

const TABS = [
    { key: 'today', label: 'Today' },
    { key: 'students', label: 'Students' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'health', label: 'Health' },
    { key: 'controls', label: 'Controls' },
];

// Route names the app reports (api/_activity.js SCREENS) → what a person calls them.
const SCREEN_LABELS = {
    TodayMain: 'Today',
    SubjectsList: 'Subjects',
    SubjectDetail: 'Subject detail',
    SubjectPlanner: 'Planner',
    Insights: 'Insights',
    InsightsMain: 'Insights',
    Settings: 'Settings',
    EditTimetable: 'Edit timetable',
    EditSubjects: 'Edit subjects',
    ERPConnect: 'Connect college',
    AdminMain: 'Admin',
};

const REASON_COPY = {
    dead: 'college ended the session',
    stale: 'session older than a year',
    invalid_token: 'token from an older app version',
    no_persistent: 'no saved sign-in on the device',
    expired: 'saved sign-in expired',
};

// How api/_activity.js labels a sign-in attempt, in words and in colour.
const OUTCOME_COPY = {
    trusted: 'Signed in — trusted device',
    'otp-sent': 'OTP sent — new device',
    'otp-verified': 'Signed in — OTP verified',
    rejected: 'Rejected by the college',
    error: 'Could not reach the college',
};
const OUTCOME_TONE = {
    trusted: COLORS.success,
    'otp-verified': COLORS.success,
    'otp-sent': COLORS.warning,
    rejected: COLORS.danger,
    error: COLORS.danger,
};

const TZ = 'Asia/Kolkata';
const DAY = 86400000;

// ─── Formatting ──────────────────────────────────────────────────────
const fmtWhen = (ms) => (ms ? formatRelativeTime(ms) : '—');
const fmtClock = (ms) => (ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '—');
const fmtDay = (day) => new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
const fmtMinutes = (m) => {
    if (!m) return '0m';
    const h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
};
const istDay = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));
const shiftDay = (day, n) => istDay(Date.parse(`${day}T12:00:00+05:30`) + n * DAY);

/** Screen counts → [{ label, count }] with Insights/InsightsMain merged, most used first. */
function featureRows(screens) {
    const byLabel = {};
    Object.entries(screens || {}).forEach(([k, n]) => {
        const label = SCREEN_LABELS[k] || k;
        byLabel[label] = (byLabel[label] || 0) + (Number(n) || 0);
    });
    return Object.entries(byLabel).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

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
        megaphone: <><Path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" {...p} /><Path d="M14 8a4 4 0 0 1 0 8" {...p} /></>,
        sliders: <><Line x1="4" y1="8" x2="20" y2="8" {...p} /><Line x1="4" y1="16" x2="20" y2="16" {...p} /><Circle cx="9" cy="8" r="2.6" {...p} fill={color} /><Circle cx="15" cy="16" r="2.6" {...p} fill={color} /></>,
        shield: <Path d="M12 3l7 3v5c0 4-3 7.4-7 8-4-.6-7-4-7-8V6z" {...p} />,
        wrench: <Path d="M14.6 6.4a3.6 3.6 0 0 0-4.9 4.2l-5.4 5.4a1.5 1.5 0 0 0 2.1 2.1l5.4-5.4a3.6 3.6 0 0 0 4.2-4.9l-2.1 2.1-1.4-1.4z" {...p} />,
        lock: <><Rect x="5" y="11" width="14" height="9" rx="2" {...p} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} /></>,
        search: <><Circle cx="11" cy="11" r="7" {...p} /><Line x1="16" y1="16" x2="21" y2="21" {...p} /></>,
        refresh: <><Path d="M23 4v6h-6" {...p} /><Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" {...p} /></>,
        key: <><Circle cx="8" cy="15" r="4" {...p} /><Path d="M10.8 12.2 20 3l2 2-3 3-2-2 2-2" {...p} /></>,
        list: <><Line x1="8" y1="6" x2="21" y2="6" {...p} /><Line x1="8" y1="12" x2="21" y2="12" {...p} /><Line x1="8" y1="18" x2="21" y2="18" {...p} /><Circle cx="4" cy="6" r="1" {...p} fill={color} /><Circle cx="4" cy="12" r="1" {...p} fill={color} /><Circle cx="4" cy="18" r="1" {...p} fill={color} /></>,
        clock: <><Circle cx="12" cy="12" r="9" {...p} /><Polyline points="12 7 12 12 15.5 14" {...p} /></>,
        grid: <><Rect x="3.5" y="3.5" width="7" height="7" rx="1.5" {...p} /><Rect x="13.5" y="3.5" width="7" height="7" rx="1.5" {...p} /><Rect x="3.5" y="13.5" width="7" height="7" rx="1.5" {...p} /><Rect x="13.5" y="13.5" width="7" height="7" rx="1.5" {...p} /></>,
        chart: <><Line x1="5" y1="20" x2="5" y2="11" {...p} /><Line x1="12" y1="20" x2="12" y2="5" {...p} /><Line x1="19" y1="20" x2="19" y2="14" {...p} /></>,
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

function Bar({ value, maxVal, color, label, right }) {
    const styles = getStyles();
    const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
    return (
        <View style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
            <Text style={[styles.barValue, TABULAR]}>{right ?? `${value.toFixed(0)}%`}</Text>
        </View>
    );
}

/** Vertical bars. `onPress(i)` makes each column tappable. */
function Columns({ values, labels, highlight, color, onPress, height = 90 }) {
    const styles = getStyles();
    const max = Math.max(...values, 1);
    return (
        <View>
            <View style={[styles.colsRow, { height }]}>
                {values.map((v, i) => {
                    const Wrap = onPress ? TouchableOpacity : View;
                    const tap = onPress ? { onPress: () => onPress(i), activeOpacity: 0.7 } : {};
                    return (
                        <Wrap key={i} style={styles.colCell} {...tap}>
                            {v > 0 && <Text style={[styles.colValue, TABULAR]}>{v}</Text>}
                            <View style={[styles.colBar, {
                                height: `${Math.max((v / max) * 78, v > 0 ? 4 : 1)}%`,
                                backgroundColor: i === highlight ? COLORS.textPrimary : v > 0 ? color : COLORS.borderSubtle,
                            }]} />
                        </Wrap>
                    );
                })}
            </View>
            <View style={styles.colsLabels}>
                {labels.map((l, i) => <Text key={i} style={styles.colLabel} numberOfLines={1}>{l}</Text>)}
            </View>
        </View>
    );
}

/** A 24-hour strip with a segment per session. */
function DayStrip({ sessions, dayStart }) {
    const styles = getStyles();
    return (
        <View style={styles.strip}>
            {[6, 12, 18].map((h) => <View key={h} style={[styles.stripTick, { left: `${(h / 24) * 100}%` }]} />)}
            {sessions.map((s, i) => (
                <View key={i} style={[styles.stripSeg, {
                    left: `${Math.max(0, ((s.start - dayStart) / DAY) * 100)}%`,
                    width: `${Math.max(0.8, ((s.end - s.start) / DAY) * 100)}%`,
                }]} />
            ))}
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
            <Text style={[styles.kpiValue, TABULAR, { color }]} numberOfLines={1}>{value ?? '—'}</Text>
            <Text style={styles.kpiLabel}>{label}</Text>
        </View>
    );
}

function Empty({ children }) {
    const styles = getStyles();
    return <Text style={styles.emptyText}>{children}</Text>;
}

function Chip({ text }) {
    const styles = getStyles();
    return <View style={styles.chip}><Text style={styles.chipText}>{text}</Text></View>;
}

/**
 * A metric with its own loading/error state. `load(force)` resolves to whether
 * it succeeded and never rejects; without `force` it keeps data it already has.
 * A new fetcher (e.g. another day) starts from empty.
 */
function useMetric(fetcher) {
    const [state, setState] = useState({ data: null, loading: false, error: null });
    const dataRef = useRef(null);
    const inFlight = useRef(null);
    const generation = useRef(0);   // bumps with the fetcher, so a late answer for the old day is dropped
    const lastFetcher = useRef(fetcher);

    useEffect(() => {
        if (lastFetcher.current === fetcher) return;
        lastFetcher.current = fetcher;
        generation.current++;
        inFlight.current = null;
        dataRef.current = null;
        setState({ data: null, loading: false, error: null });
    }, [fetcher]);

    const load = useCallback((force = false) => {
        if (!force && dataRef.current) return Promise.resolve(true);
        if (inFlight.current) return inFlight.current;
        const gen = generation.current;
        const current = () => gen === generation.current;
        setState((s) => ({ ...s, loading: true, error: null }));
        const request = fetcher(force).then(
            (data) => { if (!current()) return false; dataRef.current = data; setState({ data, loading: false, error: null }); return true; },
            (e) => { if (!current()) return false; setState((s) => ({ ...s, loading: false, error: e?.message || 'Failed to load' })); return false; },
        ).finally(() => { if (inFlight.current === request) inFlight.current = null; });
        inFlight.current = request;
        return request;
    }, [fetcher]);

    const setData = useCallback((update) => setState((s) => {
        const data = typeof update === 'function' ? update(s.data) : update;
        dataRef.current = data;
        return { ...s, data };
    }), []);

    return { ...state, load, setData };
}

// ─── Screen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
    const styles = getStyles();
    const { state } = useApp();
    const roll = state.erpRollNumber;
    const [tab, setTab] = useState('today');
    const [refreshing, setRefreshing] = useState(false);

    // Config
    const [config, setConfig] = useState(null);
    const [configError, setConfigError] = useState(null);
    const [flags, setFlags] = useState({});
    const [minVersion, setMinVersion] = useState('');
    const [updateUrl, setUpdateUrl] = useState('');
    const [maintMode, setMaintMode] = useState(false);
    const [maintMsg, setMaintMsg] = useState('');

    // Today tab
    const [day, setDay] = useState(null);           // null = today
    const [expanded, setExpanded] = useState(null);
    const [featureRange, setFeatureRange] = useState('day');

    // Metrics
    const live = useMetric(useCallback((f) => fetchLive(f), []));
    const daily = useMetric(useCallback((f) => fetchDaily(day, f), [day]));
    const usage = useMetric(useCallback((f) => fetchUsage(f), []));
    const logins = useMetric(useCallback((f) => fetchLoginEvents(f), []));
    const roster = useMetric(useCallback((f) => fetchUserRoster(f), []));
    const overview = useMetric(useCallback((f) => fetchOverview(f), []));
    const sessions = useMetric(useCallback((f) => fetchSessionEvents(f), []));
    const difficulty = useMetric(useCallback((f) => fetchSubjectDifficulty(f), []));
    const bunk = useMetric(useCallback((f) => fetchBunkCultureIndex(f), []));
    const batches = useMetric(useCallback((f) => fetchBatchDistribution(f), []));
    const endpoints = useMetric(useCallback((f) => fetchEndpointHealth(f), []));
    const failures = useMetric(useCallback((f) => fetchParserFailures(f), []));
    const downtime = useMetric(useCallback((f) => fetchDowntime(f), []));
    const announcements = useMetric(useCallback(() => getActiveAnnouncements(), []));
    const revoked = useMetric(useCallback(() => getRevokedUsers(), []));
    const audit = useMetric(useCallback(() => listAuditLog(), []));

    // Students tab
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);   // { rollNumber, studentName }
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
            setUpdateUrl(c.updateUrl || '');
            setMaintMode(!!c.maintenanceMode);
            setMaintMsg(c.maintenanceMessage || '');
        } catch (e) {
            setConfigError(e?.message || 'Could not load the remote config.');
        }
    }, []);

    // The roster is loaded up front: it is what turns a roll number into a name
    // on every other list.
    useEffect(() => { loadConfig(); roster.load(); revoked.load(); live.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { daily.load(); }, [daily.load]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (tab === 'health') overview.load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    const viewingToday = !day || day === daily.data?.day && daily.data?.isToday;

    // Online-now and today's list are only true if they keep asking. The server
    // caches them (20s / 60s), so a poll is at most one real read per tick.
    useEffect(() => {
        if (tab !== 'today' || !viewingToday) return undefined;
        const fast = setInterval(() => { live.load(true); }, 60000);
        const slow = setInterval(() => { daily.load(true); }, 120000);
        return () => { clearInterval(fast); clearInterval(slow); };
    }, [tab, viewingToday]); // eslint-disable-line react-hooks/exhaustive-deps

    const tabMetrics = {
        today: [live, daily, usage, logins],
        students: [roster, revoked],
        attendance: [overview, difficulty, bunk, batches],
        health: [overview, downtime, endpoints, sessions, failures],
        controls: [announcements, revoked, audit],
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const metrics = tabMetrics[tab] || [];
            const results = await Promise.all([loadConfig(), ...metrics.map((m) => m.load(true))]);
            const failed = results.slice(1).filter((ok) => !ok).length;
            if (failed) showAlert('Partly refreshed', `${metrics.length - failed} of ${metrics.length} panels reloaded; the rest show their own error.`);
        } finally {
            setRefreshing(false);
        }
    };

    // ── Names ────────────────────────────────────────────────────
    // Every list carries a roll number; the name comes from whichever source
    // has one. Rolls are shown small, under the name.
    const names = useMemo(() => {
        const m = new Map();
        const add = (r, n) => { if (r && n && !m.has(String(r))) m.set(String(r), n); };
        (roster.data?.users || []).forEach((u) => add(u.rollNumber, u.studentName));
        (daily.data?.people || []).forEach((p) => add(p.rollNumber, p.studentName));
        (live.data?.online || []).forEach((p) => add(p.rollNumber, p.studentName));
        (logins.data?.events || []).forEach((e) => add(e.rollNumber, e.studentName));
        return m;
    }, [roster.data, daily.data, live.data, logins.data]);
    const nameOf = (r) => names.get(String(r)) || null;

    // ── Actions ──────────────────────────────────────────────────
    const run = async (mutate, successMessage) => {
        try {
            const result = await mutate();
            if (successMessage) showAlert(successMessage);
            audit.load(true);
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
        const link = updateUrl.trim();
        if (!/^\d+\.\d+\.\d+$/.test(version)) return showAlert('Invalid version', 'Use three numbers, like 2.1.0.');
        if (link && !/^https:\/\/\S+$/.test(link)) return showAlert('Invalid link', 'The download link must start with https://');
        const body = `Everyone below v${version} will be blocked until they update.${link ? '' : ' There is no download link, so the block screen will have no button.'}`;
        if (!await confirmAction('Publish version gate?', body, 'Publish')) return;
        await run(() => updateAdminConfig(roll, { minVersion: version, updateUrl: link }), 'Version gate updated');
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
        const target = String(targetRoll || revokeRoll).trim();
        const reason = (reasonText || revokeReason).trim();
        if (!target) return false;
        if (target === String(roll || '').trim()) { showAlert('Not allowed', 'You cannot revoke your own access.'); return false; }
        const who = nameOf(target) ? `${nameOf(target)} (${target})` : target;
        if (!await confirmAction('Revoke access?', `${who} will be locked out of Presence until reinstated.`)) return false;
        if (!await run(() => revokeUser(roll, target, reason), 'Access revoked')) return false;
        revoked.setData((prev) => [...(prev || []).filter((r) => r.rollNumber !== target), { rollNumber: target, reason: reason || 'No reason provided', revokedAt: Date.now() }]);
        if (!targetRoll) { setRevokeRoll(''); setRevokeReason(''); }
        return true;
    };

    const handleUnrevoke = async (target) => {
        if (!await run(() => unrevokeUser(roll, target), 'Access reinstated')) return false;
        revoked.setData((prev) => (prev || []).filter((r) => r.rollNumber !== target));
        return true;
    };

    const handlePurge = async () => {
        const count = roster.data?.unfinished?.olderThan7d ?? 0;
        if (!await confirmAction(
            'Delete leftover accounts?',
            `${count} account${count === 1 ? '' : 's'} left over from the old login codes ${count === 1 ? 'has' : 'have'} been idle for over a week. They hold no attendance data, and nothing can create new ones. A student who comes back simply signs in again.`,
            'Delete',
        )) return;
        setPurging(true);
        try {
            const result = await run(() => purgeUnfinishedSignups(7));
            if (result) {
                showAlert('Cleaned up', `Deleted ${result.deleted}. ${result.remaining > 0 ? `${result.remaining} more are newer than a week or beyond this batch.` : 'Nothing left to clean.'}`);
                await Promise.all([roster.load(true), overview.load(true)]);
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
        return students.filter((u) => String(u.rollNumber).toLowerCase().includes(q) || String(u.studentName || '').toLowerCase().includes(q));
    }, [students, query]);

    const adminName = (state.userName || 'Admin').split(' ')[0];
    const d = daily.data;
    const lv = live.data;
    const o = overview.data;
    const unfinishedOld = roster.data?.unfinished?.olderThan7d ?? 0;
    const unfinishedAll = roster.data?.unfinished?.count ?? 0;
    const shownDay = d?.day || day;
    const features = featureRows(featureRange === 'day' ? d?.screens : usage.data?.screens);
    const featureMax = features[0]?.count || 0;

    const endpointColor = (r) => (r >= 95 ? COLORS.success : r >= 85 ? COLORS.warning : COLORS.danger);
    const difficultyColor = (r) => (r >= 35 ? COLORS.danger : r >= 15 ? COLORS.warning : COLORS.success);

    // A plain function, not a component: defined in render, a component would remount every tick.
    const personLine = ({ key, rollNumber, fallback, sub, right, dot }) => (
        <TouchableOpacity key={key} style={styles.liveRow} onPress={() => setSelected({ rollNumber, studentName: nameOf(rollNumber) || fallback })} activeOpacity={0.7}>
            {dot}
            <View style={{ flex: 1 }}>
                <Text style={styles.liveRowName} numberOfLines={1}>{nameOf(rollNumber) || fallback || rollNumber || 'Unknown'}</Text>
                <Text style={styles.liveRowSub} numberOfLines={1}>{sub}</Text>
            </View>
            <Text style={styles.liveRowWhen}>{right}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.hero}>
                    <View style={styles.heroControlsRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.heroEyebrow}>ADMIN</Text>
                            <Text style={styles.heroTitle}>Hello, {adminName}</Text>
                        </View>
                        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={refreshing} activeOpacity={0.7}>
                            {refreshing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <PanelIcon name="refresh" color={COLORS.primary} size={14} />}
                            <Text style={styles.refreshBtnText}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.kpiRow}>
                        <Kpi label="ONLINE NOW" value={lv?.onlineNow} tone={lv?.onlineNow > 0 ? 'good' : undefined} />
                        <Kpi label={viewingToday ? 'USED TODAY' : `USED · ${shownDay ? fmtDay(shownDay).toUpperCase() : ''}`} value={d?.users} />
                        <Kpi label={viewingToday ? 'TIME TODAY' : 'TIME IN APP'} value={d ? fmtMinutes(d.minutes) : undefined} />
                        <Kpi label="STUDENTS" value={roster.data ? students.length : undefined} />
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.catRow}>
                    {TABS.map((t) => (
                        <TouchableOpacity key={t.key} style={[styles.catTab, tab === t.key && styles.catTabActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
                            <Text style={[styles.catTabText, tab === t.key && styles.catTabTextActive]} numberOfLines={1}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ══ TODAY ══ */}
                {tab === 'today' && (
                    <>
                        <View style={styles.dayNav}>
                            <TouchableOpacity style={styles.dayBtn} onPress={() => setDay(shiftDay(shownDay || istDay(Date.now()), -1))} accessibilityLabel="Previous day">
                                <Text style={styles.dayBtnText}>‹</Text>
                            </TouchableOpacity>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={styles.dayTitle}>{shownDay ? `${viewingToday ? 'Today · ' : ''}${fmtDay(shownDay)}` : 'Today'}</Text>
                                {!viewingToday && <TouchableOpacity onPress={() => setDay(null)}><Text style={styles.dayLink}>Back to today</Text></TouchableOpacity>}
                            </View>
                            <TouchableOpacity style={[styles.dayBtn, viewingToday && { opacity: 0.3 }]} disabled={viewingToday} onPress={() => setDay(shiftDay(shownDay, 1))} accessibilityLabel="Next day">
                                <Text style={styles.dayBtnText}>›</Text>
                            </TouchableOpacity>
                        </View>

                        <Panel icon="clock" title="Who used the app" accent={COLORS.primary} statusText={d ? `${d.users} student${d.users === 1 ? '' : 's'}` : ''}>
                            <Loadable load={daily.load} loading={daily.loading && !d} error={daily.error} onRetry={() => daily.load(true)}>
                                {d && (
                                    <>
                                        <View style={[styles.kpiRow, { marginTop: 0 }]}>
                                            <Kpi label="STUDENTS" value={d.users} />
                                            <Kpi label="SESSIONS" value={d.sessions} />
                                            <Kpi label="TIME IN APP" value={fmtMinutes(d.minutes)} />
                                            <Kpi label="AVG / STUDENT" value={fmtMinutes(d.avgMinutes)} />
                                        </View>
                                        {d.people.length === 0 ? (
                                            <Empty>{d.isToday ? 'Nobody has opened the app yet today.' : 'Nobody opened the app on this day.'}</Empty>
                                        ) : d.people.map((p) => {
                                            const open = expanded === p.rollNumber;
                                            return (
                                                <View key={p.rollNumber} style={styles.personBlock}>
                                                    <TouchableOpacity onPress={() => setExpanded(open ? null : p.rollNumber)} activeOpacity={0.7}>
                                                        <View style={styles.personHead}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.liveRowName} numberOfLines={1}>{p.studentName || nameOf(p.rollNumber) || p.rollNumber}</Text>
                                                                <Text style={styles.liveRowSub} numberOfLines={1}>
                                                                    opened {fmtClock(p.firstOpenAt)} · {p.sessions.length} session{p.sessions.length === 1 ? '' : 's'}
                                                                    {p.platform ? ` · ${p.platform}` : ''}{p.appVersion ? ` v${p.appVersion}` : ''}
                                                                </Text>
                                                            </View>
                                                            <Text style={[styles.personTime, TABULAR]}>{fmtMinutes(p.minutes)}</Text>
                                                        </View>
                                                        <DayStrip sessions={p.sessions} dayStart={d.dayStart} />
                                                    </TouchableOpacity>
                                                    {open && (
                                                        <View style={styles.personDetail}>
                                                            <Text style={styles.subSectionLabel}>{p.rollNumber}</Text>
                                                            {p.sessions.map((s, i) => (
                                                                <View key={i} style={styles.sessionRow}>
                                                                    <Text style={[styles.sessionText, TABULAR]}>{fmtClock(s.start)} – {fmtClock(s.end)}</Text>
                                                                    <Text style={[styles.sessionText, TABULAR, { color: COLORS.textMuted }]}>{fmtMinutes(s.minutes)}</Text>
                                                                </View>
                                                            ))}
                                                            <View style={styles.chipRow}>
                                                                {featureRows(p.screens).map((f) => <Chip key={f.label} text={`${f.label} ×${f.count}`} />)}
                                                                {featureRows(p.screens).length === 0 && <Text style={styles.liveRowSub}>No screen data — this student is on an app version that does not report screens.</Text>}
                                                            </View>
                                                            <TouchableOpacity onPress={() => setSelected({ rollNumber: p.rollNumber, studentName: p.studentName })}>
                                                                <Text style={styles.dayLink}>Full profile →</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                        <Text style={styles.noteText}>Times are IST. A session is time the app was open in the foreground, to the minute; beats more than five minutes apart start a new one.</Text>
                                    </>
                                )}
                            </Loadable>
                        </Panel>

                        <Panel icon="chart" title="Activity by hour" accent={COLORS.primary} statusText="students">
                            {d ? (
                                <Columns
                                    values={d.hours}
                                    labels={d.hours.map((_, h) => (h % 6 === 0 ? `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` : ''))}
                                    color={COLORS.primary}
                                />
                            ) : <Empty>Loading…</Empty>}
                        </Panel>

                        <Panel icon="grid" title="What's used most" accent={COLORS.success} statusText="screen views">
                            <View style={styles.typeRow}>
                                {[['day', viewingToday ? 'Today' : 'This day'], ['14d', 'Last 14 days']].map(([k, label]) => (
                                    <TouchableOpacity key={k} style={[styles.typePill, featureRange === k && styles.typePillActive]} onPress={() => { setFeatureRange(k); if (k === '14d') usage.load(); }}>
                                        <Text style={[styles.typePillText, featureRange === k && styles.typePillTextActive]}>{label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {featureRange === '14d' && usage.loading && !usage.data ? <Empty>Loading…</Empty>
                                : featureRange === '14d' && usage.error ? <Empty>{usage.error}</Empty>
                                    : features.length === 0 ? <Empty>No screen views recorded yet. They arrive from app versions with usage pings.</Empty>
                                        : features.map((f) => <Bar key={f.label} label={f.label} value={f.count} maxVal={featureMax} color={COLORS.success} right={`${f.count}`} />)}
                        </Panel>

                        <Panel icon="activity" title="Daily students — last 14 days" accent={COLORS.primary} statusText="tap a day">
                            <Loadable load={usage.load} loading={usage.loading && !usage.data} error={usage.error} onRetry={() => usage.load(true)}>
                                {usage.data && (
                                    <Columns
                                        values={usage.data.days.map((x) => x.users)}
                                        labels={usage.data.days.map((x, i) => (i % 2 === 1 ? '' : String(Number(x.day.slice(8)))))}
                                        highlight={usage.data.days.findIndex((x) => x.day === shownDay)}
                                        color={COLORS.primary + 'AA'}
                                        onPress={(i) => { const pick = usage.data.days[i].day; setDay(pick === istDay(Date.now()) ? null : pick); }}
                                    />
                                )}
                            </Loadable>
                        </Panel>

                        <Panel icon="users" title="Online now" accent={COLORS.successText} statusText={lv ? `updated ${fmtClock(lv.generatedAt)}` : ''}>
                            <Loadable load={live.load} loading={live.loading && !lv} error={live.error} onRetry={() => live.load(true)}>
                                {lv && (lv.online.length === 0 ? <Empty>Nobody has the app open right now.</Empty>
                                    : lv.online.map((u) => personLine({
                                        key: u.rollNumber, rollNumber: u.rollNumber, fallback: u.studentName,
                                        dot: <View style={styles.liveRowDot} />,
                                        sub: `${u.rollNumber}${u.platform ? ` · ${u.platform}` : ''}${u.appVersion ? ` v${u.appVersion}` : ''}`,
                                        right: fmtWhen(u.lastSeenAt),
                                    })))}
                            </Loadable>
                        </Panel>

                        <Panel icon="key" title="Sign-in log" accent={COLORS.primary} statusText={logins.data ? `${logins.data.loginsToday} today` : ''}>
                            <Loadable load={logins.load} loading={logins.loading && !logins.data} error={logins.error} onRetry={() => logins.load(true)}>
                                {logins.data && (
                                    <>
                                        <View style={[styles.kpiRow, { marginTop: 0 }]}>
                                            <Kpi label="LOGINS TODAY" value={logins.data.loginsToday} />
                                            <Kpi label="STUDENTS TODAY" value={logins.data.studentsToday} />
                                            <Kpi label="LOGINS 24H" value={logins.data.logins24h} />
                                            <Kpi label="FAILED 24H" value={logins.data.failed24h} tone={logins.data.failed24h > 0 ? 'warn' : 'good'} />
                                        </View>
                                        {logins.data.events.length === 0 ? <Empty>No sign-in attempts recorded yet.</Empty>
                                            : logins.data.events.slice(0, 40).map((e) => personLine({
                                                key: e.id, rollNumber: e.rollNumber, fallback: e.studentName,
                                                dot: <View style={[styles.outcomeDot, { backgroundColor: OUTCOME_TONE[e.outcome] || COLORS.textMuted }]} />,
                                                sub: `${OUTCOME_COPY[e.outcome] || e.outcome}${e.platform ? ` · ${e.platform}` : ''} · ${e.rollNumber}`,
                                                right: fmtWhen(e.at),
                                            }))}
                                    </>
                                )}
                            </Loadable>
                        </Panel>
                    </>
                )}

                {/* ══ STUDENTS ══ */}
                {tab === 'students' && (
                    <Panel icon="users" title="Students" accent={COLORS.primary} statusText={`${students.length}`}>
                        <Loadable load={roster.load} loading={roster.loading && !roster.data} error={roster.error} onRetry={() => roster.load(true)}>
                            {unfinishedAll > 0 && (
                                <View style={styles.noticeBox}>
                                    <Text style={styles.noticeText}>
                                        {unfinishedAll} leftover account{unfinishedAll === 1 ? '' : 's'} from the old login codes — not shown here.
                                        {unfinishedOld > 0 ? ` ${unfinishedOld} idle over a week.` : ''}
                                    </Text>
                                    {unfinishedOld > 0 && (
                                        <TouchableOpacity onPress={handlePurge} disabled={purging} style={styles.noticeBtn}>
                                            <Text style={styles.noticeBtnText}>{purging ? 'Deleting…' : 'Delete idle'}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                            {roster.data && (
                                <View style={styles.chipRow}>
                                    {Object.entries(roster.data.byPlatform || {}).map(([k, n]) => <Chip key={k} text={`${k} ${n}`} />)}
                                    {Object.entries(roster.data.byVersion || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => <Chip key={k} text={`v${k} · ${n}`} />)}
                                </View>
                            )}
                            <View style={styles.searchBar}>
                                <PanelIcon name="search" color={COLORS.textMuted} size={16} />
                                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Name or roll number" placeholderTextColor={COLORS.textMuted} />
                            </View>
                            {filtered.map((u) => {
                                const isRevoked = revokedSet.has(String(u.rollNumber));
                                const badge = isRevoked ? ['REVOKED', COLORS.dangerLight, COLORS.dangerDark]
                                    : !u.inCloud ? ['NO CLOUD COPY', COLORS.inputBackground, COLORS.textMuted]
                                        : !u.erpConnected ? ['DISCONNECTED', COLORS.warningLight, COLORS.warningDark]
                                            : ['ACTIVE', COLORS.successLight, COLORS.successDark];
                                return (
                                    <TouchableOpacity key={u.rollNumber} style={styles.userCard} onPress={() => setSelected({ rollNumber: u.rollNumber, studentName: u.studentName })} activeOpacity={0.7}>
                                        <View style={styles.userCardHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.userCardTitle} numberOfLines={1}>{u.studentName || 'Name not reported'}</Text>
                                                <Text style={styles.userCardSub} numberOfLines={1}>
                                                    {u.rollNumber} · {u.batchGroup} · seen {fmtWhen(u.lastActive)}{u.platform ? ` · ${u.platform}` : ''}{u.version ? ` v${u.version}` : ''}
                                                </Text>
                                            </View>
                                            <View style={[styles.userBadge, { backgroundColor: badge[1] }]}><Text style={[styles.userBadgeText, { color: badge[2] }]}>{badge[0]}</Text></View>
                                        </View>
                                        <View style={styles.userStatsRow}>
                                            <View style={styles.userStatCell}>
                                                <Text style={[styles.userStatVal, TABULAR, { color: u.overallAttendancePct == null ? COLORS.textMuted : u.overallAttendancePct >= u.goal ? COLORS.successText : COLORS.dangerText }]}>
                                                    {u.overallAttendancePct != null ? `${u.overallAttendancePct}%` : '—'}
                                                </Text>
                                                <Text style={styles.userStatLbl}>Overall</Text>
                                            </View>
                                            <View style={styles.userStatCell}><Text style={[styles.userStatVal, { color: u.belowGoal > 0 ? COLORS.dangerText : COLORS.textPrimary }]}>{u.inCloud ? u.belowGoal : '—'}</Text><Text style={styles.userStatLbl}>Below goal</Text></View>
                                            <View style={styles.userStatCell}><Text style={[styles.userStatVal, TABULAR]}>{u.loginCount ?? '—'}</Text><Text style={styles.userStatLbl}>Logins</Text></View>
                                            <View style={styles.userStatCell}><Text style={[styles.userStatVal, TABULAR]}>{u.syncCount ?? '—'}</Text><Text style={styles.userStatLbl}>Syncs</Text></View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {roster.data && filtered.length === 0 && <Empty>{students.length === 0 ? 'No student has signed in yet.' : 'No match.'}</Empty>}
                            <Text style={styles.noteText}>NO CLOUD COPY: signed in and syncing, but the phone never backed its attendance up, so there are no attendance figures for them.</Text>
                        </Loadable>
                    </Panel>
                )}

                {/* ══ ATTENDANCE ══ */}
                {tab === 'attendance' && (
                    <>
                        <Panel icon="activity" title="Across students" accent={COLORS.primary} statusText="cloud copies">
                            <Loadable load={overview.load} loading={overview.loading && !o} error={overview.error} onRetry={() => overview.load(true)}>
                                {o && (
                                    <>
                                        <View style={[styles.kpiRow, { marginTop: 0 }]}>
                                            <Kpi label="AVG ATTENDANCE" value={o.avgAttendancePct != null ? `${o.avgAttendancePct}%` : '—'} tone={o.avgAttendancePct != null && o.avgAttendancePct < 75 ? 'bad' : 'good'} />
                                            <Kpi label="BELOW GOAL" value={o.belowGoalStudents} tone={o.belowGoalStudents > 0 ? 'warn' : 'good'} />
                                            <Kpi label="WITH NUMBERS" value={o.studentsWithNumbers} />
                                            <Kpi label="CONNECTED" value={o.connected} />
                                        </View>
                                        <Text style={styles.noteText}>From the {o.students} student{o.students === 1 ? '' : 's'} whose phones back their attendance up to the cloud.</Text>
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
                                {(bunk.data || []).map((x, i) => (
                                    <Bar key={i} label={x.day} value={x.bunkRate} maxVal={100} color={x.bunkRate >= 30 ? COLORS.danger : x.bunkRate >= 15 ? COLORS.warning : COLORS.success} />
                                ))}
                                {bunk.data && bunk.data.every((x) => x.total === 0) && <Empty>No register data yet.</Empty>}
                            </Loadable>
                        </Panel>

                        <Panel icon="users" title="Batches" accent={COLORS.success} statusText="every student">
                            <Loadable load={batches.load} loading={batches.loading} error={batches.error} onRetry={() => batches.load(true)}>
                                {(batches.data || []).map((b, i) => (
                                    <Bar key={i} label={b.batch} value={b.percentage} maxVal={100} color={COLORS.primary} right={`${b.count} (${b.percentage.toFixed(0)}%)`} />
                                ))}
                                {batches.data && batches.data.length === 0 && <Empty>No students yet.</Empty>}
                            </Loadable>
                        </Panel>
                    </>
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
                                            <Text style={styles.endpointMeta}>{ev.failures}/{ev.attempts} calls failed · {ev.affectedUsers} student{ev.affectedUsers === 1 ? '' : 's'}{ev.startedAt ? ` · since ${fmtClock(ev.startedAt)}` : ''}</Text>
                                            {!!ev.sampleError && <Text style={styles.endpointMeta} numberOfLines={2}>{ev.sampleError}</Text>}
                                        </View>
                                        <Text style={[styles.endpointRate, { color: COLORS.danger }]}>{ev.failRate.toFixed(0)}%</Text>
                                    </View>
                                ))}
                                {downtime.data && downtime.data.length === 0 && <Empty>Nothing is failing in the last hour. Outages appear here on their own and clear when the college recovers.</Empty>}
                            </Loadable>
                        </Panel>

                        <Panel icon="activity" title="Endpoint health" accent={COLORS.success} statusText="24h">
                            {o && (
                                <View style={[styles.kpiRow, { marginTop: 0, marginBottom: SPACING.sm }]}>
                                    <Kpi label="SYNCS 24H" value={o.syncs24h} />
                                    <Kpi label="SUCCESS 24H" value={o.successRate24h != null ? `${o.successRate24h.toFixed(0)}%` : '—'} tone={o.successRate24h == null ? undefined : o.successRate24h >= 95 ? 'good' : o.successRate24h >= 85 ? 'warn' : 'bad'} />
                                    <Kpi label="SIGN-IN ASKS 7D" value={o.signInPrompts7d} tone={o.signInPrompts7d > 0 ? 'warn' : 'good'} />
                                    <Kpi label="LOST SIGN-INS 7D" value={o.signInLost7d} tone={o.signInLost7d > 0 ? 'bad' : 'good'} />
                                </View>
                            )}
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
                                {endpoints.data && endpoints.data.length === 0 && <Empty>No sync telemetry in the last 24 hours. It is written by the phone after a cloud sign-in, so it can be empty even while students are using the app — see the Today tab for that.</Empty>}
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
                                        {(sessions.data.recent || []).slice(0, 15).map((ev, i) => personLine({
                                            key: i, rollNumber: ev.rollNumber || ev.userId, fallback: ev.studentName,
                                            sub: REASON_COPY[ev.reason] || ev.reason, right: fmtWhen(ev.at),
                                        }))}
                                    </>
                                )}
                            </Loadable>
                        </Panel>

                        <Panel icon="alert" title="Parser failures" accent={COLORS.danger} statusText="recent">
                            <Loadable load={failures.load} loading={failures.loading} error={failures.error} onRetry={() => failures.load(true)}>
                                {(failures.data || []).map((f, i) => <FailureCard key={i} failure={f} name={nameOf(f.rollNumber)} />)}
                                {failures.data && failures.data.length === 0 && <Empty>No parser errors in the recent syncs.</Empty>}
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

                        <Panel icon="shield" title="Minimum version" accent={COLORS.warning} statusText={`v${config?.minVersion || '—'}`}>
                            <View style={styles.inputGroup}><Text style={styles.inputLabel}>REQUIRED VERSION</Text><TextInput style={styles.input} value={minVersion} onChangeText={setMinVersion} placeholder="e.g. 2.1.0" placeholderTextColor={COLORS.textMuted} /></View>
                            <View style={styles.inputGroup}><Text style={styles.inputLabel}>DOWNLOAD LINK ON THE BLOCK SCREEN</Text><TextInput style={styles.input} value={updateUrl} onChangeText={setUpdateUrl} placeholder="https://…" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" /></View>
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
                                {!!nameOf(revokeRoll.trim()) && <Text style={styles.flagHint}>{nameOf(revokeRoll.trim())}</Text>}
                                <View style={styles.inputGroup}><Text style={styles.inputLabel}>REASON</Text><TextInput style={styles.input} value={revokeReason} onChangeText={setRevokeReason} placeholder="Shown to the student" placeholderTextColor={COLORS.textMuted} /></View>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={() => (revokeRoll.trim() ? handleRevoke() : showAlert('Nothing to revoke', 'Enter a roll number first.'))} activeOpacity={0.8}><Text style={styles.actionBtnText}>Revoke access</Text></TouchableOpacity>
                                {(revoked.data || []).map((r) => (
                                    <View key={r.rollNumber} style={styles.revokedRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.revokedRoll}>{nameOf(r.rollNumber) || r.rollNumber}</Text>
                                            <Text style={styles.revokedReason}>{nameOf(r.rollNumber) ? `${r.rollNumber} · ` : ''}{r.reason}{r.revokedAt ? ` · ${fmtWhen(r.revokedAt)}` : ''}</Text>
                                        </View>
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

            {selected && (
                <StudentSheet
                    student={selected}
                    isRevoked={revokedSet.has(String(selected.rollNumber))}
                    onClose={() => setSelected(null)}
                    // Closed first: on web the confirm dialog renders beneath a Modal.
                    onRevoke={() => { setSelected(null); handleRevoke(selected.rollNumber, 'Revoked from the admin panel'); }}
                    onUnrevoke={() => { setSelected(null); handleUnrevoke(selected.rollNumber); }}
                />
            )}
        </SafeAreaView>
    );
}

// ─── Student profile ─────────────────────────────────────────────────
function StudentSheet({ student, isRevoked, onClose, onRevoke, onUnrevoke }) {
    const styles = getStyles();
    const detail = useMetric(useCallback((f) => fetchStudent(student.rollNumber, f), [student.rollNumber]));
    useEffect(() => { detail.load(); }, [detail.load]); // eslint-disable-line react-hooks/exhaustive-deps
    const s = detail.data;
    const a = s?.attendance;
    const l = s?.ledger;

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalTitle}>{s?.studentName || student.studentName || 'Name not reported'}</Text>
                            <Text style={styles.modalSub}>{student.rollNumber}{s ? ` · ${s.batchGroup}` : ''}{l?.platform ? ` · ${l.platform}` : ''}{l?.appVersion ? ` v${l.appVersion}` : ''}</Text>
                            {isRevoked && <Text style={[styles.modalSub, { color: COLORS.dangerText }]}>Access revoked{s?.revoked?.reason ? ` — ${s.revoked.reason}` : ''}</Text>}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} accessibilityLabel="Close"><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 480 }}>
                        <Loadable load={detail.load} loading={detail.loading && !s} error={detail.error} onRetry={() => detail.load(true)}>
                            {s && (
                                <>
                                    <View style={[styles.kpiRow, { marginTop: 0 }]}>
                                        <Kpi label="TIME · 30D" value={fmtMinutes(s.usageMinutes30d)} />
                                        <Kpi label="DAYS USED" value={s.usage.length} />
                                        <Kpi label="LOGINS" value={l?.loginCount ?? '—'} />
                                        <Kpi label="SYNCS" value={l?.syncCount ?? '—'} />
                                    </View>
                                    <Text style={styles.modalSub}>
                                        First seen {l?.firstSeen ? new Date(l.firstSeen).toLocaleDateString('en-IN') : '—'} · last seen {fmtWhen(l?.lastSeenAt)} · last sign-in {fmtWhen(l?.lastLoginAt)}
                                        {s.cloud ? ` · cloud copy ${fmtWhen(s.cloud.lastActive)}` : ' · no cloud copy'}
                                    </Text>

                                    <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>USAGE — LAST 30 DAYS</Text>
                                    {s.usage.length === 0 && <Empty>No recorded app openings in the last 30 days.</Empty>}
                                    {s.usage.map((u) => (
                                        <View key={u.day} style={styles.sessionDay}>
                                            <View style={styles.sessionRow}>
                                                <Text style={styles.userSubName}>{fmtDay(u.day)}</Text>
                                                <Text style={[styles.sessionText, TABULAR]}>{fmtMinutes(u.minutes)}</Text>
                                            </View>
                                            <Text style={styles.userSubMeta}>{u.sessions.map((x) => `${fmtClock(x.start)} (${fmtMinutes(x.minutes)})`).join(' · ')}</Text>
                                            {featureRows(u.screens).length > 0 && <Text style={styles.userSubMeta}>{featureRows(u.screens).map((f) => `${f.label} ×${f.count}`).join(', ')}</Text>}
                                        </View>
                                    ))}

                                    <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>ATTENDANCE ({a.subjects.length} SUBJECTS){a.overallAttendancePct != null ? ` · ${a.overallAttendancePct}%` : ''}</Text>
                                    {a.subjects.map((sub, i) => (
                                        <View key={i} style={styles.userSubjectRow}>
                                            <View style={{ flex: 1 }}><Text style={styles.userSubName}>{sub.name}</Text><Text style={styles.userSubMeta}>{sub.attended}/{sub.total} hours · goal {sub.target}%</Text></View>
                                            <Text style={[styles.userSubPct, TABULAR, { color: sub.pct >= sub.target ? COLORS.successText : COLORS.dangerText }]}>{sub.pct.toFixed(1)}%</Text>
                                        </View>
                                    ))}
                                    {a.subjects.length === 0 && <Empty>{s.cloud ? 'No subjects synced yet.' : 'This phone has not backed up attendance to the cloud.'}</Empty>}

                                    <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>SIGN-INS</Text>
                                    {s.logins.slice(0, 10).map((e) => (
                                        <View key={e.id} style={styles.sessionRow}>
                                            <Text style={[styles.userSubMeta, { flex: 1 }]} numberOfLines={1}>{OUTCOME_COPY[e.outcome] || e.outcome}{e.platform ? ` · ${e.platform}` : ''}</Text>
                                            <Text style={styles.userSubMeta}>{e.at ? new Date(e.at).toLocaleString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}</Text>
                                        </View>
                                    ))}
                                    {s.logins.length === 0 && <Empty>No sign-in attempts on record.</Empty>}

                                    <Text style={[styles.subSectionLabel, { marginTop: SPACING.md }]}>RECENT SYNCS</Text>
                                    {s.syncs.slice(0, 10).map((x, i) => (
                                        <View key={i} style={styles.sessionRow}>
                                            <Text style={[styles.userSubMeta, { flex: 1 }]} numberOfLines={1}>
                                                {x.endpoints.map((ep) => `${ep.name} ${ep.status === 'ok' ? '✓' : '✕'}`).join('  ')}{x.parserErrors.length ? `  · ${x.parserErrors.length} error${x.parserErrors.length === 1 ? '' : 's'}` : ''}
                                            </Text>
                                            <Text style={styles.userSubMeta}>{fmtWhen(x.at)}</Text>
                                        </View>
                                    ))}
                                    {s.syncs.length === 0 && <Empty>No sync telemetry from this phone.</Empty>}
                                </>
                            )}
                        </Loadable>
                    </ScrollView>
                    <View style={styles.modalFooter}>
                        {isRevoked ? (
                            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={onUnrevoke}><Text style={styles.actionBtnText}>Reinstate access</Text></TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger, flex: 1 }]} onPress={onRevoke}><Text style={styles.actionBtnText}>Revoke access</Text></TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function summariseDetail(detail) {
    if (!detail || typeof detail !== 'object') return String(detail || '');
    return Object.entries(detail).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ').slice(0, 120);
}

function FailureCard({ failure, name }) {
    const [expanded, setExpanded] = useState(false);
    const styles = getStyles();
    const ts = Number.isFinite(failure.timestampMs) ? new Date(failure.timestampMs).toLocaleString('en-IN', { timeZone: TZ }) : 'Unknown';
    return (
        <TouchableOpacity style={styles.failureCard} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
            <View style={styles.failureHeader}>
                <Text style={styles.failureUser}>{name ? `${name} · ${failure.rollNumber}` : failure.rollNumber}</Text>
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
    scrollContent: { paddingHorizontal: SPACING.screenPadding, paddingTop: SPACING.sm, width: '100%', maxWidth: 820, alignSelf: 'center' },
    loadingContainer: { padding: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACING.xs },
    loadingText: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted },
    errorContainer: { padding: SPACING.md, alignItems: 'center', backgroundColor: COLORS.dangerLight, borderRadius: BORDER_RADIUS.md, gap: SPACING.xs, marginBottom: SPACING.md },
    errorText: { ...TYPOGRAPHY.captionMedium, color: COLORS.dangerDark, textAlign: 'center' },
    retryBtn: { backgroundColor: COLORS.danger, paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: BORDER_RADIUS.sm },
    retryBtnText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textOnPrimary },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BORDER_RADIUS.full },
    refreshBtnText: { ...TYPOGRAPHY.micro, color: COLORS.primary },

    hero: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.medium },
    heroControlsRow: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'center' },
    heroEyebrow: { ...TYPOGRAPHY.micro, color: COLORS.primary, letterSpacing: 1.2 },
    heroTitle: { ...TYPOGRAPHY.headingLarge, color: COLORS.textPrimary, marginTop: 4 },
    kpiRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.md },
    kpiCell: { flex: 1, alignItems: 'center', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: 2 },
    kpiValue: { ...TYPOGRAPHY.displaySmall, fontSize: 18 },
    kpiLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 2, fontSize: 8, textAlign: 'center' },

    catRow: { flexDirection: 'row', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: 4, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    catTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
    catTabActive: { backgroundColor: COLORS.cardBackground, ...SHADOWS.small },
    catTabText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted },
    catTabTextActive: { color: COLORS.textPrimary },

    dayNav: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
    dayBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border },
    dayBtnText: { fontSize: 22, lineHeight: 24, color: COLORS.textPrimary },
    dayTitle: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary },
    dayLink: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary, marginTop: 2 },

    panel: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.small },
    panelHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    panelIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    panelTitle: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary, flex: 1 },
    panelPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
    panelPillText: { ...TYPOGRAPHY.micro },
    panelBody: { padding: SPACING.md },
    noteText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.xs },

    liveRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },
    liveRowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
    outcomeDot: { width: 8, height: 8, borderRadius: 4 },
    liveRowName: { ...TYPOGRAPHY.labelMedium, color: COLORS.textPrimary },
    liveRowSub: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted, marginTop: 1 },
    liveRowWhen: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted, ...TABULAR },

    personBlock: { paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },
    personHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 6 },
    personTime: { ...TYPOGRAPHY.labelMedium, color: COLORS.textPrimary },
    personDetail: { marginTop: SPACING.sm, padding: SPACING.sm, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md },
    strip: { height: 8, borderRadius: 4, backgroundColor: COLORS.inputBackground, overflow: 'hidden', position: 'relative' },
    stripTick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.border },
    stripSeg: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: COLORS.primary },
    sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, gap: SPACING.sm },
    sessionText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textPrimary },
    sessionDay: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: SPACING.xs },
    chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border },
    chipText: { ...TYPOGRAPHY.captionSmall, color: COLORS.textSecondary },

    colsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    colCell: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    colBar: { width: '100%', borderRadius: 3 },
    colValue: { ...TYPOGRAPHY.captionSmall, fontSize: 9, color: COLORS.textMuted, marginBottom: 2 },
    colsLabels: { flexDirection: 'row', gap: 3, marginTop: 4 },
    colLabel: { flex: 1, ...TYPOGRAPHY.captionSmall, fontSize: 9, color: COLORS.textMuted, textAlign: 'center' },

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
    barLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, width: 110 },
    barTrack: { flex: 1, height: 8, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    barValue: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary, width: 70, textAlign: 'right' },

    searchBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    searchInput: { flex: 1, color: COLORS.textPrimary, ...TYPOGRAPHY.bodyMedium },
    userCard: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderSubtle },
    userCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
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
    failureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
    failureUser: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary, flex: 1 },
    failureTime: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, textTransform: 'none' },
    failureDetail: { marginTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: 4 },
    failureComponent: { ...TYPOGRAPHY.micro, color: COLORS.dangerText },
    failureError: { ...TYPOGRAPHY.captionMedium, color: COLORS.textSecondary },

    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    tableCell: { flex: 1, ...TYPOGRAPHY.bodySmall, color: COLORS.textPrimary },

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
    flagHint: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2, marginBottom: 4 },
    subSectionLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: SPACING.xs },
    announcementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
    announcementTitle: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary },
    announcementBody: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },
    removeGlyph: { color: COLORS.dangerText, fontWeight: '700', fontSize: 16, padding: 4 },
    revokedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.xs },
    revokedRoll: { ...TYPOGRAPHY.labelSmall, color: COLORS.dangerText },
    revokedReason: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted },

    modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', padding: SPACING.lg },
    modalCard: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, maxHeight: '90%', width: '100%', maxWidth: 640, alignSelf: 'center', ...SHADOWS.large },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle, paddingBottom: SPACING.sm, marginBottom: SPACING.md },
    modalTitle: { ...TYPOGRAPHY.headingMedium, color: COLORS.textPrimary, fontSize: 18 },
    modalSub: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },
    modalCloseBtn: { padding: 4 },
    modalCloseText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700' },
    userSubjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    userSubName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
    userSubMeta: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted },
    userSubPct: { ...TYPOGRAPHY.labelSmall },
    modalFooter: { flexDirection: 'row', marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },

    emptyText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },
});
