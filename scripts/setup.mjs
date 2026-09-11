import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generatePassword, hashPassword } from "./admin-credentials.mjs";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const destination = ".env.production";
if (existsSync(destination) && !process.argv.includes("--force")) {
  console.error(`${destination} já existe. Para recriar conscientemente, acrescente --force.`);
  process.exit(1);
}

const terminal = createInterface({ input, output });
let domain = option("domain") || "";
let email = option("email") || "";
if (!domain && input.isTTY) domain = await terminal.question("Domínio da loja (ex.: loja.exemplo.com.br): ");
if (!email && input.isTTY) email = await terminal.question("E-mail do administrador: ");
terminal.close();

domain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
email = email.trim().toLowerCase();
if (!/^(localhost|(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/.test(domain)) {
  console.error("Informe um domínio válido, sem http:// e sem caminhos.");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Informe um e-mail válido.");
  process.exit(1);
}

const password = generatePassword();
const values = {
  NODE_ENV: "production",
  DOMAIN: domain,
  APP_URL: domain === "localhost" ? "http://localhost" : `https://${domain}`,
  ADMIN_EMAIL: email,
  ADMIN_PASSWORD_HASH: hashPassword(password),
  SESSION_SECRET: randomBytes(48).toString("base64url"),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  ANALYTICS_SALT: randomBytes(32).toString("base64url"),
  SHIPPING_QUOTE_SECRET: randomBytes(48).toString("base64url"),
  DATABASE_PATH: "/app/data/telas-jort.sqlite",
};

writeFileSync(destination, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`, { mode: 0o600 });
console.log(`\nArquivo ${destination} criado com permissão restrita.`);
console.log(`Acesso: ${email}`);
console.log("Senha temporária (guarde em um gerenciador de senhas):");
console.log(password);
console.log("\nEssa senha não fica gravada em texto puro e não será mostrada novamente.");
