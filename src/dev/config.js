/**
 * Development Configuration
 *
 * SET TO FALSE BEFORE PRODUCTION BUILD!
 */

// Master switch for dev mode
export const DEV_MODE = true;

export const DEV_MODE_CONFIG = {
    // Visual
    showDevPanel: true,
    showDebugInfo: false,

    // Data
    useMockData: false,
    persistDevChanges: false,

    // Features
    allowTimeTravel: true,
    allowDataManipulation: true,
    showCalculationLogs: true,
};

// Which mock scenario to use on first launch (if skip setup is true)
export const MOCK_SCENARIO = 'NORMAL';

// Skip setup flow (load mock data instead)
export const SKIP_SETUP = false;

// Console logging
export const ENABLE_LOGS = false;
