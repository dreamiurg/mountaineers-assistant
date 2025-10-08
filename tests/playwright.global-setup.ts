import { execSync } from 'node:child_process';

async function globalSetup(): Promise<void> {
  execSync('npm run build', { stdio: 'inherit' });
}

export default globalSetup;
