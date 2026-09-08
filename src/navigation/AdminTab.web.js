import React from 'react';

/**
 * The admin dashboard, for the web build only.
 *
 * See AdminTab.native.js for why the native build gets a stub instead. Metro
 * resolves the platform suffix, so only one of the two files is ever bundled.
 */
export const ADMIN_AVAILABLE = true;

// Still lazy: the panel and its charts are dead weight for the students who
// make up every visitor except one.
export const AdminScreen = React.lazy(() => import('../screens/main/AdminScreen'));
