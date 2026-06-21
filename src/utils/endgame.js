import { COLORS } from '../theme/theme';

export function getRiskLevel(canSkip, mustAttend, remainingUnits) {
    if (mustAttend > remainingUnits) return 'impossible';
    if (canSkip === 0) return 'critical';
    if (canSkip <= 2) return 'tight';
    if (canSkip <= 5) return 'moderate';
    return 'comfortable';
}

export function getRiskColor(level) {
    if (level === 'impossible' || level === 'critical') return COLORS.danger;
    if (level === 'tight') return COLORS.warning;
    if (level === 'moderate') return COLORS.primary;
    return COLORS.success;
}

export function getRiskLabel(level) {
    const labels = { impossible: 'Cannot pass', critical: 'Zero margin', tight: 'Tight', moderate: 'Manageable', comfortable: 'Comfortable' };
    return labels[level] || '';
}

export function getSkipStrategy(subject, threshold) {
    const { canSkip, mustAttend, remainingUnits, percentage, weeklyUnits } = subject;
    const risk = getRiskLevel(canSkip, mustAttend, remainingUnits);
    const tgt = subject.target || threshold || 75;
    if (risk === 'impossible') return { headline: 'Cannot reach target', detail: `Even attending every remaining class won't reach ${tgt}%. Need ${mustAttend} but only ${remainingUnits} remain.`, action: 'Talk to your professor about attendance condonation.', emoji: '🚨' };
    if (risk === 'critical') return { headline: 'Attend every class', detail: 'Zero skip margin. Missing even one class puts you below target.', action: `Current: ${percentage.toFixed(1)}% — must attend all ${remainingUnits} remaining.`, emoji: '⚠️' };
    if (risk === 'tight') return { headline: `Skip at most ${canSkip}`, detail: `You can afford ${canSkip} absence${canSkip !== 1 ? 's' : ''} across the rest of the semester.`, action: weeklyUnits > 0 ? `~${(canSkip / weeklyUnits).toFixed(1)} weeks worth of classes.` : 'Use them wisely.', emoji: '🟡' };
    if (risk === 'moderate') return { headline: `Can skip ${canSkip} classes`, detail: 'Reasonable buffer. Spread skips across the semester.', action: weeklyUnits > 0 ? `~${Math.floor(canSkip / weeklyUnits)} full weeks off, or skip 1 every ${Math.ceil(remainingUnits / canSkip)} classes.` : `${canSkip} total skips available.`, emoji: '🟢' };
    return { headline: `Can skip ${canSkip} classes`, detail: "You're in great shape. Plenty of buffer remaining.", action: weeklyUnits > 0 ? `Could skip ~${Math.floor(canSkip / weeklyUnits)} full weeks and still pass.` : `${canSkip} total skips available.`, emoji: '✅' };
}

export const OVERALL_MESSAGES = {
    impossible: "Some subjects can't be saved — act now.",
    critical: 'No room for error. Attend everything.',
    tight: "Manageable, but don't waste skips.",
    moderate: "You're on track. Skip strategically.",
    comfortable: "You're in great shape for the semester.",
};

export function getWeeklyBurnPlan(canSkip, weeksLeft, weeklyUnits) {
    if (canSkip <= 0 || weeksLeft <= 0 || weeklyUnits <= 0) return [];
    const plan = [];
    let acc = 0;
    const rate = canSkip / weeksLeft;
    for (let w = 1; w <= weeksLeft; w++) {
        acc += rate;
        let skips = Math.floor(acc);
        skips = Math.min(skips, weeklyUnits);
        acc -= skips;
        plan.push({ week: w, skips });
    }
    let leftover = canSkip - plan.reduce((sum, p) => sum + p.skips, 0);
    for (let w = weeksLeft - 1; w >= 0 && leftover > 0; w--) {
        if (plan[w].skips < weeklyUnits) {
            plan[w].skips++;
            leftover--;
        }
    }
    return plan;
}
