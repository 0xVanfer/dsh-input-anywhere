import { spawn } from 'node:child_process'

const commands = [
  ['pnpm', ['exec', 'tsc', '-p', 'tsconfig.client.json', '--watch', '--preserveWatchOutput']],
  ['pnpm', ['exec', 'tsdown', '--watch']],
]

const children = commands.map(([command, args]) => spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
}))

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}

for (const child of children) {
  child.on('error', error => {
    console.error(error)
    stop(1)
  })
  child.on('exit', code => {
    if (!stopping) stop(code ?? 1)
  })
}

process.on('SIGINT', () => { stop(130) })
process.on('SIGTERM', () => { stop(143) })
