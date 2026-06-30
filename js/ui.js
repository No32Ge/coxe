// ==========================================
// 🖥️ UI 渲染与视图交互逻辑
// ==========================================
// 高兼容性本地拷贝工具（完美支持本地 file:// 协议与非安全上下文环境）
window.copyToClipboard = function(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    } else {
        return new Promise((resolve, reject) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                // 将元素隐式移出可视区
                textarea.style.position = 'fixed';
                textarea.style.top = '-9999px';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                textarea.setSelectionRange(0, 99999); // 适配移动端
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (success) {
                    resolve();
                } else {
                    reject(new Error("Fallback copy execCommand returned false"));
                }
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 32位 FNV-1a 哈希算法，用于产生一致的短校验特征值
window.calculateHash = function(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

// 基于排序文件拓扑和内容的确定性工作区哈希计算
window.calculateWorkspaceHash = function(files) {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const parts = sorted.map(f => {
        const fHash = window.calculateHash(f.content);
        return f.path + ':' + fHash;
    });
    return window.calculateHash(parts.join('|'));
};

// 基于哈希特征计算生成带有较高辨识度的浅色背景和暗色字体样式规则
window.getHashStyles = function(hash) {
    if (!hash || hash === 'N/A') return 'background-color: #f1f5f9; color: #475569; border-color: #cbd5e1;';
    let intVal = 0;
    for (let i = 0; i < hash.length; i++) {
        intVal += hash.charCodeAt(i);
    }
    const hue = (intVal * 137) % 360; // 黄金分割比分散色调
    return 'background-color: hsl(' + hue + ', 70%, 93%); color: hsl(' + hue + ', 75%, 22%); border-color: hsl(' + hue + ', 60%, 82%);';
};

window.escapeHtml = function(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.updateStats = function() {
    let totalBytes = 0;
    window.parsedFiles.forEach(f => {
        totalBytes += new Blob([f.content]).size;
    });
    const kb = (totalBytes / 1024).toFixed(1);
    document.getElementById('stats-badge').textContent = `${window.parsedFiles.length} 个本地文件 | ${kb} KB`;
};

// 解析 HTML 文件并在其内部完全内联虚拟文件系统中的相对 JS 依赖，产生 100% 独立的离线运行包
window.resolveHTMLContent = function(htmlContent, htmlPath) {
    let resolved = htmlContent;
    
    // 计算当前 HTML 文件所处的父级目录（例如 "AI 协同本地文件管理器/"）
    const pathParts = htmlPath ? htmlPath.split('/') : [];
    pathParts.pop(); // 移除文件名
    const baseDir = pathParts.length > 0 ? pathParts.join('/') + '/' : '';

    // 处理 CSS 外链（<link rel="stylesheet" href="...">），将其内联为 <style>
    resolved = resolved.replace(/<link\s+([^>]*?)>/gi, (match, attrs) => {
        if (/\brel=["']stylesheet["']/i.test(attrs)) {
            const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
            if (hrefMatch) {
                const srcPath = hrefMatch[1];
                // 排除绝对/第三方 URL
                if (/^(http:\/\/|https:\/\/|\/\/)/.test(srcPath)) {
                    return match;
                }
                const normPath = srcPath.replace(/^\.\//, '');
                const targetPath = baseDir + normPath;
                const virtualFile = window.parsedFiles.find(f => f.path === targetPath);
                if (virtualFile) {
                    // 尝试保留 media 属性，以支持响应式样式
                    const mediaMatch = attrs.match(/media=["']([^"']+)["']/i);
                    const mediaAttr = mediaMatch ? ' media="' + mediaMatch[1] + '"' : '';
                    return '<style' + mediaAttr + '>\n/* 虚拟工作区内联编译解析: ' + targetPath + ' */\n' + virtualFile.content + '\n</style>';
                }
            }
        }
        return match;
    });

    // 匹配非绝对/非第三方的脚本标签，如 src="js/app.js"
    const scriptRegex = /<script\s+([^>]*?\s+)?src=["']((?!http:\/\/|https:\/\/|\/\/)[^"']+)["']([^>]*?)><\/script>/g;
    
    resolved = resolved.replace(scriptRegex, (match, beforeAttr, srcPath, afterAttr) => {
        const normPath = srcPath.replace(/^\.\//, ''); // 标准化去掉 "./" 头部
        const targetPath = baseDir + normPath; // 拼接上父级目录，精确定位虚拟文件系统路径
        const virtualFile = window.parsedFiles.find(f => f.path === targetPath);
        
        if (virtualFile) {
            // 采用字符串拆离拼接，阻断外层 XML 处理引擎对 script 进行错误的切割
            return '<' + 'script ' + (beforeAttr || '') + ' ' + (afterAttr || '') + '>\n// 虚拟工作区内联编译解析: ' + targetPath + '\n' + virtualFile.content + '\n<' + '/script>';
        } else {
            return match;
        }
    });
    
    return resolved;
};

window.viewFile = function(path, content) {
    document.querySelectorAll('.file-node-item').forEach(el => {
        if (el.getAttribute('data-path') === path) {
            el.classList.add('bg-blue-50', 'text-blue-700', 'font-semibold');
        } else {
            el.classList.remove('bg-blue-50', 'text-blue-700', 'font-semibold');
        }
    });

    const isOmitted = window.isFileOmitted(path, window.hideConfig);
    let displayContent = content;
    if (isOmitted) {
        displayContent = `[⚠️ 该文件已被忽略配置过滤]\n\n文件路径: ${path}\n\n命中规则: 后缀或文件目录符合忽略名单（如音频/node_modules/二进制流等）。\n系统在 AI 导出数据与该预览中均已自动省略其具体内容，以便节省 Token 并性能。`;
    }

    const fileHash = window.calculateHash(content);
    const currentFileName = document.getElementById('current-file-name');
    const currentFileContent = document.getElementById('current-file-content');
    const lineNumbersDiv = document.getElementById('line-numbers');
    const copyFileContentBtn = document.getElementById('copy-file-content');
    const previewHtmlBtn = document.getElementById('preview-html-btn');
    const downloadHtmlBtn = document.getElementById('download-html-btn');

    currentFileName.setAttribute('data-active-path', path);
    currentFileName.innerHTML = path + ' <span class="text-[10px] text-slate-400 font-mono ml-2">(Hash: ' + fileHash + ')</span>';
    currentFileContent.textContent = displayContent;

    const lines = displayContent.split('\n');
    const lineCount = lines.length;
    let lineNumStr = '';
    for (let i = 1; i <= lineCount; i++) {
        lineNumStr += i + '\n';
    }
    lineNumbersDiv.textContent = lineNumStr;

    copyFileContentBtn.classList.remove('hidden');

    // 如果为 HTML 文件，则激活运行预览与独立下载编译控制按钮
    if (path.toLowerCase().endsWith('.html')) {
        if (previewHtmlBtn) previewHtmlBtn.classList.remove('hidden');
        if (downloadHtmlBtn) downloadHtmlBtn.classList.remove('hidden');
    } else {
        if (previewHtmlBtn) previewHtmlBtn.classList.add('hidden');
        if (downloadHtmlBtn) downloadHtmlBtn.classList.add('hidden');
    }
};

window.renderDirectoryTree = function(files, filter = "") {
    const treeRoot = document.getElementById('tree-root');
    treeRoot.innerHTML = '';
    
    const searchContentChk = document.getElementById('search-content-chk');
    const searchContent = searchContentChk ? searchContentChk.checked : false;
    
    const filteredFiles = files.filter(f => {
        if (!filter) return true;
        const lowerFilter = filter.toLowerCase();
        const pathMatch = f.path.toLowerCase().includes(lowerFilter);
        if (pathMatch) return true;
        
        if (searchContent) {
            const isOmitted = window.isFileOmitted(f.path, window.hideConfig);
            if (!isOmitted) {
                return f.content.toLowerCase().includes(lowerFilter);
            }
        }
        return false;
    });
    
    if (filteredFiles.length === 0) {
        treeRoot.innerHTML = `<div class="text-slate-400 italic p-2">未匹配到任何文件</div>`;
        return;
    }

    const root = { type: 'dir', name: 'Root', children: {} };
    filteredFiles.forEach(file => {
        const parts = file.path.split('/');
        let current = root;
        parts.forEach((part, index) => {
            if (!part) return;
            const isLast = index === parts.length - 1;
            if (isLast) {
                current.children[part] = { type: 'file', name: part, path: file.path, content: file.content };
            } else {
                if (!current.children[part]) {
                    current.children[part] = { type: 'dir', name: part, children: {} };
                }
                current = current.children[part];
            }
        });
    });

    function buildDom(node, container, isRoot = false) {
        const ul = document.createElement('ul');
        ul.className = isRoot ? "space-y-1" : "pl-3.5 border-l border-slate-200 ml-1 space-y-1";

        const keys = Object.keys(node.children).sort((a, b) => {
            const typeA = node.children[a].type;
            const typeB = node.children[b].type;
            if (typeA !== typeB) return typeA === 'dir' ? -1 : 1;
            return a.localeCompare(b);
        });

        keys.forEach(key => {
            const child = node.children[key];
            const li = document.createElement('li');

            if (child.type === 'dir') {
                const folderDiv = document.createElement('div');
                folderDiv.className = "flex items-center space-x-1.5 py-1 px-1 rounded cursor-pointer hover:bg-slate-100 text-slate-700 font-medium select-none truncate";
                folderDiv.innerHTML = `
                    <svg class="w-3.5 h-3.5 text-amber-500 fill-current flex-shrink-0" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
                    <span class="truncate text-xs">${child.name}</span>
                `;
                const subContainer = document.createElement('div');
                if (filter) {
                    subContainer.classList.remove('hidden');
                }
                buildDom(child, subContainer, false);

                folderDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    subContainer.classList.toggle('hidden');
                });

                li.appendChild(folderDiv);
                li.appendChild(subContainer);
            } else {
                const fileDiv = document.createElement('div');
                const isOmitted = window.isFileOmitted(child.path, window.hideConfig);
                const isHidden = window.isFileHiddenFromAI(child.path, window.hideConfig);
                const fileHash = window.calculateHash(child.content);
                
                let fileItemClass = "file-node-item flex items-center space-x-1.5 py-1 px-1 rounded cursor-pointer hover:bg-slate-100 text-slate-600 select-none truncate text-xs";
                let iconColor = "text-slate-400";
                let fileNameClass = "";
                let hashColor = "text-slate-400";
                let tagHtml = "";
                let deleteBtnClass = "delete-file-btn ml-auto text-red-400 hover:text-red-600 cursor-pointer text-[10px] flex-shrink-0";
                let deleteBtnTitle = "删除文件";

                // 优先检查待删除状态（红色高亮）
                if (window.pendingDeletePath === child.path) {
                    fileItemClass += " bg-red-100 text-red-700 border border-red-300";
                    iconColor = "text-red-500";
                    fileNameClass = "text-red-700 font-semibold";
                    hashColor = "text-red-500";
                    deleteBtnClass += " text-red-600 animate-pulse";
                    deleteBtnTitle = "再次点击确认删除";
                } else if (isHidden) {
                    fileItemClass += " bg-red-50/50";
                    iconColor = "text-red-300";
                    fileNameClass = "text-red-400 line-through";
                    hashColor = "text-red-300";
                    tagHtml = ' <span class="text-[9px] text-red-500 bg-red-50 px-1 rounded border border-red-200">屏蔽</span>';
                } else if (isOmitted) {
                    iconColor = "text-slate-300";
                    fileNameClass = "text-slate-400 line-through";
                    hashColor = "text-slate-400";
                    tagHtml = ' <span class="text-[9px] text-amber-500 bg-amber-50 px-1 rounded border border-amber-200">忽略</span>';
                }
                
                let matchBadge = "";
                if (filter && searchContent) {
                    const lowerFilter = filter.toLowerCase();
                    const pathMatch = child.path.toLowerCase().includes(lowerFilter);
                    const isOmitted = window.isFileOmitted(child.path, window.hideConfig);
                    if (!pathMatch && !isOmitted && child.content.toLowerCase().includes(lowerFilter)) {
                        const occurrences = child.content.toLowerCase().split(lowerFilter).length - 1;
                        matchBadge = ` <span class="text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200" title="内容匹配 ${occurrences} 处">内:${occurrences}</span>`;
                    }
                }
                
                fileDiv.className = fileItemClass;
                fileDiv.setAttribute('data-path', child.path);
                
                fileDiv.innerHTML = `
                    <svg class="w-3.5 h-3.5 ${iconColor} fill-current flex-shrink-0" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
                    <span class="truncate ${fileNameClass}">${child.name}</span>
                    <span class="text-[9px] font-mono ml-1 flex-shrink-0 ${hashColor}">[${fileHash}]</span>${tagHtml}${matchBadge}
                    <span class="${deleteBtnClass}" data-delete-path="${child.path}" title="${deleteBtnTitle}">✕</span>
                `;

                fileDiv.addEventListener('click', (e) => {
                    // 若点击删除按钮则交给树根委托处理，不触发查看
                    if (e.target.closest('.delete-file-btn')) {
                        return;
                    }
                    e.stopPropagation();
                    window.viewFile(child.path, child.content);
                });

                li.appendChild(fileDiv);
            }
            ul.appendChild(li);
        });
        container.appendChild(ul);
    }

    buildDom(root, treeRoot, true);
};

window.renderStringMode = function(files) {
    const stringContent = document.getElementById('string-content');
    const omittedCounter = document.getElementById('omitted-counter');
    const hiddenCounter = document.getElementById('hidden-folder-counter');

    const hidePaths = window.hideConfig.hidePaths || [];

    // 分组：隐藏目录 -> 文件列表，可见文件列表
    const hiddenDirFilesMap = {};
    const visibleFiles = [];

    files.forEach(file => {
        let hidden = false;
        for (const hp of hidePaths) {
            const hpNorm = hp.endsWith('/') ? hp : hp + '/';
            if (file.path.startsWith(hpNorm)) {
                hidden = true;
                if (!hiddenDirFilesMap[hpNorm]) {
                    hiddenDirFilesMap[hpNorm] = [];
                }
                hiddenDirFilesMap[hpNorm].push(file);
                break;
            }
        }
        if (!hidden) {
            visibleFiles.push(file);
        }
    });

    const hiddenByFolderCount = files.length - visibleFiles.length;

    if (hiddenCounter) {
        if (hiddenByFolderCount > 0) {
            hiddenCounter.textContent = `🙈 AI视图已屏蔽：${hiddenByFolderCount} 个文件（来自 hidePaths 配置）`;
            hiddenCounter.classList.remove('hidden');
        } else {
            hiddenCounter.textContent = `🙈 AI视图已屏蔽：0 个文件`;
            hiddenCounter.classList.add('hidden');
        }
    }

    let ommitedCount = 0;
    const xmlFragments = [];

    // 为每个隐藏目录生成一个占位条目
    for (const [dirPath, hiddenFiles] of Object.entries(hiddenDirFilesMap)) {
        const dirHash = window.calculateHash(dirPath);
        xmlFragments.push(
            '<' + 'file name="' + dirPath + '" status="hidden" hash="' + dirHash + '">[该目录下的内容已被屏蔽]' + '<' + '/file>'
        );
    }

    // 可见文件照常处理
    visibleFiles.forEach(file => {
        const omitted = window.isFileOmitted(file.path, window.hideConfig);
        const fileHash = window.calculateHash(file.content);
        if (omitted) {
            ommitedCount++;
            xmlFragments.push(
                '<' + 'file name="' + file.path + '" status="omitted" hash="' + fileHash + '">[Content Omitted / Saved for AI context (Excluded by filter rules)]' + '<' + '/file>'
            );
        } else {
            xmlFragments.push(
                '<' + 'file name="' + file.path + '" hash="' + fileHash + '">' + file.content + '<' + '/file>'
            );
        }
    });

    if (xmlFragments.length === 0) {
        stringContent.value = "=== ATTACHED FILES ===\n\n[文件系统为空]";
        omittedCounter.textContent = "已忽略：0 个文件";
        return;
    }

    let output = "=== ATTACHED FILES ===\n\n";
    output += xmlFragments.join('\n\n');
    stringContent.value = output;
    omittedCounter.textContent = `已忽略：${ommitedCount} 个大文件内容`;
};

window.switchTab = function(activeBtn, inactiveBtns, activePanel, inactivePanels) {
    activeBtn.classList.add('border-blue-600', 'text-blue-600');
    activeBtn.classList.remove('border-transparent', 'text-slate-500');
    inactiveBtns.forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-slate-500');
    });
    activePanel.classList.remove('hidden');
    inactivePanels.forEach(panel => panel.classList.add('hidden'));
};

window.renderExportTree = function(container, files) {
    container.innerHTML = '';
    if (files.length === 0) {
        container.innerHTML = '<div class="text-slate-400 italic p-2">无文件</div>';
        return;
    }
    
    const root = { type: 'dir', name: '', children: {} };
    files.forEach(file => {
        const parts = file.path.split('/');
        let current = root;
        parts.forEach((part, idx) => {
            if (!part) return;
            const isLast = idx === parts.length - 1;
            if (isLast) {
                current.children[part] = { type: 'file', name: part, path: file.path, content: file.content };
            } else {
                if (!current.children[part]) {
                    current.children[part] = { type: 'dir', name: part, children: {} };
                }
                current = current.children[part];
            }
        });
    });

    function buildDom(node, parentEl, depth) {
        const childrenKeys = Object.keys(node.children).sort((a, b) => {
            const typeA = node.children[a].type;
            const typeB = node.children[b].type;
            if (typeA !== typeB) return typeA === 'dir' ? -1 : 1;
            return a.localeCompare(b);
        });
        childrenKeys.forEach(key => {
            const child = node.children[key];
            if (child.type === 'dir') {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'export-folder';
                folderDiv.style.marginLeft = (depth * 16) + 'px';
                const headerDiv = document.createElement('div');
                headerDiv.className = 'export-folder-header flex items-center space-x-1 py-1';
                
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'text-slate-400 hover:text-slate-600 text-xs focus:outline-none';
                toggleBtn.textContent = '▼';
                toggleBtn.type = 'button';
                
                const folderCheck = document.createElement('input');
                folderCheck.type = 'checkbox';
                folderCheck.className = 'folder-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500';
                
                const folderName = document.createElement('span');
                folderName.className = 'text-xs font-medium text-slate-700 truncate';
                folderName.textContent = child.name + '/';
                
                headerDiv.appendChild(toggleBtn);
                headerDiv.appendChild(folderCheck);
                headerDiv.appendChild(folderName);
                folderDiv.appendChild(headerDiv);
                
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children border-l border-slate-200 ml-2 pl-2';
                folderDiv.appendChild(childrenContainer);
                parentEl.appendChild(folderDiv);
                
                buildDom(child, childrenContainer, depth + 1);
                
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    childrenContainer.classList.toggle('hidden');
                    toggleBtn.textContent = childrenContainer.classList.contains('hidden') ? '▶' : '▼';
                });
                
                folderCheck.addEventListener('change', () => {
                    const checked = folderCheck.checked;
                    const fileCheckboxes = childrenContainer.querySelectorAll('input.file-checkbox');
                    fileCheckboxes.forEach(cb => { cb.checked = checked; });
                    const subFolderChecks = childrenContainer.querySelectorAll('input.folder-checkbox');
                    subFolderChecks.forEach(cb => { cb.checked = checked; });
                    window.updateExportFolderCheckboxes(container);
                });
                
            } else {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'flex items-center space-x-1 py-0.5';
                fileDiv.style.marginLeft = (depth * 16) + 'px';
                const fileCheck = document.createElement('input');
                fileCheck.type = 'checkbox';
                fileCheck.className = 'file-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500';
                fileCheck.dataset.path = child.path;
                const fileLabel = document.createElement('span');
                fileLabel.className = 'text-xs text-slate-600 truncate';
                fileLabel.textContent = child.name;
                
                fileDiv.appendChild(fileCheck);
                fileDiv.appendChild(fileLabel);
                parentEl.appendChild(fileDiv);
                
                fileCheck.addEventListener('change', () => {
                    window.updateExportFolderCheckboxes(container);
                });
            }
        });
    }
    
    buildDom(root, container, 0);
    // 初始全选，方便快速导出全部
    const allChecks = container.querySelectorAll('input.file-checkbox');
    allChecks.forEach(cb => { cb.checked = true; });
    window.updateExportFolderCheckboxes(container);
};

window.getSelectedExportFiles = function(container) {
    const checkboxes = container.querySelectorAll('input.file-checkbox:checked');
    return Array.from(checkboxes).map(cb => {
        const path = cb.dataset.path;
        const file = window.parsedFiles.find(f => f.path === path);
        return file;
    }).filter(Boolean);
};

/**
 * 显示自定义输入模态框，返回用户输入的字符串，取消返回 null
 * @param {string} title 标题
 * @param {string} placeholder 占位提示
 * @param {string} defaultValue 默认值
 * @returns {Promise<string|null>}
 */
window.showInputModal = function(title, placeholder, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('input-modal');
        const titleEl = document.getElementById('input-modal-title');
        const field = document.getElementById('input-modal-field');
        const confirmBtn = document.getElementById('input-modal-confirm-btn');
        const cancelBtn = document.getElementById('input-modal-cancel');
        const cancelBtn2 = document.getElementById('input-modal-cancel-btn');

        if (!modal || !field) {
            resolve(null);
            return;
        }

        titleEl.textContent = title;
        field.placeholder = placeholder || '';
        field.value = defaultValue;

        function cleanup() {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            cancelBtn2.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
        }

        function onConfirm() {
            const value = field.value.trim();
            cleanup();
            resolve(value);
        }

        function onCancel() {
            cleanup();
            resolve(null);
        }

        function onBackdrop(e) {
            if (e.target === modal) {
                onCancel();
            }
        }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        cancelBtn2.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);

        modal.classList.remove('hidden');
        field.focus();
        field.select();
    });
};

window.updateExportFolderCheckboxes = function(container) {
    const folderChecks = container.querySelectorAll('input.folder-checkbox');
    folderChecks.forEach(fc => {
        const folderDiv = fc.closest('.export-folder');
        if (!folderDiv) return;
        const fileCbs = folderDiv.querySelectorAll('.file-checkbox');
        const allChecked = fileCbs.length > 0 && Array.from(fileCbs).every(cb => cb.checked);
        const someChecked = Array.from(fileCbs).some(cb => cb.checked);
        fc.checked = allChecked;
        fc.indeterminate = someChecked && !allChecked;
    });
};