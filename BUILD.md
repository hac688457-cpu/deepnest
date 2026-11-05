# Build


## Prerequisites

### General

- **Node 20+:** [Node.js](https://nodejs.org). You can use the Node Version Manager (nvm):
  - [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) to download Node and change versions.
- **Python 3.7.9 and up** You can use the Python Version Manager (pyenv):
  - [pyenv-win](https://github.com/pyenv-win/pyenv-win) to download and change versions.
- **RUST** setup rust via https://rustup.rs/ - mainly for used for plugins - currently not used in this repo.

### WINDOWS

- **Visual Studio with Desktop Development with C++ extension**
  - Install VS2022 from https://visualstudio.microsoft.com/vs/features/cplusplus/
  - or, as an administrator via `npm install --global windows-build-tools` (older VS version)

### MACOS

[Install Homebrew](https://docs.brew.sh/Installation)
```shell
xcode-select --install
brew install boost
```

### LINUX

Have a look in the workflow file:
https://github.com/deepnest-next/deepnest/blob/main/.github/workflows/build.yml#L28

- gcc
- clang
- libboost-dev

### Possible Problems

- On Windows 10 1905 or newer, you might need to **disable the built-in Python launcher** via
  - **Start** > "**Manage App Execution Aliases**" and turning off the "**App Installer" aliases for Python**"
- close-and-open all command shells and your IDE to activate the latest setup

## Building

```sh
git clone https://github.com/deepnest-next/deepnest
cd deepnest
npm install
npm run build
npm run start
```

### Rebuild

```sh
# If you change the electron-related files (web files, javascript), a build with
npm run build

# If you change the the Minkowski files (the `.cc` or `.h` files):
npm run build-all
```

### Running

- `npm run start`

### Clean builds

```sh
npm run clean  && npm run build

# full clean, incl. `node_modules`
npm run clean-all && npm install && npm run build
```

### Running the tests

First, one-time setup:

```sh
npx playwright install chromium
```

Without this, you may encounter tests timing out after 30000 milliseconds.

Then, simply run `npm run test`.

### Add tests via playwright codegen

To create new tests you can run:

```sh
npm run pw:codegen
```

or

Linux/MacOS:
```sh
node ./helper_scripts/playwright_codegen.js
```

or

Windows:
```sh
node .\helper_scripts\playwright_codegen.js
```

### Create a Distribution

```sh
npm run dist

# During development, you can combine `clean-all, build-all and dist` via:
npm run dist-all
```

The resulting files will be located in `.\deepnest-<version>-win32-x64`.

Create a zip file of this folder for a simple distribution.

## Debugging

If the environment variable "deepnest_debug" has a value of "1", deepnest will open the browser dev tools (debugger/inspector).

### Isolated Ubuntu x64 package

From a clean, verified checkout, build in a separate temporary copy. The example
reuses installed local dependencies; it does not install global packages. The
isolated HOME needs the Electron headers required by `electron-rebuild` (or
network access to obtain them). `electron-packager` uses the Electron version
in `node_modules`.

```sh
mkdir -p /tmp/deepnest-cnc-final-ubuntu-release/{work,home,dist}
git archive HEAD | tar -x -C /tmp/deepnest-cnc-final-ubuntu-release/work
cp -a --reflink=auto node_modules /tmp/deepnest-cnc-final-ubuntu-release/work/
cd /tmp/deepnest-cnc-final-ubuntu-release/work
HOME=/tmp/deepnest-cnc-final-ubuntu-release/home npm run build
HOME=/tmp/deepnest-cnc-final-ubuntu-release/home ./node_modules/.bin/electron-packager . deepnest-v1.5.6 --platform=linux --arch=x64 --out=/tmp/deepnest-cnc-final-ubuntu-release/dist --asar --ignore='^/tests' --ignore='^/examples'
```

Verify the packaged `resources/app.asar` against the intended source revision
and run the isolated Electron acceptance in `tests/CNC_DXF.md`. Do not reuse an
older package for release validation.
