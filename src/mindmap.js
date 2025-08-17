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
        
        this.init();
    }

    init() {
        this.setupEventListeners();
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

        // SVG画布事件
        this.svg.addEventListener('click', (e) => {
            if (e.target === this.svg) {
                this.deselectAllNodes();
            }
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelectedNode();
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                this.addChildNode();
            }
        });

        // 鼠标滚轮缩放
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(delta, e.clientX, e.clientY);
        });
    }

    createRootNode() {
        const node = this.createNode(400, 300, '中心主题');
        this.selectNode(node);
    }

    createNode(x, y, text = '新节点') {
        const nodeId = `node-${this.nodeCounter++}`;
        const nodeData = {
            id: nodeId,
            x: x,
            y: y,
            text: text,
            width: 120,
            height: 40,
            children: [],
            parent: null
        };

        // 创建SVG节点组
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.classList.add('mindmap-node');
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
            nodeData.text = newText;
            textElement.textContent = newText;
            document.body.removeChild(input);
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
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
    }

    deselectAllNodes() {
        this.selectedNode = null;
        document.querySelectorAll('.mindmap-node.selected').forEach(node => {
            node.classList.remove('selected');
        });
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

        const childNode = this.createNode(childX, childY, '子节点');
        
        // 建立父子关系
        parentNode.children.push(childNode.id);
        childNode.parent = parentNode.id;

        // 创建连接线
        this.createConnection(parentNode.id, childNode.id);
        this.selectNode(childNode);
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
                // 使用贝塞尔曲线创建平滑连接
                const dx = childNode.x - parentNode.x;
                const dy = childNode.y - parentNode.y;
                const controlOffset = Math.abs(dx) * 0.3;

                const path = `M ${parentNode.x} ${parentNode.y} 
                             C ${parentNode.x + controlOffset} ${parentNode.y}, 
                               ${childNode.x - controlOffset} ${childNode.y}, 
                               ${childNode.x} ${childNode.y}`;
                
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

    // 数据序列化
    exportData() {
        const data = {
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
                id,
                x: node.x,
                y: node.y,
                text: node.text,
                children: node.children,
                parent: node.parent
            })),
            connections: this.connections,
            scale: this.scale,
            panX: this.panX,
            panY: this.panY
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
                const node = this.createNode(nodeData.x, nodeData.y, nodeData.text);
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
            
        } catch (error) {
            console.error('导入数据失败:', error);
        }
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
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mindmap.json';
        a.click();
        URL.revokeObjectURL(url);
    });
}
