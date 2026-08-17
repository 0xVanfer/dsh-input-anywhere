import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const suppliedTarball = process.argv[2]
const sourceRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const work = await mkdtemp(join(tmpdir(), 'dsh-input-anywhere-package-'))

function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`)
  console.log(`PASS ${label}`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.status !== 0) {
    throw new Error([
      `FAIL ${command} ${args.join(' ')}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'))
  }
  return result.stdout
}

async function filesUnder(root, directory = root) {
  const entries = await readdir(directory)
  const files = []
  for (const entry of entries) {
    const absolute = join(directory, entry)
    if ((await stat(absolute)).isDirectory()) files.push(...await filesUnder(root, absolute))
    else files.push(absolute.slice(root.length + 1))
  }
  return files.sort()
}

const expectedFiles = [
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'SECURITY.md',
  'cordis.patch.yml',
  'docs/architecture.md',
  'docs/compatibility.md',
  'docs/research.md',
  'docs/testing.md',
  'lib/client.js',
  'lib/client.js.map',
  'lib/index.js',
  'lib/preferences-contract.js',
  'lib/types/client/InputAnywhereControls.d.ts',
  'lib/types/client/InputAnywhereSettings.d.ts',
  'lib/types/client/dom.d.ts',
  'lib/types/client/index.d.ts',
  'lib/types/client/layout.d.ts',
  'lib/types/client/locales.d.ts',
  'lib/types/client/preferences.d.ts',
  'lib/types/client/styles.d.ts',
  'lib/types/index.d.ts',
  'lib/types/preferences-contract.d.ts',
  'package.json',
].sort()

try {
  const tarballPath = suppliedTarball === undefined
    ? join(work, `${sourceJson.name.replace(/^@/, '').replaceAll('/', '-')}-${sourceJson.version}.tgz`)
    : resolve(suppliedTarball)
  if (suppliedTarball === undefined) {
    run('pnpm', ['pack', '--pack-destination', work], { cwd: sourceRoot, stdio: 'inherit' })
  }
  run('tar', ['-xzf', tarballPath, '-C', work])
  const packageRoot = join(work, 'package')
  const files = await filesUnder(packageRoot)
  check('tarball contains the exact public packlist', JSON.stringify(files) === JSON.stringify(expectedFiles))

  const packedJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  check('packed name and version match the source manifest', packedJson.name === sourceJson.name
    && packedJson.version === sourceJson.version)
  check('packed Host and Client exports exist', await stat(join(packageRoot, packedJson.exports['.'].default)).then(() => true)
    && await stat(join(packageRoot, packedJson.exports['./client'].default)).then(() => true))
  check('packed DSH bundle references the included Cordis patch', packedJson.dsh?.bundle?.patch === './cordis.patch.yml'
    && files.includes('cordis.patch.yml'))
  check('packed Client manifest targets the expected Web dependencies', packedJson.dsh?.client?.platform === 'web'
    && JSON.stringify(packedJson.dsh.client.inject) === JSON.stringify([
      '@deepseek-ai/dsh-api-remotes',
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-settings',
    ]))

  const patch = await readFile(join(packageRoot, 'cordis.patch.yml'), 'utf8')
  const semanticPatch = patch.split('\n')
    .filter(line => line.trim() !== '' && !line.trimStart().startsWith('#'))
    .join('\n')
  check('packed Cordis patch inserts only this package row', semanticPatch === [
    '- insert:',
    '    - id: input-anywhere',
    '      name: dsh-input-anywhere',
  ].join('\n'))

  const consumer = join(work, 'consumer')
  await mkdir(consumer)
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--legacy-peer-deps',
    '--package-lock=false',
    '@deepseek-ai/cordis@^4.0.1',
    tarballPath,
  ], {
    cwd: consumer,
    env: { ...process.env, npm_config_cache: join(work, 'npm-cache') },
  })
  const installedPackageRoot = join(consumer, 'node_modules', 'dsh-input-anywhere')
  run(process.execPath, [resolve('scripts/verify-bundle.mjs'), installedPackageRoot], { stdio: 'inherit' })

  const imported = run(process.execPath, [
    '--input-type=module',
    '--eval',
    "const plugin = await import('dsh-input-anywhere'); if (plugin.name !== 'dsh-input-anywhere' || typeof plugin.apply !== 'function') process.exit(1)",
  ], { cwd: consumer })
  check(`clean consumer imports ${basename(tarballPath)}`, imported === '')
} finally {
  await rm(work, { recursive: true, force: true })
}
