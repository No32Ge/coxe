
// ==========================================
// 💬 AI 问答对话与模型配置管理器
// ==========================================
window.AiManager = {
    activeAgentId: "agent_deepseek_chat",
    histories: {}, // { agentId: [ { role, content } ] }

    init: function() {
        this.loadApiKey();
        this.ensureDefaultAgents();
        this.bindEvents();
        this.renderAgentConfigList();
        this.renderActiveAgentBadge();
        this.renderSuggestions();
    },

    loadApiKey: function() {
        const savedKey = localStorage.getItem('coxe_global_api_key');
        const keyInput = document.getElementById('global-api-key-input');
        if (savedKey && keyInput) {
            keyInput.value = savedKey;
        }
    },

    saveApiKey: function(key) {
        localStorage.setItem('coxe_global_api_key', key);
    },

    getApiKey: function(agent) {
        if (agent.apiKey && agent.apiKey.trim()) {
            return agent.apiKey.trim();
        }
        const keyInput = document.getElementById('global-api-key-input');
        return keyInput ? keyInput.value.trim() : "";
    },

    ensureDefaultAgents: function() {
        if (!window.hideConfig.aiAgents || !Array.isArray(window.hideConfig.aiAgents) || window.hideConfig.aiAgents.length === 0) {
            window.hideConfig.aiAgents = [
                {
                    id: "agent_deepseek_chat",
                    name: "DeepSeekChat",
                    systemPrompt: "你是一个乐于助人的AI助手。",
                    apiUrl: "https://api.deepseek.com/v1/chat/completions",
                    apiKey: "",
                    model: "deepseek-chat",
                    type: "stateless"
                },
                {
                    id: "agent_deepseek_coder",
                    name: "DeepSeekCoder",
                    systemPrompt: "你是一个精通代码重构的AI专家。",
                    apiUrl: "https://api.deepseek.com/v1/chat/completions",
                    apiKey: "",
                    model: "deepseek-coder",
                    type: "stateful"
                }
            ];
        }
        
        const exists = window.hideConfig.aiAgents.some(a => a.id === this.activeAgentId);
        if (!exists && window.hideConfig.aiAgents.length > 0) {
            this.activeAgentId = window.hideConfig.aiAgents[0].id;
        }
    },

    saveAgentsToConfig: function() {
        const projId = window.getCurrentProjectId();
        if (window.hideConfig.enableLocalStorage !== false) {
            localStorage.setItem(`workspace_project_hide_config_${projId}`, JSON.stringify(window.hideConfig, null, 2));
        }
        const configTextarea = document.getElementById('config-textarea');
        if (configTextarea) {
            configTextarea.value = JSON.stringify(window.hideConfig, null, 2);
        }
        this.renderSuggestions();
    },

    bindEvents: function() {
        const toggleBtn = document.getElementById('ai-chat-toggle-btn');
        const drawer = document.getElementById('ai-chat-drawer');
        const closeBtn = document.getElementById('ai-chat-close-btn');
        const configToggle = document.getElementById('ai-agent-config-toggle-btn');
        const configPanel = document.getElementById('ai-agent-config-panel');
        const addAgentBtn = document.getElementById('ai-agent-add-btn');
        const apiKeyInput = document.getElementById('global-api-key-input');
        const sendBtn = document.getElementById('ai-chat-send-btn');
        const inputField = document.getElementById('ai-chat-input');
        const clearBtn = document.getElementById('ai-chat-clear-btn');

        if (toggleBtn && drawer) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                drawer.classList.remove('hidden');
                setTimeout(() => {
                    const container = document.getElementById('ai-chat-modal-container');
                    if (container) {
                        container.classList.remove('scale-95', 'opacity-0');
                        container.classList.add('scale-100', 'opacity-100');
                    }
                }, 50);
            });
        }

        if (closeBtn && drawer) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const container = document.getElementById('ai-chat-modal-container');
                if (container) {
                    container.classList.remove('scale-100', 'opacity-100');
                    container.classList.add('scale-95', 'opacity-0');
                }
                setTimeout(() => {
                    drawer.classList.add('hidden');
                }, 150);
            });
        }

        // Backdrop close & stop propagation on inner container
        drawer.addEventListener('click', (e) => {
            const container = document.getElementById('ai-chat-modal-container');
            if (container && !container.contains(e.target)) {
                closeBtn.click();
            }
        });
        const modalContainer = document.getElementById('ai-chat-modal-container');
        if (modalContainer) {
            modalContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        if (configToggle && configPanel) {
            configToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                configPanel.classList.toggle('hidden');
            });
        }

        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', (e) => {
                this.saveApiKey(e.target.value.trim());
            });
        }

        if (addAgentBtn) {
            addAgentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newAgent = {
                    id: "agent_" + Date.now(),
                    name: "AI_" + Math.random().toString(36).substring(5, 8).toUpperCase(),
                    systemPrompt: "你是一个自定义AI助手。",
                    apiUrl: "https://api.deepseek.com/v1/chat/completions",
                    apiKey: "",
                    model: "deepseek-chat",
                    type: "stateless"
                };
                window.hideConfig.aiAgents.push(newAgent);
                this.saveAgentsToConfig();
                this.renderAgentConfigList();
                this.renderActiveAgentBadge();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm("是否清空当前所有AI的模型对话历史记录？")) {
                    this.histories = {};
                    const messagesBox = document.getElementById('ai-chat-messages');
                    if (messagesBox) {
                        messagesBox.innerHTML = `
                            <div class="text-center text-xs text-slate-400 py-10">
                                <p>对话已清空！</p>
                                <p class="mt-1">您可以继续直接聊天，或输入 <span class="bg-slate-200 px-1 rounded font-mono">@</span> 切换特定模型。</p>
                            </div>
                        `;
                    }
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSendMessage());
        }

        const suggestPopup = document.getElementById('ai-placeholder-suggestions');

        if (inputField) {
            inputField.addEventListener('keydown', (e) => {
                // Keyboard navigation for {{ placeholders suggestion popup
                if (suggestPopup && !suggestPopup.classList.contains('hidden')) {
                    const activeItem = suggestPopup.querySelector('.active-suggestion');
                    const items = Array.from(suggestPopup.querySelectorAll('.suggestion-item'));
                    if (items.length > 0) {
                        let currentIndex = items.indexOf(activeItem);
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (activeItem) activeItem.classList.remove('active-suggestion', 'bg-blue-50', 'text-blue-700');
                            const nextIndex = (currentIndex + 1) % items.length;
                            items[nextIndex].classList.add('active-suggestion', 'bg-blue-50', 'text-blue-700');
                            items[nextIndex].scrollIntoView({ block: 'nearest' });
                            return;
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (activeItem) activeItem.classList.remove('active-suggestion', 'bg-blue-50', 'text-blue-700');
                            const prevIndex = (currentIndex - 1 + items.length) % items.length;
                            items[prevIndex].classList.add('active-suggestion', 'bg-blue-50', 'text-blue-700');
                            items[prevIndex].scrollIntoView({ block: 'nearest' });
                            return;
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (activeItem) {
                                activeItem.click();
                            } else {
                                items[0].click();
                            }
                            return;
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            suggestPopup.classList.add('hidden');
                            this.placeholderStage = "category"; // reset cascade stage
                            return;
                        }
                    }
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });

            inputField.addEventListener('input', (e) => {
                const val = e.target.value;
                const cursorPos = e.target.selectionStart;
                const beforeCursor = val.substring(0, cursorPos);
                
                // Show @ switcher suggestions
                const suggestBox = document.getElementById('ai-chat-suggestions');
                if (val.includes('@')) {
                    if (suggestBox) suggestBox.classList.remove('hidden');
                } else {
                    if (suggestBox) suggestBox.classList.add('hidden');
                }

                // Show {{ placeholder suggestions
                const lastBraceIndex = beforeCursor.lastIndexOf('{{');
                if (lastBraceIndex !== -1 && lastBraceIndex > beforeCursor.lastIndexOf('}}')) {
                    const query = beforeCursor.substring(lastBraceIndex + 2);
                    if (query === "") {
                        this.placeholderStage = "category";
                        this.placeholderSelectedNode = null;
                        this.placeholderSelectedLog = null;
                    }
                    this.renderPlaceholderSuggestions(query, lastBraceIndex, cursorPos);
                } else {
                    if (suggestPopup) suggestPopup.classList.add('hidden');
                    this.placeholderStage = "category";
                }
            });
        }

        // Click outside placeholder suggestions popup to close it
        document.addEventListener('click', (e) => {
            if (suggestPopup && !suggestPopup.contains(e.target) && e.target !== inputField) {
                suggestPopup.classList.add('hidden');
            }
        });
    },

    renderSuggestions: function() {
        const suggestBox = document.getElementById('ai-chat-suggestions');
        if (!suggestBox) return;

        suggestBox.innerHTML = '<span class="text-[10px] text-slate-400 font-semibold uppercase">快捷 @ 切换:</span>';
        const agents = window.hideConfig.aiAgents || [];

        agents.forEach(agent => {
            const btn = document.createElement('button');
            btn.className = "px-1.5 py-0.5 bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded font-mono text-[10px] transition";
            btn.textContent = `@${agent.name}`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const inputField = document.getElementById('ai-chat-input');
                if (inputField) {
                    const currentVal = inputField.value;
                    if (currentVal.startsWith('@')) {
                        inputField.value = `@${agent.name} ` + currentVal.replace(/^@[^\s]*\s*/, '');
                    } else {
                        inputField.value = `@${agent.name} ` + currentVal;
                    }
                    this.activeAgentId = agent.id;
                    this.renderActiveAgentBadge();
                    inputField.focus();
                }
            });
            suggestBox.appendChild(btn);
        });
    },

    renderActiveAgentBadge: function() {
        const badge = document.getElementById('current-active-agent-badge');
        if (!badge) return;

        const agents = window.hideConfig.aiAgents || [];
        const activeAgent = agents.find(a => a.id === this.activeAgentId) || agents[0];

        if (activeAgent) {
            const stateText = activeAgent.type === 'stateful' ? '有记忆' : '无记忆';
            badge.textContent = `${activeAgent.name} (${stateText})`;
        } else {
            badge.textContent = "无模型";
        }
    },

    renderAgentConfigList: function() {
        const container = document.getElementById('ai-agents-list');
        if (!container) return;

        container.innerHTML = '';
        const agents = window.hideConfig.aiAgents || [];

        agents.forEach((agent) => {
            const div = document.createElement('div');
            div.className = "bg-white p-3 border border-slate-200 rounded-lg space-y-2 relative text-xs shadow-xs";

            div.innerHTML = `
                <div class="flex items-center justify-between font-semibold text-slate-700">
                    <input type="text" class="agent-name-input font-bold bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-300 rounded px-1.5 py-0.5 w-32 focus:bg-white focus:outline-none" value="${agent.name}" data-id="${agent.id}" />
                    <div class="flex items-center space-x-1.5">
                        <select class="agent-type-select text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5" data-id="${agent.id}">
                            <option value="stateless" ${agent.type === 'stateless' ? 'selected' : ''}>无记忆 (每次独立对话)</option>
                            <option value="stateful" ${agent.type === 'stateful' ? 'selected' : ''}>有记忆 (携带连续上下文)</option>
                        </select>
                        <button class="agent-delete-btn text-red-500 hover:text-red-700 font-bold px-1 text-[10px]" data-id="${agent.id}" title="删除模型">✕</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                        <label class="text-slate-400 block">模型代号 Model</label>
                        <input type="text" class="agent-model-input w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono" value="${agent.model}" data-id="${agent.id}" />
                    </div>
                    <div>
                        <label class="text-slate-400 block">API 端点 URL</label>
                        <input type="text" class="agent-url-input w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono" value="${agent.apiUrl}" data-id="${agent.id}" />
                    </div>
                </div>
                <div class="text-[10px]">
                    <label class="text-slate-400 block">系统提示词 System Prompt</label>
                    <textarea class="agent-prompt-input w-full bg-slate-50 border border-slate-200 rounded p-1 font-mono h-12 resize-none focus:outline-none" data-id="${agent.id}">${agent.systemPrompt}</textarea>
                </div>
                <div class="text-[10px]">
                    <label class="text-slate-400 block">独立 API Key (留空继承全局 Key)</label>
                    <input type="password" class="agent-key-input w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono" value="${agent.apiKey || ''}" data-id="${agent.id}" placeholder="继承全局Key" />
                </div>
            `;

            const nameInput = div.querySelector('.agent-name-input');
            const typeSelect = div.querySelector('.agent-type-select');
            const modelInput = div.querySelector('.agent-model-input');
            const urlInput = div.querySelector('.agent-url-input');
            const promptInput = div.querySelector('.agent-prompt-input');
            const keyInput = div.querySelector('.agent-key-input');
            const deleteBtn = div.querySelector('.agent-delete-btn');

            nameInput.addEventListener('change', (e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '').trim();
                if (cleaned) {
                    agent.name = cleaned;
                    e.target.value = cleaned;
                } else {
                    e.target.value = agent.name;
                }
                this.saveAgentsToConfig();
                this.renderActiveAgentBadge();
            });

            typeSelect.addEventListener('change', (e) => {
                agent.type = e.target.value;
                this.saveAgentsToConfig();
                this.renderActiveAgentBadge();
            });

            modelInput.addEventListener('change', (e) => {
                agent.model = e.target.value.trim();
                this.saveAgentsToConfig();
            });

            urlInput.addEventListener('change', (e) => {
                agent.apiUrl = e.target.value.trim();
                this.saveAgentsToConfig();
            });

            promptInput.addEventListener('change', (e) => {
                agent.systemPrompt = e.target.value;
                this.saveAgentsToConfig();
            });

            keyInput.addEventListener('change', (e) => {
                agent.apiKey = e.target.value.trim();
                this.saveAgentsToConfig();
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (agents.length <= 1) {
                    alert("必须保留至少一个配置！");
                    return;
                }
                if (confirm(`确定要删除 AI 模型 "${agent.name}" 吗？`)) {
                    window.hideConfig.aiAgents = agents.filter(a => a.id !== agent.id);
                    if (this.activeAgentId === agent.id) {
                        this.activeAgentId = window.hideConfig.aiAgents[0].id;
                    }
                    this.saveAgentsToConfig();
                    this.renderAgentConfigList();
                    this.renderActiveAgentBadge();
                }
            });

            container.appendChild(div);
        });
    },

    formatMessage: function(text) {
        let escaped = window.escapeHtml(text);
        
        // Render {{...}} tags nicely as styled UI chips in chat history!
        const placeholderRegex = /\{\{([^}]+?)\}\}/g;
        escaped = escaped.replace(placeholderRegex, (match, placeholderContent) => {
            let label = placeholderContent;
            let icon = "🔌";
            if (placeholderContent === "当前全部文件") {
                icon = "📁";
                label = "当前全部文件";
            } else if (placeholderContent.startsWith("当前文件:")) {
                icon = "📄";
                label = placeholderContent.replace("当前文件:", "");
            } else if (placeholderContent.startsWith("节点:")) {
                icon = "🕒";
                const parts = placeholderContent.split(':');
                if (parts.length >= 3) {
                    const nodeId = parts[1];
                    const node = window.HistoryManager.historyList.find(n => n.id === nodeId);
                    const nodeName = node ? node.label : `未命名节点`;
                    label = `节点 [${nodeName}] 的${parts[2] === '全部文件' ? '全部文件' : '文件 ' + parts[2]}`;
                } else {
                    label = "快照数据";
                }
            } else if (placeholderContent.startsWith("日志组:")) {
                icon = "📊";
                const groupId = placeholderContent.replace("日志组:", "");
                const group = window.logGroups.find(g => g.id === groupId);
                label = group ? `日志组: ${group.label}` : `日志数据`;
            } else if (placeholderContent.startsWith("日志组代码对比:")) {
                icon = "📊";
                const groupId = placeholderContent.replace("日志组代码对比:", "");
                const group = window.logGroups.find(g => g.id === groupId);
                label = group ? `日志组 [${group.label}] 代码对比` : `代码变动对比`;
            } else if (placeholderContent.startsWith("失败日志:")) {
                icon = "🚨";
                const groupId = placeholderContent.replace("失败日志:", "");
                const group = window.logGroups.find(g => g.id === groupId);
                label = group ? `失败日志: ${group.label}` : `运行失败日志`;
            }
            return `<span class="inline-flex items-center space-x-1 bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 rounded px-1.5 py-0.5 font-sans font-semibold text-[11px] align-middle select-none transition" title="引用数据: ${placeholderContent}"><span>${icon}</span><span>${label}</span></span>`;
        });

        const codeBlockRegex = /```([\s\S]*?)```/g;
        escaped = escaped.replace(codeBlockRegex, (match, code) => {
            return `<pre class="bg-slate-900 text-slate-200 p-2.5 rounded-lg my-1.5 font-mono text-xs overflow-x-auto whitespace-pre">${code.trim()}</pre>`;
        });

        const inlineCodeRegex = /`([^`]+)`/g;
        escaped = escaped.replace(inlineCodeRegex, (match, code) => {
            return `<code class="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">${code}</code>`;
        });

        return escaped.replace(/\n/g, '<br>');
    },

    getCurrentWorkspaceXml: function(files) {
        const xmlFragments = [];
        const hidePaths = window.hideConfig.hidePaths || [];
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

        for (const [dirPath, hiddenFiles] of Object.entries(hiddenDirFilesMap)) {
            const dirHash = window.calculateHash(dirPath);
            xmlFragments.push(`<file name="${dirPath}" status="hidden" hash="${dirHash}">[该目录下的内容已被屏蔽]</file>`);
        }

        visibleFiles.forEach(file => {
            const omitted = window.isFileOmitted(file.path, window.hideConfig);
            const fileHash = window.calculateHash(file.content);
            if (omitted) {
                xmlFragments.push(`<file name="${file.path}" status="omitted" hash="${fileHash}">[Content Omitted / Saved for AI context (Excluded by filter rules)]</file>`);
            } else {
                xmlFragments.push(`<file name="${file.path}" hash="${fileHash}">${file.content}</file>`);
            }
        });

        return xmlFragments.join('\n\n');
    },

    renderPlaceholderSuggestions: function(query, lastBraceIndex, cursorPos) {
        const popup = document.getElementById('ai-placeholder-suggestions');
        if (!popup) return;

        if (!this.placeholderStage) {
            this.placeholderStage = "category";
        }

        const options = [];

        const renderList = (items) => {
            if (items.length === 0) {
                popup.innerHTML = '<div class="p-3 text-slate-400 italic text-[11px] text-center select-none">未找到匹配项</div>';
                return;
            }
            
            popup.innerHTML = '';
            
            // 建立美观的级联导航路径面包屑与返回键
            const header = document.createElement('div');
            header.className = "p-2.5 bg-slate-100 text-[10px] text-slate-600 font-bold border-b border-slate-200 flex justify-between items-center select-none sticky top-0 z-10";
            
            let pathText = "⚙️ 关联快照变量：选择分类";
            if (this.placeholderStage === "file") pathText = "📄 关联工作区 ➔ 选择特定代码文件";
            else if (this.placeholderStage === "node_select") pathText = "🕒 时光机备份 ➔ 选择历史快照版本";
            else if (this.placeholderStage === "node_action") pathText = `🕒 [${this.placeholderSelectedNode?.label}] ➔ 选择分析范围`;
            else if (this.placeholderStage === "node_file_select") pathText = `🕒 [${this.placeholderSelectedNode?.label}] ➔ 选择提取代码的文件`;
            else if (this.placeholderStage === "log_select") pathText = "📊 事件编译器 ➔ 选择执行日志周期";
            else if (this.placeholderStage === "log_action") pathText = `📊 [${this.placeholderSelectedLog?.label}] ➔ 选择日志关联维度`;

            header.innerHTML = `<span>${pathText}</span>`;
            
            if (this.placeholderStage !== "category") {
                const backBtn = document.createElement('button');
                backBtn.className = "text-blue-600 hover:text-blue-800 font-bold ml-2 focus:outline-none transition-colors text-[10px]";
                backBtn.textContent = "◀ 返回上级";
                backBtn.type = "button";
                backBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.placeholderStage === "file" || this.placeholderStage === "node_select" || this.placeholderStage === "log_select") {
                        this.placeholderStage = "category";
                    } else if (this.placeholderStage === "node_action") {
                        this.placeholderStage = "node_select";
                    } else if (this.placeholderStage === "node_file_select") {
                        this.placeholderStage = "node_action";
                    } else if (this.placeholderStage === "log_action") {
                        this.placeholderStage = "log_select";
                    }
                    this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                    const inputField = document.getElementById('ai-chat-input');
                    inputField.focus();
                });
                header.appendChild(backBtn);
            }
            popup.appendChild(header);

            items.forEach((opt, idx) => {
                const div = document.createElement('div');
                div.className = "suggestion-item p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition border-b border-slate-100 last:border-0 " + (idx === 0 ? "active-suggestion bg-blue-50 text-blue-700 font-semibold" : "text-slate-700");
                div.innerHTML = `
                    <span class="truncate pr-4">${opt.label}</span>
                    ${opt.placeholder ? `<span class="font-mono text-[10px] text-slate-500 flex-shrink-0 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${opt.placeholder}</span>` : `<span class="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">选择 ➔</span>`}
                `;
                
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const inputField = document.getElementById('ai-chat-input');
                    
                    if (opt.placeholder) {
                        const val = inputField.value;
                        const before = val.substring(0, lastBraceIndex);
                        const after = val.substring(cursorPos);
                        
                        inputField.value = before + opt.placeholder + after;
                        popup.classList.add('hidden');
                        this.placeholderStage = "category"; // 重置级联
                        
                        const newCursorPos = lastBraceIndex + opt.placeholder.length;
                        inputField.focus();
                        inputField.setSelectionRange(newCursorPos, newCursorPos);
                    } else if (opt.action) {
                        opt.action();
                    }
                });
                popup.appendChild(div);
            });

            popup.classList.remove('hidden');
        };

        // 一级分类：提供顶层大类选择
        if (this.placeholderStage === "category") {
            options.push({
                label: "📁 当前工作区 (导出全部活动代码文件大纲结构)",
                placeholder: "{{当前全部文件}}",
                searchStr: "当前全部文件 workspace current files"
            });
            options.push({
                label: "📄 关联当前工作区中的特定单个文件内容",
                action: () => {
                    this.placeholderStage = "file";
                    this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                },
                searchStr: "当前文件 file current"
            });
            options.push({
                label: "🕒 历史快照版本 (从时光机提取备份历史版本)",
                action: () => {
                    this.placeholderStage = "node_select";
                    this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                },
                searchStr: "历史节点 快照 node snapshot history version"
            });
            options.push({
                label: "📊 事件编译器日志 (引用前后代码Diff差异或异常运行报错)",
                action: () => {
                    this.placeholderStage = "log_select";
                    this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                },
                searchStr: "日志 失败 错误 log build error diff compilation"
            });
            
            const filtered = options.filter(opt => {
                if (!query) return true;
                return opt.searchStr.toLowerCase().includes(query.toLowerCase()) || opt.label.toLowerCase().includes(query.toLowerCase());
            });
            renderList(filtered);
            return;
        }

        // 二级路径：活动工作区文件列表
        if (this.placeholderStage === "file") {
            window.parsedFiles.forEach(file => {
                options.push({
                    label: `📄 ${file.path}`,
                    placeholder: `{{当前文件:${file.path}}}`,
                    searchStr: file.path
                });
            });
            const filtered = options.filter(opt => {
                if (!query) return true;
                return opt.searchStr.toLowerCase().includes(query.toLowerCase());
            });
            renderList(filtered);
            return;
        }

        // 二级路径：选择历史备份节点（突出备注名称，不再仅有hash）
        if (this.placeholderStage === "node_select") {
            const historyNodes = window.HistoryManager.historyList || [];
            historyNodes.forEach(node => {
                options.push({
                    label: `🕒 [${node.label}] (校验快照指纹: ${node.wsHash})`,
                    action: () => {
                        this.placeholderSelectedNode = node;
                        this.placeholderStage = "node_action";
                        this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                    },
                    searchStr: `${node.label} ${node.wsHash}`
                });
            });
            const filtered = options.filter(opt => {
                if (!query) return true;
                return opt.searchStr.toLowerCase().includes(query.toLowerCase());
            });
            renderList(filtered);
            return;
        }

        // 三级路径：对特定快照节点进行功能关联
        if (this.placeholderStage === "node_action") {
            const node = this.placeholderSelectedNode;
            if (!node) {
                this.placeholderStage = "category";
                this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                return;
            }
            options.push({
                label: `📁 [引用全部] 导入快照 [${node.label}] 拥有的全部文件`,
                placeholder: `{{节点:${node.id}:全部文件}}`,
                searchStr: "全部文件"
            });
            options.push({
                label: `📄 [提取单文件] 选择导入该快照内某个特定代码文件`,
                action: () => {
                    this.placeholderStage = "node_file_select";
                    this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                },
                searchStr: "单文件 特定"
            });
            renderList(options);
            return;
        }

        // 四级路径：选择历史快照内的某个具体文件
        if (this.placeholderStage === "node_file_select") {
            const node = this.placeholderSelectedNode;
            if (!node) {
                this.placeholderStage = "category";
                this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                return;
            }
            node.files.forEach(fileRef => {
                options.push({
                    label: `📄 ${fileRef.path}`,
                    placeholder: `{{节点:${node.id}:${fileRef.path}}}`,
                    searchStr: fileRef.path
                });
            });
            const filtered = options.filter(opt => {
                if (!query) return true;
                return opt.searchStr.toLowerCase().includes(query.toLowerCase());
            });
            renderList(filtered);
            return;
        }

        // 二级路径：日志组选择
        if (this.placeholderStage === "log_select") {
            const logGroups = window.logGroups || [];
            logGroups.forEach(group => {
                options.push({
                    label: `📊 [${group.label}]`,
                    action: () => {
                        this.placeholderSelectedLog = group;
                        this.placeholderStage = "log_action";
                        this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                    },
                    searchStr: group.label
                });
            });
            const filtered = options.filter(opt => {
                if (!query) return true;
                return opt.searchStr.toLowerCase().includes(query.toLowerCase());
            });
            renderList(filtered);
            return;
        }

        // 三级路径：日志维度决策
        if (this.placeholderStage === "log_action") {
            const group = this.placeholderSelectedLog;
            if (!group) {
                this.placeholderStage = "category";
                this.renderPlaceholderSuggestions("", lastBraceIndex, cursorPos);
                return;
            }
            options.push({
                label: `📋 引用本次 XML 执行的完整控制台输出日志`,
                placeholder: `{{日志组:${group.id}}}`,
                searchStr: "运行日志 完整"
            });
            options.push({
                label: `🚨 引用本次执行中抛出失败的异常错误日志`,
                placeholder: `{{失败日志:${group.id}}}`,
                searchStr: "失败日志 错误 异常"
            });
            options.push({
                label: `📊 引用本次变更发生前后的代码 Diff 对比视图`,
                placeholder: `{{日志组代码对比:${group.id}}}`,
                searchStr: "代码对比 变动 diff"
            });
            renderList(options);
            return;
        }
    },

    resolvePlaceholders: function(text) {
        let resolved = text;

        // 1. Resolve {{当前全部文件}}
        if (resolved.includes('{{当前全部文件}}')) {
            const currentXml = this.getCurrentWorkspaceXml(window.parsedFiles);
            resolved = resolved.replace(/\{\{当前全部文件\}\}/g, `\n\n=== 📁 当前全部文件快照 ===\n${currentXml}\n=========================\n\n`);
        }

        // 2. Resolve {{当前文件:[路径]}}
        const currentFileRegex = /\{\{当前文件:([^}]+?)\}\}/g;
        resolved = resolved.replace(currentFileRegex, (match, path) => {
            const file = window.parsedFiles.find(f => f.path === path);
            if (file) {
                const fileHash = window.calculateHash(file.content);
                const isOmitted = window.isFileOmitted(file.path, window.hideConfig);
                const displayContent = isOmitted ? "[内容已过滤忽略]" : file.content;
                return `\n\n=== 📄 文件 [${path}] 代码 ===\n<file name="${path}" hash="${fileHash}">${displayContent}</file>\n=========================\n\n`;
            } else {
                return `\n\n[⚠️ 未能找到当前活动文件: ${path}]\n\n`;
            }
        });

        // 3. Resolve {{节点:[ID]:全部文件}}
        const nodeAllRegex = /\{\{节点:([^:]+?):全部文件\}\}/g;
        resolved = resolved.replace(nodeAllRegex, (match, nodeId) => {
            const node = window.HistoryManager.historyList.find(n => n.id === nodeId);
            if (node) {
                const reconstructed = window.HistoryManager.reconstructFiles(node.files);
                const nodeXml = this.getCurrentWorkspaceXml(reconstructed);
                return `\n\n=== 🕒 历史快照节点 [${node.label}] (${new Date(node.timestamp).toLocaleString()}) 全部文件 ===\n${nodeXml}\n=========================\n\n`;
            } else {
                return `\n\n[⚠️ 未能在时光机中找到对应的历史节点: ${nodeId}]\n\n`;
            }
        });

        // 4. Resolve {{节点:[ID]:[路径]}}
        const nodeFileRegex = /\{\{节点:([^:]+?):([^}]+?)\}\}/g;
        resolved = resolved.replace(nodeFileRegex, (match, nodeId, path) => {
            const node = window.HistoryManager.historyList.find(n => n.id === nodeId);
            if (node) {
                const reconstructed = window.HistoryManager.reconstructFiles(node.files);
                const file = reconstructed.find(f => f.path === path);
                if (file) {
                    const fileHash = window.calculateHash(file.content);
                    const isOmitted = window.isFileOmitted(file.path, window.hideConfig);
                    const displayContent = isOmitted ? "[内容已过滤忽略]" : file.content;
                    return `\n\n=== 🕒 历史快照节点 [${node.label}] 内的文件 [${path}] 代码 ===\n<file name="${path}" hash="${fileHash}">${displayContent}</file>\n=========================\n\n`;
                } else {
                    return `\n\n[⚠️ 历史快照节点 ${node.label} 内未找到文件 ${path}]\n\n`;
                }
            } else {
                return `\n\n[⚠️ 未能在时光机中找到对应的历史节点: ${nodeId}]\n\n`;
            }
        });

        // 5. Resolve {{日志组:[ID]}}
        const logGroupRegex = /\{\{日志组:([^}]+?)\}\}/g;
        resolved = resolved.replace(logGroupRegex, (match, groupId) => {
            const group = window.logGroups.find(g => g.id === groupId);
            if (group) {
                const logsText = group.logs.map(l => `[${l.timestamp}] [${l.action.toUpperCase()}] ${l.file ? `"${l.file}"` : ''} - ${l.text}`).join('\n');
                return `\n\n=== 📊 日志组 [${group.label}] (${new Date(group.timestamp).toLocaleString()}) ===\n${logsText}\n=========================\n\n`;
            } else {
                return `\n\n[⚠️ 未找到对应的日志组: ${groupId}]\n\n`;
            }
        });

        // 6. Resolve {{失败日志:[ID]}}
        const logFailedRegex = /\{\{失败日志:([^}]+?)\}\}/g;
        resolved = resolved.replace(logFailedRegex, (match, groupId) => {
            const group = window.logGroups.find(g => g.id === groupId);
            if (group) {
                const failedLogs = group.logs.filter(l => l.level === 'error');
                if (failedLogs.length > 0) {
                    const logsText = failedLogs.map(l => `[${l.timestamp}] [${l.action.toUpperCase()}] ${l.file ? `"${l.file}"` : ''} - ${l.text}`).join('\n');
                    return `\n\n=== 🚨 日志组 [${group.label}] 内的失败日志 ===\n${logsText}\n=========================\n\n`;
                } else {
                    return `\n\n=== 🚨 日志组 [${group.label}] 未检测到运行失败日志 ===\n\n`;
                }
            } else {
                return `\n\n[⚠️ 未找到对应的日志组: ${groupId}]\n\n`;
            }
        });

        // 7. Resolve {{日志组代码对比:[ID]}}
        const logDiffRegex = /\{\{日志组代码对比:([^}]+?)\}\}/g;
        resolved = resolved.replace(logDiffRegex, (match, groupId) => {
            const group = window.logGroups.find(g => g.id === groupId);
            if (group) {
                const diffLines = [];
                const beforeMap = new Map(group.beforeFiles.map(f => [f.path, f.content]));
                const afterMap = new Map(group.afterFiles.map(f => [f.path, f.content]));
                const allPaths = new Set([...beforeMap.keys(), ...afterMap.keys()]);

                allPaths.forEach(path => {
                    const beforeContent = beforeMap.get(path);
                    const afterContent = afterMap.get(path);
                    if (beforeContent !== afterContent) {
                        diffLines.push(`文件路径: ${path}`);
                        if (beforeContent === undefined) {
                            diffLines.push(`  * 状态: 新建`);
                            diffLines.push(`  * 代码内容:\n<file name="${path}" action="create">\n${afterContent}\n</file>`);
                        } else if (afterContent === undefined) {
                            diffLines.push(`  * 状态: 已删除`);
                        } else {
                            diffLines.push(`  * 状态: 已修改`);
                            diffLines.push(`  * 执行前内容:\n${beforeContent}`);
                            diffLines.push(`  * 执行后内容:\n${afterContent}`);
                        }
                        diffLines.push(`----------------------------------`);
                    }
                });

                if (diffLines.length === 0) {
                    return `\n\n=== 📊 日志组 [${group.label}] 执行前后未产生代码变动 ===\n\n`;
                }

                return `\n\n=== 📊 日志组 [${group.label}] 执行前后的代码变动对比 ===\n${diffLines.join('\n')}\n=========================\n\n`;
            } else {
                return `\n\n[⚠️ 未找到对应的日志组: ${groupId}]\n\n`;
            }
        });

        return resolved;
    },

    appendMessage: function(sender, text, isError = false) {
        const messagesBox = document.getElementById('ai-chat-messages');
        if (!messagesBox) return;

        if (messagesBox.querySelector('.text-center')) {
            messagesBox.innerHTML = '';
        }

        const wrapper = document.createElement('div');
        wrapper.className = `flex flex-col space-y-1 ${sender === 'user' ? 'items-end' : 'items-start'}`;

        const senderLabel = document.createElement('span');
        senderLabel.className = 'text-[10px] text-slate-400 px-1 font-semibold';
        senderLabel.textContent = sender === 'user' ? '您' : 'AI 助手';

        const bubble = document.createElement('div');
        bubble.className = `max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
            sender === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : isError 
                    ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
        }`;
        bubble.innerHTML = this.formatMessage(text);

        wrapper.appendChild(senderLabel);
        wrapper.appendChild(bubble);
        messagesBox.appendChild(wrapper);

        messagesBox.scrollTop = messagesBox.scrollHeight;
    },

    createEmptyAssistantMessageBubble: function(agentName) {
        const messagesBox = document.getElementById('ai-chat-messages');
        if (!messagesBox) return null;

        if (messagesBox.querySelector('.text-center')) {
            messagesBox.innerHTML = '';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col space-y-1 items-start';

        const senderLabel = document.createElement('span');
        senderLabel.className = 'text-[10px] text-slate-400 px-1 font-semibold';
        senderLabel.textContent = agentName;

        const bubble = document.createElement('div');
        bubble.className = 'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed bg-white border border-slate-200 text-slate-800 rounded-tl-none relative shadow-sm';
        bubble.innerHTML = '<span class="inline-block w-1.5 h-3.5 bg-blue-600 animate-pulse align-middle"></span>';

        wrapper.appendChild(senderLabel);
        wrapper.appendChild(bubble);
        messagesBox.appendChild(wrapper);
        messagesBox.scrollTop = messagesBox.scrollHeight;

        return bubble;
    },

    updateAssistantMessageBubble: function(bubbleEl, text) {
        if (!bubbleEl) return;
        bubbleEl.innerHTML = this.formatMessage(text) + '<span class="inline-block w-1.5 h-3.5 bg-blue-600 animate-pulse ml-0.5 align-middle"></span>';
        const messagesBox = document.getElementById('ai-chat-messages');
        if (messagesBox) {
            messagesBox.scrollTop = messagesBox.scrollHeight;
        }
    },

    // 从 AI 返回文本中独立解析出 <file> 标签块，并返回干净文本与关联数据包，实现文本和交互布局解耦
    parseFileBlocksFromText: function(text) {
        const regex = /<file\s+([^>]*?)>([\s\S]*?)<\/file>/gi;
        const blocks = [];
        let index = 0;
        let lastIndex = 0;
        let rebuiltText = "";

        while ((match = regex.exec(text)) !== null) {
            rebuiltText += text.substring(lastIndex, match.index);
            
            const attrStr = match[1];
            const content = match[2];
            
            const nameMatch = attrStr.match(/name\s*=\s*["']([^"']+)["']/i);
            const actionMatch = attrStr.match(/action\s*=\s*["']([^"']+)["']/i);
            const toMatch = attrStr.match(/to\s*=\s*["']([^"']+)["']/i);
            
            const name = nameMatch ? nameMatch[1] : "unnamed_file";
            const action = actionMatch ? actionMatch[1].toLowerCase() : "create";
            const to = toMatch ? toMatch[1] : null;

            blocks.push({
                index: index,
                name: name,
                action: action,
                to: to,
                rawContent: content,
                fullXml: match[0]
            });

            // 插入唯一的纯文本占位符，防止 HTML 被 Markdown 二次转换转义
            rebuiltText += `\n\n___AI_FILE_WIDGET_PLACEHOLDER_${index}___\n\n`;
            index++;
            lastIndex = regex.lastIndex;
        }
        rebuiltText += text.substring(lastIndex);

        return {
            cleanText: rebuiltText,
            blocks: blocks
        };
    },

    // 动态绘制美观的 AI 修改块交互布局卡片
    createFileWidget: function(block) {
        const div = document.createElement('div');
        
        // 依据不同的行为设计配色与图形化图标指示
        let actionTheme = {
            bg: "bg-blue-50/40",
            border: "border-blue-200",
            text: "text-blue-800",
            badge: "bg-blue-100 text-blue-800 border-blue-200",
            icon: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`,
            actionLabel: "PITCH 修补"
        };

        if (block.action === 'create' || block.action === 'add') {
            actionTheme = {
                bg: "bg-emerald-50/40",
                border: "border-emerald-200",
                text: "text-emerald-800",
                badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
                icon: `<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
                actionLabel: "CREATE 创建"
            };
        } else if (block.action === 'delete' || block.action === 'remove') {
            actionTheme = {
                bg: "bg-rose-50/40",
                border: "border-rose-200",
                text: "text-rose-800",
                badge: "bg-rose-100 text-rose-800 border-rose-200",
                icon: `<svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`,
                actionLabel: "DELETE 删除"
            };
        } else if (block.action === 'rename' || block.action === 'move') {
            actionTheme = {
                bg: "bg-purple-50/40",
                border: "border-purple-200",
                text: "text-purple-800",
                badge: "bg-purple-100 text-purple-800 border-purple-200",
                icon: `<svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>`,
                actionLabel: "RENAME 移动"
            };
        } else if (block.action === 'copy') {
            actionTheme = {
                bg: "bg-indigo-50/40",
                border: "border-indigo-200",
                text: "text-indigo-800",
                badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
                icon: `<svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>`,
                actionLabel: "COPY 复制"
            };
        }

        div.className = `ai-file-card my-4 border ${actionTheme.border} ${actionTheme.bg} rounded-xl shadow-xs overflow-hidden transition-all duration-300 hover:shadow-md select-none`;
        
        let previewHtml = "";
        const isContentVisible = block.action === 'create' || block.action === 'pitch' || block.action === 'add';
        
        if (isContentVisible) {
            let displayedContent = window.escapeHtml(block.rawContent.trim());
            // 特殊对 PITCH 分支中的 SEARCH/REPLACE 进行代码高亮染色
            if (block.action === 'pitch' || block.action === 'patch') {
                displayedContent = displayedContent
                    .replace(/&lt;&lt;&lt;&lt;&lt;&lt;&lt;\s*SEARCH/g, '<span class="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold block border-l-4 border-rose-500 my-1">▼ SEARCH (匹配删除段)</span>')
                    .replace(/=======/g, '<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold block border-l-4 border-slate-500 my-1">▼ TO REPLACE WITH (替换为下文)</span>')
                    .replace(/&gt;&gt;&gt;&gt;&gt;&gt;&gt;\s*REPLACE/g, '<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold block border-l-4 border-emerald-500 my-1">▲ REPLACE END (替换段结束)</span>');
            }
            
            previewHtml = `
                <div class="px-4 pb-3 border-t border-dashed ${actionTheme.border} pt-2 bg-white/80">
                    <button class="toggle-preview-btn w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-700 font-semibold py-1 focus:outline-none select-none">
                        <span class="flex items-center space-x-1">
                            <span class="preview-icon-arrow">▶</span>
                            <span>查看修改详情 (${block.rawContent.split('\n').length} 行)</span>
                        </span>
                    </button>
                    <div class="preview-content-box hidden mt-1">
                        <div class="max-h-56 overflow-y-auto bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-slate-300 whitespace-pre scrollbar-thin border border-slate-900 leading-relaxed select-text">${displayedContent}</div>
                    </div>
                </div>
            `;
        }

        // 装载当前系统最新的版本历史基础信息
        const activeNode = window.HistoryManager.historyList.find(n => n.id === window.HistoryManager.activeHistoryId);
        const activeNodeLabel = activeNode ? activeNode.label : "初始";
        const activeNodeHash = activeNode ? activeNode.wsHash : "N/A";

        div.innerHTML = `
            <div class="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div class="flex items-start space-x-2.5 min-w-0">
                    <div class="p-1.5 bg-white rounded-lg border ${actionTheme.border} shadow-2xs flex-shrink-0">
                        ${actionTheme.icon}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span class="px-1.5 py-0.5 border rounded-full text-[10px] font-bold tracking-wider ${actionTheme.badge}">${actionTheme.actionLabel}</span>
                            <span class="font-mono font-bold text-slate-700 truncate select-all" title="${block.name}">${block.name}</span>
                            ${block.to ? `<span class="text-slate-400">➔</span> <span class="font-mono font-bold text-slate-700 truncate select-all" title="${block.to}">${block.to}</span>` : ''}
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1.5 flex items-center space-x-1 flex-wrap font-sans leading-none">
                            <span>基准点:</span>
                            <span class="font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 rounded-sm border border-slate-200 transition select-all base-node-hash" title="应用时的基准快照哈希">${activeNodeHash}</span>
                            <span class="truncate max-w-[120px] text-slate-500 hover:text-slate-700 select-all" title="当前历史快照备注">(${activeNodeLabel})</span>
                        </div>
                    </div>
                </div>
                
                <!-- 应用修改动作控制按钮 -->
                <div class="flex items-center self-end md:self-center">
                    <button class="run-change-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-lg text-xs shadow-xs transition duration-150 flex items-center space-x-1.5 flex-shrink-0 cursor-pointer">
                        <span>⚡ 运行修改</span>
                    </button>
                </div>
            </div>
            ${previewHtml}
        `;

        // 处理手风琴面板的展开收起行为
        const toggleBtn = div.querySelector('.toggle-preview-btn');
        const previewBox = div.querySelector('.preview-content-box');
        const arrowEl = div.querySelector('.preview-icon-arrow');
        if (toggleBtn && previewBox) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = previewBox.classList.toggle('hidden');
                arrowEl.textContent = isHidden ? "▶" : "▼";
                toggleBtn.classList.toggle('text-slate-500', isHidden);
                toggleBtn.classList.toggle('text-blue-600', !isHidden);
            });
        }

        // 调用统一的 applyXmlActions 指令引擎执行动作
        const runBtn = div.querySelector('.run-change-btn');
        if (runBtn) {
            runBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const result = window.applyXmlActions(block.fullXml, `AI 智能应用: ${block.action.toUpperCase()} - ${block.name}`);
                
                if (result.success) {
                    this.markCardAsExecuted(div, result.newHash, result.newLabel);
                } else {
                    alert(result.msg || "应用修改失败，请检查语法。");
                }
            });
        }

        // 响应式订阅：在对话框处于打开状态时，如用户在时光机主面板手动回滚、切换版本，本卡片展示的“基准点哈希”将自动秒级同步刷新
        const onSnapshotChange = (e) => {
            const hashEl = div.querySelector('.base-node-hash');
            if (hashEl && !div.classList.contains('ai-card-applied')) {
                hashEl.textContent = e.detail.newHash;
                const noteEl = hashEl.nextElementSibling;
                if (noteEl) {
                    noteEl.textContent = `(${e.detail.newLabel})`;
                    noteEl.title = e.detail.newLabel;
                }
            }
        };
        window.addEventListener('workspace-snapshot-changed', onSnapshotChange);
        
        // 当该 DOM 节点被销毁时，自动注销观察者，防止垃圾回收溢出
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === div || node.contains(div)) {
                        window.removeEventListener('workspace-snapshot-changed', onSnapshotChange);
                        observer.disconnect();
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return div;
    },

    // 成功执行应用后的卡片状态平滑过度切换
    markCardAsExecuted: function(cardEl, newHash, newLabel) {
        cardEl.classList.add('ai-card-applied');
        cardEl.classList.remove('border-blue-200', 'bg-blue-50/40', 'border-emerald-200', 'bg-emerald-50/40', 'border-purple-200', 'bg-purple-50/40', 'border-indigo-200', 'bg-indigo-50/40');
        cardEl.classList.add('border-emerald-300', 'bg-emerald-50/20');
        
        const runBtn = cardEl.querySelector('.run-change-btn');
        if (runBtn) {
            const successBtn = document.createElement('div');
            successBtn.className = "px-3 py-1.5 bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-lg text-xs flex items-center space-x-1 cursor-default select-none shadow-2xs";
            successBtn.innerHTML = `
                <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>已应用修改</span>
            `;
            runBtn.parentNode.replaceChild(successBtn, runBtn);
        }

        const baseNodeHash = cardEl.querySelector('.base-node-hash');
        if (baseNodeHash) {
            baseNodeHash.textContent = newHash;
            baseNodeHash.className = "font-mono bg-emerald-100 text-emerald-800 px-1 rounded-sm border border-emerald-200 select-all";
            const parent = baseNodeHash.parentNode;
            if (parent) {
                parent.innerHTML = `
                    <span class="text-emerald-700 font-bold flex items-center space-x-1 py-0.5">
                        <svg class="w-3.5 h-3.5 text-emerald-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        <span>成功写入新历史快照:</span>
                        <span class="font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 select-all">${newHash}</span>
                    </span>
                `;
            }
        }

        // 卡片微小的物理动效回弹反馈
        cardEl.style.transform = 'scale(0.98)';
        setTimeout(() => {
            cardEl.style.transform = 'scale(1)';
        }, 150);
    },

    finalizeAssistantMessageBubble: function(bubbleEl, text) {
        if (!bubbleEl) return;

        // 1. 抽取文件变动标签
        const { cleanText, blocks } = this.parseFileBlocksFromText(text);

        // 2. 正常格式化渲染非指令的说明文本
        let formattedHtml = this.formatMessage(cleanText);

        // 3. 在格式化（排除被格式化转义影响）之后，将特殊的占位符重新转换为合法的 HTML 标签容器
        blocks.forEach(block => {
            const htmlPlaceholder = `<div class="ai-file-block-placeholder" data-index="${block.index}"></div>`;
            formattedHtml = formattedHtml.replace(`___AI_FILE_WIDGET_PLACEHOLDER_${block.index}___`, htmlPlaceholder);
        });

        bubbleEl.innerHTML = formattedHtml;

        // 4. 精准寻找占位符节点，替换挂载高阶的原生 interactive layout 卡片
        const placeholders = bubbleEl.querySelectorAll('.ai-file-block-placeholder');
        placeholders.forEach(ph => {
            const idx = parseInt(ph.getAttribute('data-index'));
            const block = blocks[idx];
            if (block) {
                const widgetEl = this.createFileWidget(block);
                ph.parentNode.replaceChild(widgetEl, ph);
            }
        });

        const messagesBox = document.getElementById('ai-chat-messages');
        if (messagesBox) {
            messagesBox.scrollTop = messagesBox.scrollHeight;
        }
    },

    handleSendMessage: async function() {
        const inputField = document.getElementById('ai-chat-input');
        if (!inputField) return;

        let originalText = inputField.value.trim();
        if (!originalText) return;

        inputField.value = ''; 

        const agents = window.hideConfig.aiAgents || [];
        let targetAgent = agents.find(a => a.id === this.activeAgentId) || agents[0];
        let displayQueryText = originalText;
        let finalApiContent = originalText;

        const atMatch = originalText.match(/^@([a-zA-Z0-9_\u4e00-\u9fa5]+)\s+/);
        if (atMatch) {
            const parsedAgentName = atMatch[1];
            const matchedAgent = agents.find(a => a.name.toLowerCase() === parsedAgentName.toLowerCase());
            if (matchedAgent) {
                targetAgent = matchedAgent;
                this.activeAgentId = matchedAgent.id;
                this.renderActiveAgentBadge();
                finalApiContent = originalText.substring(atMatch[0].length).trim();
            }
        }

        this.appendMessage('user', displayQueryText);

        const apiKey = this.getApiKey(targetAgent);
        if (!apiKey) {
            this.appendMessage('system', "⚠️ 错误: 未检测到 API Key。请在上方 API Key 配置输入框中填入您的 API 密钥，或者单独为该 AI 节点配置独立 API Key。", true);
            return;
        }

        // 解析并拉起变量数据注入
        const finalApiContentResolved = this.resolvePlaceholders(finalApiContent);

        let messagesPayload = [];
        
        if (targetAgent.systemPrompt && targetAgent.systemPrompt.trim()) {
            messagesPayload.push({ role: "system", content: targetAgent.systemPrompt });
        }

        if (targetAgent.type === 'stateful') {
            if (!this.histories[targetAgent.id]) {
                this.histories[targetAgent.id] = [];
            }
            this.histories[targetAgent.id].forEach(msg => {
                messagesPayload.push(msg);
            });
        }

        messagesPayload.push({ role: "user", content: finalApiContentResolved });

        const typingWrapper = document.createElement('div');
        typingWrapper.className = 'flex flex-col space-y-1 items-start typing-indicator-wrapper';
        typingWrapper.innerHTML = `
            <span class="text-[10px] text-slate-400 px-1 font-semibold">${targetAgent.name} 正在思考...</span>
            <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-3.5 py-2 text-slate-500 text-xs flex items-center space-x-1 shadow-sm">
                <span class="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                <span class="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                <span class="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
            </div>
        `;
        const messagesBox = document.getElementById('ai-chat-messages');
        messagesBox.appendChild(typingWrapper);
        messagesBox.scrollTop = messagesBox.scrollHeight;

        try {
            const response = await fetch(targetAgent.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: targetAgent.model,
                    messages: messagesPayload,
                    temperature: 0.7,
                    stream: true // 开启模型流式输出
                })
            });

            const indicator = messagesBox.querySelector('.typing-indicator-wrapper');
            if (indicator) messagesBox.removeChild(indicator);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error ? errData.error.message : `HTTP status ${response.status}`;
                this.appendMessage('system', `API 响应失败: ${errMsg}`, true);
                return;
            }

            // 建立流式实时更新的文本气泡
            const bubbleEl = this.createEmptyAssistantMessageBubble(targetAgent.name);
            let assistantReply = "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            let buffer = "";

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    buffer += decoder.decode(value, { stream: !done });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || ""; // 拦截分包缓存
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        if (trimmed === "data: [DONE]") continue;
                        if (trimmed.startsWith("data: ")) {
                            try {
                                const jsonStr = trimmed.slice(6);
                                const parsed = JSON.parse(jsonStr);
                                const content = parsed.choices?.[0]?.delta?.content || "";
                                if (content) {
                                    assistantReply += content;
                                    this.updateAssistantMessageBubble(bubbleEl, assistantReply);
                                }
                            } catch (e) {
                                // 忽略断句等不完整数据帧的解析错误
                            }
                        }
                    }
                }
            }

            // 移除流式光标
            this.finalizeAssistantMessageBubble(bubbleEl, assistantReply);

            if (targetAgent.type === 'stateful') {
                this.histories[targetAgent.id].push({ role: "user", content: finalApiContentResolved });
                this.histories[targetAgent.id].push({ role: "assistant", content: assistantReply });
                if (this.histories[targetAgent.id].length > 16) {
                    this.histories[targetAgent.id] = this.histories[targetAgent.id].slice(-16);
                }
            }

        } catch (err) {
            const indicator = messagesBox.querySelector('.typing-indicator-wrapper');
            if (indicator) messagesBox.removeChild(indicator);
            this.appendMessage('system', `流式连接失败: ${err.message}`, true);
        }
    }
};
