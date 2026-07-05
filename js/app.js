// ==========================================
// 🕹️ 主业务流程控制逻辑与生命周期
// ==========================================
window.parsedFiles = [];
window.consoleLogs = [];
window.pendingDeletePath = null;
window.logGroups = [];
window.currentLogGroupId = null;

window.addConsoleLog = function(action, file, text, level="info") {
    let color = 'text-slate-300';
    if (level === 'success') color = 'text-emerald-400 font-medium';
    if (level === 'warn') color = 'text-amber-400';
    if (level === 'error') color = 'text-rose-500 font-bold';
    
    const timestamp = new Date().toLocaleTimeString();
    const logHTML = `<div class="${color}"><span class="text-slate-600">[${timestamp}]</span> [${action.toUpperCase()}] ${file ? `"${file}"` : ''} - ${text}</div>`;
    window.consoleLogs.push(logHTML);
    
    // Add log to current XML log group if active
    if (window.currentLogGroupId && window.logGroups) {
        const group = window.logGroups.find(g => g.id === window.currentLogGroupId);
        if (group) {
            group.logs.push({
                action: action,
                file: file,
                text: text,
                level: level,
                timestamp: timestamp,
                html: logHTML
            });
        }
    }
    
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        logOutput.innerHTML = window.consoleLogs.join('');
        logOutput.scrollTop = logOutput.scrollHeight;
    }
};

window.loadFiles = function(files, historyLabel = "载入外部项目") {
    window.parsedFiles = files;
    window.parsedFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    window.HistoryManager.pushHistory(historyLabel);
    window.HistoryManager.saveCurrentStateToStorage();

    window.renderDirectoryTree(window.parsedFiles);
    window.renderStringMode(window.parsedFiles);
    window.updateStats();
    
    if (window.parsedFiles.length > 0) {
        window.viewFile(window.parsedFiles[0].path, window.parsedFiles[0].content);
    }
    document.getElementById('workspace').classList.remove('hidden');
};

window.switchProject = function(projectId) {
    window.setCurrentProjectId(projectId);
    window.loadHideConfig(); // 载入对应的项目配置

    let cachedFiles = null;
    let cachedHistory = null;
    let cachedActiveHistoryId = null;

    if (window.hideConfig.enableLocalStorage !== false) {
        try {
            const stored = localStorage.getItem(`workspace_project_files_${projectId}`);
            if (stored) {
                cachedFiles = JSON.parse(stored);
            } else if (projectId === 'proj_default') {
                // 兼容旧数据的迁移
                const legacyStored = localStorage.getItem('workspace_files');
                if (legacyStored) cachedFiles = JSON.parse(legacyStored);
            }
        } catch (e) {
            console.error("加载本地项目文件失败: ", e);
        }

        try {
            const storedHistory = localStorage.getItem(`workspace_project_history_list_${projectId}`);
            if (storedHistory) {
                cachedHistory = JSON.parse(storedHistory);
            } else if (projectId === 'proj_default') {
                const legacyStoredHistory = localStorage.getItem('workspace_history_list');
                if (legacyStoredHistory) cachedHistory = JSON.parse(legacyStoredHistory);
            }

            const storedActiveId = localStorage.getItem(`workspace_project_active_history_id_${projectId}`);
            if (storedActiveId) {
                cachedActiveHistoryId = JSON.parse(storedActiveId);
            } else if (projectId === 'proj_default') {
                const legacyStoredActiveId = localStorage.getItem('workspace_active_history_id');
                if (legacyStoredActiveId) cachedActiveHistoryId = JSON.parse(legacyStoredActiveId);
            }

            const storedDatabase = localStorage.getItem(`workspace_project_object_database_${projectId}`);
            if (storedDatabase) {
                window.HistoryManager.objectDatabase = JSON.parse(storedDatabase);
            } else if (projectId === 'proj_default') {
                const legacyStoredDatabase = localStorage.getItem('workspace_object_database');
                if (legacyStoredDatabase) window.HistoryManager.objectDatabase = JSON.parse(legacyStoredDatabase);
            } else {
                window.HistoryManager.objectDatabase = {};
            }
        } catch (e) {
            console.error("加载本地时光机数据失败: ", e);
        }
    } else {
        window.HistoryManager.objectDatabase = {};
    }

    if (cachedHistory && cachedHistory.length > 0 && cachedActiveHistoryId) {
        window.HistoryManager.historyList = cachedHistory;
        window.HistoryManager.activeHistoryId = cachedActiveHistoryId;
        
        const activeState = cachedHistory.find(item => item.id === cachedActiveHistoryId);
        if (activeState) {
            window.parsedFiles = window.HistoryManager.reconstructFiles(activeState.files);
            window.renderDirectoryTree(window.parsedFiles);
            window.renderStringMode(window.parsedFiles);
            window.updateStats();
            window.HistoryManager.renderTimeline();
            
            if (window.parsedFiles.length > 0) {
                window.viewFile(window.parsedFiles[0].path, window.parsedFiles[0].content);
            } else {
                document.getElementById('current-file-name').textContent = '';
                document.getElementById('current-file-content').textContent = '';
                document.getElementById('line-numbers').textContent = '';
            }
            document.getElementById('workspace').classList.remove('hidden');
            window.addConsoleLog("SYSTEM", `成功切换并载入项目历史时光机（共 ${cachedHistory.length} 个历史版本）。`, "success");
        } else {
            window.loadFilesWithoutPush(JSON.parse(JSON.stringify(window.demoFiles)), "初始化默认案例");
        }
    } else if (cachedFiles && Array.isArray(cachedFiles)) {
        window.parsedFiles = cachedFiles;
        window.parsedFiles.sort((a, b) => a.path.localeCompare(b.path));
        window.HistoryManager.historyList = [];
        window.HistoryManager.activeHistoryId = null;
        window.HistoryManager.pushHistory("自动恢复本地缓存");
        window.renderDirectoryTree(window.parsedFiles);
        window.renderStringMode(window.parsedFiles);
        window.updateStats();
        if (window.parsedFiles.length > 0) {
            window.viewFile(window.parsedFiles[0].path, window.parsedFiles[0].content);
        }
        document.getElementById('workspace').classList.remove('hidden');
        window.addConsoleLog("SYSTEM", `已载入项目上次离开时的缓存文件 (共 ${cachedFiles.length} 个文件)。`, "success");
    } else {
        window.loadFilesWithoutPush(JSON.parse(JSON.stringify(window.demoFiles)), "初始化默认案例");
    }

    const fileSearch = document.getElementById('file-search');
    if (fileSearch) fileSearch.value = '';
    window.renderProjectListUI();
};

window.loadFilesWithoutPush = function(files, label = "初始化项目") {
    window.parsedFiles = files;
    window.parsedFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    window.HistoryManager.historyList = [];
    window.HistoryManager.activeHistoryId = null;
    window.HistoryManager.objectDatabase = {};
    window.HistoryManager.pushHistory(label);
    
    window.renderDirectoryTree(window.parsedFiles);
    window.renderStringMode(window.parsedFiles);
    window.updateStats();
    
    if (window.parsedFiles.length > 0) {
        window.viewFile(window.parsedFiles[0].path, window.parsedFiles[0].content);
    }
    document.getElementById('workspace').classList.remove('hidden');
};

window.renderProjectListUI = function() {
    const selector = document.getElementById('project-selector');
    if (!selector) return;

    const list = window.getProjectList();
    const currentId = window.getCurrentProjectId();

    selector.innerHTML = '';
    let currentProjectName = '未命名项目';
    list.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === currentId) {
            option.selected = true;
            currentProjectName = p.name;
        }
        selector.appendChild(option);
    });

    // 动态更新浏览器导航栏（网页标签页标题）与网页顶部导航栏标题
    const displayTitle = `Coxe - ${currentProjectName}`;
    document.title = displayTitle;

    const headerTitle = document.getElementById('header-title');
    if (headerTitle) {
        headerTitle.textContent = displayTitle;
    }
};

window.addNewProject = async function() {
    const name = await window.showInputModal("新建项目", "请输入新项目名称:", "未命名项目_" + Date.now().toString(36).substring(5));
    if (name && name.trim()) {
        const list = window.getProjectList();
        const newId = "proj_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        list.push({ id: newId, name: name.trim() });
        window.saveProjectList(list);
        
        window.switchProject(newId);
        window.addConsoleLog("SYSTEM", `成功创建项目 "${name.trim()}"`, "success");
    }
};

window.renameCurrentProject = async function() {
    const list = window.getProjectList();
    const currentId = window.getCurrentProjectId();
    const project = list.find(p => p.id === currentId);
    if (!project) return;

    const newName = await window.showInputModal("重命名当前项目", "请输入新的项目名称:", project.name);
    if (newName && newName.trim()) {
        const oldName = project.name;
        project.name = newName.trim();
        window.saveProjectList(list);
        window.renderProjectListUI();
        window.addConsoleLog("SYSTEM", `成功将项目 "${oldName}" 重命名为 "${newName.trim()}"`, "success");
    }
};

window.deleteCurrentProject = function() {
    const list = window.getProjectList();
    const currentId = window.getCurrentProjectId();
    if (list.length <= 1) {
        alert("必须保留至少一个项目！");
        return;
    }

    const project = list.find(p => p.id === currentId);
    if (!project) return;

    if (confirm(`⚠️ 警告: 确定要彻底删除项目 "${project.name}" 吗？\n此操作无法撤销，该项目下的所有虚拟文件和时光机历史将全部丢失！`)) {
        localStorage.removeItem(`workspace_project_files_${currentId}`);
        localStorage.removeItem(`workspace_project_history_list_${currentId}`);
        localStorage.removeItem(`workspace_project_active_history_id_${currentId}`);
        localStorage.removeItem(`workspace_project_object_database_${currentId}`);
        localStorage.removeItem(`workspace_project_hide_config_${currentId}`);

        const newList = list.filter(p => p.id !== currentId);
        window.saveProjectList(newList);

        window.switchProject(newList[0].id);
        window.addConsoleLog("SYSTEM", `项目 "${project.name}" 已被彻底删除，已自动切换至 "${newList[0].name}"。`, "warn");
    }
};

window.exportCurrentProject = function() {
    const list = window.getProjectList();
    const currentId = window.getCurrentProjectId();
    const project = list.find(p => p.id === currentId);
    if (!project) return;

    const exportData = {
        type: "coxe_project_export",
        version: "1.0.0",
        projectName: project.name,
        files: window.parsedFiles,
        historyList: window.HistoryManager.historyList,
        activeHistoryId: window.HistoryManager.activeHistoryId,
        objectDatabase: window.HistoryManager.objectDatabase,
        hideConfig: window.hideConfig
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.replace(/[\/\\?%*:|"<>\s]/g, '_')}_config_and_history.json`;
    link.click();
    window.addConsoleLog("SYSTEM", `项目 "${project.name}" 的文件结构、配置以及时光机数据已成功打包导出。`, "success");
};

window.importProjectFile = function(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.type !== "coxe_project_export") {
                alert("导入失败！文件格式不匹配，非 Coxe 导出的完整项目数据。");
                return;
            }

            const list = window.getProjectList();
            const newId = "proj_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
            const name = (data.projectName || "未命名导入项目") + " (Imported)";
            
            list.push({ id: newId, name: name });
            window.saveProjectList(list);

            localStorage.setItem(`workspace_project_files_${newId}`, JSON.stringify(data.files || []));
            localStorage.setItem(`workspace_project_history_list_${newId}`, JSON.stringify(data.historyList || []));
            localStorage.setItem(`workspace_project_active_history_id_${newId}`, JSON.stringify(data.activeHistoryId || null));
            localStorage.setItem(`workspace_project_object_database_${newId}`, JSON.stringify(data.objectDatabase || {}));
            localStorage.setItem(`workspace_project_hide_config_${newId}`, JSON.stringify(data.hideConfig || window.DEFAULT_HIDE_CONFIG, null, 2));

            window.switchProject(newId);
            window.addConsoleLog("SYSTEM", `成功从配置文件导入并创建项目 "${name}"。`, "success");
        } catch (err) {
            alert("解析项目文件失败: " + err.message);
        }
    };
    reader.readAsText(file);
};

// DOM 加载完成后，挂载并绑定所有全局交互事件
window.addEventListener('DOMContentLoaded', () => {
    // 切换并加载当前选中的项目
    window.switchProject(window.getCurrentProjectId());

    // 初始化 AI 问答助手
    if (window.AiManager) {
        window.AiManager.init();
    }

    // 项目管理器事件绑定
    const projectSelector = document.getElementById('project-selector');
    const addProjectBtn = document.getElementById('add-project-btn');
    const renameProjectBtn = document.getElementById('rename-project-btn');
    const exportProjectBtn = document.getElementById('export-project-btn');
    const importProjectBtn = document.getElementById('import-project-btn');
    const projectImportInput = document.getElementById('project-import-input');
    const deleteProjectBtn = document.getElementById('delete-project-btn');

    if (projectSelector) {
        projectSelector.addEventListener('change', (e) => {
            window.switchProject(e.target.value);
        });
    }

    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.addNewProject();
        });
    }

    if (renameProjectBtn) {
        renameProjectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.renameCurrentProject();
        });
    }

    if (exportProjectBtn) {
        exportProjectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.exportCurrentProject();
        });
    }

    if (importProjectBtn) {
        importProjectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            projectImportInput.click();
        });
    }

    if (projectImportInput) {
        projectImportInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                window.importProjectFile(e.target.files[0]);
                e.target.value = ''; // Reset
            }
        });
    }

    if (deleteProjectBtn) {
        deleteProjectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.deleteCurrentProject();
        });
    }

    // 交互元素绑定
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const resetDemoBtn = document.getElementById('reset-demo-btn');
    const loadingStatus = document.getElementById('loading-status');
    const workspace = document.getElementById('workspace');

    const tabTreeBtn = document.getElementById('tab-tree-btn');
    const tabStringBtn = document.getElementById('tab-string-btn');
    const tabXmlBtn = document.getElementById('tab-xml-btn');
    const treeView = document.getElementById('tree-view');
    const stringView = document.getElementById('string-view');
    const xmlView = document.getElementById('xml-view');

    const copyFileContentBtn = document.getElementById('copy-file-content');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const copyAllText = document.getElementById('copy-all-text');

    const xmlInput = document.getElementById('xml-input');
    const executeXmlBtn = document.getElementById('execute-xml-btn');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    const loadExampleBtn = document.getElementById('load-example-btn');
    const downloadZipBtn = document.getElementById('download-zip-btn');
    const copyAiSpecBtn = document.getElementById('copy-ai-spec-btn');
    const fileSearch = document.getElementById('file-search');
    const configTextarea = document.getElementById('config-textarea');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const renameFileBtn = document.getElementById('rename-file-btn');
    const editFileBtn = document.getElementById('edit-file-btn');
    const saveFileBtn = document.getElementById('save-file-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editTextarea = document.getElementById('edit-textarea');
    const codeViewTable = document.getElementById('code-view-table');

    // 新建文件/文件夹内联输入区域
    const addFileContainer = document.getElementById('add-file-container');
    const addFileBtn = document.getElementById('add-file-btn');
    const addFileInputWrapper = document.getElementById('add-file-input-wrapper');
    const addFileInput = document.getElementById('add-file-input');
    const addFileIdle = document.getElementById('add-file-idle');

    if (addFileBtn && addFileInput && addFileInputWrapper && addFileIdle) {
        addFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addFileIdle.classList.add('hidden');
            addFileInputWrapper.classList.remove('hidden');
            addFileInput.value = '';
            addFileInput.focus();
        });

        addFileInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.activeElement !== addFileInput) {
                    addFileInputWrapper.classList.add('hidden');
                    addFileIdle.classList.remove('hidden');
                }
            }, 150);
        });

        addFileInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const raw = addFileInput.value.trim();
                if (!raw) {
                    addFileInputWrapper.classList.add('hidden');
                    addFileIdle.classList.remove('hidden');
                    return;
                }
                if (raw.endsWith('/')) {
                    const folderPath = raw;
                    const placeholderFile = folderPath + '.gitkeep';
                    if (window.parsedFiles.find(f => f.path === placeholderFile)) {
                        alert('该文件夹已存在（或占位文件已存在）。');
                    } else {
                        window.parsedFiles.push({ path: placeholderFile, content: '' });
                        window.parsedFiles.sort((a, b) => a.path.localeCompare(b.path));
                        window.HistoryManager.pushHistory('手动新建文件夹 ' + folderPath);
                        window.HistoryManager.saveCurrentStateToStorage();
                        window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
                        window.renderStringMode(window.parsedFiles);
                        window.updateStats();
                        window.addConsoleLog('CREATE', folderPath, '手动创建新文件夹（占位文件）。', 'success');
                    }
                } else {
                    if (window.parsedFiles.find(f => f.path === raw)) {
                        alert('文件已存在！');
                    } else {
                        window.parsedFiles.push({ path: raw, content: '' });
                        window.parsedFiles.sort((a, b) => a.path.localeCompare(b.path));
                        window.HistoryManager.pushHistory('手动新建文件 ' + raw);
                        window.HistoryManager.saveCurrentStateToStorage();
                        window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
                        window.renderStringMode(window.parsedFiles);
                        window.updateStats();
                        window.viewFile(raw, '');
                        window.addConsoleLog('CREATE', raw, '手动创建新文件。', 'success');
                    }
                }
                addFileInput.value = '';
                addFileInputWrapper.classList.add('hidden');
                addFileIdle.classList.remove('hidden');
            } else if (e.key === 'Escape') {
                addFileInput.value = '';
                addFileInputWrapper.classList.add('hidden');
                addFileIdle.classList.remove('hidden');
            }
        });
    }

    // 目录树中删除文件的委托事件（两段式：第一次变红，第二次确认删除）
    const treeRoot = document.getElementById('tree-root');
    if (treeRoot) {
        treeRoot.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-file-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const path = deleteBtn.getAttribute('data-delete-path');
                if (!path) return;
                if (window.pendingDeletePath === path) {
                    // 第二次点击：执行删除
                    const idx = window.parsedFiles.findIndex(f => f.path === path);
                    if (idx !== -1) {
                        window.parsedFiles.splice(idx, 1);
                        window.HistoryManager.pushHistory('手动删除文件 ' + path);
                        window.HistoryManager.saveCurrentStateToStorage();
                        window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
                        window.renderStringMode(window.parsedFiles);
                        window.updateStats();
                        const currentPath = document.getElementById('current-file-name').getAttribute('data-active-path');
                        if (currentPath === path) {
                            if (window.parsedFiles.length > 0) {
                                window.viewFile(window.parsedFiles[0].path, window.parsedFiles[0].content);
                            } else {
                                document.getElementById('current-file-name').textContent = '';
                                document.getElementById('current-file-content').textContent = '';
                            }
                        }
                        window.addConsoleLog('DELETE', path, '手动删除文件。', 'success');
                    }
                    window.pendingDeletePath = null;
                } else {
                    // 第一次点击：标记为待删除（变红）
                    window.pendingDeletePath = path;
                    window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
                }
            } else {
                // 点击树内非删除按钮区域，取消所有待删除状态
                if (window.pendingDeletePath) {
                    window.pendingDeletePath = null;
                    window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
                }
            }
        });
    }

    // 重置案例事件
    resetDemoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm("确定要重置并丢弃当前修改，恢复含有过滤示范的前端案例项目吗？")) {
            window.loadFiles(JSON.parse(JSON.stringify(window.demoFiles)), "重置演示案例");
            window.addConsoleLog("SYSTEM", "已重置回到初始忽略演示项目结构。", "info");
        }
    });

    // 保存全局 JSON 规则
    saveConfigBtn.addEventListener('click', () => {
        try {
            const parsed = JSON.parse(configTextarea.value);
            window.hideConfig = parsed;
            const projId = window.getCurrentProjectId();

            if (window.hideConfig.enableLocalStorage === false) {
                localStorage.removeItem(`workspace_project_hide_config_${projId}`);
                localStorage.removeItem(`workspace_project_files_${projId}`);
                window.addConsoleLog("CONFIG", null, "LocalStorage 持久化已禁用。配置与缓存代码均已被安全移除，之后将只在内存中运行。", "warn");
            } else {
                localStorage.setItem(`workspace_project_hide_config_${projId}`, JSON.stringify(parsed, null, 2));
                window.HistoryManager.saveCurrentStateToStorage();
                window.addConsoleLog("CONFIG", null, "LocalStorage 已成功启用并持久化当前项目的过滤配置与文件状态。", "success");
            }
            
            window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
            window.renderStringMode(window.parsedFiles);
            window.updateStats();
            
            const curPath = document.getElementById('current-file-name').textContent;
            const file = window.parsedFiles.find(f => f.path === curPath);
            if (file) {
                window.viewFile(file.path, file.content);
            }

            alert("规则保存并应用成功！");
        } catch (err) {
            alert("JSON 语法错误:\n" + err.message);
        }
    });

    // 选择文件夹按钮绑定
    if (selectFolderBtn && folderInput) {
        selectFolderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            folderInput.click();
        });
        folderInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFiles(e.target.files);
        });
    }

    // 拖拽/点击上传事件绑定
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50/20'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500', 'bg-blue-50/20'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50/20');
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFiles(e.target.files);
    });

    // 解析 tar 格式 ArrayBuffer，返回文件列表 { path, content }
    function parseTarBuffer(arrayBuffer) {
        const files = [];
        let offset = 0;
        const decoder = new TextDecoder();
        while (offset < arrayBuffer.byteLength) {
            const header = new Uint8Array(arrayBuffer, offset, 512);
            if (header.every(b => b === 0)) break;
            const nameBytes = header.slice(0, 100);
            const nameEnd = nameBytes.indexOf(0);
            const fileName = decoder.decode(nameBytes.slice(0, nameEnd >= 0 ? nameEnd : 100));
            const sizeBytes = header.slice(124, 136);
            const sizeStr = decoder.decode(sizeBytes).replace(/\0/g, '').trim();
            const fileSize = parseInt(sizeStr, 8) || 0;
            offset += 512;
            if (fileSize > 0) {
                const contentBytes = new Uint8Array(arrayBuffer, offset, fileSize);
                const content = decoder.decode(contentBytes);
                const isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 8000));
                if (!isBinary) {
                    files.push({ path: fileName, content: content });
                }
                const blocks = Math.ceil(fileSize / 512);
                offset += blocks * 512;
            }
        }
        return files;
    }

    // 处理单个文件，返回 { type, files, label }
    async function handleFile(file) {
        const fileName = file.name;
        const lowerName = fileName.toLowerCase();
        const buffer = await file.arrayBuffer();

        if (lowerName.endsWith('.zip')) {
            try {
                const zip = await JSZip.loadAsync(buffer);
                const filesTemp = [];
                const promises = [];
                zip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir) {
                        const promise = zipEntry.async('text').then(content => {
                            const isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 8000));
                            if (!isBinary) {
                                filesTemp.push({ path: relativePath, content: content });
                            }
                        });
                        promises.push(promise);
                    }
                });
                await Promise.all(promises);
                return { type: 'zip', files: filesTemp, label: `导入 ZIP 压缩包 (${fileName})` };
            } catch (err) {
                throw new Error('ZIP 解压失败: ' + err.message);
            }
        } else if (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz')) {
            try {
                const decompressed = pako.ungzip(new Uint8Array(buffer));
                const tarBuffer = decompressed.buffer;
                const files = parseTarBuffer(tarBuffer);
                return { type: 'targz', files: files, label: `导入 tar.gz 压缩包 (${fileName})` };
            } catch (err) {
                throw new Error('tar.gz 解压失败: ' + err.message);
            }
        } else if (lowerName.endsWith('.tar')) {
            try {
                const files = parseTarBuffer(buffer);
                return { type: 'tar', files: files, label: `导入 tar 压缩包 (${fileName})` };
            } catch (err) {
                throw new Error('tar 解压失败: ' + err.message);
            }
        } else if (lowerName.endsWith('.gz')) {
            try {
                const decompressed = pako.ungzip(new Uint8Array(buffer));
                const content = new TextDecoder().decode(decompressed);
                const isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 8000));
                if (!isBinary) {
                    const baseName = fileName.replace(/\.gz$/i, '');
                    return { type: 'gz', files: [{ path: baseName, content: content }], label: `导入 GZ 文件 (${fileName})` };
                } else {
                    return { type: 'gz', files: [], label: `GZ 文件 (${fileName}) 被识别为二进制，已跳过` };
                }
            } catch (err) {
                throw new Error('GZ 解压失败: ' + err.message);
            }
        } else {
            // 普通文件直接读取文本
            const content = await file.text();
            const isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 8000));
            if (!isBinary) {
                return { type: 'file', files: [{ path: fileName, content: content }], label: `导入文件 (${fileName})` };
            } else {
                return { type: 'file', files: [], label: `文件 (${fileName}) 疑似二进制，已跳过` };
            }
        }
    }

    // 批量处理拖拽/选择的文件（自动识别文件夹模式）
    async function handleFiles(fileList) {
        loadingStatus.classList.remove('hidden');
        workspace.classList.add('hidden');

        // 检测是否为文件夹选择（webkitRelativePath 存在且非空）
        const isFolderMode = fileList.length > 0 && fileList[0].webkitRelativePath && fileList[0].webkitRelativePath.length > 0;

        if (isFolderMode) {
            // 文件夹模式：直接读取文本内容，使用 webkitRelativePath 作为路径
            const allFiles = [];
            let imported = 0;
            for (const file of fileList) {
                try {
                    const content = await file.text();
                    const isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 8000));
                    if (!isBinary) {
                        allFiles.push({
                            path: file.webkitRelativePath,
                            content: content
                        });
                        imported++;
                    }
                } catch (err) {
                    console.error(`读取 ${file.webkitRelativePath} 失败:`, err);
                }
            }
            loadingStatus.classList.add('hidden');
            if (allFiles.length > 0) {
                window.loadFiles(allFiles, "导入本地文件夹");
                window.addConsoleLog("SYSTEM", `成功导入文件夹，共 ${allFiles.length} 个文件。`, "success");
            } else {
                alert('所选文件夹中没有可读的文本文件。');
                workspace.classList.remove('hidden');
            }
            return;
        }

        // 普通文件/压缩包模式（原有逻辑）
        const allFiles = [];
        let totalImported = 0;
        const errors = [];

        for (const file of fileList) {
            try {
                const result = await handleFile(file);
                allFiles.push(...result.files);
                totalImported += result.files.length;
            } catch (err) {
                errors.push(err.message);
                console.error(err);
            }
        }

        if (allFiles.length > 0) {
            window.loadFiles(allFiles, "导入文件/压缩包");
            window.addConsoleLog("SYSTEM", `成功导入 ${allFiles.length} 个文件。`, "success");
        } else if (errors.length > 0) {
            alert('所有文件导入失败: ' + errors.join('; '));
            workspace.classList.remove('hidden');
        } else {
            alert('没有可导入的有效文本文件。');
            workspace.classList.remove('hidden');
        }
        loadingStatus.classList.add('hidden');
        if (errors.length > 0) {
            window.addConsoleLog("SYSTEM", `部分文件导入失败: ${errors.join('; ')}`, "warn");
        }
    }

    // 选项卡切换绑定
    tabTreeBtn.addEventListener('click', () => { window.switchTab(tabTreeBtn, [tabStringBtn, tabXmlBtn], treeView, [stringView, xmlView]); });
    tabStringBtn.addEventListener('click', () => { window.switchTab(tabStringBtn, [tabTreeBtn, tabXmlBtn], stringView, [treeView, xmlView]); });
    tabXmlBtn.addEventListener('click', () => { window.switchTab(tabXmlBtn, [tabTreeBtn, tabStringBtn], xmlView, [treeView, stringView]); });

    // 文件名搜索
    fileSearch.addEventListener('input', () => {
        window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
    });

    const searchContentChk = document.getElementById('search-content-chk');
    if (searchContentChk) {
        searchContentChk.addEventListener('change', () => {
            window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
        });
    }

    // 展开立体版本图事件侦听
    const viewGraphBtn = document.getElementById('view-graph-btn');
    const graphModal = document.getElementById('graph-modal');
    const closeGraphBtn = document.getElementById('close-graph-btn');

    if (viewGraphBtn && graphModal) {
        viewGraphBtn.addEventListener('click', () => {
            graphModal.classList.remove('hidden');
            window.HistoryManager.renderVersionGraph();
        });

        closeGraphBtn.addEventListener('click', () => {
            graphModal.classList.add('hidden');
        });

        graphModal.addEventListener('click', (e) => {
            if (e.target === graphModal) {
                graphModal.classList.add('hidden');
            }
        });
    }

    // 一键复制 AI 指令规格说明 (使用高兼容复制工具)
    copyAiSpecBtn.addEventListener('click', () => {
        const aiSpecTemplate = document.getElementById('ai-spec-template');
        window.copyToClipboard(aiSpecTemplate.value).then(() => {
            const prevText = copyAiSpecBtn.textContent;
            copyAiSpecBtn.textContent = '✅ 指令规格书已拷贝！请发给 AI';
            copyAiSpecBtn.classList.replace('bg-slate-800', 'bg-green-600');
            setTimeout(() => {
                copyAiSpecBtn.textContent = prevText;
                copyAiSpecBtn.classList.replace('bg-green-600', 'bg-slate-800');
            }, 2000);
        });
    });

    // 复制单文件预览 (使用高兼容复制工具)
    copyFileContentBtn.addEventListener('click', () => {
        const currentFileContentEl = document.getElementById('current-file-content');
        if (!currentFileContentEl) return;
        window.copyToClipboard(currentFileContentEl.textContent).then(() => {
            const originText = copyFileContentBtn.textContent;
            copyFileContentBtn.textContent = '已复制文件预览！';
            copyFileContentBtn.classList.add('text-green-600', 'border-green-300');
            setTimeout(() => {
                copyFileContentBtn.textContent = originText;
                copyFileContentBtn.classList.remove('text-green-600', 'border-green-300');
            }, 1500);
        });
    });

    // 编辑文件按钮事件
    editFileBtn.addEventListener('click', () => {
        const currentFileNameEl = document.getElementById('current-file-name');
        const path = currentFileNameEl.getAttribute('data-active-path');
        if (!path) return;
        const file = window.parsedFiles.find(f => f.path === path);
        if (!file) return;
        editTextarea.value = file.content;
        codeViewTable.classList.add('hidden');
        editTextarea.classList.remove('hidden');
        editFileBtn.classList.add('hidden');
        if (renameFileBtn) renameFileBtn.classList.add('hidden');
        copyFileContentBtn.classList.add('hidden');
        saveFileBtn.classList.remove('hidden');
        cancelEditBtn.classList.remove('hidden');
    });

    // 保存编辑
    saveFileBtn.addEventListener('click', () => {
        const currentFileNameEl = document.getElementById('current-file-name');
        const path = currentFileNameEl.getAttribute('data-active-path');
        if (!path) return;
        const file = window.parsedFiles.find(f => f.path === path);
        if (!file) return;
        const newContent = editTextarea.value;
        file.content = newContent;
        window.HistoryManager.pushHistory('编辑文件 ' + path);
        window.HistoryManager.saveCurrentStateToStorage();
        window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
        window.renderStringMode(window.parsedFiles);
        window.updateStats();
        window.viewFile(path, newContent);
        // 恢复视图
        codeViewTable.classList.remove('hidden');
        editTextarea.classList.add('hidden');
        editFileBtn.classList.remove('hidden');
        if (renameFileBtn) renameFileBtn.classList.remove('hidden');
        copyFileContentBtn.classList.remove('hidden');
        saveFileBtn.classList.add('hidden');
        cancelEditBtn.classList.add('hidden');
    });

    // 取消编辑
    cancelEditBtn.addEventListener('click', () => {
        codeViewTable.classList.remove('hidden');
        editTextarea.classList.add('hidden');
        editFileBtn.classList.remove('hidden');
        if (renameFileBtn) renameFileBtn.classList.remove('hidden');
        copyFileContentBtn.classList.remove('hidden');
        saveFileBtn.classList.add('hidden');
        cancelEditBtn.classList.add('hidden');
    });

    // 重命名与移动文件
    if (renameFileBtn) {
        renameFileBtn.addEventListener('click', async () => {
            const currentFileNameEl = document.getElementById('current-file-name');
            const path = currentFileNameEl.getAttribute('data-active-path');
            if (!path) return;
            const file = window.parsedFiles.find(f => f.path === path);
            if (!file) return;

            const newPath = await window.showInputModal(
                '重命名/移动文件',
                '请输入新的相对路径（如：src/components/NewName.jsx）',
                path
            );

            if (newPath && newPath !== path) {
                const isExist = window.parsedFiles.some(f => f.path === newPath);
                if (isExist) {
                    alert('目标文件路径已存在！');
                    return;
                }

                file.path = newPath;
                window.parsedFiles.sort((a, b) => a.path.localeCompare(b.path));

                window.HistoryManager.pushHistory(`重命名文件 ${path} -> ${newPath}`);
                window.HistoryManager.saveCurrentStateToStorage();

                window.renderDirectoryTree(window.parsedFiles, fileSearch.value.trim());
                window.renderStringMode(window.parsedFiles);
                window.updateStats();
                window.viewFile(newPath, file.content);

                window.addConsoleLog('RENAME', path, `重命名并移动到 "${newPath}"。`, 'success');
            }
        });
    }

    // 运行 HTML 预览按钮
    const previewHtmlBtn = document.getElementById('preview-html-btn');
    if (previewHtmlBtn) {
        previewHtmlBtn.addEventListener('click', () => {
            const currentFileName = document.getElementById('current-file-name');
            const path = currentFileName.getAttribute('data-active-path');
            const file = window.parsedFiles.find(f => f.path === path);
            if (file) {
                const resolved = window.resolveHTMLContent(file.content, file.path);
                const blob = new Blob([resolved], { type: 'text/html' });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
                window.addConsoleLog("PREVIEW", path, "已成功编译相对 JS 依赖并在新页签拉起预览运行。", "success");
            }
        });
    }

    // 离线编译版 HTML 文件直接下载
    const downloadHtmlBtn = document.getElementById('download-html-btn');
    if (downloadHtmlBtn) {
        downloadHtmlBtn.addEventListener('click', () => {
            const currentFileName = document.getElementById('current-file-name');
            const path = currentFileName.getAttribute('data-active-path');
            const file = window.parsedFiles.find(f => f.path === path);
            if (file) {
                const resolved = window.resolveHTMLContent(file.content, file.path);
                const blob = new Blob([resolved], { type: 'text/html' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                const baseName = path.split('/').pop().replace(/\.html$/, '');
                const wsHash = window.calculateWorkspaceHash(window.parsedFiles);
                link.download = baseName + '_' + wsHash + '.html';
                link.click();
                window.addConsoleLog("DOWNLOAD", path, "相对 JS 依赖已完全内联注入，编译后独立文件已派发下载。", "success");
            }
        });
    }

    // 复制大纲与全部文件 (使用高兼容复制工具)
    copyAllBtn.addEventListener('click', () => {
        const stringContent = document.getElementById('string-content');
        window.copyToClipboard(stringContent.value).then(() => {
            copyAllText.textContent = '复制成功！';
            copyAllBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            copyAllBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            setTimeout(() => {
                copyAllText.textContent = '📋 复制大纲与全部文件';
                copyAllBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                copyAllBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            }, 2000);
        });
    });

    // 抽象出通用的 XML 指令应用引擎，供左侧面板与 AI 协同对话卡片统一调用
    window.applyXmlActions = function(xmlVal, customHistoryLabel = null) {
        const ops = window.Patcher.parseXmlActions(xmlVal);
        if (ops.length === 0) {
            return { success: false, msg: "未检测到格式正确的 <file> XML 动作指令片段。" };
        }

        // 设置当前 XML 执行的日志分组
        const xmlGroupId = 'xml_group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        const beforeFiles = window.parsedFiles.map(f => ({ path: f.path, content: f.content }));
        const groupLogs = [];
        window.logGroups.unshift({
            id: xmlGroupId,
            timestamp: new Date(),
            label: customHistoryLabel || `XML 执行指令组 (${new Date().toLocaleTimeString()})`,
            logs: groupLogs,
            beforeFiles: beforeFiles,
            afterFiles: [],
            success: true
        });
        window.currentLogGroupId = xmlGroupId;

        window.addConsoleLog("SYSTEM", null, `开始处理 ${ops.length} 项更改命令...`, "info");

        let countCreate = 0;
        let countPatch = 0;
        let countDelete = 0;
        let countRenameMove = 0;
        let countCopy = 0;
        let hasError = false;

        ops.forEach(op => {
            const { action, name, content, to } = op;
            const fileIndex = window.parsedFiles.findIndex(f => f.path === name);

            if (action === 'create' || action === 'add') {
                countCreate++;
                if (fileIndex !== -1) {
                    window.parsedFiles[fileIndex].content = content;
                    window.addConsoleLog("CREATE", name, "文件已存在，已完整写入重写。", "success");
                } else {
                    window.parsedFiles.push({ path: name, content: content });
                    window.addConsoleLog("CREATE", name, "新文件创建成功。", "success");
                }
            }
            else if (action === 'delete' || action === 'remove') {
                if (fileIndex !== -1) {
                    countDelete++;
                    window.parsedFiles.splice(fileIndex, 1);
                    window.addConsoleLog("DELETE", name, "已成功从工作区中移除。", "success");
                } else {
                    window.addConsoleLog("DELETE", name, "跳过。未能匹配到要删除的指定文件。", "warn");
                }
            }
            else if (action === 'pitch' || action === 'patch') {
                if (fileIndex === -1) {
                    window.addConsoleLog("PITCH", name, "失败。无法对不存在的目标文件进行修补。", "error");
                    hasError = true;
                } else {
                    countPatch++;
                    const targetFile = window.parsedFiles[fileIndex];
                    const result = window.Patcher.executePitchEngine(targetFile.content, content);
                    targetFile.content = result.content;
                    if (result.success) {
                        window.addConsoleLog("PITCH", name, `修补完成: ${result.msg}`, "success");
                    } else {
                        window.addConsoleLog("PITCH", name, `部分或全部修补异常: ${result.msg}`, "warn");
                        if (!result.success) hasError = true;
                    }
                }
            }
            else if (action === 'rename' || action === 'move') {
                if (!to) {
                    window.addConsoleLog("RENAME/MOVE", name, "缺少目标路径 (to) 属性，跳过。", "error");
                    hasError = true;
                } else if (fileIndex === -1) {
                    window.addConsoleLog("RENAME/MOVE", name, "失败。源文件不存在。", "error");
                    hasError = true;
                } else {
                    countRenameMove++;
                    window.parsedFiles[fileIndex].path = to;
                    window.addConsoleLog("RENAME/MOVE", name, `成功变更为: ${to}`, "success");
                }
            }
            else if (action === 'copy') {
                if (!to) {
                    window.addConsoleLog("COPY", name, "缺少目标路径 (to) 属性，跳过。", "error");
                    hasError = true;
                } else if (fileIndex === -1) {
                    window.addConsoleLog("COPY", name, "失败。源文件不存在。", "error");
                    hasError = true;
                } else {
                    countCopy++;
                    const targetIndex = window.parsedFiles.findIndex(f => f.path === to);
                    if (targetIndex !== -1) {
                        window.parsedFiles[targetIndex].content = window.parsedFiles[fileIndex].content;
                        window.addConsoleLog("COPY", name, `目标文件已存在，已覆盖内容并复制到: ${to}`, "success");
                    } else {
                        window.parsedFiles.push({
                            path: to,
                            content: window.parsedFiles[fileIndex].content
                        });
                        window.addConsoleLog("COPY", name, `成功复制为: ${to}`, "success");
                    }
                }
            } else {
                window.addConsoleLog("ERROR", name, `不支持的未知事件动作类型 "${action}"。`, "error");
                hasError = true;
            }
        });

        window.parsedFiles.sort((a, b) => a.path.localeCompare(b.path));
        
        let summaryParts = [];
        if (countCreate > 0) summaryParts.push(`新置:${countCreate}`);
        if (countPatch > 0) summaryParts.push(`修补:${countPatch}`);
        if (countDelete > 0) summaryParts.push(`删除:${countDelete}`);
        if (countRenameMove > 0) summaryParts.push(`移动:${countRenameMove}`);
        if (countCopy > 0) summaryParts.push(`复制:${countCopy}`);
        const historyLabel = customHistoryLabel || ("执行 XML 指令 (" + (summaryParts.join(', ') || "无改动") + ")");

        window.HistoryManager.pushHistory(historyLabel);
        window.HistoryManager.saveCurrentStateToStorage();

        // 刷新目录树、字符串数据模式与统计区
        const filterVal = fileSearch ? fileSearch.value.trim() : "";
        window.renderDirectoryTree(window.parsedFiles, filterVal);
        window.renderStringMode(window.parsedFiles);
        window.updateStats();

        const currentActiveNameEl = document.getElementById('current-file-name');
        if (currentActiveNameEl) {
            const currentActivePath = currentActiveNameEl.getAttribute('data-active-path');
            const updatedActiveFile = window.parsedFiles.find(f => f.path === currentActivePath);
            if (updatedActiveFile) {
                window.viewFile(updatedActiveFile.path, updatedActiveFile.content);
            }
        }

        window.addConsoleLog("SYSTEM", null, "虚拟项目重新构建完成。快照已写入时间线。", "info");

        // 完结 XML 执行日志
        if (window.currentLogGroupId) {
            const activeGroup = window.logGroups.find(g => g.id === window.currentLogGroupId);
            if (activeGroup) {
                activeGroup.afterFiles = window.parsedFiles.map(f => ({ path: f.path, content: f.content }));
                activeGroup.success = !activeGroup.logs.some(l => l.level === 'error');
                hasError = !activeGroup.success;
            }
            window.currentLogGroupId = null;
        }

        // 渲染联动版本分支图
        const graphModal = document.getElementById('graph-modal');
        if (graphModal && !graphModal.classList.contains('hidden')) {
            window.HistoryManager.renderVersionGraph();
        }

        // 抛出快照改变事件，便于 AI 关联对话框内所有的基准卡片组件响应式联动
        const activeHistoryState = window.HistoryManager.historyList.find(h => h.id === window.HistoryManager.activeHistoryId);
        const newHash = activeHistoryState ? activeHistoryState.wsHash : "N/A";
        const newLabel = activeHistoryState ? activeHistoryState.label : "主线";
        
        window.dispatchEvent(new CustomEvent('workspace-snapshot-changed', {
            detail: { newHash, newLabel, id: window.HistoryManager.activeHistoryId }
        }));

        return {
            success: !hasError,
            newHash: newHash,
            newLabel: newLabel,
            opsCount: ops.length,
            msg: `成功应用 ${ops.length} 项修改。`
        };
    };

    // 绑定左侧面板输入区执行事件
    executeXmlBtn.addEventListener('click', () => {
        const xmlVal = xmlInput.value.trim();
        if (!xmlVal) {
            alert("请先输入修改指令 XML 文本");
            return;
        }
        const result = window.applyXmlActions(xmlVal);
        if (result.success === false) {
            alert(result.msg || "应用修改失败，请检查编译器控制台。");
        }
    });

    // 清理事件日志
    clearLogsBtn.addEventListener('click', () => {
        window.consoleLogs = [];
        document.getElementById('log-output').innerHTML = '<div class="text-slate-500">&gt; 控制台已重置。</div>';
    });

    // 载入教程命令示例（采用拼装防止触发自指匹配）
    loadExampleBtn.addEventListener('click', () => {
        xmlInput.value = `<!-- XML 命令案例说明书（AI 可完全兼容此输入） -->

<!-- 1. 新建并写入配置文件 -->
` + '<' + `file action="create" name="src/config.json">` + `
{
  "theme": "dark",
  "debug": true
}
` + '<' + `/file>` + `

<!-- 2. 精准局部合并（修补）App.jsx -->
` + '<' + `file action="pitch" name="src/App.jsx">` + `
<<<<<<< SEARCH
  const [count, setCount] = useState(0);

  return (
=======
  const [count, setCount] = useState(0);

  const handleDecrement = () => {
    setCount(prev => Math.max(0, prev - 1));
  };

  return (
>>>>>>> REPLACE
` + '<' + `/file>` + `

<!-- 3. 重命名文件 -->
` + '<' + `file action="rename" name="src/App.jsx" to="src/AppComponent.jsx">` + '<' + `/file>` + `

<!-- 4. 移动文件 -->
` + '<' + `file action="move" name="src/index.js" to="public/index.js">` + '<' + `/file>` + `

<!-- 5. 复制文件 -->
` + '<' + `file action="copy" name="src/config.json" to="config.backup.json">` + '<' + `/file>`;

        window.addConsoleLog("SYSTEM", null, "已载入 XML 动作指令案例。可以点击“执行”来测试时光机时间线的状态变迁。", "info");
    });

    // 打包导出：弹出文件选择界面，支持按快照hash命名
    downloadZipBtn.addEventListener('click', () => {
        if (window.parsedFiles.length === 0) {
            alert("当前工作区内没有有效文件可供打包。");
            return;
        }
        const modal = document.getElementById('export-modal');
        const treeContainer = document.getElementById('export-tree-container');
        const fileNameInput = document.getElementById('export-file-name');
        const confirmBtn = document.getElementById('export-confirm-btn');
        const cancelBtn = document.getElementById('export-cancel-btn');
        const selectAllBtn = document.getElementById('export-select-all');
        const deselectAllBtn = document.getElementById('export-deselect-all');

        // 当前工作区快照哈希作为默认文件名
        const currentHash = window.calculateWorkspaceHash(window.parsedFiles);
        fileNameInput.value = `workspace_${currentHash}.zip`;

        // 渲染可勾选的文件树
        window.renderExportTree(treeContainer, window.parsedFiles);

        modal.classList.remove('hidden');

        // 绑定一次性事件（通过克隆节点防止重复绑定）
        const newConfirm = () => {
            const selectedFiles = window.getSelectedExportFiles(treeContainer);
            if (selectedFiles.length === 0) {
                alert("请至少选择一个文件进行导出。");
                return;
            }
            const zip = new JSZip();
            selectedFiles.forEach(file => {
                zip.file(file.path, file.content);
            });
            zip.generateAsync({ type: 'blob' }).then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = fileNameInput.value || `workspace_${currentHash}.zip`;
                link.click();
                window.addConsoleLog("SYSTEM", null, `已选择 ${selectedFiles.length} 个文件打包导出为 ${link.download}。`, "success");
            }).catch(err => {
                window.addConsoleLog("SYSTEM", null, "压缩失败: " + err.message, "error");
            });
            modal.classList.add('hidden');
        };

        const closeModal = () => {
            modal.classList.add('hidden');
        };

        const confirmClone = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(confirmClone, confirmBtn);
        confirmClone.addEventListener('click', newConfirm);

        const cancelClone = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);
        cancelClone.addEventListener('click', closeModal);

        const selectAllClone = selectAllBtn.cloneNode(true);
        selectAllBtn.parentNode.replaceChild(selectAllClone, selectAllBtn);
        selectAllClone.addEventListener('click', () => {
            const checkboxes = treeContainer.querySelectorAll('input.file-checkbox');
            checkboxes.forEach(cb => { cb.checked = true; });
            window.updateExportFolderCheckboxes(treeContainer);
        });

        const deselectAllClone = deselectAllBtn.cloneNode(true);
        deselectAllBtn.parentNode.replaceChild(deselectAllClone, deselectAllBtn);
        deselectAllClone.addEventListener('click', () => {
            const checkboxes = treeContainer.querySelectorAll('input.file-checkbox');
            checkboxes.forEach(cb => { cb.checked = false; });
            window.updateExportFolderCheckboxes(treeContainer);
        });
    });
});