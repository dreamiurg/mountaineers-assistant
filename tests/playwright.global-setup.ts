import { execSync } from 'node:child_process'

async function globalSetup(): Promise<void> {
  execSync('bun run build', { stdio: 'inherit' })
}

export default globalSetup
