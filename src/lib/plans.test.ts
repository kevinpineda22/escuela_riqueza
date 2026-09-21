import { describe, expect, it } from "vitest";
import { canAccessCertificates, canReadCommunity, canWriteCommunity } from "@/lib/plans";
import { PLANS, USER_ROLES } from "@/types/user";

describe("canReadCommunity", () => {
  it("allows free, individual, vip and admin to read", () => {
    expect(canReadCommunity(PLANS.FREE, USER_ROLES.STUDENT)).toBe(true);
    expect(canReadCommunity(PLANS.INDIVIDUAL, USER_ROLES.STUDENT)).toBe(true);
    expect(canReadCommunity(PLANS.VIP, USER_ROLES.STUDENT)).toBe(true);
    expect(canReadCommunity(PLANS.FREE, USER_ROLES.ADMIN)).toBe(true);
  });

  it("denies unknown/missing plans", () => {
    expect(canReadCommunity(null, USER_ROLES.STUDENT)).toBe(false);
    expect(canReadCommunity(undefined, undefined)).toBe(false);
  });
});

describe("canWriteCommunity", () => {
  it("denies free", () => {
    expect(canWriteCommunity(PLANS.FREE, USER_ROLES.STUDENT)).toBe(false);
  });

  it("allows individual and vip", () => {
    expect(canWriteCommunity(PLANS.INDIVIDUAL, USER_ROLES.STUDENT)).toBe(true);
    expect(canWriteCommunity(PLANS.VIP, USER_ROLES.STUDENT)).toBe(true);
  });

  it("always allows admin, regardless of plan", () => {
    expect(canWriteCommunity(PLANS.FREE, USER_ROLES.ADMIN)).toBe(true);
  });
});

describe("canAccessCertificates", () => {
  it("denies free", () => {
    expect(canAccessCertificates(PLANS.FREE, USER_ROLES.STUDENT)).toBe(false);
  });

  it("allows individual, vip and admin", () => {
    expect(canAccessCertificates(PLANS.INDIVIDUAL, USER_ROLES.STUDENT)).toBe(true);
    expect(canAccessCertificates(PLANS.VIP, USER_ROLES.STUDENT)).toBe(true);
    expect(canAccessCertificates(PLANS.FREE, USER_ROLES.ADMIN)).toBe(true);
  });
});
