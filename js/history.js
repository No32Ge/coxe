// ==========================================
// 🕒 时光机操作历史控制逻辑
// ==========================================
window.HistoryManager = {
    historyList: [],
    activeHistoryId: null,
    zoomState: { x: 0, y: 0, scale: 1 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    objectDatabase: {}, // CAS 唯一内容存储库：file_hash -> content

    getHash: function(content) {
        if (window.calculateHash) {
            return window.calculateHash(content);
        }
        let hash = 0x811c9dc5;
        for (let i = 0; i < content.length; i++) {
            hash ^= content.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    },

    serializeToCAS: function(files) {
        return files.map(f => {
            const h = this.getHash(f.content);
            this.objectDatabase[h] = f.content;
            return { path: f.path, hash: h };
        });
    },

    reconstructFiles: function(casFiles) {
        return casFiles.map(cf => ({
            path: cf.path,
            content: this.objectDatabase[cf.hash] !== undefined ? this.objectDatabase[cf.hash] : ""
        }));
    },

    pruneObjectDatabase: function() {
        const activeHashes = new Set();
        // 1. 收集历史快照列表中所有仍有引用的文件哈希值
        this.historyList.forEach(item => {
            item.files.forEach(f => {
                activeHashes.add(f.hash);
            });
        });
        // 2. 收集当前活动工作区正在引用的文件哈希值
        window.parsedFiles.forEach(f => {
            activeHashes.add(this.getHash(f.content));
        });
        // 3. 清理数据库中已无引用的孤立 Blob
        Object.keys(this.objectDatabase).forEach(h => {
            if (!activeHashes.has(h)) {
                delete this.objectDatabase[h];
            }
        });
    },

    deepCopyFiles: function(files) {
        return files.map(f => ({ path: f.path, content: f.content }));
    },

    pushHistory: function(label) {
        const maxLimit = window.hideConfig.maxHistoryLimit !== undefined ? parseInt(window.hideConfig.maxHistoryLimit) : 10;
        if (maxLimit <= 0) return;

        // 执行内容寻址序列化
        const casFiles = this.serializeToCAS(window.parsedFiles);
        const wsHash = window.calculateWorkspaceHash(window.parsedFiles);
        const now = new Date();
        const newId = Date.now() + "_" + Math.random().toString(36).substring(2, 7);

        // 绑定父节点哈希特征关联
        const parentId = this.activeHistoryId;

        this.historyList.unshift({
            id: newId,
            timestamp: now,
            label: label,
            files: casFiles,
            wsHash: wsHash,
            parentId: parentId
        });

        this.activeHistoryId = newId;

        if (this.historyList.length > maxLimit) {
            this.historyList = this.historyList.slice(0, maxLimit);
        }

        this.pruneObjectDatabase(); // 释放孤立内容
        this.renderTimeline();
        this.saveCurrentStateToStorage();
    },

    renderTimeline: function() {
        const timelineOutput = document.getElementById('timeline-output');
        const historyCounter = document.getElementById('history-counter');
        timelineOutput.innerHTML = '';
        const maxLimit = window.hideConfig.maxHistoryLimit !== undefined ? parseInt(window.hideConfig.maxHistoryLimit) : 10;
        historyCounter.textContent = `${this.historyList.length} / ${maxLimit} 状态`;

        if (this.historyList.length === 0) {
            timelineOutput.innerHTML = '<div class="text-slate-400 italic text-[11px] p-2 text-center">暂无快照历史</div>';
            return;
        }

        this.historyList.forEach(item => {
            const isActive = item.id === this.activeHistoryId;
            const itemDiv = document.createElement('div');
            itemDiv.className = `flex items-start space-x-2.5 p-2 rounded border transition text-[11px] cursor-pointer ${
                isActive 
                    ? 'border-blue-300 bg-blue-50/60 font-semibold' 
                    : 'border-slate-100 bg-slate-50/30 hover:bg-slate-100/70 hover:border-slate-200'
            }`;

            const timeStr = new Date(item.timestamp).toLocaleTimeString();
            const fileCount = item.files.length;
            const wsHashStr = item.wsHash || 'N/A';

            // 检索父级节点的 Hash，以便彩色联排
            const parentItem = this.historyList.find(x => x.id === item.parentId);
            const parentWsHash = parentItem ? parentItem.wsHash : null;

            const currentHashStyles = window.getHashStyles(item.wsHash);
            const parentHashStyles = parentWsHash ? window.getHashStyles(parentWsHash) : '';

            const parentBadge = parentWsHash 
                ? `<span class="font-mono px-1 rounded text-[9px] border inline-flex items-center space-x-0.5 ml-1" style="${parentHashStyles}" title="父节点哈希校验值"><span>←</span><span>${parentWsHash}</span></span>`
                : '';

            itemDiv.innerHTML = `
                <div class="mt-1 flex-shrink-0 w-2 h-2 rounded-full ${isActive ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-400'}"></div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-800 truncate block font-medium">${item.label}</span>
                        <span class="text-slate-400 font-mono flex-shrink-0 ml-2">${timeStr}</span>
                    </div>
                    <div class="text-[10px] text-slate-500 mt-1 flex justify-between items-center">
                        <div class="flex items-center space-x-1 min-w-0">
                            <span class="truncate flex-shrink-0">共 ${fileCount} 件</span>
                            <span class="font-mono px-1.5 py-0.5 rounded text-[9px] border inline-flex items-center" style="${currentHashStyles}" title="该状态下的系统确定性特征校验值">WS:${wsHashStr}</span>
                            ${parentBadge}
                        </div>
                        ${isActive ? '<span class="text-blue-600 font-bold flex-shrink-0 ml-1">当前活动</span>' : '<span class="text-slate-400 hover:text-blue-500 font-medium flex-shrink-0 ml-1">点击回滚</span>'}
                    </div>
                </div>
            `;

            itemDiv.addEventListener('click', () => {
                this.rollbackTo(item.id);
            });

            timelineOutput.appendChild(itemDiv);
        });
    },

    // 计算版本控制节点的排布拓扑
    calculateNodeLayouts: function() {
        if (this.historyList.length === 0) return [];
        const chronological = [...this.historyList].reverse();
        
        const nodes = chronological.map(item => ({
            id: item.id,
            wsHash: item.wsHash,
            label: item.label,
            timestamp: item.timestamp,
            parentId: item.parentId,
            children: [],
            x: 0,
            y: 0
        }));

        nodes.forEach(n => {
            if (n.parentId) {
                const parent = nodes.find(p => p.id === n.parentId);
                if (parent) parent.children.push(n);
            }
        });

        const roots = nodes.filter(n => !n.parentId || !nodes.find(p => p.id === n.parentId));
        let maxLane = 0;
        const visited = new Set();

        function layoutNode(node, gen, lane) {
            if (visited.has(node.id)) return;
            visited.add(node.id);

            node.x = gen * 200 + 120; // 宽裕的水平间距，防止文字和点遮挡
            node.y = lane * 110 + 100; // 宽裕的垂直间距

            if (node.children.length === 0) return;

            node.children.forEach((child, index) => {
                const childLane = index === 0 ? lane : ++maxLane;
                layoutNode(child, gen + 1, childLane);
            });
        }

        roots.forEach((root, idx) => {
            const lane = idx === 0 ? 0 : ++maxLane;
            layoutNode(root, 0, lane);
        });

        return nodes;
    },

    // 初始化鼠标拖拽平移、鼠标滚轮缩放事件与工具栏按钮
    initZoomEvents: function(svg) {
        if (svg.dataset.zoomInitialized) return;
        svg.dataset.zoomInitialized = "true";

        const self = this;
        self.dragged = false; // 标记是否发生了真实拖拽，用于阻止 click 误触发

        svg.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return; // 仅支持鼠标左键拖动
            
            const startX = e.clientX;
            const startY = e.clientY;
            let hasMoved = false;
            
            self.panStart = { x: e.clientX - self.zoomState.x, y: e.clientY - self.zoomState.y };

            const onPointerMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (!hasMoved && distance > 5) {
                    hasMoved = true;
                    self.isPanning = true;
                    self.dragged = true; // 确定发生了位移，后续阻止 click 事件
                    svg.classList.replace('cursor-grab', 'cursor-grabbing');
                }

                if (self.isPanning) {
                    self.zoomState.x = moveEvent.clientX - self.panStart.x;
                    self.zoomState.y = moveEvent.clientY - self.panStart.y;
                    self.applyZoomTransform();
                }
            };

            const onPointerUp = () => {
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                if (self.isPanning) {
                    self.isPanning = false;
                    svg.classList.replace('cursor-grabbing', 'cursor-grab');
                }
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });

        // 捕获阶段拦截拖拽释放后的 click 事件，防止将拖拽结束误判为点击节点
        svg.addEventListener('click', (e) => {
            if (self.dragged) {
                e.stopPropagation();
                e.preventDefault();
                self.dragged = false;
            }
        }, true);

        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 1.15;
            const rect = svg.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;

            const oldScale = self.zoomState.scale;
            let newScale = oldScale;

            if (e.deltaY < 0) {
                newScale = Math.min(oldScale * zoomFactor, 3.0);
            } else {
                newScale = Math.max(oldScale / zoomFactor, 0.25);
            }

            self.zoomState.x = localX - (localX - self.zoomState.x) * (newScale / oldScale);
            self.zoomState.y = localY - (localY - self.zoomState.y) * (newScale / oldScale);
            self.zoomState.scale = newScale;

            self.applyZoomTransform();
        }, { passive: false });

        // 绑定快捷工具条按钮事件
        const btnIn = document.getElementById('graph-zoom-in-btn');
        const btnOut = document.getElementById('graph-zoom-out-btn');
        const btnReset = document.getElementById('graph-zoom-reset-btn');

        if (btnIn) {
            btnIn.addEventListener('click', (e) => {
                e.stopPropagation();
                const oldScale = self.zoomState.scale;
                const newScale = Math.min(oldScale * 1.25, 3.0);
                const rect = svg.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                self.zoomState.x = centerX - (centerX - self.zoomState.x) * (newScale / oldScale);
                self.zoomState.y = centerY - (centerY - self.zoomState.y) * (newScale / oldScale);
                self.zoomState.scale = newScale;
                self.applyZoomTransform();
            });
        }

        if (btnOut) {
            btnOut.addEventListener('click', (e) => {
                e.stopPropagation();
                const oldScale = self.zoomState.scale;
                const newScale = Math.max(oldScale / 1.25, 0.25);
                const rect = svg.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                self.zoomState.x = centerX - (centerX - self.zoomState.x) * (newScale / oldScale);
                self.zoomState.y = centerY - (centerY - self.zoomState.y) * (newScale / oldScale);
                self.zoomState.scale = newScale;
                self.applyZoomTransform();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', (e) => {
                e.stopPropagation();
                self.autoCenterGraph();
            });
        }
    },

    // 将视图缩放属性应用至渲染容器中
    applyZoomTransform: function() {
        const viewport = document.getElementById('svg-viewport');
        if (viewport) {
            viewport.setAttribute('transform', `translate(${this.zoomState.x}, ${this.zoomState.y}) scale(${this.zoomState.scale})`);
        }
        const scaleIndicator = document.getElementById('graph-scale-indicator');
        if (scaleIndicator) {
            scaleIndicator.textContent = Math.round(this.zoomState.scale * 100) + '%';
        }
    },

    // 自适应最优比例并使整个版本控制树居中对齐
    autoCenterGraph: function() {
        const svg = document.getElementById('version-svg');
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 400;

        const nodes = this.calculateNodeLayouts();
        if (nodes.length === 0) return;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        nodes.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });

        // 宽度和高度边界外留空，计算缩放比
        const graphWidth = maxX - minX + 240;
        const graphHeight = maxY - minY + 180;
        const padding = 50;
        
        const scaleX = (width - padding * 2) / graphWidth;
        const scaleY = (height - padding * 2) / graphHeight;
        const scale = Math.min(Math.min(scaleX, scaleY), 1.1); // 限制最大缩放上限，保证画面紧凑度
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        this.zoomState.scale = scale;
        this.zoomState.x = width / 2 - centerX * scale;
        this.zoomState.y = height / 2 - centerY * scale;

        this.applyZoomTransform();
    },

    // 绘制非线性 2D 拓扑版本连线图
    renderVersionGraph: function() {
        const svg = document.getElementById('version-svg');
        if (!svg) return;
        svg.innerHTML = '';
        
        if (this.historyList.length === 0) return;

        // 注册平移与缩放逻辑
        this.initZoomEvents(svg);

        // 声明平移工作视口
        const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        viewport.setAttribute('id', 'svg-viewport');
        svg.appendChild(viewport);

        const nodes = this.calculateNodeLayouts();
        if (nodes.length === 0) return;

        // 若尚未执行首次居中计算，则进行自适应缩放适配
        if (!svg.dataset.firstRendered) {
            svg.dataset.firstRendered = "true";
            setTimeout(() => {
                this.autoCenterGraph();
            }, 50);
        } else {
            this.applyZoomTransform();
        }

        // 1. 绘制版本连接导线（使用贝塞尔曲线增加过渡辨识度）
        nodes.forEach(node => {
            if (node.parentId) {
                const parent = nodes.find(p => p.id === node.parentId);
                if (parent) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const d = `M ${parent.x} ${parent.y} C ${(parent.x + node.x)/2} ${parent.y}, ${(parent.x + node.x)/2} ${node.y}, ${node.x} ${node.y}`;
                    path.setAttribute('d', d);
                    path.setAttribute('stroke', '#64748b'); // 深石板灰增加线条对比度
                    path.setAttribute('stroke-width', '2.5');
                    path.setAttribute('fill', 'none');
                    viewport.appendChild(path);
                }
            }
        });

        // 2. 绘制版本节点卡片与关系
        nodes.forEach(node => {
            const isActive = node.id === this.activeHistoryId;
            const styles = window.getHashStyles(node.wsHash);
            
            const bgMatch = styles.match(/background-color:\s*(hsl\([^)]+\));/);
            const textMatch = styles.match(/color:\s*(hsl\([^)]+\));/);
            const borderMatch = styles.match(/border-color:\s*(hsl\([^)]+\));/);
            
            const bgColor = bgMatch ? bgMatch[1] : '#f1f5f9';
            const textColor = textMatch ? textMatch[1] : '#475569';
            const borderColor = borderMatch ? borderMatch[1] : '#cbd5e1';

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'cursor-pointer select-none transition-transform duration-100 transform hover:scale-105');
            g.style.transformOrigin = `${node.x}px ${node.y}px`;
            
            g.addEventListener('click', () => {
                if (confirm(`是否安全回滚整个项目文件系统到该节点: [${node.label}]?`)) {
                    this.rollbackTo(node.id);
                    document.getElementById('graph-modal').classList.add('hidden');
                }
            });

            // 为活动状态添加发光底层氛围圈
            if (isActive) {
                const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                glow.setAttribute('cx', node.x);
                glow.setAttribute('cy', node.y);
                glow.setAttribute('r', '34');
                glow.setAttribute('fill', '#60a5fa');
                glow.setAttribute('opacity', '0.25');
                g.appendChild(glow);
            }

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', '24');
            circle.setAttribute('fill', bgColor);
            circle.setAttribute('stroke', isActive ? '#2563eb' : borderColor);
            circle.setAttribute('stroke-width', isActive ? '4' : '2.5');
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y + 4);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-family', 'monospace');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', textColor);
            text.textContent = node.wsHash;

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', node.x);
            label.setAttribute('y', node.y + 45);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '11');
            label.setAttribute('font-weight', isActive ? 'bold' : 'normal');
            label.setAttribute('fill', isActive ? '#1e40af' : '#334155');
            
            // 截断超长 commit 文本，避免节点挤作一团
            const cleanLabel = node.label.length > 22 ? node.label.slice(0, 20) + '...' : node.label;
            label.textContent = cleanLabel;

            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `快照动作: ${node.label}\n系统指纹: ${node.wsHash}\n产生时间: ${new Date(node.timestamp).toLocaleString()}\n点击快速回退至此时刻`;
            g.appendChild(title);

            g.appendChild(circle);
            g.appendChild(text);
            g.appendChild(label);
            viewport.appendChild(g);
        });
    },

    rollbackTo: function(id) {
        const target = this.historyList.find(item => item.id === id);
        if (!target) {
            window.addConsoleLog("ROLLBACK", null, "未找到该快照节点，回滚失败。", "error");
            return;
        }

        // 从 CAS 数据库还原文件列表
        window.parsedFiles = this.reconstructFiles(target.files);
        this.activeHistoryId = id;

        window.renderDirectoryTree(window.parsedFiles, document.getElementById('file-search').value.trim());
        window.renderStringMode(window.parsedFiles);
        window.updateStats();
        
        this.saveCurrentStateToStorage();

        const currentFileName = document.getElementById('current-file-name');
        const curPath = currentFileName.getAttribute('data-active-path');
        const activeFile = window.parsedFiles.find(f => f.path === curPath);
        if (activeFile) {
            window.viewFile(activeFile.path, activeFile.content);
        } else if (window.parsedFiles.length > 0) {
            window.viewFile(window.parsedFiles[0].path, window.parsedFiles[0].content);
        }

        this.renderTimeline();
        window.addConsoleLog("ROLLBACK", null, `时光机成功回滚至: [${target.label}] (${new Date(target.timestamp).toLocaleTimeString()})`, "success");
    },

    saveCurrentStateToStorage: function() {
        if (window.hideConfig.enableLocalStorage === false) {
            localStorage.removeItem('workspace_files');
            localStorage.removeItem('workspace_history_list');
            localStorage.removeItem('workspace_active_history_id');
            localStorage.removeItem('workspace_object_database');
            return;
        }
        try {
            localStorage.setItem('workspace_files', JSON.stringify(window.parsedFiles));
            localStorage.setItem('workspace_history_list', JSON.stringify(this.historyList));
            localStorage.setItem('workspace_active_history_id', JSON.stringify(this.activeHistoryId));
            localStorage.setItem('workspace_object_database', JSON.stringify(this.objectDatabase));
        } catch (e) {
            console.warn("LocalStorage 容量超限，部分历史快照与代码可能无法持久化缓存:", e);
        }
    }
};