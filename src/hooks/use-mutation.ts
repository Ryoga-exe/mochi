import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { MutationResult } from "src/lib/mutation";

export function useMutation<TInput, TValue>(action: (options: { data: TInput }) => Promise<MutationResult<TValue>>) {
  const invoke = useServerFn(action);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(data: TInput, onSuccess?: (value: TValue) => void | Promise<void>) {
    setPending(true);
    setError("");
    try {
      const result = await invoke({ data });
      // useServerFn navigates instead of returning a result for a redirect.
      if (!result) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await onSuccess?.(result.value);
    } catch {
      setError("操作に失敗しました。接続を確認して、もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error, clearError: () => setError("") };
}
