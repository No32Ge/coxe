// ==========================================
// ⚙️ JSON 忽略与运行配置逻辑（LocalStorage 固化）
// ==========================================
window.DEFAULT_HIDE_CONFIG = {
    "excludeExtensions": [
        ".mp3", ".wav", ".png", ".jpg", ".jpeg", 
        ".gif", ".ico", ".pdf", ".zip", ".tar", 
        ".gz", ".mp4", ".mov", ".woff", ".woff2"
    ],
    "excludePaths": [
        "node_modules/", 
        "dist/", 
        "build/", 
        ".git/", 
        "package-lock.json", 
        "yarn.lock", 
        "pnpm-lock.yaml"
    ],
    "maxHistoryLimit": 10,
    "hidePaths": [],
    "enableLocalStorage": true
};

window.hideConfig = window.DEFAULT_HIDE_CONFIG;

window.loadHideConfig = function() {
    try {
        const stored = localStorage.getItem('workspace_hide_config');
        if (stored) {
            window.hideConfig = JSON.parse(stored);
            if (window.hideConfig.maxHistoryLimit === undefined) window.hideConfig.maxHistoryLimit = 10;
            if (window.hideConfig.enableLocalStorage === undefined) window.hideConfig.enableLocalStorage = true;
            if (!Array.isArray(window.hideConfig.hidePaths)) window.hideConfig.hidePaths = [];
        } else {
            localStorage.setItem('workspace_hide_config', JSON.stringify(window.DEFAULT_HIDE_CONFIG, null, 2));
            window.hideConfig = window.DEFAULT_HIDE_CONFIG;
        }
    } catch (e) {
        console.error("加载配置失败，重置为默认配置: ", e);
        window.hideConfig = window.DEFAULT_HIDE_CONFIG;
    }
    document.getElementById('config-textarea').value = JSON.stringify(window.hideConfig, null, 2);
};

window.isFileOmitted = function(path, config) {
    if (!config) return false;
    if (config.excludeExtensions && Array.isArray(config.excludeExtensions)) {
        if (config.excludeExtensions.some(ext => path.toLowerCase().endsWith(ext.toLowerCase()))) {
            return true;
        }
    }
    if (config.excludePaths && Array.isArray(config.excludePaths)) {
        if (config.excludePaths.some(p => path.includes(p) || path.startsWith(p))) {
            return true;
        }
    }
    return false;
};

window.isFileHiddenFromAI = function(path, config) {
    if (!config || !Array.isArray(config.hidePaths)) return false;
    return config.hidePaths.some(p => path.includes(p) || path.startsWith(p));
};