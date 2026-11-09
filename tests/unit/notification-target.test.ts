import { describe, expect, it } from "vitest";
import { notificationTarget } from "@/lib/notification-target";
describe("notification destinations", () => {
 it.each(["/fees", "/staff/leave", "/helpdesk", "/certificates", "/library", "/notices"])("does not link to removed module %s", path => expect(notificationTarget(path, "ADMIN")).toBeNull());
 it.each(["/leave", "/results", "/materials", "/exams/hall-tickets"])("keeps retained student destination %s", path => expect(notificationTarget(path, "STUDENT")).toBe(path));
 it("resolves old deep links to a usable section without stale record IDs", () => {
  expect(notificationTarget("/leave/deleted-request", "STUDENT")).toBe("/leave");
  expect(notificationTarget("/materials/missing-id", "FACULTY")).toBe("/materials");
 });
 it("applies role permissions instead of sending users to unauthorized screens", () => {
  expect(notificationTarget("/staff/swaps", "STUDENT")).toBeNull();
  expect(notificationTarget("/materials", "PARENT")).toBeNull();
  expect(notificationTarget("/staff/swaps", "HOD")).toBe("/staff/swaps");
 });
 it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/results/../../fees", "invalid", null])("rejects unsafe/unknown destination %s", path => expect(notificationTarget(path,"ADMIN")).toBeNull());
});
