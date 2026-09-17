import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const androidDir = resolve(process.cwd(), 'android')
const isWindows = process.platform === 'win32'
const gradleCommand = isWindows ? 'gradlew.bat' : './gradlew'
const gradlePath = resolve(androidDir, isWindows ? 'gradlew.bat' : 'gradlew')

if (!existsSync(gradlePath)) {
  console.error(`Gradle wrapper introuvable: ${gradlePath}`)
  process.exit(1)
}

console.log(`Lancement Android release avec ${gradleCommand}...`)

const result = spawnSync(gradleCommand, ['bundleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWindows,
})

process.exit(result.status ?? 1)
