/**
 * A hacked-together loader that supports tsconfig paths
 * (https://github.com/TypeStrong/ts-node/discussions/1450#discussion-3563207)
 *
 * as well as getting the extensions correct.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as tsConfigPaths from 'tsconfig-paths'
// @ts-ignore: Typescript doesn't recognize @swc-node/register/esm
import { load as loadTs, resolve as resolveTs } from '@swc-node/register/esm'

const config = tsConfigPaths.loadConfig('.svelte-kit')
if (config.resultType == 'failed') throw new Error('Loading typescript config failed: ' + config.message)
const matchPath = tsConfigPaths.createMatchPath(config.absoluteBaseUrl, config.paths)

/** Resolve an import (such as ./test) to a file path
 * @param {string} specifier    The given import
 * @param {any} context         Some context
 * @param {any} defaultResolver The resolver to fall back to
 */
export function resolve(specifier, context, defaultResolver) {
  if (specifier === 'bun:test') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('../scripts/bun-test-shim.js', import.meta.url).href,
    }
  }

  const mappedSpecifier = matchPath(specifier.replace('?url', ''))
  if (mappedSpecifier) {
    const resolvedPath = isDirectory(mappedSpecifier) ? `${mappedSpecifier}/index` : mappedSpecifier
    let target = resolvedPath
    if (
      !target.endsWith('.json') && !target.endsWith('.ts') && !target.endsWith('.js') && !target.endsWith('.zip') && !target.endsWith('.stl') && !target.endsWith('.step') && !target.endsWith('.svg')
      && !target.endsWith('.png')
    ) {
      if (existsSync(`${target}.ts`)) target = `${target}.ts`
      else if (existsSync(`${target}.js`)) target = `${target}.js`
    }
    const url = pathToFileURL(target).href
    specifier = url
  } else if (specifier.startsWith('.')) {
    const parent = context.parentURL || pathToFileURL('./index.js').href
    const cleanSpecifier = specifier.replace('?url', '')
    const rawUrl = new URL(cleanSpecifier, parent).href
    let filePath = fileURLToPath(rawUrl)
    if (!existsSync(filePath)) {
      if (existsSync(`${filePath}.ts`)) filePath = `${filePath}.ts`
      else if (existsSync(`${filePath}.js`)) filePath = `${filePath}.js`
      else if (existsSync(filePath.replace(/\.js$/, '.ts'))) filePath = filePath.replace(/\.js$/, '.ts')
    }
    specifier = pathToFileURL(filePath).href
  }

  return resolveTs(specifier, context, defaultResolver)
}

/** @param {string} absPath */
function isDirectory(absPath) {
  try {
    return statSync(absPath).isDirectory()
  } catch {
    return false
  }
}

/** Load a file
 * @param {string} url    The given import
 * @param {any} context         Some context
 * @param {any} nextLoad The loader to fall back to
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    const filePath = fileURLToPath(url)
    const content = readFileSync(filePath, 'utf-8')
    return {
      format: 'module',
      source: `export default ${content}`,
      shortCircuit: true,
    }
  }
  if (url.includes('?url') || url.endsWith('.zip') || url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.svg') || url.endsWith('.stl') || url.endsWith('.step')) {
    const cleanUrl = url.replace('?url', '')
    const filePath = cleanUrl.startsWith('file://') ? fileURLToPath(cleanUrl) : cleanUrl
    return {
      format: 'module',
      source: `export default "${filePath}"`,
      shortCircuit: true,
    }
  }
  return await loadTs(url, context, nextLoad)
}
