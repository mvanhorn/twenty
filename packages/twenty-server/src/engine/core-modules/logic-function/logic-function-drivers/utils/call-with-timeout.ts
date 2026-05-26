import { ExecutionTimedOutException } from 'src/engine/core-modules/logic-function/logic-function-drivers/exceptions/execution-timed-out.exception';

export const callWithTimeout = async <T>({
  callback,
  timeoutMs,
}: {
  callback: () => Promise<T>;
  timeoutMs: number;
}): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new ExecutionTimedOutException(timeoutMs)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([callback(), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
};
