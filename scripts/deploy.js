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
    console.log('\nPlease create or update .env with your Hostinger FTP credentials:');
    console.log('--------------------------------------------------');
    console.log('FTP_HOST=ftp.yourdomain.com (or your Hostinger IP)');
    console.log('FTP_USER=your_ftp_username');
    console.log('FTP_PASSWORD=your_ftp_password');
    console.log('FTP_REMOTE_DIR=public_html');
    console.log('--------------------------------------------------\n');
    process.exit(1);
  }

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

  console.log(`\n🚀 Step 2: Connecting to Hostinger FTP (${FTP_HOST})...`);
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      port: FTP_PORT,
      secure: false // Hostinger standard FTP (or set to 'explicit' for FTPS)
    });

    console.log(`\n📂 Step 3: Uploading dist files directly to ${REMOTE_DIR}...`);
    await client.ensureDir(REMOTE_DIR);
    await client.clearWorkingDir();
    await client.uploadFromDir(localDistDir);

    console.log('\n🎉 SUCCESS! Your app has been deployed live to Hostinger!');
  } catch (err) {
    console.error('\n❌ Deployment failed:', err.message);
  } finally {
    client.close();
  }
}

deploy();
