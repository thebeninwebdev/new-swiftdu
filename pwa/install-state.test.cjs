const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('lib/pwa-install.ts', 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const moduleRecord = { exports: {} }
vm.runInNewContext(code, {
  exports: moduleRecord.exports,
  module: moduleRecord,
})

const {
  CUSTOMER_INSTALL_SUGGESTION_INTERVAL_MS,
  shouldShowCustomerInstallSuggestion,
} = moduleRecord.exports

test('customer install suggestion is limited to once every seven days', () => {
  const now = Date.UTC(2026, 9, 28)

  assert.equal(shouldShowCustomerInstallSuggestion(null, now), true)
  assert.equal(shouldShowCustomerInstallSuggestion('not-a-date', now), true)
  assert.equal(shouldShowCustomerInstallSuggestion(String(now), now), false)
  assert.equal(
    shouldShowCustomerInstallSuggestion(
      String(now - CUSTOMER_INSTALL_SUGGESTION_INTERVAL_MS + 1),
      now,
    ),
    false,
  )
  assert.equal(
    shouldShowCustomerInstallSuggestion(
      String(now - CUSTOMER_INSTALL_SUGGESTION_INTERVAL_MS),
      now,
    ),
    true,
  )
})
