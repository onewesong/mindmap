class MindMap {
    constructor() {
        this.svg = document.getElementById('mindmap-svg');
        this.nodesLayer = document.getElementById('nodes-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        
        this.nodes = new Map();
        this.connections = [];
        this.selectedNode = null;
        this.nodeCounter = 0;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        
        // 画布拖拽相关
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        
        // 历史记录系统
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // 右键菜单相关
        this.contextMenu = null;
        this.contextMenuTarget = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupColorSystem();
        this.setupThemeSystem();
        this.setupContextMenu();
        this.createRootNode();
    }

    setupEventListeners() {
        // 工具栏按钮事件
        document.getElementById('add-node-btn').addEventListener('click', () => {
            this.addChildNode();
        });
        
        document.getElementById('delete-node-btn').addEventListener('click', () => {
            this.deleteSelectedNode();
        });
        
        document.getElementById('zoom-in-btn').addEventListener('click', () => {
            this.zoom(1.2);
        });
        
        document.getElementById('zoom-out-btn').addEventListener('click', () => {
            this.zoom(0.8);
        });
        
        document.getElementById('reset-zoom-btn').addEventListener('click', () => {
            this.resetView();
        });
        
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undo();
        });
        
        document.getElementById('redo-btn').addEventListener('click', () => {
            this.redo();
        });
        
        document.getElementById('import-markdown-btn').addEventListener('click', () => {
            this.importFromMarkdown();
        });
        
        document.getElementById('export-markdown-btn').addEventListener('click', () => {
            this.exportToMarkdown();
        });

        // SVG画布事件
        this.svg.addEventListener('click', (e) => {
            if (e.target === this.svg) {
                this.deselectAllNodes();
            }
        });

        // 阻止画布右键菜单
        this.svg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.hideContextMenu();
        });

        // 画布拖拽事件
        this.svg.addEventListener('mousedown', (e) => {
            if (e.target === this.svg && e.button === 0) { // 只响应左键
                this.isPanning = true;
                this.panStart = { x: e.clientX, y: e.clientY };
                this.svg.classList.add('dragging');
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const deltaX = e.clientX - this.panStart.x;
                const deltaY = e.clientY - this.panStart.y;
                
                this.panX += deltaX;
                this.panY += deltaY;
                
                this.updateTransform();
                
                this.panStart = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.svg.classList.remove('dragging');
            }
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            // 如果当前有输入框在编辑，不处理快捷键
            if (document.querySelector('.node-input')) {
                return;
            }
            
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelectedNode();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.addChildNode();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedNode) {
                    // Enter键用于编辑当前节点
                    const nodeGroup = document.querySelector(`[data-node-id="${this.selectedNode.id}"]`);
                    if (nodeGroup) {
                        this.editNodeText(nodeGroup, this.selectedNode);
                    }
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            } else if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });

        // 鼠标滚轮缩放
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(delta, e.clientX, e.clientY);
        });
    }

    setupColorSystem() {
        const colorBtn = document.getElementById('color-selector-btn');
        const colorDropdown = document.getElementById('color-dropdown');
        const colorOptions = document.querySelectorAll('.color-option');
        const colorContainer = document.querySelector('.color-selector-container');
        
        // 颜色按钮点击事件
        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 检查是否有选中的节点
            if (!this.selectedNode) {
                return;
            }
            
            const isShow = colorDropdown.classList.contains('show');
            this.closeAllDropdowns();
            
            if (!isShow) {
                colorDropdown.classList.add('show');
                colorBtn.classList.add('active');
                this.updateActiveColor();
            }
        });
        
        // 颜色选项点击事件
        colorOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = option.getAttribute('data-color');
                
                if (this.selectedNode) {
                    this.setNodeColor(this.selectedNode, color);
                    this.updateActiveColor();
                    // 保存状态
                    this.saveState();
                }
                
                this.closeAllDropdowns();
            });
        });
        
        // 更新颜色选择器状态
        this.updateColorSelectorState();
    }
    
    setupThemeSystem() {
        const themeBtn = document.getElementById('theme-selector-btn');
        const themeDropdown = document.getElementById('theme-dropdown');
        const themeOptions = document.querySelectorAll('.theme-option');
        
        // 从本地存储加载主题
        const savedTheme = localStorage.getItem('mindmap-theme') || 'mac-light';
        this.applyTheme(savedTheme);
        this.updateActiveTheme(savedTheme);
        
        // 主题按钮点击事件
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShow = themeDropdown.classList.contains('show');
            this.closeAllDropdowns();
            
            if (!isShow) {
                themeDropdown.classList.add('show');
                themeBtn.classList.add('active');
            }
        });
        
        // 主题选项点击事件
        themeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = option.getAttribute('data-theme');
                this.applyTheme(theme);
                this.updateActiveTheme(theme);
                localStorage.setItem('mindmap-theme', theme);
                this.closeAllDropdowns();
            });
        });
        
        // 点击外部关闭下拉菜单和上下文菜单
        document.addEventListener('click', (e) => {
            this.closeAllDropdowns();
            this.hideContextMenu();
        });
    }
    
    applyTheme(theme) {
        // 移除所有主题类
        document.body.removeAttribute('data-theme');
        
        // 应用新主题
        if (theme !== 'mac-light') {
            document.body.setAttribute('data-theme', theme);
        }
    }
    
    updateActiveTheme(activeTheme) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-theme') === activeTheme) {
                option.classList.add('active');
            }
        });
    }
    
    closeAllDropdowns() {
        document.querySelectorAll('.theme-dropdown, .color-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        document.querySelectorAll('.theme-btn, .color-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    createRootNode() {
        const node = this.createNode(400, 300, '中心主题', 'default');
        this.selectNode(node);
        // 更新节点样式（根节点特殊处理）
        setTimeout(() => {
            this.updateNodeStyle(node);
        }, 10);
        // 保存初始状态
        this.saveState();
    }

    createNode(x, y, text = '新节点', color = null) {
        const nodeId = `node-${this.nodeCounter++}`;
        
        // 如果没有指定颜色，根据层级自动分配颜色
        if (color === null) {
            color = this.getAutoColor();
        }
        
        const nodeData = {
            id: nodeId,
            x: x,
            y: y,
            text: text,
            width: 120,
            height: 40,
            children: [],
            parent: null,
            color: color
        };

        // 创建SVG节点组
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.classList.add('mindmap-node');
        nodeGroup.classList.add(`node-color-${nodeData.color}`);
        nodeGroup.setAttribute('data-node-id', nodeId);

        // 创建半圆角矩形背景
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('node-bg');
        rect.setAttribute('width', nodeData.width);
        rect.setAttribute('height', nodeData.height);
        rect.setAttribute('rx', 12); // 半圆角
        rect.setAttribute('ry', 12);

        // 创建文本
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.classList.add('node-text');
        textElement.setAttribute('x', nodeData.width / 2);
        textElement.setAttribute('y', nodeData.height / 2);
        textElement.textContent = text;

        // 创建连接点
        const connectionPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        connectionPoint.classList.add('connection-point');
        connectionPoint.setAttribute('cx', nodeData.width);
        connectionPoint.setAttribute('cy', nodeData.height / 2);
        connectionPoint.setAttribute('r', 4);

        nodeGroup.appendChild(rect);
        nodeGroup.appendChild(textElement);
        nodeGroup.appendChild(connectionPoint);

        this.updateNodePosition(nodeGroup, nodeData);
        this.nodesLayer.appendChild(nodeGroup);

        // 添加事件监听器
        this.setupNodeEventListeners(nodeGroup, nodeData);

        this.nodes.set(nodeId, nodeData);
        return nodeData;
    }

    updateNodePosition(nodeGroup, nodeData) {
        nodeGroup.setAttribute('transform', `translate(${nodeData.x - nodeData.width / 2}, ${nodeData.y - nodeData.height / 2})`);
    }

    setupNodeEventListeners(nodeGroup, nodeData) {
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };

        nodeGroup.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };
            this.selectNode(nodeData);
            nodeGroup.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = (e.clientX - dragStart.x) / this.scale;
                const dy = (e.clientY - dragStart.y) / this.scale;
                
                nodeData.x += dx;
                nodeData.y += dy;
                
                this.updateNodePosition(nodeGroup, nodeData);
                this.updateConnections();
                
                dragStart = { x: e.clientX, y: e.clientY };
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                nodeGroup.style.cursor = 'move';
            }
        });

        // 双击编辑文本
        nodeGroup.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editNodeText(nodeGroup, nodeData);
        });

        // 点击选择节点
        nodeGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(nodeData);
        });

        // 右键菜单
        nodeGroup.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectNode(nodeData);
            this.showContextMenu(e.clientX, e.clientY, nodeData);
        });
    }

    editNodeText(nodeGroup, nodeData) {
        const textElement = nodeGroup.querySelector('.node-text');
        const rect = nodeGroup.querySelector('.node-bg');
        const svgRect = this.svg.getBoundingClientRect();
        const nodeRect = rect.getBoundingClientRect();

        // 创建输入框
        const input = document.createElement('input');
        input.classList.add('node-input');
        input.value = nodeData.text;
        input.style.left = `${nodeRect.left - svgRect.left}px`;
        input.style.top = `${nodeRect.top - svgRect.top}px`;
        input.style.width = `${nodeData.width}px`;
        input.style.height = `${nodeData.height}px`;

        document.body.appendChild(input);
        input.focus();
        input.select();

        const finishEdit = () => {
            const newText = input.value.trim() || '新节点';
            const oldText = nodeData.text;
            
            if (newText !== oldText) {
                nodeData.text = newText;
                textElement.textContent = newText;
                // 保存状态（仅在文本实际改变时）
                this.saveState();
            }
            
            document.body.removeChild(input);
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，避免触发全局快捷键
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                document.body.removeChild(input);
            }
        });
    }

    selectNode(nodeData) {
        this.deselectAllNodes();
        this.selectedNode = nodeData;
        
        const nodeGroup = document.querySelector(`[data-node-id="${nodeData.id}"]`);
        if (nodeGroup) {
            nodeGroup.classList.add('selected');
        }
        
        // 更新颜色选择器状态
        this.updateColorSelectorState();
        this.updateActiveColor();
    }

    deselectAllNodes() {
        this.selectedNode = null;
        document.querySelectorAll('.mindmap-node.selected').forEach(node => {
            node.classList.remove('selected');
        });
        
        // 更新颜色选择器状态
        this.updateColorSelectorState();
    }

    addChildNode() {
        if (!this.selectedNode) return;

        // 计算子节点位置
        const parentNode = this.selectedNode;
        const childCount = parentNode.children.length;
        const angle = (childCount * Math.PI) / 4; // 分散角度
        const distance = 200;
        
        const childX = parentNode.x + Math.cos(angle) * distance;
        const childY = parentNode.y + Math.sin(angle) * distance;

        // 为子节点分配下一个颜色
        const nextColor = this.getNextLevelColor(parentNode.color);
        const childNode = this.createNode(childX, childY, '子节点', nextColor);
        
        // 建立父子关系
        parentNode.children.push(childNode.id);
        childNode.parent = parentNode.id;

        // 创建连接线
        this.createConnection(parentNode.id, childNode.id);
        
        // 更新节点样式（延迟执行确保DOM已更新）
        setTimeout(() => {
            this.updateNodeStyle(parentNode);
            this.updateNodeStyle(childNode);
        }, 10);
        
        this.selectNode(childNode);
        
        // 保存状态
        this.saveState();
    }

    createConnection(parentId, childId) {
        const connection = {
            id: `connection-${parentId}-${childId}`,
            parent: parentId,
            child: childId
        };

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-line');
        line.setAttribute('data-connection-id', connection.id);

        this.connectionsLayer.appendChild(line);
        this.connections.push(connection);
        this.updateConnections();
    }

    updateConnections() {
        this.connections.forEach(connection => {
            const parentNode = this.nodes.get(connection.parent);
            const childNode = this.nodes.get(connection.child);
            const line = document.querySelector(`[data-connection-id="${connection.id}"]`);

            if (parentNode && childNode && line) {
                // 计算连接点位置 - 从节点边缘到节点边缘
                const parentHalfWidth = (parentNode.width || 120) / 2;
                const childHalfWidth = (childNode.width || 120) / 2;
                
                // 起点：父节点右边缘
                const startX = parentNode.x + parentHalfWidth;
                const startY = parentNode.y;
                
                // 终点：子节点左边缘
                const endX = childNode.x - childHalfWidth;
                const endY = childNode.y;
                
                // 使用贝塞尔曲线创建平滑连接
                const dx = endX - startX;
                const controlOffset = Math.abs(dx) * 0.4;

                const path = `M ${startX} ${startY} 
                             C ${startX + controlOffset} ${startY}, 
                               ${endX - controlOffset} ${endY}, 
                               ${endX} ${endY}`;
                
                line.setAttribute('d', path);
            }
        });
    }

    deleteSelectedNode() {
        if (!this.selectedNode || this.nodes.size === 1) return;

        const nodeId = this.selectedNode.id;
        const nodeData = this.selectedNode;

        // 删除所有相关连接
        this.connections = this.connections.filter(connection => {
            if (connection.parent === nodeId || connection.child === nodeId) {
                const line = document.querySelector(`[data-connection-id="${connection.id}"]`);
                if (line) line.remove();
                return false;
            }
            return true;
        });

        // 删除子节点
        nodeData.children.forEach(childId => {
            this.deleteNodeById(childId);
        });

        // 从父节点的子节点列表中移除
        if (nodeData.parent) {
            const parentNode = this.nodes.get(nodeData.parent);
            if (parentNode) {
                parentNode.children = parentNode.children.filter(id => id !== nodeId);
            }
        }

        // 删除节点DOM元素
        const nodeGroup = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeGroup) nodeGroup.remove();

        // 从节点集合中删除
        this.nodes.delete(nodeId);
        this.selectedNode = null;
        
        // 更新所有节点样式（删除节点后层级可能发生变化）
        this.updateAllNodeStyles();
        
        // 保存状态
        this.saveState();
    }

    deleteNodeById(nodeId) {
        const nodeData = this.nodes.get(nodeId);
        if (!nodeData) return;

        // 递归删除子节点
        nodeData.children.forEach(childId => {
            this.deleteNodeById(childId);
        });

        // 删除相关连接
        this.connections = this.connections.filter(connection => {
            if (connection.parent === nodeId || connection.child === nodeId) {
                const line = document.querySelector(`[data-connection-id="${connection.id}"]`);
                if (line) line.remove();
                return false;
            }
            return true;
        });

        // 删除DOM元素
        const nodeGroup = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeGroup) nodeGroup.remove();

        // 从节点集合中删除
        this.nodes.delete(nodeId);
    }

    zoom(factor, centerX = null, centerY = null) {
        const newScale = Math.max(0.1, Math.min(3, this.scale * factor));
        
        if (centerX !== null && centerY !== null) {
            // 以鼠标位置为中心缩放
            const svgRect = this.svg.getBoundingClientRect();
            const x = centerX - svgRect.left;
            const y = centerY - svgRect.top;
            
            this.panX = x - (x - this.panX) * (newScale / this.scale);
            this.panY = y - (y - this.panY) * (newScale / this.scale);
        }
        
        this.scale = newScale;
        this.updateTransform();
    }

    resetView() {
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
    }

    updateTransform() {
        const transform = `translate(${this.panX}, ${this.panY}) scale(${this.scale})`;
        this.nodesLayer.setAttribute('transform', transform);
        this.connectionsLayer.setAttribute('transform', transform);
    }
    
    // 节点样式和层级相关方法
    getNodeLevel(nodeData) {
        let level = 0;
        let current = nodeData;
        
        // 向上追溯到根节点计算层级
        while (current.parent) {
            level++;
            current = this.nodes.get(current.parent);
            if (!current) break;
        }
        
        return level;
    }
    
    updateNodeStyle(nodeData) {
        if (!nodeData) {
            console.warn('updateNodeStyle: nodeData is null');
            return;
        }
        
        const level = this.getNodeLevel(nodeData);
        const isLeafNode = nodeData.children.length === 0;
        const nodeGroup = document.querySelector(`[data-node-id="${nodeData.id}"]`);
        
        if (!nodeGroup) {
            console.warn(`updateNodeStyle: 找不到节点DOM元素 ${nodeData.id}`);
            return;
        }
        
        const rect = nodeGroup.querySelector('.node-bg');
        const text = nodeGroup.querySelector('.node-text');
        
        if (!rect || !text) {
            console.warn(`updateNodeStyle: 找不到节点子元素 ${nodeData.id}`);
            return;
        }
        
        // 根据层级设置不同大小
        let width, height, fontSize, fontWeight;
        switch (level) {
            case 0: // 根节点
                width = 180;
                height = 60;
                fontSize = 18;
                fontWeight = '700';
                break;
            case 1: // 第一级子节点
                width = 150;
                height = 50;
                fontSize = 16;
                fontWeight = '600';
                break;
            case 2: // 第二级子节点
                width = 130;
                height = 45;
                fontSize = 15;
                fontWeight = '500';
                break;
            case 3: // 第三级子节点
                width = 110;
                height = 40;
                fontSize = 14;
                fontWeight = '500';
                break;
            default: // 更深层级
                width = 100;
                height = 35;
                fontSize = 13;
                fontWeight = '400';
                break;
        }
        
        console.log(`更新节点 ${nodeData.id} 样式: 层级${level}, 大小${width}x${height}`);
        
        // 更新节点数据
        nodeData.width = width;
        nodeData.height = height;
        
        // 更新矩形大小
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        
        // 更新文本样式
        text.setAttribute('x', width / 2);
        text.setAttribute('y', height / 2);
        text.setAttribute('font-size', fontSize);
        text.setAttribute('font-weight', fontWeight);
        
        // 叶子节点特殊处理（保持正常背景，避免连线问题）
        if (isLeafNode && level > 0) {
            rect.style.opacity = '0.8'; // 轻微透明但不影响连线
            text.style.fontStyle = 'italic';
            text.style.opacity = '0.9';
            nodeGroup.classList.add('leaf-node');
        } else {
            rect.style.opacity = '1';
            text.style.fontStyle = 'normal';
            text.style.opacity = '1';
            nodeGroup.classList.remove('leaf-node');
        }
        
        // 更新连接点位置
        const connectionPoint = nodeGroup.querySelector('.connection-point');
        if (connectionPoint) {
            connectionPoint.setAttribute('cx', width);
            connectionPoint.setAttribute('cy', height / 2);
        }
        
        // 重新定位节点
        this.updateNodePosition(nodeGroup, nodeData);
    }
    
    updateAllNodeStyles() {
        // 更新所有节点的样式
        this.nodes.forEach(nodeData => {
            this.updateNodeStyle(nodeData);
        });
        // 更新连接线
        this.updateConnections();
    }
    
    // 节点颜色相关方法
    getAutoColor() {
        const colors = ['blue', 'green', 'orange', 'purple', 'red', 'teal', 'yellow', 'pink'];
        return colors[this.nodes.size % colors.length];
    }
    
    getNextLevelColor(parentColor) {
        const colors = ['blue', 'green', 'orange', 'purple', 'red', 'teal', 'yellow', 'pink'];
        const parentIndex = colors.indexOf(parentColor);
        if (parentIndex === -1) return colors[0];
        return colors[(parentIndex + 1) % colors.length];
    }
    
    setNodeColor(nodeData, color) {
        nodeData.color = color;
        
        const nodeGroup = document.querySelector(`[data-node-id="${nodeData.id}"]`);
        if (nodeGroup) {
            // 移除所有颜色类
            const colorClasses = ['node-color-default', 'node-color-blue', 'node-color-green', 
                                'node-color-orange', 'node-color-purple', 'node-color-red', 
                                'node-color-teal', 'node-color-yellow', 'node-color-pink'];
            colorClasses.forEach(cls => nodeGroup.classList.remove(cls));
            
            // 添加新颜色类
            nodeGroup.classList.add(`node-color-${color}`);
        }
    }
    
    updateColorSelectorState() {
        const colorContainer = document.querySelector('.color-selector-container');
        if (this.selectedNode) {
            colorContainer.classList.remove('disabled');
        } else {
            colorContainer.classList.add('disabled');
        }
    }
    
    updateActiveColor() {
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
            if (this.selectedNode && option.getAttribute('data-color') === this.selectedNode.color) {
                option.classList.add('active');
            }
        });
    }
    
    // 历史记录系统
    saveState() {
        const currentState = {
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
                id,
                x: node.x,
                y: node.y,
                text: node.text,
                children: [...node.children],
                parent: node.parent,
                color: node.color
            })),
            connections: [...this.connections],
            selectedNodeId: this.selectedNode ? this.selectedNode.id : null
        };
        
        // 移除当前索引之后的历史记录
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // 添加新状态
        this.history.push(JSON.parse(JSON.stringify(currentState)));
        this.historyIndex++;
        
        // 限制历史记录大小
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        // 更新按钮状态
        this.updateHistoryButtons();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.updateHistoryButtons();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.updateHistoryButtons();
        }
    }
    
    restoreState(state) {
        // 清空现有数据
        this.nodes.clear();
        this.connections = [];
        this.nodesLayer.innerHTML = '';
        this.connectionsLayer.innerHTML = '';
        this.selectedNode = null;
        
        // 重建节点
        state.nodes.forEach(nodeData => {
            const node = this.createNodeFromData(nodeData);
            this.nodes.set(nodeData.id, node);
        });
        
        // 重建连接
        state.connections.forEach(connection => {
            this.createConnection(connection.parent, connection.child);
        });
        
        // 恢复选中状态
        if (state.selectedNodeId && this.nodes.has(state.selectedNodeId)) {
            this.selectNode(this.nodes.get(state.selectedNodeId));
        }
        
        // 更新所有节点样式
        this.updateAllNodeStyles();
    }
    
    createNodeFromData(nodeData) {
        const nodeId = nodeData.id;
        
        // 创建节点数据
        const newNodeData = {
            id: nodeId,
            x: nodeData.x,
            y: nodeData.y,
            text: nodeData.text,
            width: 120,
            height: 40,
            children: [...nodeData.children],
            parent: nodeData.parent,
            color: nodeData.color || 'default'
        };

        // 创建SVG节点组
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.classList.add('mindmap-node');
        nodeGroup.classList.add(`node-color-${newNodeData.color}`);
        nodeGroup.setAttribute('data-node-id', nodeId);

        // 创建半圆角矩形背景
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('node-bg');
        rect.setAttribute('width', newNodeData.width);
        rect.setAttribute('height', newNodeData.height);
        rect.setAttribute('rx', 12);
        rect.setAttribute('ry', 12);

        // 创建文本
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.classList.add('node-text');
        textElement.setAttribute('x', newNodeData.width / 2);
        textElement.setAttribute('y', newNodeData.height / 2);
        textElement.textContent = nodeData.text;

        // 创建连接点
        const connectionPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        connectionPoint.classList.add('connection-point');
        connectionPoint.setAttribute('cx', newNodeData.width);
        connectionPoint.setAttribute('cy', newNodeData.height / 2);
        connectionPoint.setAttribute('r', 4);

        nodeGroup.appendChild(rect);
        nodeGroup.appendChild(textElement);
        nodeGroup.appendChild(connectionPoint);

        // 添加事件监听器
        this.setupNodeEventListeners(nodeGroup, newNodeData);

        this.updateNodePosition(nodeGroup, newNodeData);
        this.nodesLayer.appendChild(nodeGroup);

        return newNodeData;
    }
    
    updateHistoryButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
            undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.history.length - 1;
            redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
        }
    }
    
    // 右键上下文菜单相关方法
    setupContextMenu() {
        this.contextMenu = document.getElementById('context-menu');
        
        // 菜单项点击事件
        document.getElementById('menu-edit').addEventListener('click', () => {
            this.hideContextMenu();
            if (this.contextMenuTarget) {
                this.editSelectedNode();
            }
        });
        
        document.getElementById('menu-add-child').addEventListener('click', () => {
            this.hideContextMenu();
            this.addChildNode();
        });
        
        document.getElementById('menu-change-color').addEventListener('click', (e) => {
            this.hideContextMenu();
            // 触发颜色选择器
            const colorBtn = document.getElementById('color-selector-btn');
            const colorDropdown = document.getElementById('color-dropdown');
            
            if (this.selectedNode) {
                this.closeAllDropdowns();
                colorDropdown.classList.add('show');
                colorBtn.classList.add('active');
                this.updateActiveColor();
            }
        });
        
        document.getElementById('menu-delete').addEventListener('click', () => {
            this.hideContextMenu();
            this.deleteSelectedNode();
        });
    }
    
    showContextMenu(x, y, nodeData) {
        this.contextMenuTarget = nodeData;
        
        // 更新菜单项状态
        const deleteItem = document.getElementById('menu-delete');
        const addChildItem = document.getElementById('menu-add-child');
        const editItem = document.getElementById('menu-edit');
        
        // 根节点且是唯一节点时不能删除
        if (this.nodes.size === 1) {
            deleteItem.classList.add('disabled');
        } else {
            deleteItem.classList.remove('disabled');
        }
        
        // 显示菜单
        this.contextMenu.classList.add('show');
        
        // 调整菜单位置，确保不会超出屏幕
        const menuRect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let adjustedX = x;
        let adjustedY = y;
        
        // 防止菜单超出右边界
        if (x + menuRect.width > viewportWidth) {
            adjustedX = x - menuRect.width;
        }
        
        // 防止菜单超出下边界
        if (y + menuRect.height > viewportHeight) {
            adjustedY = y - menuRect.height;
        }
        
        this.contextMenu.style.left = `${Math.max(0, adjustedX)}px`;
        this.contextMenu.style.top = `${Math.max(0, adjustedY)}px`;
    }
    
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.remove('show');
            this.contextMenuTarget = null;
        }
    }

    // 数据序列化
    exportData() {
        const data = {
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
                id,
                x: node.x,
                y: node.y,
                text: node.text,
                children: node.children,
                parent: node.parent,
                color: node.color
            })),
            connections: this.connections,
            scale: this.scale,
            panX: this.panX,
            panY: this.panY,
            theme: document.body.getAttribute('data-theme') || 'mac-light'
        };
        return JSON.stringify(data, null, 2);
    }

    // 数据导入
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // 清空现有数据
            this.nodes.clear();
            this.connections = [];
            this.nodesLayer.innerHTML = '';
            this.connectionsLayer.innerHTML = '';
            
            // 重建节点
            data.nodes.forEach(nodeData => {
                const node = this.createNode(nodeData.x, nodeData.y, nodeData.text, nodeData.color || 'default');
                node.id = nodeData.id;
                node.children = nodeData.children || [];
                node.parent = nodeData.parent;
                this.nodes.set(nodeData.id, node);
            });
            
            // 重建连接
            data.connections.forEach(connection => {
                this.createConnection(connection.parent, connection.child);
            });
            
            // 恢复视图状态
            if (data.scale !== undefined) this.scale = data.scale;
            if (data.panX !== undefined) this.panX = data.panX;
            if (data.panY !== undefined) this.panY = data.panY;
            this.updateTransform();
            
            // 恢复主题
            if (data.theme) {
                this.applyTheme(data.theme);
                this.updateActiveTheme(data.theme);
                localStorage.setItem('mindmap-theme', data.theme);
            }
            
            // 更新所有节点样式
            this.updateAllNodeStyles();
            
        } catch (error) {
            console.error('导入数据失败:', error);
        }
    }
    
    // Markdown导出功能
    exportToMarkdown() {
        // 找到根节点
        const rootNode = Array.from(this.nodes.values()).find(node => !node.parent);
        if (!rootNode) {
            console.error('未找到根节点');
            return;
        }
        
        let markdown = '';
        
        // 添加标题和说明
        markdown += `# ${rootNode.text}\n\n`;
        markdown += `> 此思维导图由 MindMap 应用生成\n`;
        markdown += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        
        // 递归生成子节点的Markdown
        const generateMarkdown = (nodeId, level = 1) => {
            const node = this.nodes.get(nodeId);
            if (!node) return '';
            
            let result = '';
            
            // 为子节点生成标题或列表项
            if (level <= 6) {
                // 使用标题格式 (H1-H6)
                const headerLevel = Math.min(level, 6);
                const headerPrefix = '#'.repeat(headerLevel);
                result += `${headerPrefix} ${node.text}\n\n`;
            } else {
                // 深层级使用列表格式
                const indent = '  '.repeat(level - 7);
                result += `${indent}- ${node.text}\n`;
            }
            
            // 如果有子节点，按顺序处理
            if (node.children && node.children.length > 0) {
                // 对子节点进行排序 (可选：按创建顺序或位置排序)
                const sortedChildren = [...node.children];
                
                for (const childId of sortedChildren) {
                    result += generateMarkdown(childId, level + 1);
                }
                
                // 在标题后添加空行
                if (level <= 6) {
                    result += '\n';
                }
            }
            
            return result;
        };
        
        // 生成子节点内容
        if (rootNode.children && rootNode.children.length > 0) {
            for (const childId of rootNode.children) {
                markdown += generateMarkdown(childId, 1);
            }
        }
        
        // 添加脚注
        markdown += '\n---\n\n';
        markdown += '*本文档由思维导图自动生成*\n';
        
        // 下载Markdown文件
        this.downloadFile(markdown, 'mindmap.md', 'text/markdown');
    }
    
    // 树形结构导出 (可选的导出格式)
    exportToMarkdownTree() {
        const rootNode = Array.from(this.nodes.values()).find(node => !node.parent);
        if (!rootNode) {
            console.error('未找到根节点');
            return;
        }
        
        let markdown = `# ${rootNode.text}\n\n`;
        
        const generateTree = (nodeId, prefix = '', isLast = true) => {
            const node = this.nodes.get(nodeId);
            if (!node) return '';
            
            let result = '';
            const connector = isLast ? '└── ' : '├── ';
            result += `${prefix}${connector}${node.text}\n`;
            
            if (node.children && node.children.length > 0) {
                const nextPrefix = prefix + (isLast ? '    ' : '│   ');
                
                for (let i = 0; i < node.children.length; i++) {
                    const childId = node.children[i];
                    const isLastChild = i === node.children.length - 1;
                    result += generateTree(childId, nextPrefix, isLastChild);
                }
            }
            
            return result;
        };
        
        markdown += '```\n';
        markdown += `${rootNode.text}\n`;
        
        if (rootNode.children && rootNode.children.length > 0) {
            for (let i = 0; i < rootNode.children.length; i++) {
                const childId = rootNode.children[i];
                const isLast = i === rootNode.children.length - 1;
                markdown += generateTree(childId, '', isLast);
            }
        }
        
        markdown += '```\n';
        
        this.downloadFile(markdown, 'mindmap-tree.md', 'text/markdown');
    }
    
    // 文件下载工具函数
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Markdown导入功能
    importFromMarkdown() {
        const fileInput = document.getElementById('markdown-file-input');
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const markdownContent = event.target.result;
                this.parseAndImportMarkdown(markdownContent);
                // 重置文件输入
                fileInput.value = '';
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }
    
    parseAndImportMarkdown(markdownContent) {
        if (!markdownContent.trim()) {
            alert('文件内容为空');
            return;
        }
        
        // 确认是否替换当前思维导图
        if (this.nodes.size > 0) {
            if (!confirm('导入Markdown将替换当前思维导图，确定要继续吗？')) {
                return;
            }
        }
        
        // 清空现有内容
        this.clearMindMap();
        
        const lines = markdownContent.split('\n');
        const nodeStack = []; // 用于追踪层级关系
        let rootNode = null;
        let nodeIdCounter = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            let text = '';
            let level = 0;
            
            // 解析标题
            const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                level = headerMatch[1].length; // # 的数量决定层级
                text = headerMatch[2].trim();
            }
            // 解析列表项
            else if (line.match(/^[\s]*[-*+]\s+(.+)$/)) {
                const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
                const indent = listMatch[1].length;
                level = Math.floor(indent / 2) + 7; // 列表项从第7级开始
                text = listMatch[2].trim();
            }
            // 解析有序列表
            else if (line.match(/^[\s]*\d+\.\s+(.+)$/)) {
                const orderedListMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
                const indent = orderedListMatch[1].length;
                level = Math.floor(indent / 2) + 7;
                text = orderedListMatch[2].trim();
            }
            else {
                // 跳过其他类型的行（代码块、引用等）
                continue;
            }
            
            if (!text) continue;
            
            // 创建节点
            const nodeId = `imported-node-${nodeIdCounter++}`;
            let nodeColor = 'default';
            
            // 根据层级分配颜色
            if (level === 1) nodeColor = 'blue';
            else if (level === 2) nodeColor = 'green';
            else if (level === 3) nodeColor = 'orange';
            else if (level === 4) nodeColor = 'purple';
            else if (level === 5) nodeColor = 'red';
            else if (level === 6) nodeColor = 'teal';
            
            // 计算节点位置
            let x, y;
            if (!rootNode) {
                // 根节点位置
                x = 400;
                y = 300;
                rootNode = { id: nodeId, level: level };
            } else {
                // 根据层级和顺序计算位置
                const angle = (nodeIdCounter * Math.PI) / 6;
                const distance = 150 + (level - 1) * 100;
                x = 400 + Math.cos(angle) * distance;
                y = 300 + Math.sin(angle) * distance;
            }
            
            // 创建节点
            const nodeData = this.createNode(x, y, text, nodeColor);
            nodeData.id = nodeId;
            this.nodes.set(nodeId, nodeData);
            
            // 建立层级关系
            while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].level >= level) {
                nodeStack.pop();
            }
            
            if (nodeStack.length > 0) {
                const parent = nodeStack[nodeStack.length - 1];
                const parentNodeData = this.nodes.get(parent.id);
                if (parentNodeData) {
                    parentNodeData.children.push(nodeId);
                    nodeData.parent = parent.id;
                    this.createConnection(parent.id, nodeId);
                }
            }
            
            nodeStack.push({ id: nodeId, level: level });
        }
        
        // 如果没有创建任何节点，创建默认根节点
        if (this.nodes.size === 0) {
            this.createRootNode();
            alert('未能解析到有效的Markdown结构，已创建默认思维导图');
            return;
        }
        
        // 重新布局节点
        this.layoutImportedNodes();
        
        // 更新所有节点样式
        this.updateAllNodeStyles();
        
        // 选中根节点
        if (rootNode) {
            const rootNodeData = this.nodes.get(rootNode.id);
            if (rootNodeData) {
                this.selectNode(rootNodeData);
            }
        }
        
        // 保存状态
        this.saveState();
        
        alert(`成功导入 ${this.nodes.size} 个节点的思维导图！`);
    }
    
    clearMindMap() {
        // 清空所有数据
        this.nodes.clear();
        this.connections = [];
        this.selectedNode = null;
        this.nodeCounter = 0;
        
        // 清空DOM
        this.nodesLayer.innerHTML = '';
        this.connectionsLayer.innerHTML = '';
        
        // 重置视图
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
        
        // 清空历史记录
        this.history = [];
        this.historyIndex = -1;
        this.updateHistoryButtons();
    }
    
    layoutImportedNodes() {
        const rootNode = Array.from(this.nodes.values()).find(node => !node.parent);
        if (!rootNode) return;
        
        // 使用简单的径向布局
        const layoutNode = (nodeData, centerX, centerY, radius, startAngle, angleSpan) => {
            nodeData.x = centerX;
            nodeData.y = centerY;
            
            const nodeGroup = document.querySelector(`[data-node-id="${nodeData.id}"]`);
            if (nodeGroup) {
                this.updateNodePosition(nodeGroup, nodeData);
            }
            
            if (nodeData.children && nodeData.children.length > 0) {
                const childAngleStep = angleSpan / nodeData.children.length;
                const childRadius = radius + 200;
                
                nodeData.children.forEach((childId, index) => {
                    const childNode = this.nodes.get(childId);
                    if (childNode) {
                        const angle = startAngle + (index * childAngleStep) + (childAngleStep / 2);
                        const childX = centerX + Math.cos(angle) * childRadius;
                        const childY = centerY + Math.sin(angle) * childRadius;
                        
                        const childAngleSpan = childAngleStep * 0.8; // 给子节点留一些角度空间
                        layoutNode(childNode, childX, childY, childRadius / 2, angle - childAngleSpan/2, childAngleSpan);
                    }
                });
            }
        };
        
        // 从根节点开始布局
        layoutNode(rootNode, 400, 300, 100, 0, 2 * Math.PI);
        
        // 更新连接线
        this.updateConnections();
    }
}

// 初始化应用
const mindMap = new MindMap();

// Electron菜单事件处理
if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.on('menu-new', () => {
        if (confirm('确定要创建新的思维导图吗？当前内容将丢失。')) {
            location.reload();
        }
    });
    
    ipcRenderer.on('menu-save', () => {
        const data = mindMap.exportData();
        // 这里可以添加文件保存逻辑
        console.log('保存数据:', data);
        
        // 使用浏览器下载功能作为临时保存方案
        mindMap.downloadFile(data, 'mindmap.json', 'application/json');
    });
    
    ipcRenderer.on('menu-import-markdown', () => {
        mindMap.importFromMarkdown();
    });
    
    ipcRenderer.on('menu-export-markdown', () => {
        mindMap.exportToMarkdown();
    });
}
