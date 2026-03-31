import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface FacilitatorAccountRecord {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FacilitatorAccountSummary {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

const ACCOUNTS_PATH = resolve(process.cwd(), "data/facilitator_accounts.json");

const normalizeLoginId = (value: string) => value.trim().toLowerCase();

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, passwordHash: string) => {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const derivedHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");
  if (derivedHash.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedHash, storedBuffer);
};

export const loadFacilitatorAccounts = (): FacilitatorAccountRecord[] => {
  if (!existsSync(ACCOUNTS_PATH)) {
    return [];
  }

  const raw = readFileSync(ACCOUNTS_PATH, "utf-8");
  return JSON.parse(raw) as FacilitatorAccountRecord[];
};

export const saveFacilitatorAccounts = (accounts: FacilitatorAccountRecord[]) => {
  writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), "utf-8");
};

export const sanitizeFacilitatorAccount = (account: FacilitatorAccountRecord): FacilitatorAccountSummary => ({
  loginId: account.loginId,
  displayName: account.displayName,
  role: account.role,
  isActive: account.isActive,
  mustChangePassword: account.mustChangePassword,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
});

export const findFacilitatorAccount = (accounts: FacilitatorAccountRecord[], loginId: string) =>
  accounts.find((account) => account.loginId === normalizeLoginId(loginId));

export const createFacilitatorAccountRecord = (
  loginId: string,
  displayName: string,
  temporaryPassword: string,
  role: "admin" | "facilitator" = "facilitator",
): FacilitatorAccountRecord => {
  const now = new Date().toISOString();
  return {
    loginId: normalizeLoginId(loginId),
    displayName: displayName.trim(),
    role,
    passwordHash: hashPassword(temporaryPassword),
    isActive: true,
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateFacilitatorPassword = (
  account: FacilitatorAccountRecord,
  nextPassword: string,
  mustChangePassword = false,
): FacilitatorAccountRecord => ({
  ...account,
  passwordHash: hashPassword(nextPassword),
  mustChangePassword,
  updatedAt: new Date().toISOString(),
});

export const normalizeFacilitatorLoginId = normalizeLoginId;
