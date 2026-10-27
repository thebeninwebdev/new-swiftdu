const os = require('node:os')
os.userInfo = () => ({ username: 'swiftdu', uid: -1, gid: -1, shell: null, homedir: process.cwd() })
