import { describe, expect, it } from "bun:test";

import {
  isLoginNoticeCode,
  isUnconfirmedEmailError,
  loginNoticeMessage,
} from "@/lib/auth/loginNotice";

describe("isLoginNoticeCode", () => {
  it("accepts the code the confirm route redirects with", () => {
    expect(isLoginNoticeCode("confirm")).toBe(true);
  });

  it("rejects an unknown code", () => {
    expect(isLoginNoticeCode("whatever")).toBe(false);
  });

  it("rejects a missing value", () => {
    expect(isLoginNoticeCode(null)).toBe(false);
    expect(isLoginNoticeCode(undefined)).toBe(false);
    expect(isLoginNoticeCode("")).toBe(false);
  });

  it("does not match on inherited object properties", () => {
    expect(isLoginNoticeCode("toString")).toBe(false);
    expect(isLoginNoticeCode("constructor")).toBe(false);
  });
});

describe("loginNoticeMessage", () => {
  it("explains a failed confirmation link in plain language", () => {
    const message = loginNoticeMessage("confirm");
    expect(message).toContain("confirmation link");
    expect(message.length).toBeGreaterThan(0);
  });
});

describe("isUnconfirmedEmailError", () => {
  it("recognises the stable Supabase error code", () => {
    expect(isUnconfirmedEmailError({ code: "email_not_confirmed", message: "whatever" })).toBe(
      true,
    );
  });

  it("falls back to the prose message when no code is present", () => {
    expect(isUnconfirmedEmailError({ message: "Email not confirmed" })).toBe(true);
  });

  it("does not match ordinary bad credentials", () => {
    expect(
      isUnconfirmedEmailError({
        code: "invalid_credentials",
        message: "Invalid login credentials",
      }),
    ).toBe(false);
  });

  it("handles a missing error", () => {
    expect(isUnconfirmedEmailError(null)).toBe(false);
    expect(isUnconfirmedEmailError(undefined)).toBe(false);
    expect(isUnconfirmedEmailError({})).toBe(false);
  });
});
