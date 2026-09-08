/**
 * No admin dashboard in the app builds.
 *
 * The only admin runs the panel from the browser, so shipping it inside the APK
 * put the whole panel — every metric endpoint, every control, every roll number
 * it can act on — inside a file anyone can unzip. React.lazy does not help:
 * Metro has no code splitting on native, so a lazy import is bundled anyway.
 * A platform-suffixed module is the thing that actually leaves it out — Metro
 * resolves AdminTab.native.js here and never walks into AdminScreen.js at all.
 *
 * Admin authority was never in this file. It is ADMIN_ROLL_NUMBERS on the
 * server, checked on every request. This just stops handing out the map.
 */
export const ADMIN_AVAILABLE = false;
export const AdminScreen = null;
