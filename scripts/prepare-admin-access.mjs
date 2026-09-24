import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Never log credentials or overwrite a previously generated configuration.
const path = '.env.admin-setup.local';
writeFileSync(path, `ADMIN_PASSWORD=${randomBytes(24).toString('base64url')}\nGOOGLE_SCRIPT_TOKEN=${randomBytes(32).toString('base64url')}\n`, { flag: 'wx', mode: 0o600 });
console.log(`Claves preparadas en ${path}. Este archivo está excluido de Git.`);
