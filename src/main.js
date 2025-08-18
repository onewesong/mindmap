const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// 创建主窗口
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    titleBarStyle: 'hiddenInset', // Mac风格标题栏
    backgroundColor: '#f5f5f7', // Mac风格背景色
    icon: path.join(__dirname, 'icons/icons/png/256x256.png') // 应用图标
  });

  win.loadFile('src/index.html');
  
  // 开发环境下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

// 应用准备就绪时创建窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用 (macOS除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS上激活应用时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 设置Mac风格菜单
if (process.platform === 'darwin') {
  const template = [
    {
      label: 'MindMap',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // 发送新建事件到渲染进程
            BrowserWindow.getFocusedWindow()?.webContents.send('menu-new');
          }
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            // 发送保存事件到渲染进程
            BrowserWindow.getFocusedWindow()?.webContents.send('menu-save');
          }
        },
        { type: 'separator' },
        {
          label: '导入 Markdown',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            // 发送导入Markdown事件到渲染进程
            BrowserWindow.getFocusedWindow()?.webContents.send('menu-import-markdown');
          }
        },
        {
          label: '导出为 Markdown',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            // 发送导出Markdown事件到渲染进程
            BrowserWindow.getFocusedWindow()?.webContents.send('menu-export-markdown');
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
