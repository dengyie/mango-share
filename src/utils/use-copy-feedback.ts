import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from './clipboard';

/** One feedback channel, scoped to the current modal and latest copy request. */
export function useCopyFeedback<T>(scope: unknown) {
  const [feedback, setFeedback] = useState<{ scope: typeof scope; value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    setFeedback(null);
    return () => {
      generation.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [scope]);

  const copy = useCallback(async (text: string, value: T) => {
    const request = ++generation.current;
    let success = false;
    try {
      success = await copyToClipboard(text);
    } catch {
      return;
    }
    if (!success || request !== generation.current) return;
    if (timer.current !== null) clearTimeout(timer.current);
    setFeedback({ scope, value });
    timer.current = setTimeout(() => {
      timer.current = null;
      setFeedback(null);
    }, 2000);
  }, [scope]);

  return [feedback !== null && feedback.scope === scope ? feedback.value : null, copy] as const;
}
