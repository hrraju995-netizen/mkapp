import * as ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const FTP_HOST = process.env.FTP_HOST || process.env.FTP_SERVER;
const FTP_USER = process.env.FTP_USER || process.env.FTP_USERNAME;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
const FTP_PORT = parseInt(process.env.FTP_PORT || '21', 10);
const REMOTE_DIR = process.env.FTP_REMOTE_DIR || 'public_html';

async function deploy() {
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    console.error('\n❌ Missing FTP configuration in .env file!');
    process.exit(1);
  }

  const cleanHost = FTP_HOST.replace(/^ftp:\/\//i, '').replace(/\/$/, '').trim();

  console.log('🔨 Step 1: Building production bundle...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (e) {
    console.error('❌ Build failed!');
    process.exit(1);
  }

  const localDistDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(localDistDir)) {
    console.error('❌ dist directory not found!');
    process.exit(1);
  }

  console.log(`\n🚀 Step 2: Connecting to Hostinger FTP (${cleanHost})...`);
  const client = new ftp.Client();
  client.ftp.verbose = true;
  client.ftp.timeout = 30000;

  try {
    try {
      await client.access({
        host: cleanHost,
        user: FTP_USER.trim(),
        password: FTP_PASSWORD.trim(),
        port: FTP_PORT,
        secure: false
      });
    } catch (accessErr) {
      console.log('Retrying with explicit TLS...');
      await client.access({
        host: cleanHost,
        user: FTP_USER.trim(),
        password: FTP_PASSWORD.trim(),
        port: FTP_PORT,
        secure: 'explicit',
        secureOptions: { rejectUnauthorized: false }
      });
    }

    console.log('\n📂 Step 3: Determining target upload folder...');
    // Ensure we are in /public_html
    try {
      await client.cd('/public_html');
      console.log('Navigated to /public_html');
    } catch {
      await client.cd('public_html');
      console.log('Navigated to public_html');
    }

    console.log('\n📤 Step 4: Uploading fresh dist files to public_html...');
    await client.uploadFromDir(localDistDir);

    // Also sync to /hbuilds/current/public_html so Hostinger internal mirrors stay consistent
    try {
      console.log('\n🔄 Step 5: Syncing to /hbuilds/current/public_html...');
      await client.cd('/hbuilds/current/public_html');
      await client.uploadFromDir(localDistDir);
      console.log('✓ Synced to /hbuilds/current/public_html');
    } catch (e) {
      console.log('Note: /hbuilds/current/public_html sync skipped (not required).');
    }

    console.log('\n🎉 SUCCESS! MK Text App has been deployed live to Hostinger!');
    console.log('🌐 Visit your site to verify the latest updates!');
  } catch (err) {
    console.error('\n❌ Deployment failed:', err.message);
  } finally {
    client.close();
  }
}

deploy();
