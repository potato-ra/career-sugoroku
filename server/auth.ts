import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface FacilitatorAccountRecord {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  passwordHash: string;
  accessKeys: {
    primary: string;
    backup: string;
  };
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
  accessKeys: {
    primary: string;
    backup: string;
  };
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

const SEEDED_ACCOUNTS_PATH = resolve(process.cwd(), "data/facilitator_accounts.json");
const DEFAULT_PRODUCTION_ACCOUNTS_PATH = "/var/data/facilitator_accounts.json";
const FALLBACK_RUNTIME_ACCOUNTS_PATH = "/tmp/facilitator_accounts.json";
const CONFIGURED_ACCOUNTS_PATH =
  process.env.FACILITATOR_ACCOUNTS_PATH ||
  (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_ACCOUNTS_PATH : SEEDED_ACCOUNTS_PATH);
const STRICT_PERSISTENCE =
  process.env.FACILITATOR_STRICT_PERSISTENCE === "false" ? false : process.env.NODE_ENV === "production";
let resolvedAccountsPath: string | null = null;

const readAccountsSafely = (pathToRead: string): FacilitatorAccountRecord[] | null => {
  try {
    if (!existsSync(pathToRead)) {
      return null;
    }

    const raw = readFileSync(pathToRead, "utf-8");
    const parsed = JSON.parse(raw) as FacilitatorAccountRecord[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const initializeAccountsFile = (pathToUse: string) => {
  const parentDirectory = dirname(pathToUse);
  if (!existsSync(parentDirectory)) {
    mkdirSync(parentDirectory, { recursive: true });
  }

  if (existsSync(pathToUse)) {
    return;
  }

  if (existsSync(SEEDED_ACCOUNTS_PATH)) {
    const seededAccounts = readFileSync(SEEDED_ACCOUNTS_PATH, "utf-8");
    writeFileSync(pathToUse, seededAccounts, "utf-8");
    return;
  }

  writeFileSync(pathToUse, "[]", "utf-8");
};

const getAccountsPath = () => {
  if (resolvedAccountsPath) {
    return resolvedAccountsPath;
  }

  const candidatePaths = [...new Set([CONFIGURED_ACCOUNTS_PATH, DEFAULT_PRODUCTION_ACCOUNTS_PATH, FALLBACK_RUNTIME_ACCOUNTS_PATH])];
  const candidateAccounts = candidatePaths
    .map((candidatePath) => ({ path: candidatePath, accounts: readAccountsSafely(candidatePath) }))
    .filter((entry): entry is { path: string; accounts: FacilitatorAccountRecord[] } => Array.isArray(entry.accounts));

  const mergedAccountsMap = new Map<string, FacilitatorAccountRecord>();
  candidateAccounts.forEach((entry) => {
    entry.accounts.forEach((account) => {
      const existing = mergedAccountsMap.get(account.loginId);
      if (!existing) {
        mergedAccountsMap.set(account.loginId, account);
        return;
      }

      const existingTime = new Date(existing.updatedAt).getTime();
      const currentTime = new Date(account.updatedAt).getTime();
      if (Number.isFinite(currentTime) && (!Number.isFinite(existingTime) || currentTime >= existingTime)) {
        mergedAccountsMap.set(account.loginId, account);
      }
    });
  });
  const mergedAccounts = [...mergedAccountsMap.values()];

  try {
    initializeAccountsFile(CONFIGURED_ACCOUNTS_PATH);
    const configuredAccounts = readAccountsSafely(CONFIGURED_ACCOUNTS_PATH) ?? [];
    if (mergedAccounts.length > configuredAccounts.length) {
      writeFileSync(CONFIGURED_ACCOUNTS_PATH, JSON.stringify(mergedAccounts, null, 2), "utf-8");
      console.warn("[auth] merged facilitator account stores", {
        sources: candidateAccounts.map((entry) => `${entry.path}(${entry.accounts.length})`),
        to: CONFIGURED_ACCOUNTS_PATH,
        count: mergedAccounts.length,
      });
    }
    resolvedAccountsPath = CONFIGURED_ACCOUNTS_PATH;
    return resolvedAccountsPath;
  } catch (error) {
    if (STRICT_PERSISTENCE) {
      console.error("[auth] strict persistence is enabled. refusing volatile fallback.", {
        configuredPath: CONFIGURED_ACCOUNTS_PATH,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Facilitator account storage is not writable at ${CONFIGURED_ACCOUNTS_PATH}. ` +
          "Attach a persistent disk and/or set FACILITATOR_ACCOUNTS_PATH.",
      );
    }

    console.error("[auth] facilitator account path init failed", {
      configuredPath: CONFIGURED_ACCOUNTS_PATH,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  initializeAccountsFile(FALLBACK_RUNTIME_ACCOUNTS_PATH);
  resolvedAccountsPath = FALLBACK_RUNTIME_ACCOUNTS_PATH;
  console.warn("[auth] using fallback facilitator account path", resolvedAccountsPath);
  return resolvedAccountsPath;
};

const normalizeLoginId = (value: string) => value.trim().toLowerCase();
const createAccessKey = () => randomBytes(12).toString("hex");

const ensureAccountAccessKeys = (account: FacilitatorAccountRecord): FacilitatorAccountRecord => ({
  ...account,
  accessKeys: {
    primary: account.accessKeys?.primary || createAccessKey(),
    backup: account.accessKeys?.backup || createAccessKey(),
  },
});

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
  const accountsPath = getAccountsPath();

  const raw = readFileSync(accountsPath, "utf-8");
  const parsed = JSON.parse(raw) as FacilitatorAccountRecord[];
  const upgraded = parsed.map(ensureAccountAccessKeys);
  if (JSON.stringify(parsed) !== JSON.stringify(upgraded)) {
    saveFacilitatorAccounts(upgraded);
  }
  return upgraded;
};

export const saveFacilitatorAccounts = (accounts: FacilitatorAccountRecord[]) => {
  const accountsPath = getAccountsPath();
  writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), "utf-8");
};

export const sanitizeFacilitatorAccount = (account: FacilitatorAccountRecord): FacilitatorAccountSummary => ({
  loginId: account.loginId,
  displayName: account.displayName,
  role: account.role,
  accessKeys: account.accessKeys,
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
    accessKeys: {
      primary: createAccessKey(),
      backup: createAccessKey(),
    },
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
export const facilitatorAccountsPath = () => getAccountsPath();
export const getFacilitatorRoomId = (loginId: string, slot: "a" | "b") => `FACI_${normalizeLoginId(loginId).toUpperCase()}_${slot.toUpperCase()}`;
export const findFacilitatorAccountByAccessKey = (accounts: FacilitatorAccountRecord[], accessKey: string) =>
  accounts.find(
    (account) =>
      account.accessKeys?.primary === accessKey.trim() || account.accessKeys?.backup === accessKey.trim(),
  );

export const regenerateFacilitatorAccessKey = (
  account: FacilitatorAccountRecord,
  slot: "primary" | "backup",
): FacilitatorAccountRecord => ({
  ...account,
  accessKeys: {
    ...account.accessKeys,
    [slot]: createAccessKey(),
  },
  updatedAt: new Date().toISOString(),
});
