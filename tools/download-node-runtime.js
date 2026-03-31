/**
 * Download or copy Node.js runtime binary for Electron packaging.
 * Reads NODE_RUNTIME_SRC env var for a local path, or downloads from nodejs.org.
 * Usage: node tools/download-node-runtime.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const NODE_VERSION = '22.16.0';
const targetDir = path.join(__dirname, '..', 'node-runtime');
const platform = process.platform; // win32, darwin, linux
const arch = process.arch; // x64, arm64

const binaryName = platform === 'win32' ? 'node.exe' : 'node';
const targetPath = path.join(targetDir, binaryName);

fs.mkdirSync(targetDir, { recursive: true });

if (fs.existsSync(targetPath)) {
  console.log(`node-runtime/${binaryName} already present — skipping`);
  process.exit(0);
}

// Option 1: Copy from local path (NODE_RUNTIME_SRC env var)
const localSrc = process.env.NODE_RUNTIME_SRC;
if (localSrc) {
  const srcPath = path.resolve(localSrc, binaryName);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, targetPath);
    console.log(`Copied ${binaryName} from ${srcPath} to node-runtime/`);
    process.exit(0);
  }
  console.warn(`NODE_RUNTIME_SRC set but ${srcPath} not found — falling back to download`);
}

// Option 2: Download from nodejs.org
const platMap = { win32: 'win', darwin: 'darwin', linux: 'linux' };
const ext = platform === 'win32' ? 'zip' : 'tar.gz';
const folderName = `node-v${NODE_VERSION}-${platMap[platform] || platform}-${arch}`;
const url = `https://nodejs.org/dist/v${NODE_VERSION}/${folderName}.${ext}`;

console.log(`Downloading Node.js v${NODE_VERSION} for ${platform}-${arch}...`);
console.log(`URL: ${url}`);

if (platform === 'win32') {
  // For Windows, download the zip and extract just node.exe
  const tmpZip = path.join(targetDir, 'node.zip');
  const file = fs.createWriteStream(tmpZip);

  function download(downloadUrl) {
    https.get(downloadUrl, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        download(response.headers.location);
        return;
      }
      if (response.statusCode !== 200) {
        console.error(`Download failed: HTTP ${response.statusCode}`);
        console.error('Please set NODE_RUNTIME_SRC to a local Node.js installation directory');
        process.exit(1);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Download complete. Extracting node.exe...');
        // Use PowerShell to extract just node.exe from the zip
        const { execSync } = require('child_process');
        try {
          execSync(`powershell -Command "Expand-Archive -Path '${tmpZip}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'inherit' });
          const extractedExe = path.join(targetDir, folderName, 'node.exe');
          if (fs.existsSync(extractedExe)) {
            fs.renameSync(extractedExe, targetPath);
            // Cleanup extracted folder
            fs.rmSync(path.join(targetDir, folderName), { recursive: true, force: true });
          }
          fs.unlinkSync(tmpZip);
          console.log('node-runtime/node.exe ready');
        } catch (e) {
          console.error('Extraction failed:', e.message);
          process.exit(1);
        }
      });
    }).on('error', (err) => {
      console.error('Download error:', err.message);
      process.exit(1);
    });
  }
  download(url);
} else {
  // For macOS/Linux, download tar.gz and extract node binary
  const { execSync } = require('child_process');
  const tmpTar = path.join(targetDir, 'node.tar.gz');
  const file = fs.createWriteStream(tmpTar);

  function download(downloadUrl) {
    https.get(downloadUrl, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        download(response.headers.location);
        return;
      }
      if (response.statusCode !== 200) {
        console.error(`Download failed: HTTP ${response.statusCode}`);
        process.exit(1);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        try {
          execSync(`tar -xzf "${tmpTar}" -C "${targetDir}" "${folderName}/bin/node"`, { stdio: 'inherit' });
          fs.renameSync(path.join(targetDir, folderName, 'bin', 'node'), targetPath);
          fs.rmSync(path.join(targetDir, folderName), { recursive: true, force: true });
          fs.unlinkSync(tmpTar);
          fs.chmodSync(targetPath, 0o755);
          console.log('node-runtime/node ready');
        } catch (e) {
          console.error('Extraction failed:', e.message);
          process.exit(1);
        }
      });
    }).on('error', (err) => {
      console.error('Download error:', err.message);
      process.exit(1);
    });
  }
  download(url);
}
