/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import SplitWorkspace, {
  IPHONE_15_PRO_STORAGE_KEY,
  IPHONE_15_PRO_VIEWPORT,
} from './components/SplitWorkspace';
import ErrorBoundary from './components/ErrorBoundary';

export { IPHONE_15_PRO_STORAGE_KEY, IPHONE_15_PRO_VIEWPORT };

export default function App() {
  return (
    <ErrorBoundary>
      <SplitWorkspace />
    </ErrorBoundary>
  );
}
