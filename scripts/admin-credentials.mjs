import { randomBytes, scryptSync } from "node:crypto";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*-_";

export function generatePassword(length = 24) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join("");
}

export function hashPassword(password) {
  if (password.length < 12) throw new Error("A senha precisa ter pelo menos 12 caracteres.");
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}
