import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
const configPath = path.resolve(__dirname, '../public/firebase-web-config.json');

try {
  if (!fs.existsSync(envPath)) {
    console.log('⚠️ .env file not found, skipping firebase-web-config.json generation.');
    process.exit(0);
  }

  const envFile = fs.readFileSync(envPath, 'utf-8');
  const firebaseConfig = {};
  
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('VITE_FIREBASE_')) {
      const splitIdx = trimmed.indexOf('=');
      if (splitIdx !== -1) {
        const key = trimmed.slice(0, splitIdx).trim();
        const value = trimmed.slice(splitIdx + 1).trim();
        firebaseConfig[key] = value;
      }
    }
  });

  fs.writeFileSync(configPath, JSON.stringify(firebaseConfig, null, 2));
  console.log('✅ firebase-web-config.json generated successfully from .env');
} catch (error) {
  console.error('❌ Error generating firebase-web-config.json:', error);
}
