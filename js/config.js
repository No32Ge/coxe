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
    "enableLocalStorage": true,
    "aiAgents": [
        {
            "id": "agent_deepseek_chat",
            "name": "DeepSeekChat",
            "systemPrompt": "你是一个乐于助人的AI助手。",
            "apiUrl": "https://api.deepseek.com/v1/chat/completions",
            "apiKey": "",
            "model": "deepseek-chat",
            "type": "stateless"
        },
        {
            "id": "agent_deepseek_coder",
            "name": "DeepSeekCoder",
            "systemPrompt": "你是一个精通代码重构的AI专家。",
            "apiUrl": "https://api.deepseek.com/v1/chat/completions",
            "apiKey": "",
            "model": "deepseek-coder",
            "type": "stateful"
        }
    ]
};

window.DEFAULT_PROJECT_LIST = [
    { id: "proj_default", name: "默认项目 (Demo)" }
];

window.getProjectList = function() {
    try {
        const stored = localStorage.getItem('workspace_project_list');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("加载项目列表失败:", e);
    }
    return JSON.parse(JSON.stringify(window.DEFAULT_PROJECT_LIST));
};

window.saveProjectList = function(list) {
    try {
        localStorage.setItem('workspace_project_list', JSON.stringify(list));
    } catch (e) {
        console.error("保存项目列表失败:", e);
    }
};

window.getCurrentProjectId = function() {
    try {
        const stored = localStorage.getItem('workspace_current_project_id');
        if (stored) {
            const list = window.getProjectList();
            if (list.some(p => p.id === stored)) {
                return stored;
            }
        }
    } catch (e) {}
    return "proj_default";
};

window.setCurrentProjectId = function(id) {
    try {
        localStorage.setItem('workspace_current_project_id', id);
    } catch (e) {
        console.error("设置当前项目ID失败:", e);
    }
};

window.hideConfig = window.DEFAULT_HIDE_CONFIG;

window.loadHideConfig = function() {
    try {
        const projId = window.getCurrentProjectId();
        const stored = localStorage.getItem(`workspace_project_hide_config_${projId}`);
        if (stored) {
            window.hideConfig = JSON.parse(stored);
            if (window.hideConfig.maxHistoryLimit === undefined) window.hideConfig.maxHistoryLimit = 10;
            if (window.hideConfig.enableLocalStorage === undefined) window.hideConfig.enableLocalStorage = true;
            if (!Array.isArray(window.hideConfig.hidePaths)) window.hideConfig.hidePaths = [];
            if (!Array.isArray(window.hideConfig.aiAgents)) {
                window.hideConfig.aiAgents = JSON.parse(JSON.stringify(window.DEFAULT_HIDE_CONFIG.aiAgents));
            }
        } else {
            // 尝试读取旧版本的全局配置进行平滑迁移
            const legacy = localStorage.getItem('workspace_hide_config');
            if (legacy && projId === 'proj_default') {
                window.hideConfig = JSON.parse(legacy);
            } else {
                window.hideConfig = JSON.parse(JSON.stringify(window.DEFAULT_HIDE_CONFIG));
            }
            
            if (window.hideConfig.enableLocalStorage !== false) {
                localStorage.setItem(`workspace_project_hide_config_${projId}`, JSON.stringify(window.hideConfig, null, 2));
            }
        }
    } catch (e) {
        console.error("加载配置失败，重置为默认配置: ", e);
        window.hideConfig = JSON.parse(JSON.stringify(window.DEFAULT_HIDE_CONFIG));
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
