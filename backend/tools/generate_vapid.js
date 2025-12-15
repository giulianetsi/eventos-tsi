// Script para gerar chaves VAPID usando o pacote `web-push`.
// Uso:
//   node tools/generate_vapid.js           -> printa chaves no stdout
//   node tools/generate_vapid.js --save    -> grava/atualiza as chaves em ../.env

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

function setOrReplace(envContent, key, value) {
  const re = new RegExp('^' + key + '=.*$', 'm');
  if (re.test(envContent)) return envContent.replace(re, `${key}=${value}`);
  return (envContent && !envContent.endsWith('\n') ? envContent + '\n' : envContent) + `${key}=${value}\n`;
}

(async () => {
  try {
    const keys = webpush.generateVAPIDKeys();
    console.log('PUBLIC_VAPID_KEY=' + keys.publicKey);
    console.log('PRIVATE_VAPID_KEY=' + keys.privateKey);
    console.log('');
    console.log('To save these into backend/.env, run with --save:');
    console.log('  node tools/generate_vapid.js --save');

    if (process.argv.includes('--save')) {
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = '';
      try {
        envContent = fs.readFileSync(envPath, 'utf8');
      } catch (e) {
        // file may not exist yet
        envContent = '';
      }
      envContent = setOrReplace(envContent, 'PUBLIC_VAPID_KEY', keys.publicKey);
      envContent = setOrReplace(envContent, 'PRIVATE_VAPID_KEY', keys.privateKey);
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('Saved keys to', envPath);
    }
  } catch (err) {
    console.error('Failed to generate VAPID keys:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
