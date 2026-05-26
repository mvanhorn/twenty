import { isString } from '@sniptt/guards';

import { isWorkflowIfElseAction } from 'src/modules/workflow/workflow-executor/workflow-actions/if-else/guards/is-workflow-if-else-action.guard';
import { isWorkflowIteratorAction } from 'src/modules/workflow/workflow-executor/workflow-actions/iterator/guards/is-workflow-iterator-action.guard';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

// IF-ELSE and Iterator steps store their children in settings
// (branches[].nextStepIds / initialLoopStepIds), not in the step's own
// nextStepIds. When such a step is skipped, we must recursively collect
// those nested children so they are also marked as skipped.
export const getStepIdsToSkipWithDescendants = ({
  stepIds,
  steps,
}: {
  stepIds: string[];
  steps: WorkflowAction[];
}): string[] => {
  const result = new Set<string>(stepIds);
  const queue = [...stepIds];

  while (queue.length > 0) {
    const stepId = queue.shift()!;
    const step = steps.find((candidate) => candidate.id === stepId);

    if (!step) {
      continue;
    }

    if (isWorkflowIfElseAction(step)) {
      for (const branch of step.settings.input.branches) {
        for (const childId of branch.nextStepIds) {
          if (!result.has(childId)) {
            result.add(childId);
            queue.push(childId);
          }
        }
      }
    }

    if (isWorkflowIteratorAction(step)) {
      const rawLoopStepIds = step.settings.input.initialLoopStepIds;
      const loopStepIds = isString(rawLoopStepIds)
        ? JSON.parse(rawLoopStepIds)
        : rawLoopStepIds ?? [];

      for (const childId of loopStepIds) {
        if (!result.has(childId)) {
          result.add(childId);
          queue.push(childId);
        }
      }
    }
  }

  return Array.from(result);
};
