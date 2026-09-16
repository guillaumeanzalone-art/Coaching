import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const pbxprojPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')
const infoPlistPath = path.join(root, 'ios', 'App', 'App', 'Info.plist')

const requestedVersion = process.argv[2] || null

function fail(message) {
  console.error(`\n❌ ${message}\n`)
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) fail(`${command} ${args.join(' ')} a échoué.`)
}

if (!fs.existsSync(pbxprojPath)) fail(`Projet Xcode introuvable : ${pbxprojPath}`)
if (!fs.existsSync(infoPlistPath)) fail(`Info.plist introuvable : ${infoPlistPath}`)

let pbxproj = fs.readFileSync(pbxprojPath, 'utf8')
const currentVersionMatch = pbxproj.match(/MARKETING_VERSION = ([^;]+);/)
const currentBuildMatch = pbxproj.match(/CURRENT_PROJECT_VERSION = ([^;]+);/)

if (!currentVersionMatch) fail('MARKETING_VERSION introuvable dans project.pbxproj.')
if (!currentBuildMatch) fail('CURRENT_PROJECT_VERSION introuvable dans project.pbxproj.')

const currentVersion = currentVersionMatch[1].trim()
const nextVersion = requestedVersion || currentVersion
if (!/^\d+\.\d+(?:\.\d+)?$/.test(nextVersion)) {
  fail(`Version invalide « ${nextVersion} ». Exemple : npm run ios:release -- 1.3`)
}

const now = new Date()
const yyyy = String(now.getFullYear())
const mm = String(now.getMonth() + 1).padStart(2, '0')
const dd = String(now.getDate()).padStart(2, '0')
const todayBase = Number(`${yyyy}${mm}${dd}01`)
const currentBuild = Number(String(currentBuildMatch[1]).trim())
const nextBuild = Number.isFinite(currentBuild) && currentBuild >= todayBase
  ? currentBuild + 1
  : todayBase

pbxproj = pbxproj
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${nextVersion};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${nextBuild};`)

fs.writeFileSync(pbxprojPath, pbxproj, 'utf8')

let info = fs.readFileSync(infoPlistPath, 'utf8')

if (!info.includes('<key>NSHealthShareUsageDescription</key>')) {
  const marker = '\t<key>LSRequiresIPhoneOS</key>'
  const block = '\t<key>NSHealthShareUsageDescription</key>\n\t<string>L’araignée Coaching lit uniquement ton nombre de pas quotidien afin de calculer le bonus d’XP d’entraînement du lendemain.</string>\n'
  if (!info.includes(marker)) fail('Impossible d’insérer NSHealthShareUsageDescription dans Info.plist.')
  info = info.replace(marker, `${block}${marker}`)
}

if (!info.includes('<key>NSHealthUpdateUsageDescription</key>')) {
  const marker = '\t<key>LSRequiresIPhoneOS</key>'
  const block = '\t<key>NSHealthUpdateUsageDescription</key>\n\t<string>L’araignée Coaching utilise HealthKit pour synchroniser les données d’activité autorisées liées au suivi d’entraînement.</string>\n'
  if (!info.includes(marker)) fail('Impossible d’insérer NSHealthUpdateUsageDescription dans Info.plist.')
  info = info.replace(marker, `${block}${marker}`)
}

fs.writeFileSync(infoPlistPath, info, 'utf8')

console.log(`\n✅ iOS préparé : version ${nextVersion} — build ${nextBuild}`)
console.log('✅ Les deux descriptions HealthKit sont présentes dans Info.plist.\n')

run('npm', ['run', 'build'])
run('npx', ['cap', 'sync', 'ios'])

console.log('\n✅ Build web + sync Capacitor terminés.')
console.log('➡️ Ouverture de Xcode…\n')
run('npx', ['cap', 'open', 'ios'])
