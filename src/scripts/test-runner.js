#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import shelljs from 'shelljs'

function findTestFiles(dir, files = []) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.svelte-kit' || entry === 'target' || entry === 'venv') continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      findTestFiles(fullPath, files)
    } else if (entry.endsWith('.test.ts') || entry.endsWith('.spec.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

const hasBun = Boolean(shelljs.which('bun'))
if (hasBun) {
  const child = spawn('bun', ['test'], { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
} else {
  const testFiles = findTestFiles('src')
  const args = ['--import', './src/model_gen/register_loader.js', '--test', ...testFiles]
  const child = spawn('node', args, { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}
