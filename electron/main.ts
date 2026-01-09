import { app, BrowserWindow, session } from 'electron';
import path from 'path';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Removed electron-squirrel-startup check for macOS build preference.

const createWindow = () => {
    // Inject headers to enable SharedArrayBuffer (COOP/COEP)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Cross-Origin-Opener-Policy': ['same-origin'],
                'Cross-Origin-Embedder-Policy': ['require-corp']
            }
        });
    });

    // Checked the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false, // Don't show until ready-to-show
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
        frame: false, // Production: Frameless "Technocratic Brutalism"
        transparent: true,
        backgroundColor: '#00000000',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 20, y: 20 }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Load the index.html of the app.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        // Correct path for production (from electron/dist/main.cjs to dist/index.html)
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    // Open the DevTools if needed
    // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished initialization
app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
