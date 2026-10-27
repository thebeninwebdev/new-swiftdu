const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const ts = require('typescript')
const vm = require('node:vm')

const source = fs.readFileSync('hooks/use-network-state.ts', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exportsObject = {}
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require: (name) => name === 'react' ? { useCallback: (fn) => fn, useEffect: () => {}, useState: () => [] } : require(name),
})
const { prefersLowData } = exportsObject

test('automatic low-data mode follows Save-Data and slow connection hints', () => {
  assert.equal(prefersLowData('automatic', { saveData: true, effectiveType: '4g' }), true)
  assert.equal(prefersLowData('automatic', { effectiveType: 'slow-2g' }), true)
  assert.equal(prefersLowData('automatic', { effectiveType: '2g' }), true)
  assert.equal(prefersLowData('automatic', { effectiveType: '3g' }), false)
  assert.equal(prefersLowData('automatic', { effectiveType: '4g' }), false)
})

test('manual low-data preference overrides network hints', () => {
  assert.equal(prefersLowData('on', { effectiveType: '4g' }), true)
  assert.equal(prefersLowData('off', { saveData: true, effectiveType: '2g' }), false)
})
