import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Switch, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import {
    getAdminConfig, updateAdminConfig,
    fetchActiveUserMetrics, fetchSubjectDifficulty,
    fetchBunkCultureIndex, fetchBatchDistribution,
    fetchEndpointHealth, fetchParserFailures,
    getDowntimeEvents, resolveDowntime,
    fetchRateLimitData,
    getActiveAnnouncements, publishAnnouncement, deleteAnnouncement,
    getRevokedUsers, revokeUser, unrevokeUser,
} from '../../services/adminService';
import { showAlert } from '../../utils/alert';

// ─── ACCORDION SECTION ──────────────────────────────────────────
function AccordionSection({ title, statusColor, statusText, children, defaultOpen }) {
    const [open, setOpen] = useState(defaultOpen || false);
    const [loaded, setLoaded] = useState(defaultOpen || false);
    const styles = getStyles();

    const toggle = () => {
        if (!open) setLoaded(true);
        setOpen(!open);
    };

    return (
        <View style={styles.accordionCard}>
            <TouchableOpacity style={styles.accordionHeader} onPress={toggle} activeOpacity={0.7}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={styles.accordionTitle} numberOfLines={1}>{title}</Text>
                <Text style={styles.accordionStatus}>{statusText}</Text>
                <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {open && loaded && (
                <View style={styles.accordionBody}>
                    {children}
                </View>
            )}
        </View>
    );
}

// ─── SPARKLINE (SVG) ────────────────────────────────────────────
function Sparkline({ data, color, width = 200, height = 40 }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const step = width / (data.length - 1);
    const points = data.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={points} />
        </svg>
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

    // Config state
    const [config, setConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(true);

    // Analytics
    const [metrics, setMetrics] = useState(null);
    const [metricsLoading, setMetricsLoading] = useState(false);

    // Subject difficulty
    const [subjects, setSubjects] = useState(null);
    const [subjectsLoading, setSubjectsLoading] = useState(false);

    // Bunk culture
    const [bunkIndex, setBunkIndex] = useState(null);
    const [bunkLoading, setBunkLoading] = useState(false);

    // Batches
    const [batches, setBatches] = useState(null);
    const [batchLoading, setBatchLoading] = useState(false);

    // Endpoint health
    const [endpoints, setEndpoints] = useState(null);
    const [endpointsLoading, setEndpointsLoading] = useState(false);

    // Parser failures
    const [failures, setFailures] = useState(null);
    const [failuresLoading, setFailuresLoading] = useState(false);

    // Downtime
    const [downtimeEvents, setDowntimeEvents] = useState(null);
    const [downtimeLoading, setDowntimeLoading] = useState(false);

    // Rate limiting
    const [rateData, setRateData] = useState(null);
    const [rateLoading, setRateLoading] = useState(false);

    // Announcements
    const [announcements, setAnnouncements] = useState(null);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [annTitle, setAnnTitle] = useState('');
    const [annBody, setAnnBody] = useState('');
    const [annType, setAnnType] = useState('info');

    // Revoked users
    const [revoked, setRevoked] = useState(null);
    const [revokedLoading, setRevokedLoading] = useState(false);
    const [revokeRoll, setRevokeRoll] = useState('');
    const [revokeReason, setRevokeReason] = useState('');

    // Feature flags
    const [flags, setFlags] = useState({});

    // Forced update
    const [minVersion, setMinVersion] = useState('');

    // Maintenance
    const [maintMode, setMaintMode] = useState(false);
    const [maintMsg, setMaintMsg] = useState('');

    // ─── LOAD CONFIG ON MOUNT ───────────────────────────────────
    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setConfigLoading(true);
        try {
            const c = await getAdminConfig();
            setConfig(c);
            setFlags(c.featureFlags || {});
            setMinVersion(c.minVersion || '2.0.0');
            setMaintMode(c.maintenanceMode || false);
            setMaintMsg(c.maintenanceMessage || '');
        } catch (e) {
            showAlert('Failed to load admin config', 'error');
        } finally {
            setConfigLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadConfig();
        setRefreshing(false);
    };

    // ─── LAZY LOADERS ───────────────────────────────────────────
    const loadMetrics = useCallback(async () => {
        if (metrics || metricsLoading) return;
        setMetricsLoading(true);
        try { setMetrics(await fetchActiveUserMetrics()); } catch (e) { /* ignore */ } finally { setMetricsLoading(false); }
    }, [metrics, metricsLoading]);

    const loadSubjects = useCallback(async () => {
        if (subjects || subjectsLoading) return;
        setSubjectsLoading(true);
        try { setSubjects(await fetchSubjectDifficulty(state.erpRollNumber)); } catch (e) { /* ignore */ } finally { setSubjectsLoading(false); }
    }, [subjects, subjectsLoading]);

    const loadBunk = useCallback(async () => {
        if (bunkIndex || bunkLoading) return;
        setBunkLoading(true);
        try { setBunkIndex(await fetchBunkCultureIndex(state.erpRollNumber)); } catch (e) { /* ignore */ } finally { setBunkLoading(false); }
    }, [bunkIndex, bunkLoading]);

    const loadBatches = useCallback(async () => {
        if (batches || batchLoading) return;
        setBatchLoading(true);
        try { setBatches(await fetchBatchDistribution()); } catch (e) { /* ignore */ } finally { setBatchLoading(false); }
    }, [batches, batchLoading]);

    const loadEndpoints = useCallback(async () => {
        if (endpoints || endpointsLoading) return;
        setEndpointsLoading(true);
        try { setEndpoints(await fetchEndpointHealth(state.erpRollNumber)); } catch (e) { /* ignore */ } finally { setEndpointsLoading(false); }
    }, [endpoints, endpointsLoading]);

    const loadFailures = useCallback(async () => {
        if (failures || failuresLoading) return;
        setFailuresLoading(true);
        try { setFailures(await fetchParserFailures(state.erpRollNumber)); } catch (e) { /* ignore */ } finally { setFailuresLoading(false); }
    }, [failures, failuresLoading]);

    const loadDowntime = useCallback(async () => {
        if (downtimeEvents || downtimeLoading) return;
        setDowntimeLoading(true);
        try { setDowntimeEvents(await getDowntimeEvents()); } catch (e) { /* ignore */ } finally { setDowntimeLoading(false); }
    }, [downtimeEvents, downtimeLoading]);

    const loadRate = useCallback(async () => {
        if (rateData || rateLoading) return;
        setRateLoading(true);
        try { setRateData(await fetchRateLimitData(state.erpRollNumber)); } catch (e) { /* ignore */ } finally { setRateLoading(false); }
    }, [rateData, rateLoading]);

    const loadAnnouncements = useCallback(async () => {
        if (announcements || announcementsLoading) return;
        setAnnouncementsLoading(true);
        try { setAnnouncements(await getActiveAnnouncements()); } catch (e) { /* ignore */ } finally { setAnnouncementsLoading(false); }
    }, [announcements, announcementsLoading]);

    const loadRevoked = useCallback(async () => {
        if (revoked || revokedLoading) return;
        setRevokedLoading(true);
        try { setRevoked(await getRevokedUsers()); } catch (e) { /* ignore */ } finally { setRevokedLoading(false); }
    }, [revoked, revokedLoading]);

    // ─── HANDLERS ───────────────────────────────────────────────
    const roll = state.erpRollNumber;

    const handleToggleFlag = async (key, val) => {
        const newFlags = { ...flags, [key]: val };
        setFlags(newFlags);
        await updateAdminConfig(roll, { featureFlags: newFlags });
    };

    const handlePublishVersion = async () => {
        if (!minVersion.trim()) return;
        await updateAdminConfig(roll, { minVersion: minVersion.trim() });
        showAlert('Version gate updated', 'success');
    };

    const handleToggleMaintenance = async (val) => {
        setMaintMode(val);
        await updateAdminConfig(roll, { maintenanceMode: val, maintenanceMessage: maintMsg });
        showAlert(val ? 'Maintenance mode ON' : 'Maintenance mode OFF', 'success');
    };

    const handleSaveMaintMsg = async () => {
        await updateAdminConfig(roll, { maintenanceMessage: maintMsg });
        showAlert('Message updated', 'success');
    };

    const handlePublishAnnouncement = async () => {
        if (!annTitle.trim() || !annBody.trim()) return;
        try {
            const ann = await publishAnnouncement(roll, { title: annTitle, message: annBody, type: annType, expiryHours: 72 });
            setAnnouncements(prev => [ann, ...(prev || [])]);
            setAnnTitle('');
            setAnnBody('');
            showAlert('Announcement published', 'success');
        } catch (e) { showAlert('Failed to publish', 'error'); }
    };

    const handleDeleteAnnouncement = async (id) => {
        await deleteAnnouncement(roll, id);
        setAnnouncements(prev => (prev || []).filter(a => a.id !== id));
        showAlert('Announcement removed', 'success');
    };

    const handleRevokeUser = async () => {
        if (!revokeRoll.trim()) return;
        try {
            await revokeUser(roll, revokeRoll.trim(), revokeReason.trim());
            setRevoked(prev => [...(prev || []), { rollNumber: revokeRoll.trim(), reason: revokeReason.trim() }]);
            setRevokeRoll('');
            setRevokeReason('');
            showAlert('User revoked', 'success');
        } catch (e) { showAlert(e.message, 'error'); }
    };

    const handleUnrevokeUser = async (targetRollNumber) => {
        await unrevokeUser(roll, targetRollNumber);
        setRevoked(prev => (prev || []).filter(r => r.rollNumber !== targetRollNumber));
        showAlert('User reinstated', 'success');
    };

    const handleResolveDowntime = async (eventId) => {
        await resolveDowntime(roll, eventId);
        setDowntimeEvents(prev => (prev || []).map(e => e.id === eventId ? { ...e, resolvedAt: new Date() } : e));
        showAlert('Downtime resolved', 'success');
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
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textMuted} />}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Command Center</Text>
                    <Text style={styles.headerSub}>Welcome, Gurjoban</Text>
                </View>

                {/* ── 1. ACTIVE USER ANALYTICS ────────────────────── */}
                <AccordionSection
                    title="Active Users"
                    statusColor={COLORS.success}
                    statusText="Live"
                    defaultOpen
                >
                    <LazyLoad onVisible={loadMetrics} loading={metricsLoading}>
                        {metrics && (
                            <>
                                <View style={styles.bentoGrid}>
                                    <BentoCell label="DAU" value={metrics.dau} />
                                    <BentoCell label="WAU" value={metrics.wau} />
                                    <BentoCell label="MAU" value={metrics.mau} />
                                </View>
                                <View style={styles.sparklineCard}>
                                    <Text style={styles.sparklineLabel}>7-DAY TREND</Text>
                                    <Sparkline data={metrics.sparkline} color={COLORS.success} width={280} height={50} />
                                </View>
                            </>
                        )}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 2. SUBJECT DIFFICULTY ───────────────────────── */}
                <AccordionSection title="Subject Difficulty" statusColor={COLORS.warning} statusText="Heatmap">
                    <LazyLoad onVisible={loadSubjects} loading={subjectsLoading}>
                        {subjects && subjects.map((s, i) => (
                            <View key={i} style={styles.difficultyRow}>
                                <View style={styles.difficultyInfo}>
                                    <Text style={styles.difficultyName} numberOfLines={1}>{s.name}</Text>
                                    <Text style={styles.difficultyMeta}>{s.students} students</Text>
                                </View>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { width: `${Math.min(s.bunkRate, 100)}%`, backgroundColor: difficultyColor(s.bunkRate) }]} />
                                </View>
                                <Text style={[styles.difficultyPct, { color: difficultyColor(s.bunkRate) }]}>{s.bunkRate.toFixed(0)}%</Text>
                            </View>
                        ))}
                        {subjects && subjects.length === 0 && <Text style={styles.emptyText}>Not enough data yet</Text>}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 3. BUNK CULTURE INDEX ───────────────────────── */}
                <AccordionSection title="Bunk Culture Index" statusColor={COLORS.danger} statusText="Weekly">
                    <LazyLoad onVisible={loadBunk} loading={bunkLoading}>
                        {bunkIndex && bunkIndex.map((d, i) => (
                            <BarProgress key={i} label={d.day} value={d.bunkRate} maxVal={100} color={d.bunkRate >= 30 ? COLORS.danger : d.bunkRate >= 15 ? COLORS.warning : COLORS.success} />
                        ))}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 4. BATCH DETECTION ──────────────────────────── */}
                <AccordionSection title="Batch Distribution" statusColor={COLORS.success} statusText="Cohorts">
                    <LazyLoad onVisible={loadBatches} loading={batchLoading}>
                        {batches && batches.map((b, i) => (
                            <View key={i} style={styles.batchRow}>
                                <Text style={styles.batchLabel}>{b.batch}</Text>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { width: `${b.percentage}%`, backgroundColor: COLORS.primary }]} />
                                </View>
                                <Text style={styles.batchCount}>{b.count}</Text>
                            </View>
                        ))}
                        {batches && batches.length === 0 && <Text style={styles.emptyText}>No batch data available</Text>}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 5. ENDPOINT HEALTH ──────────────────────────── */}
                <AccordionSection title="Endpoint Health" statusColor={COLORS.success} statusText="24h">
                    <LazyLoad onVisible={loadEndpoints} loading={endpointsLoading}>
                        {endpoints && endpoints.map((ep, i) => (
                            <View key={i} style={styles.endpointRow}>
                                <View style={[styles.statusDot, { backgroundColor: endpointColor(ep.successRate) }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.endpointName}>{ep.name}</Text>
                                    <Text style={styles.endpointMeta}>{ep.avgDuration}ms avg</Text>
                                </View>
                                <Text style={[styles.endpointRate, { color: endpointColor(ep.successRate) }]}>{ep.successRate.toFixed(1)}%</Text>
                            </View>
                        ))}
                        {endpoints && endpoints.length === 0 && <Text style={styles.emptyText}>No telemetry data yet</Text>}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 6. PARSER FAILURES ──────────────────────────── */}
                <AccordionSection title="Parser Failures" statusColor={COLORS.danger} statusText="Recent">
                    <LazyLoad onVisible={loadFailures} loading={failuresLoading}>
                        {failures && failures.map((f, i) => (
                            <FailureCard key={i} failure={f} />
                        ))}
                        {failures && failures.length === 0 && <Text style={styles.emptyText}>No parser failures</Text>}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 7. ERP DOWNTIME ─────────────────────────────── */}
                <AccordionSection title="ERP Downtime" statusColor={COLORS.success} statusText="Operational">
                    <LazyLoad onVisible={loadDowntime} loading={downtimeLoading}>
                        {downtimeEvents && downtimeEvents.map((ev, i) => (
                            <View key={i} style={styles.downtimeRow}>
                                <View style={[styles.statusDot, { backgroundColor: ev.resolvedAt ? COLORS.success : COLORS.danger }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.downtimeType}>{ev.type || 'Unknown'}</Text>
                                    <Text style={styles.downtimeMeta}>
                                        {ev.reportsCount || 0} reports
                                        {ev.resolvedAt ? ' • Resolved' : ' • Active'}
                                    </Text>
                                </View>
                                {!ev.resolvedAt && (
                                    <TouchableOpacity onPress={() => handleResolveDowntime(ev.id)} style={styles.resolveBtn}>
                                        <Text style={styles.resolveBtnText}>Resolve</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                        {downtimeEvents && downtimeEvents.length === 0 && <Text style={styles.emptyText}>No downtime events</Text>}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 8. RATE LIMITING ────────────────────────────── */}
                <AccordionSection title="Rate Limiting" statusColor={COLORS.warning} statusText="Monitor">
                    <LazyLoad onVisible={loadRate} loading={rateLoading}>
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
                        {rateData && rateData.length === 0 && <Text style={styles.emptyText}>No sync activity</Text>}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 9. ANNOUNCEMENTS ────────────────────────────── */}
                <AccordionSection title="Announcements" statusColor={COLORS.primary} statusText="Broadcast">
                    <LazyLoad onVisible={loadAnnouncements} loading={announcementsLoading}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>TITLE</Text>
                            <TextInput style={styles.input} value={annTitle} onChangeText={setAnnTitle} placeholder="Announcement title" placeholderTextColor={COLORS.textMuted} />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>MESSAGE</Text>
                            <TextInput style={[styles.input, { minHeight: 60 }]} value={annBody} onChangeText={setAnnBody} placeholder="Announcement body" placeholderTextColor={COLORS.textMuted} multiline />
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
                                <Text style={styles.subSectionLabel}>ACTIVE</Text>
                                {announcements.map((a, i) => (
                                    <View key={i} style={styles.announcementCard}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.announcementTitle}>{a.title}</Text>
                                            <Text style={styles.announcementBody} numberOfLines={2}>{a.message}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDeleteAnnouncement(a.id)}>
                                            <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 16 }}>x</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </LazyLoad>
                </AccordionSection>

                {/* ── 10. FEATURE FLAGS ───────────────────────────── */}
                <AccordionSection title="Feature Flags" statusColor={COLORS.success} statusText="Config">
                    <View>
                        {Object.entries(flags).map(([key, val]) => (
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
                    </View>
                </AccordionSection>

                {/* ── 11. FORCED UPDATE ───────────────────────────── */}
                <AccordionSection title="Version Gate" statusColor={COLORS.warning} statusText={`v${minVersion}`}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>MINIMUM VERSION</Text>
                        <TextInput style={styles.input} value={minVersion} onChangeText={setMinVersion} placeholder="e.g. 2.1.0" placeholderTextColor={COLORS.textMuted} />
                    </View>
                    <TouchableOpacity style={styles.actionBtn} onPress={handlePublishVersion} activeOpacity={0.8}>
                        <Text style={styles.actionBtnText}>Publish Version Gate</Text>
                    </TouchableOpacity>
                </AccordionSection>

                {/* ── 12. MAINTENANCE MODE ────────────────────────── */}
                <AccordionSection title="Maintenance Mode" statusColor={maintMode ? COLORS.danger : COLORS.success} statusText={maintMode ? 'Active' : 'Off'}>
                    <View style={styles.flagRow}>
                        <Text style={styles.flagLabel}>Enable Maintenance</Text>
                        <Switch
                            value={maintMode}
                            onValueChange={handleToggleMaintenance}
                            trackColor={{ false: COLORS.inputBackground, true: COLORS.danger + '66' }}
                            thumbColor={maintMode ? COLORS.danger : COLORS.textMuted}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>PUBLIC MESSAGE</Text>
                        <TextInput style={[styles.input, { minHeight: 60 }]} value={maintMsg} onChangeText={setMaintMsg} placeholder="Maintenance message..." placeholderTextColor={COLORS.textMuted} multiline />
                    </View>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.inputBackground }]} onPress={handleSaveMaintMsg} activeOpacity={0.8}>
                        <Text style={[styles.actionBtnText, { color: COLORS.textPrimary }]}>Save Message</Text>
                    </TouchableOpacity>
                </AccordionSection>

                {/* ── 13. USER REVOCATION ─────────────────────────── */}
                <AccordionSection title="User Revocation" statusColor={COLORS.danger} statusText="Access">
                    <LazyLoad onVisible={loadRevoked} loading={revokedLoading}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>ROLL NUMBER</Text>
                            <TextInput style={styles.input} value={revokeRoll} onChangeText={setRevokeRoll} placeholder="e.g. 2410990123" placeholderTextColor={COLORS.textMuted} />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>REASON</Text>
                            <TextInput style={styles.input} value={revokeReason} onChangeText={setRevokeReason} placeholder="Reason for revocation" placeholderTextColor={COLORS.textMuted} />
                        </View>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={handleRevokeUser} activeOpacity={0.8}>
                            <Text style={styles.actionBtnText}>Revoke Access</Text>
                        </TouchableOpacity>

                        {revoked && revoked.length > 0 && (
                            <View style={{ marginTop: SPACING.md }}>
                                <Text style={styles.subSectionLabel}>REVOKED LIST</Text>
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
                </AccordionSection>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── LAZY LOAD WRAPPER ──────────────────────────────────────────
function LazyLoad({ onVisible, loading, children }) {
    const styles = getStyles();
    useEffect(() => { onVisible(); }, []);
    if (loading) return <ActivityIndicator style={{ padding: SPACING.md }} size="small" color={COLORS.primary} />;
    return <>{children}</>;
}

// ─── BENTO CELL ─────────────────────────────────────────────────
function BentoCell({ label, value }) {
    const styles = getStyles();
    return (
        <View style={styles.bentoCell}>
            <Text style={styles.bentoValue}>{value}</Text>
            <Text style={styles.bentoLabel}>{label}</Text>
        </View>
    );
}

// ─── FAILURE CARD ───────────────────────────────────────────────
function FailureCard({ failure }) {
    const [expanded, setExpanded] = useState(false);
    const styles = getStyles();
    let ts = 'Unknown';
    if (failure.timestamp) {
        if (typeof failure.timestamp.toDate === 'function') {
            ts = failure.timestamp.toDate().toLocaleString();
        } else if (typeof failure.timestamp === 'object') {
            const sec = failure.timestamp._seconds ?? failure.timestamp.seconds;
            if (typeof sec === 'number') {
                ts = new Date(sec * 1000).toLocaleString();
            }
        } else if (typeof failure.timestamp === 'string') {
            ts = new Date(failure.timestamp).toLocaleString();
        }
    }

    return (
        <TouchableOpacity style={styles.failureCard} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
            <View style={styles.failureHeader}>
                <Text style={styles.failureUser}>{failure.rollNumber}</Text>
                <Text style={styles.failureTime}>{ts}</Text>
            </View>
            {expanded && failure.errors.map((err, i) => (
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
    scrollContent: { paddingHorizontal: SPACING.screenPadding, paddingTop: SPACING.md },
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { marginBottom: SPACING.lg },
    headerTitle: { ...TYPOGRAPHY.headingLarge, color: COLORS.textPrimary, fontSize: 24 },
    headerSub: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },

    // Accordion
    accordionCard: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, overflow: 'hidden' },
    accordionHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
    accordionTitle: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary, flex: 1 },
    accordionStatus: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted },
    accordionBody: { padding: SPACING.md, paddingTop: 0 },
    chevron: { fontSize: 10, color: COLORS.textMuted },
    statusDot: { width: 8, height: 8, borderRadius: 4 },

    // Bento grid
    bentoGrid: { flexDirection: 'row', gap: 1, backgroundColor: COLORS.border, borderRadius: BORDER_RADIUS.sm, overflow: 'hidden', marginBottom: SPACING.sm },
    bentoCell: { flex: 1, backgroundColor: COLORS.cardBackground, padding: SPACING.md, alignItems: 'center' },
    bentoValue: { ...TYPOGRAPHY.displayLarge, color: COLORS.textPrimary, fontSize: 28 },
    bentoLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 4 },

    // Sparkline
    sparklineCard: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.sm, padding: SPACING.md, alignItems: 'center' },
    sparklineLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: SPACING.sm },

    // Bar progress
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    barLabel: { ...TYPOGRAPHY.labelSmall, color: COLORS.textSecondary, width: 70 },
    barTrack: { flex: 1, height: 8, backgroundColor: COLORS.inputBackground, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    barValue: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted, width: 42, textAlign: 'right' },

    // Difficulty
    difficultyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    difficultyInfo: { width: 120 },
    difficultyName: { ...TYPOGRAPHY.bodySmall, color: COLORS.textPrimary },
    difficultyMeta: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted },
    difficultyPct: { ...TYPOGRAPHY.labelMedium, width: 36, textAlign: 'right' },

    // Batch
    batchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    batchLabel: { ...TYPOGRAPHY.labelSmall, color: COLORS.textSecondary, width: 80 },
    batchCount: { ...TYPOGRAPHY.labelMedium, color: COLORS.textPrimary, width: 30, textAlign: 'right' },

    // Endpoint
    endpointRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    endpointName: { ...TYPOGRAPHY.bodySmall, color: COLORS.textPrimary },
    endpointMeta: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted },
    endpointRate: { ...TYPOGRAPHY.labelMedium },

    // Downtime
    downtimeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    downtimeType: { ...TYPOGRAPHY.bodySmall, color: COLORS.textPrimary },
    downtimeMeta: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted },
    resolveBtn: { backgroundColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
    resolveBtnText: { ...TYPOGRAPHY.labelSmall, color: COLORS.primary },

    // Table
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: SPACING.xs, marginBottom: SPACING.xs },
    tableRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
    tableCell: { ...TYPOGRAPHY.captionMedium, color: COLORS.textSecondary, flex: 1 },
    statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    statusBadgeText: { ...TYPOGRAPHY.micro },

    // Input
    inputGroup: { marginBottom: SPACING.sm },
    inputLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: 4 },
    input: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, ...Platform.select({ web: { outlineStyle: 'none' } }) },

    // Action button
    actionBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.sm, paddingVertical: SPACING.sm + 2, alignItems: 'center', marginTop: SPACING.xs },
    actionBtnText: { ...TYPOGRAPHY.labelMedium, color: '#FFFFFF' },

    // Type pills
    typeRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm },
    typePill: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6, backgroundColor: COLORS.inputBackground },
    typePillActive: { backgroundColor: COLORS.primary },
    typePillText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted },
    typePillTextActive: { color: '#FFFFFF' },

    // Sub-section
    subSectionLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: SPACING.xs },

    // Announcement card
    announcementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.xs, gap: SPACING.sm },
    announcementTitle: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary },
    announcementBody: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted },

    // Flag row
    flagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
    flagLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },

    // Revoked
    revokedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    revokedRoll: { ...TYPOGRAPHY.labelMedium, color: COLORS.textPrimary },
    revokedReason: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted },

    // Failure
    failureCard: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.xs },
    failureHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    failureUser: { ...TYPOGRAPHY.labelSmall, color: COLORS.textPrimary },
    failureTime: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted },
    failureDetail: { marginTop: SPACING.xs, backgroundColor: COLORS.cardBackground, borderRadius: 4, padding: SPACING.xs },
    failureComponent: { ...TYPOGRAPHY.micro, color: COLORS.warning, marginBottom: 2 },
    failureError: { ...TYPOGRAPHY.captionSmall, color: COLORS.danger, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier' },

    // Empty
    emptyText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textMuted, textAlign: 'center', padding: SPACING.md },
});
