import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface FacilitatorAccountRecord {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FacilitatorAccountSummary {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

const SEEDED_ACCOUNTS_PATH = resolve(process.cwd(), "data/facilitator_accounts.json");
const DEFAULT_PRODUCTION_ACCOUNTS_PATH = "/var/data/facilitator_accounts.json";
const ACCOUNTS_PATH =
  process.env.FACILITATOR_ACCOUNTS_PATH ||
  (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_ACCOUNTS_PATH : SEEDED_ACCOUNTS_PATH);

const ensureFacilitatorAccountsFile = () => {
  const parentDirectory = dirname(ACCOUNTS_PATH);
  if (!existsSync(parentDirectory)) {
    mkdirSync(parentDirectory, { recursive: true });
  }

  if (existsSync(ACCOUNTS_PATH)) {
    return;
  }

  if (existsSync(SEEDED_ACCOUNTS_PATH)) {
    const seededAccounts = readFileSync(SEEDED_ACCOUNTS_PATH, "utf-8");
    writeFileSync(ACCOUNTS_PATH, seededAccounts, "utf-8");
    return;
  }

  writeFileSync(ACCOUNTS_PATH, "[]", "utf-8");
};

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
  ensureFacilitatorAccountsFile();

  const raw = readFileSync(ACCOUNTS_PATH, "utf-8");
  return JSON.parse(raw) as FacilitatorAccountRecord[];
};

export const saveFacilitatorAccounts = (accounts: FacilitatorAccountRecord[]) => {
  ensureFacilitatorAccountsFile();
  writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), "utf-8");
};

export const sanitizeFacilitatorAccount = (account: FacilitatorAccountRecord): FacilitatorAccountSummary => ({
  loginId: account.loginId,
  displayName: account.displayName,
  role: account.role,
  isActive: account.isActive,
  mustChangePassword: account.mustChangePassword,
  lastLoginAt: account.lastLoginAt,
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

export const markFacilitatorLastLogin = (account: FacilitatorAccountRecord): FacilitatorAccountRecord => {
  const now = new Date().toISOString();
  return {
    ...account,
    lastLoginAt: now,
    updatedAt: now,
  };
};

export const normalizeFacilitatorLoginId = normalizeLoginId;
export const facilitatorAccountsPath = ACCOUNTS_PATH;
