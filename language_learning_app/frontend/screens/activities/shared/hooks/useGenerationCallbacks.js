/**
 * useGenerationCallbacks
 *
 * Thin bridge: pulls createJob / completeJob / failJob from the global
 * ActivityGenerationContext and returns them in the shape expected by
 * useActivityData's `generationCallbacks` parameter.
 *
 * Usage in any activity screen:
 *
 *   import { useGenerationCallbacks } from './shared/hooks/useGenerationCallbacks';
 *   ...
 *   const genCallbacks = useGenerationCallbacks();
 *   const activityData = useActivityData('reading', language, ..., genCallbacks);
 */
import { useActivityGeneration } from '../../../../contexts/ActivityGenerationContext';

export function useGenerationCallbacks() {
  const { createJob, completeJob, failJob, updateJobStatus } = useActivityGeneration();
  return { createJob, completeJob, failJob, updateJobStatus };
}
