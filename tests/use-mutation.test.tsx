// @vitest-environment happy-dom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
  redirect,
} from "@tanstack/react-router";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useMutation } from "src/hooks/use-mutation";
import type { MutationResult } from "src/lib/mutation";
import { afterEach, expect, test, vi } from "vitest";

afterEach(cleanup);

function setup() {
  const root = createRootRoute();
  const home = createRoute({ getParentRoute: () => root, path: "/" });
  const login = createRoute({ getParentRoute: () => root, path: "/login" });
  const router = createRouter({
    routeTree: root.addChildren([home, login]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const navigate = vi.spyOn(router, "navigate").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RouterContextProvider router={router}>{children}</RouterContextProvider>
  );
  return { wrapper, navigate };
}

test("authentication redirects navigate to login without becoming a mutation error", async () => {
  const { wrapper, navigate } = setup();
  const action = vi.fn(async (): Promise<MutationResult<string>> => {
    throw redirect({ to: "/login" });
  });
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useMutation(action), { wrapper });
  await act(async () => {
    await result.current.run({}, onSuccess);
  });
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/login" }));
  expect(result.current.error).toBe("");
  expect(result.current.pending).toBe(false);
  expect(onSuccess).not.toHaveBeenCalled();
});

test("successful mutations pass their value to the callback", async () => {
  const { wrapper } = setup();
  const action = vi.fn(
    async ({ data }: { data: string }): Promise<MutationResult<string>> => ({ ok: true, value: data }),
  );
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useMutation(action), { wrapper });
  await act(async () => {
    await result.current.run("saved", onSuccess);
  });
  expect(onSuccess).toHaveBeenCalledExactlyOnceWith("saved");
  expect(result.current.error).toBe("");
  expect(result.current.pending).toBe(false);
});

test("validation errors are displayed without invoking success callbacks", async () => {
  const { wrapper, navigate } = setup();
  const action = async (): Promise<MutationResult<void>> => ({ ok: false, message: "品名を入力してください。" });
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useMutation(action), { wrapper });
  await act(async () => {
    await result.current.run({}, onSuccess);
  });
  expect(result.current.error).toBe("品名を入力してください。");
  expect(navigate).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  act(() => result.current.clearError());
  expect(result.current.error).toBe("");
});

test("network failures restore the controls and display a generic error", async () => {
  const { wrapper } = setup();
  const action = async (): Promise<MutationResult<void>> => {
    throw new TypeError("Network failure");
  };
  const { result } = renderHook(() => useMutation(action), { wrapper });
  await act(async () => {
    await result.current.run({});
  });
  expect(result.current.error).toContain("接続を確認");
  expect(result.current.pending).toBe(false);
});

test("controls remain pending until the success callback finishes reloading data", async () => {
  const { wrapper } = setup();
  const action = async (): Promise<MutationResult<void>> => ({ ok: true, value: undefined });
  let finish = () => {};
  const reloading = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const { result } = renderHook(() => useMutation(action), { wrapper });
  let submission: Promise<void> | undefined;
  await act(async () => {
    submission = result.current.run({}, () => reloading);
  });
  expect(result.current.pending).toBe(true);
  await act(async () => {
    finish();
    await submission;
  });
  expect(result.current.pending).toBe(false);
});
