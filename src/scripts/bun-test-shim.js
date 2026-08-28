import * as assert from 'node:assert/strict'
import * as nodeTest from 'node:test'

function createEach(targetFn) {
  return function(cases) {
    return function(name, fn) {
      for (const item of cases) {
        if (Array.isArray(item)) {
          let testName = name
          for (const arg of item) {
            testName = testName.replace('%p', String(arg)).replace('%s', String(arg)).replace('%d', String(arg))
          }
          targetFn(testName, async (t) => fn(...item))
        } else {
          const testName = name.replace('%p', String(item)).replace('%s', String(item)).replace('%d', String(item))
          targetFn(testName, async (t) => fn(item))
        }
      }
    }
  }
}

export const test = Object.assign(
  function(name, fn) {
    return nodeTest.test(name, fn)
  },
  {
    each: createEach(nodeTest.test),
    only: nodeTest.test.only,
    skip: nodeTest.test.skip,
    todo: nodeTest.test.todo,
  },
)

export const it = test

export const describe = Object.assign(
  function(name, fn) {
    return nodeTest.describe(name, fn)
  },
  {
    each: createEach(nodeTest.describe),
    only: nodeTest.describe.only,
    skip: nodeTest.describe.skip,
    todo: nodeTest.describe.todo,
  },
)

export const beforeAll = nodeTest.before
export const afterAll = nodeTest.after
export const beforeEach = nodeTest.beforeEach
export const afterEach = nodeTest.afterEach

function isObject(val) {
  return val !== null && typeof val === 'object'
}

function checkSubset(actual, expected, path = 'root') {
  if (expected === actual) return
  if (expected === undefined && (actual === undefined || !isObject(actual))) return
  if (typeof actual === 'bigint' && typeof expected === 'bigint') {
    assert.strictEqual(actual, expected, `BigInt mismatch at ${path}`)
    return
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `Expected array at ${path}, got ${typeof actual}`)
    assert.strictEqual(actual.length, expected.length, `Array length mismatch at ${path}: expected ${expected.length}, got ${actual.length}`)
    for (let i = 0; i < expected.length; i++) {
      checkSubset(actual[i], expected[i], `${path}[${i}]`)
    }
    return
  }
  if (isObject(expected)) {
    assert.ok(isObject(actual), `Expected object at ${path}, got ${actual}`)
    for (const key of Object.keys(expected)) {
      if (expected[key] === undefined && actual[key] === undefined) continue
      checkSubset(actual[key], expected[key], `${path}.${key}`)
    }
    return
  }
  assert.strictEqual(actual, expected, `Mismatch at ${path}`)
}

export function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected)
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected)
    },
    toMatchObject(expected) {
      checkSubset(actual, expected)
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(actual - expected)
      const maxDiff = Math.pow(10, -precision) / 2
      assert.ok(diff < maxDiff, `Expected ${actual} to be close to ${expected} (precision ${precision})`)
    },
    toBeGreaterThan(expected) {
      assert.ok(actual > expected, `Expected ${actual} to be greater than ${expected}`)
    },
    toBeGreaterThanOrEqual(expected) {
      assert.ok(actual >= expected, `Expected ${actual} to be greater than or equal to ${expected}`)
    },
    toBeLessThan(expected) {
      assert.ok(actual < expected, `Expected ${actual} to be less than ${expected}`)
    },
    toBeLessThanOrEqual(expected) {
      assert.ok(actual <= expected, `Expected ${actual} to be less than or equal to ${expected}`)
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined)
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined)
    },
    toBeNull() {
      assert.strictEqual(actual, null)
    },
    toBeNaN() {
      assert.ok(Number.isNaN(actual), `Expected ${actual} to be NaN`)
    },
    toBeTruthy() {
      assert.ok(actual)
    },
    toBeFalsy() {
      assert.ok(!actual)
    },
    toContain(item) {
      if (typeof actual === 'string' || Array.isArray(actual)) {
        assert.ok(actual.includes(item), `Expected ${actual} to contain ${item}`)
      } else {
        assert.ok(false, `Expected string or array, got ${typeof actual}`)
      }
    },
    toHaveLength(len) {
      assert.strictEqual(actual?.length, len, `Expected length ${len}, got ${actual?.length}`)
    },
    toThrow(err) {
      assert.throws(actual, err)
    },
    pass() {
      assert.ok(true)
    },
    fail(msg) {
      assert.fail(msg)
    },
  }
}

expect.fail = function(msg) {
  assert.fail(msg)
}

expect.pass = function() {
  assert.ok(true)
}
