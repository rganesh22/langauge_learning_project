import React from 'react';

/**
 * Context holding the root navigation ref (NavigationContainer's ref).
 * Use from nested screens (e.g. Practice tab) to navigate to Stack screens like 'Activity'.
 */
export const RootNavigationRefContext = React.createContext(null);
