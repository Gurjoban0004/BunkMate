# 🧠 Presence - MASTER PROJECT CONTEXT
**Last Updated:** 2026-03-04
**Platform Targets:** Android (APK via EAS) & iOS (PWA via Web)

## 1. PROJECT OVERVIEW
Presence is a beautifully crafted, privacy-first college attendance tracker designed to be an entirely offline, local-storage-only application. Built with React Native (Expo), it avoids the overhead of a backend server, ensuring blazing-fast performance and total user data ownership. The app empowers students to seamlessly track their classes with features like a tailored "Speed Paint" setup for initial configuration and an intelligent "Bunk Planner" that automatically calculates safety buffers and recovery paths based on dynamic danger thresholds.

To eliminate friction, the app focuses heavily on intuitive UX—such as 2-hour class merging, pattern detection, and a clean, pastel-driven UI that prioritizes visual clarity over clutter. The architecture firmly relies on AsyncStorage intertwined with the React Context API to maintain a single source of truth, enabling advanced offline functionalities like timeline travel (Dev Mode) and base64-based backup/restore across platforms without sacrificing performance.

## 2. DIRECTORY STRUCTURE
```
attendance-app/src/
├── components/          # Reusable UI building blocks
│   ├── common/          # Buttons, Cards, ErrorBoundary, Inputs
│   ├── calculator/      # Bunk calculator specific UI components
│   ├── subjects/        # Subject list components
│   ├── planner/         # Shared planner components (DateHeader, PlannerModeToggle)
│   └── today/           # Today screen components (ClassCard, Progress rings)
├── context/             # Global State Management
│   ├── AppContext.js    # Single source of truth for user data and schedules
│   └── AlertContext.js  # Global alert definitions handling cross-platform dialogs
├── data/                # Hardcoded and configurable data
│   └── presets.js       # Predefined class schedules and groups (e.g., CS4-G1)
├── dev/                 # Developer tools
│   ├── DevModePanel.js  # Testing time travel and mocked states
│   └── mockData/        # Mock scenarios for UI testing
├── navigation/          # React Navigation stacks & tabs
│   ├── AppNavigator.js  # Root Switcher (Setup vs. Main Tabs vs. Web)
│   ├── SetupNavigator.js# Stack for the onboarding flow
│   ├── TabNavigator.js  # Main Bottom Tabs and internal Stacks
│   ├── WebNavigator.js  # Web-specific navigation fallbacks
│   └── WebTabNavigator.js# Web-specific tab layout handling
├── screens/             # Screen-level components
│   ├── main/            # Core user-facing screens (Today, Subjects, Planner, Settings)
│   │   └── PlannerScreen/ # Unified planner views (SkipMode, FixMode, NoClasses)
│   └── setup/           # Onboarding flow (Welcome, Time Config, Speed Paint)
├── storage/             # Data persistence
│   └── storage.js       # AsyncStorage wrappers (saveAppState, loadAppState)
├── theme/               # Design System variables
│   └── theme.js         # Centralized colors, typography, spacing, shadows
└── utils/               # Core Business Logic
    ├── attendance.js    # Attendance maths, logic bound to days/slots
    ├── calculator.js    # Bunk calculations, trend detection algorithms
    ├── backlog.js       # Historic backlog calculators
    ├── dateHelpers.js   # Date/time parsers and string formatters
    ├── streak.js        # Streak tracking logic
    └── planner.js       # Planner specific derivations
```

## 3. GLOBAL STATE MANAGEMENT (The Brains)
### 3.1 State Schema
Our robust React Context (`AppContext.js`) defines the structure as follows:
```json
{
  "setupComplete": false,
  "userName": "",
  "timeSlots": [
    { "id": "1", "start": "09:00", "end": "10:00" }
  ],
  "subjects": [
    { 
      "id": "sub-uuid", 
      "name": "Subject Name", 
      "teacher": "Teacher Name", 
      "color": "#HEX", 
      "initialAttended": 0, 
      "initialTotal": 0,
      "target": 75 
    }
  ],
  "timetable": {
    "Monday": [{ "slotId": "1", "subjectId": "sub-uuid" }],
    "Tuesday": [],
    "Wednesday": [],
    "Thursday": [],
    "Friday": [],
    "Saturday": []
  },
  "attendanceRecords": {
    "YYYY-MM-DD": {
      "sub-uuid": { "status": "present|absent|cancelled", "units": 1, "isExtra": false },
      "_holiday": true
    }
  },
  "holidays": ["YYYY-MM-DD"],
  "settings": {
    "notificationEnabled": true,
    "notificationTime": "18:00",
    "smartAlertsEnabled": true,
    "dangerThreshold": 75
  },
  "notificationState": {},
  "setupDate": "YYYY-MM-DD",
  "trackingStartDate": "YYYY-MM-DD",
  "todayIncludedInSetup": false,
  "devDate": null
}
```

### 3.2 Reducer Actions
The context uses `useReducer` to enforce strict mutations:
*   `SET_TIME_SLOTS`: Updates the user's daily bell schedule.
*   `ADD_SUBJECT` / `SET_SUBJECTS` / `UPDATE_SUBJECT` / `DELETE_SUBJECT` / `SET_SUBJECT_TARGET`: Manages the subject dictionary, handles cascade deletes for timetable/attendance records.
*   `SET_TIMETABLE` / `SET_TIMETABLE_DAY`: Replaces the weekly schedule map or updates one specific day map.
*   `SET_INITIAL_ATTENDANCE`: Stores user input of historic (setup) attended/total values for calculating continuity.
*   `MARK_ATTENDANCE` / `REMOVE_ATTENDANCE` / `EDIT_ATTENDANCE`: Updates individual daily records securely appending to current dictionaries without overriding unrelated subjects.
*   `MARK_HOLIDAY` / `UNDO_HOLIDAY` / `REMOVE_HOLIDAY`: Flags particular days entirely bypassing normal scheduling maths.
*   `LOAD_PRESET`: Sets up full boilerplate configuration using preset data.
*   `COMPLETE_SETUP` / `SET_TRACKING_CONFIG`: Triggers system switches from Onboarding -> Main and tracks setup/app initialization timeframes.
*   `UPDATE_SETTINGS`: Merges user configuration overrides (e.g., danger threshold updates).
*   `LOAD_STATE` / `RESET_STATE`: Boots up app with loaded storage config or nukes all data. Features internal migration mapping (e.g., outdated colors -> new themes).

### 3.3 Storage Sync
`storage.js` acts as the persistence bridge to local storage utilizing `@react-native-async-storage/async-storage`. 
*   **Auto-Save:** Inside `AppContext.js`, a bounded `useEffect` listens to state changes and triggers `saveAppState(state)` automatically for every mutation (with debounces/flags applied on first mount).
*   **Versioning:** Handles incremental changes gracefully using an embedded `_version` tag to handle potential future migration scripts via `loadAppState()`.
*   **Backup/Restore:** Because there is no database, the entire stringified `jsonValue` can be converted via `base64.js` into an encrypted payload the user can copy/paste around to switch devices.

## 4. CORE BUSINESS LOGIC & MATH
Inside `utils/attendance.js` and `utils/calculator.js`, math handles edge scenarios uniquely to support a perfect user experience.

*   **Attendance Percentage:** Handled safely via `calculatePercentage(attended, total)`. `((attended / total) * 100 * 10) / 10`. Yields `0` dynamically if `total === 0` avoiding division by zero NaNs crashing the UI.
*   **2-Hour Classes:** Consecutive timetable slots matching identical `subjectId` running adjacent are internally aggregated into single UI blocks by `getClassesForDay()`. The algorithm scans previous slot end-times against current slot start-times. If the gap is `<= 30` minutes, it extends the `lastClass.endTime` and increments `lastClass.units += 1` instead of rendering two separate cards.
*   **The Tracking Boundary:** CRITICAL log rules apply around `setupDate` and `trackingStartDate`. Subjects track metrics spanning all historic data (`initialTotal` + `initialAttended`). The UI scans `attendanceRecords` exclusively >= `trackingStartDate`. Double-counting logs created overlapping on setup day are prevented tightly; records marked before the `trackingStartDate` threshold or globally matching `_holiday` boolean checks get ignored.
*   **Bunk Math:** Handled via `calculateBunks()` algebraic logic. 
    * To Bunk (status: safe): `canBunk = Math.floor(attended / target - total)`
    * Need to Attend (status: danger): `needAttend = Math.ceil((target * total - attended) / (1 - target))` 
    Provides Infinity protection gracefully if math targets an impossible scenario (100% threshold with 1 absence).

## 5. NAVIGATION ARCHITECTURE
React Navigation gracefully structures internal user flows.
*   **RootNavigator (`AppNavigator.js`):** Intercepts global load wrapper and conditionally routes. Uses `state.setupComplete` boolean to decide whether to mount `SetupNavigator` or `TabNavigator`. Explicitly overrides native wrappers utilizing Web Tab implementations on browser builds to protect Safari DOM hit test constraints.
*   **SetupStack (`SetupNavigator.js`):** Sequential on-boarding: `Welcome` -> `TimeSlotsScreen` -> `SubjectListScreen` -> `TimetableBuilderScreen` (Speed Paint Grid) -> `AttendanceStatsScreen` -> `SetupComplete`.
*   **MainTabs (`TabNavigator.js`):** Unified bottom tabs containing:
    * `TodayStack` (TodayScreen, Weekly Summary, Past)
    * `SubjectsStack` (List, Detail Overviews)
    * `PlannerStack` (Master Planner Layouts, Bunk Views)
    * `SettingsStack` (SettingsMain, Edit Arrays, Exports)

## 6. UI / UX DESIGN SYSTEM
### 6.1 Theme Variables
Inside `theme/theme.js`, explicit hardcoded colors are shunned in favor of structural mappings holding a "Clean Pastel & Compact" aesthetic.
*   **Colors:**
    * `background`: `#F5F7FA` (Main view backs)
    * `cardBackground`: `#FFFFFF` (Surface areas)
    * `primary`: `#8B80F9` (Pill active tabs, primary toggles)
    * `primaryLight`: `#E8E6FF` (Subtle selection highlights)
    * `success`: `#6BCB77`, `danger`: `#FF6B6B`, `warning`: `#FFD93D` (Strictly semantic boundaries, not decorative).
    * `subjectPalette`: An array of 8 muted pastels (`#85C1E9`, `#F48FB1`, etc.) ensuring no red/green subject color misdirections mask actual danger alerts.
*   **Spacing & Radii:** 8pt grid logic. Standard screen paddings default to `20px`. Heavy reliance on `{ sm: 8, md: 12, lg: 20 }` radius systems yielding the smooth pill-like app experience.
*   **Shadows/Elevation:** Cross-platform mapping handles `elevation` for Android ripples while utilizing `shadowOpacity` maps for iOS and soft `boxShadow` injects directly on Web implementations.

### 6.2 UI Principles
*   Cards universally lack `borderWidths` utilizing `SHADOWS.small` elevation for depth grouping.
*   Emojis (✅, ❌, ⚠️) exclusively depict status validation responses and shouldn't act as structural adornments.
*   Class cards inside `ClassCard.js` specifically maintain horizontal, compact layouts preserving infinite-scroll reductions.
*   Grid layouts (2-column maps) deploy in `SubjectsScreen` leveraging screen real-estate efficiently over bloated list-items.

## 7. CRITICAL COMPONENT BEHAVIORS
*   **ClassCard.js (`components/today/ClassCard.js`):** Generates active horizontal rows. Displays `2-HR CLASS` badges natively identifying parsed adjacent merges. Contains real-time action handling (Mark Present/Absent) encapsulating internal Haptic feedback triggers and animated scale interactions. Displays a grayed-out "✓ Included in setup" view overlay when intercepting `isPreCounted` signals dynamically disabling overlapping inputs for new accounts.
*   **Planner Tab (`screens/main/PlannerScreen`):** Orchestrates a dynamic hub combining mode toggles (`PlannerModeToggle`) pushing between `SkipModeView` (safe to bunk) and `FixModeView` (in danger). When `hasClassesToday()` resolves false, overrides to a friendly `NoClassesTodayView`. The planner provides visual timeline sliders and contextual week calendars tracking future paths.
*   **Preset Loader (`data/presets.js`):** Bypasses manual configuration workflows safely mapping generic group timetable blocks (e.g., `CS4-G1`) mapping 6 daily slots immediately into system states without requiring individual slot/subject mapping by new users.

## 8. DEPLOYMENT & PLATFORM SPECIFICS
*   **Android:** Packed securely using EAS Build targeting the core `eas.json` schema. Leverages `android_ripple` configs on generic `Pressable` surfaces rendering deep material interactions heavily backed by exact `elevation` mapping for floating cards.
*   **PWA / Web:** Built relying exclusively on `expo export --platform web`. Employs CSS overrides natively inside `App.js` combating Safari `use-select` zoom scaling and hidden `react-native-screens` flex-overlay blocking interactions. Clipboard fallback systems natively intercept `Backup/Restore` string limits ensuring users can copy the chunked data easily across unlinked platforms missing native deep share interfaces.
