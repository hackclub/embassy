import { describe, expect, it } from "bun:test";
import { isValidOrderTransition } from "./order.service";

describe("isValidOrderTransition", () => {
  it("allows exactly one step forward", () => {
    expect(isValidOrderTransition("AWAITING_RECIPIENT_DETAILS", "RECIPIENT_DETAILS_RECEIVED")).toBe(true);
    expect(isValidOrderTransition("RECIPIENT_DETAILS_RECEIVED", "DRAFTING")).toBe(true);
    expect(isValidOrderTransition("SHIPPING", "DELIVERED")).toBe(true);
  });

  it("rejects skipping steps", () => {
    expect(isValidOrderTransition("RECIPIENT_DETAILS_RECEIVED", "SENT_TO_HQ")).toBe(false);
    expect(isValidOrderTransition("AWAITING_RECIPIENT_DETAILS", "SHIPPING")).toBe(false);
  });

  it("rejects going backwards", () => {
    expect(isValidOrderTransition("DRAFTING", "RECIPIENT_DETAILS_RECEIVED")).toBe(false);
    expect(isValidOrderTransition("DELIVERED", "SHIPPING")).toBe(false);
  });

  it("rejects no-ops", () => {
    expect(isValidOrderTransition("DRAFTING", "DRAFTING")).toBe(false);
  });

  it("allows cancel/error from any non-terminal state", () => {
    expect(isValidOrderTransition("DRAFTING", "CANCELLED")).toBe(true);
    expect(isValidOrderTransition("AWAITING_RECIPIENT_DETAILS", "ERROR")).toBe(true);
    expect(isValidOrderTransition("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("allows recovery from ERROR/CANCELLED only into RECIPIENT_DETAILS_RECEIVED", () => {
    expect(isValidOrderTransition("ERROR", "RECIPIENT_DETAILS_RECEIVED")).toBe(true);
    expect(isValidOrderTransition("CANCELLED", "RECIPIENT_DETAILS_RECEIVED")).toBe(true);
    expect(isValidOrderTransition("ERROR", "SHIPPING")).toBe(false);
  });
});
