import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/db", () => ({ db: { notification: { updateMany: m.update } } }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { markNotificationRead } from "@/actions/notifications";
beforeEach(() => { vi.clearAllMocks();m.auth.mockResolvedValue({ id: "owner" }); });
describe("private notification mutations", () => {
 it("always scopes a supplied ID to the authenticated owner", async () => {
  const form = new FormData();form.set("id", "someone-elses-notice");form.set("userId", "victim");
  await markNotificationRead({}, form);
  expect(m.update).toHaveBeenCalledWith({ where: { userId: "owner", id: "someone-elses-notice", readAt: null }, data: { readAt: expect.any(Date) } });
 });
 it("mark-all only changes the owner's unread records", async () => {
  await markNotificationRead({}, new FormData());
  expect(m.update.mock.calls[0][0].where).toEqual({ userId: "owner", readAt: null });
 });
});
