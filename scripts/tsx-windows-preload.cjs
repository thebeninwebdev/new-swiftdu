// Node 24 can fail in constrained Windows sessions while tsx resolves os.userInfo().
// tsx only uses geteuid to choose a temporary-directory name.
if (process.platform === 'win32' && typeof process.geteuid !== 'function') {
  process.geteuid = () => 'swiftdu'
}
