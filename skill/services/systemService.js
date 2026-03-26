/**
 * 系统管理服务
 * 版本检查、升级、卸载功能
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const https = require('https');

// 系统配置
const SYSTEM_CONFIG = {
  // 安装目录
  installDir: process.env.LOG_SEARCH_INSTALL_DIR || '/opt/hiclaw-log-search',
  // GitHub 仓库
  repo: 'nillikechatchat/hiclaw-log-search',
  // 当前版本
  currentVersion: require('../../package.json').version,
  // 卸载确认码
  uninstallConfirmCode: 'UNINSTALL-CONFIRM',
};

/**
 * 获取当前版本信息
 */
function getVersion() {
  return {
    version: SYSTEM_CONFIG.currentVersion,
    installDir: SYSTEM_CONFIG.installDir,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * 检查是否有新版本
 */
async function checkUpgrade() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${SYSTEM_CONFIG.repo}/releases/latest`,
      headers: {
        'User-Agent': 'HiClaw-Log-Search',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const latestVersion = release.tag_name?.replace(/^v/, '') || release.name;
          
          resolve({
            hasUpgrade: latestVersion && latestVersion !== SYSTEM_CONFIG.currentVersion,
            currentVersion: SYSTEM_CONFIG.currentVersion,
            latestVersion: latestVersion || SYSTEM_CONFIG.currentVersion,
            releaseUrl: release.html_url,
            releaseNotes: release.body,
            publishedAt: release.published_at,
          });
        } catch (e) {
          resolve({
            hasUpgrade: false,
            currentVersion: SYSTEM_CONFIG.currentVersion,
            error: 'Failed to parse version info',
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        hasUpgrade: false,
        currentVersion: SYSTEM_CONFIG.currentVersion,
        error: e.message,
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        hasUpgrade: false,
        currentVersion: SYSTEM_CONFIG.currentVersion,
        error: 'Request timeout',
      });
    });
  });
}

/**
 * 执行升级
 */
async function executeUpgrade() {
  const installDir = SYSTEM_CONFIG.installDir;
  
  try {
    // 1. 检查目录是否存在
    if (!fs.existsSync(installDir)) {
      return { success: false, error: 'Installation directory not found' };
    }

    // 2. 执行 git pull
    const gitResult = execSync('git pull origin main', {
      cwd: installDir,
      encoding: 'utf-8',
      timeout: 60000,
    });

    // 3. 安装依赖（如果有）
    const packageJsonPath = path.join(installDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        execSync('npm install --production', {
          cwd: installDir,
          encoding: 'utf-8',
          timeout: 120000,
        });
      } catch (e) {
        // npm install 可能失败，但不影响主要功能
        console.warn('npm install warning:', e.message);
      }
    }

    // 4. 重启服务（通过 systemd 或直接退出让 supervisor 重启）
    setTimeout(() => {
      process.exit(0); // 退出，让 supervisor/systemd 重启
    }, 1000);

    return {
      success: true,
      message: 'Upgrade completed, service restarting...',
      gitOutput: gitResult,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
    };
  }
}

/**
 * 执行卸载
 * @param {string} confirmCode - 确认码，防止误操作
 */
async function executeUninstall(confirmCode) {
  // 验证确认码
  if (confirmCode !== SYSTEM_CONFIG.uninstallConfirmCode) {
    return {
      success: false,
      error: 'Invalid confirm code. Use "' + SYSTEM_CONFIG.uninstallConfirmCode + '" to confirm.',
      hint: 'This is a destructive operation. Please confirm carefully.',
    };
  }

  const installDir = SYSTEM_CONFIG.installDir;

  try {
    // 1. 停止服务（通过 systemd）
    try {
      execSync('systemctl stop hiclaw-log-search', { timeout: 30000 });
    } catch (e) {
      // 可能没有 systemd，继续
    }

    // 2. 禁用服务
    try {
      execSync('systemctl disable hiclaw-log-search', { timeout: 10000 });
    } catch (e) {
      // 继续
    }

    // 3. 删除服务文件
    const serviceFile = '/etc/systemd/system/hiclaw-log-search.service';
    if (fs.existsSync(serviceFile)) {
      fs.unlinkSync(serviceFile);
    }

    // 4. 重新加载 systemd
    try {
      execSync('systemctl daemon-reload', { timeout: 10000 });
    } catch (e) {
      // 继续
    }

    // 5. 删除 Nginx 配置
    const nginxConf = '/etc/nginx/conf.d/log-search.conf';
    if (fs.existsSync(nginxConf)) {
      fs.unlinkSync(nginxConf);
      try {
        execSync('nginx -s reload', { timeout: 10000 });
      } catch (e) {
        // 继续
      }
    }

    // 6. 删除安装目录（异步，因为当前进程还在运行）
    setTimeout(() => {
      try {
        execSync(`rm -rf ${installDir}`, { timeout: 60000 });
      } catch (e) {
        console.error('Failed to remove install directory:', e.message);
      }
    }, 2000);

    return {
      success: true,
      message: 'Uninstall initiated. Service stopped, files will be removed.',
      removedFiles: [
        serviceFile,
        nginxConf,
        installDir,
      ],
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
    };
  }
}

/**
 * 获取卸载确认码（仅本地可调用）
 */
function getUninstallConfirmCode(clientIp) {
  const isLocal = clientIp === '127.0.0.1' || 
                  clientIp === '::1' || 
                  clientIp === '::ffff:127.0.0.1';

  if (!isLocal) {
    return { error: 'Only accessible from localhost' };
  }

  return {
    confirmCode: SYSTEM_CONFIG.uninstallConfirmCode,
    warning: 'DANGER: This code will completely remove the log-search service.',
  };
}

module.exports = {
  getVersion,
  checkUpgrade,
  executeUpgrade,
  executeUninstall,
  getUninstallConfirmCode,
  SYSTEM_CONFIG,
};