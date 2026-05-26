import {
  createMockCodeStep,
  createMockIfElseStep,
  createMockIteratorStep,
} from 'src/modules/workflow/workflow-executor/utils/create-mock-workflow-steps.util';
import { getStepIdsToSkipWithDescendants } from 'src/modules/workflow/workflow-executor/utils/get-step-ids-to-skip-with-descendants.util';

describe('getStepIdsToSkipWithDescendants', () => {
  it('should return the same step IDs for regular steps', () => {
    const steps = [
      createMockCodeStep('step-1', ['step-2']),
      createMockCodeStep('step-2', []),
    ];

    const result = getStepIdsToSkipWithDescendants({
      stepIds: ['step-1'],
      steps,
    });

    expect(result).toEqual(['step-1']);
  });

  it('should include branch children for an if-else step', () => {
    const steps = [
      createMockIfElseStep(
        'if-else-1',
        [
          { id: 'branch-if', filterGroupId: 'fg1', nextStepIds: ['step-a'] },
          { id: 'branch-else', nextStepIds: ['step-b'] },
        ],
      ),
      createMockCodeStep('step-a', []),
      createMockCodeStep('step-b', []),
    ];

    const result = getStepIdsToSkipWithDescendants({
      stepIds: ['if-else-1'],
      steps,
    });

    expect(result).toEqual(
      expect.arrayContaining(['if-else-1', 'step-a', 'step-b']),
    );
    expect(result).toHaveLength(3);
  });

  it('should include loop children for an iterator step', () => {
    const steps = [
      createMockIteratorStep('iterator-1', ['after-loop'], ['loop-step-1']),
      createMockCodeStep('loop-step-1', ['iterator-1']),
      createMockCodeStep('after-loop', []),
    ];

    const result = getStepIdsToSkipWithDescendants({
      stepIds: ['iterator-1'],
      steps,
    });

    expect(result).toEqual(
      expect.arrayContaining(['iterator-1', 'loop-step-1']),
    );
    expect(result).toHaveLength(2);
  });

  it('should recursively expand nested if-else inside an if-else branch', () => {
    const steps = [
      createMockIfElseStep(
        'outer-if-else',
        [
          {
            id: 'branch-if',
            filterGroupId: 'fg1',
            nextStepIds: ['inner-if-else'],
          },
          { id: 'branch-else', nextStepIds: ['step-c'] },
        ],
      ),
      createMockIfElseStep(
        'inner-if-else',
        [
          { id: 'inner-branch-if', filterGroupId: 'fg2', nextStepIds: ['step-a'] },
          { id: 'inner-branch-else', nextStepIds: ['step-b'] },
        ],
      ),
      createMockCodeStep('step-a', []),
      createMockCodeStep('step-b', []),
      createMockCodeStep('step-c', []),
    ];

    const result = getStepIdsToSkipWithDescendants({
      stepIds: ['outer-if-else'],
      steps,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        'outer-if-else',
        'inner-if-else',
        'step-a',
        'step-b',
        'step-c',
      ]),
    );
    expect(result).toHaveLength(5);
  });

  it('should handle an iterator inside an if-else branch', () => {
    const steps = [
      createMockIfElseStep(
        'if-else-1',
        [
          {
            id: 'branch-if',
            filterGroupId: 'fg1',
            nextStepIds: ['iterator-1'],
          },
          { id: 'branch-else', nextStepIds: ['step-c'] },
        ],
      ),
      createMockIteratorStep('iterator-1', ['after-loop'], ['loop-step']),
      createMockCodeStep('loop-step', ['iterator-1']),
      createMockCodeStep('after-loop', []),
      createMockCodeStep('step-c', []),
    ];

    const result = getStepIdsToSkipWithDescendants({
      stepIds: ['if-else-1'],
      steps,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        'if-else-1',
        'iterator-1',
        'loop-step',
        'step-c',
      ]),
    );
    expect(result).toHaveLength(4);
  });

  it('should not duplicate step IDs', () => {
    const steps = [
      createMockIfElseStep(
        'if-else-1',
        [
          { id: 'branch-if', filterGroupId: 'fg1', nextStepIds: ['shared'] },
          { id: 'branch-else', nextStepIds: ['shared'] },
        ],
      ),
      createMockCodeStep('shared', []),
    ];

    const result = getStepIdsToSkipWithDescendants({
      stepIds: ['if-else-1'],
      steps,
    });

    expect(result).toEqual(
      expect.arrayContaining(['if-else-1', 'shared']),
    );
    expect(result).toHaveLength(2);
  });

  it('should handle empty step IDs', () => {
    const result = getStepIdsToSkipWithDescendants({
      stepIds: [],
      steps: [],
    });

    expect(result).toEqual([]);
  });

  it('should handle step not found in steps array', () => {
    const result = getStepIdsToSkipWithDescendants({
      stepIds: ['non-existent'],
      steps: [createMockCodeStep('step-1', [])],
    });

    expect(result).toEqual(['non-existent']);
  });
});
