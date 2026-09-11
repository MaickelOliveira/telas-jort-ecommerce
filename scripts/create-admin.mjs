import { generatePassword, hashPassword } from "./admin-credentials.mjs";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: pnpm admin:create -- seu-email@dominio.com.br");
  process.exit(1);
}

const password = generatePassword();
console.log("\nCopie estas duas linhas para o arquivo de ambiente da VPS:\n");
console.log(`ADMIN_EMAIL=${email}`);
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log("\nSenha temporária (aparece somente agora):");
console.log(password);
console.log("\nReinicie a aplicação depois de substituir as duas linhas.");
