/**
 * Centralized logging utility
 * Logs only show in development mode, except for errors
 */

export const logger = {
  /**
   * Log general information (dev only)
   */
  log: (...args) => {
    if (__DEV__) {
      console.log(...args);
    }
  },

  /**
   * Log warnings (dev only)
   */
  warn: (...args) => {
    if (__DEV__) {
      console.warn(...args);
    }
  },

  /**
   * Log errors (always logged, even in production)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Log info with emoji prefix (dev only)
   */
  info: (emoji, ...args) => {
    if (__DEV__) {
      console.log(emoji, ...args);
    }
  },
};
