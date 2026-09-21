import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const version = process.argv[2]
const androidCodeRaw = process.argv[3]
const iosBuild = process.argv[4]

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

if (!version || !/^\d+\.\d+(?:\.\d+)?$/.test(version)) {
  fail('Version invalide. Exemple attendu : 1.2.0')
}

const androidCode = Number(androidCodeRaw)
if (!Number.isInteger(androidCode) || androidCode <= 0 || androidCode > 2100000000) {
  fail('versionCode Android invalide.')
}

if (!iosBuild || !/^\d+(?:\.\d+){0,2}$/.test(iosBuild)) {
  fail('Build iOS invalide.')
}

const gradlePath = path.join(root, 'android', 'app', 'build.gradle')
const pbxprojPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')

if (!fs.existsSync(gradlePath)) fail(`Fichier Android introuvable : ${gradlePath}`)
if (!fs.existsSync(pbxprojPath)) fail(`Projet iOS introuvable : ${pbxprojPath}`)

let gradle = fs.readFileSync(gradlePath, 'utf8')
if (!/versionCode\s+\d+/.test(gradle)) fail('versionCode Android introuvable.')
if (!/versionName\s+["'][^"']+["']/.test(gradle)) fail('versionName Android introuvable.')

gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${androidCode}`)
  .replace(/versionName\s+["'][^"']+["']/, `versionName "${version}"`)

fs.writeFileSync(gradlePath, gradle, 'utf8')

let pbxproj = fs.readFileSync(pbxprojPath, 'utf8')
if (!/MARKETING_VERSION = [^;]+;/.test(pbxproj)) fail('MARKETING_VERSION iOS introuvable.')
if (!/CURRENT_PROJECT_VERSION = [^;]+;/.test(pbxproj)) fail('CURRENT_PROJECT_VERSION iOS introuvable.')

pbxproj = pbxproj
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${iosBuild};`)

fs.writeFileSync(pbxprojPath, pbxproj, 'utf8')

console.log(`✅ Version store préparée : ${version}`)
console.log(`   Android versionCode : ${androidCode}`)
console.log(`   iOS build : ${iosBuild}`)
