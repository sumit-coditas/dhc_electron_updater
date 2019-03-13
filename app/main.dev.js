/* eslint global-require: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 *
 * @flow
 */
import { app, BrowserWindow, session, protocol, ipcMain, shell } from 'electron';
import { path } from 'path';
import { url } from 'url';
import { autoUpdater } from 'electron-updater';
import { localStorage } from 'electron-browser-storage';
import log from 'electron-log';
import MenuBuilder from './menu';
let win; 

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');


// function createDefaultWindow() {
//     win = new BrowserWindow({width: 900, height: 680});
//     win.loadURL(`file://${__dirname}/version.html`);
//     win.on('closed', () => app.quit());
// //   return win;
// }

// when the update is ready, notify the BrowserWindow
autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('updateReady')
});

function sendStatusToWindow(text) {
  log.info(text);
  win.webContents.send('message', text);
}

let mainWindow;
// Keep a reference for dev mode
let dev = false;


ipcMain.on('Open default directory', (event, folderPath) => {
    shell.openItem(folderPath);
    // shell.showItemInFolder(folderPath);
});


// app.commandLine.appendSwitch('inspect', '5858')
if (process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath)) {
    dev = true;
}

// Temporary fix broken high-dpi scale factor on Windows (125% scaling)
// info: https://github.com/electron/electron/issues/9691
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
}

// my application redirect uri
const redirectUri = 'http://localhost:3000/';

// Prepare to filter only the callbacks for my redirectUri
const filter = {
    urls: [redirectUri + '*']
};


function createWindow() {

    autoUpdater.checkForUpdatesAndNotify();
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        show: false
    });

    // and load the index.html of the app.
    let indexPath;
    // if (dev && process.argv.indexOf('--noDevServer') === -1) {
    //     console.log('true');
    //     indexPath = url.format({
    //         protocol: 'http:',
    //         host: 'localhost:3000',
    //         slashes: true
    //     });
    // } else {
    //     indexPath = url.format({
    //         protocol: 'file:',
    //         pathname: path.join(__dirname, 'dist/index.html'),
    //         protocol: 'file:',
    //         slashes: true
    //     });
    // }
    // mainWindow.loadURL(indexPath);
      mainWindow.loadURL(`file://${__dirname}/app.html`);
      // mainWindow.loadURL(`file://${__dirname}/version.html`);

    // Don't show until we are ready and loaded
    mainWindow.once('ready-to-show', async () => {

        //clearing office redirect token
        await localStorage.removeItem('OFFICE_REDIRECT_CODE')

        mainWindow.show();

        // Open the DevTools automatically if developing
        if (dev) {
            mainWindow.webContents.openDevTools();
        }

    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    mainWindow.webContents.on('will-navigate', function (event, newUrl) {
        console.log('will-navigate', newUrl);
        if (newUrl.includes('https://login.microsoftonline.com/common/oauth2')) {
            let child = new BrowserWindow({ parent: mainWindow });
            child.setAlwaysOnTop(true);
            child.loadURL(newUrl);
            event.preventDefault();
            child.once('ready-to-show', () => {
                child.show();
                child.webContents.openDevTools();
            });

            child.webContents.on('will-navigate', function (event, newUrl1) {
                console.log('inside child will-navigate', newUrl1);
            });

            child.webContents.on('will-redirect', async (event, newUrl) => {
                console.log('will-redirect', newUrl);
                if (newUrl.includes('?code=')) {
                    console.log('url found', newUrl.split('/?code=').pop());
                    await localStorage.setItem('OFFICE_REDIRECT_CODE', newUrl.split('/?code=').pop().split('&session_state=')[0])
                    // mainWindow.loadURL(indexPath)
                    event.preventDefault();
                    child.close()
                    mainWindow.reload()
                }
            });
        }
    });
    mainWindow.webContents.openDevTools();
}


// app.on('ready', createWindow);
app.on('ready', function() {
  // createDefaultWindow();
  createWindow();
  autoUpdater.checkForUpdates();
});

ipcMain.on("quitAndInstall", (event, arg) => {
    autoUpdater.quitAndInstall();
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});


// export default class AppUpdater {
//   constructor() {
//     log.transports.file.level = 'info';
//     autoUpdater.logger = log;
//     autoUpdater.checkForUpdatesAndNotify();
//   }
// }

// function createDefaultWindow() {
//   win = new BrowserWindow({width: 900, height: 680});
//   win.loadURL(`file://${__dirname}/index.html`);
//   win.on('closed', () => app.quit());
// return win;
// }

// // when the update is ready, notify the BrowserWindow
// autoUpdater.on('update-downloaded', (info) => {
//   win.webContents.send('updateReady')
// });

// let mainWindow = null;

// if (process.env.NODE_ENV === 'production') {
//   const sourceMapSupport = require('source-map-support');
//   sourceMapSupport.install();
// }

// if (
//   process.env.NODE_ENV === 'development' ||
//   process.env.DEBUG_PROD === 'true'
// ) {
//   require('electron-debug')();
// }

// const installExtensions = async () => {
//   const installer = require('electron-devtools-installer');
//   const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
//   const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

//   return Promise.all(
//     extensions.map(name => installer.default(installer[name], forceDownload))
//   ).catch(console.log);
// };

// /**
//  * Add event listeners...
//  */

// app.on('window-all-closed', () => {
//   // Respect the OSX convention of having the application in memory even
//   // after all windows have been closed
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });

// app.on('ready', async () => {
//   createDefaultWindow();
//   autoUpdater.checkForUpdates();
//   if (
//     process.env.NODE_ENV === 'development' ||
//     process.env.DEBUG_PROD === 'true'
//   ) {
//     await installExtensions();
//   }

//   mainWindow = new BrowserWindow({
//     show: false,
//     width: 1024,
//     height: 728
//   });

//   mainWindow.loadURL(`file://${__dirname}/app.html`);

//   mainWindow.once('ready-to-show', async () => {

//     //clearing office redirect token
//     await localStorage.removeItem('OFFICE_REDIRECT_CODE')

//     mainWindow.show();

//     // Open the DevTools automatically if developing
//     if (dev) {
//         mainWindow.webContents.openDevTools();
//     }

// });

// mainWindow.webContents.on('will-navigate', function (event, newUrl) {
//   console.log('will-navigate', newUrl);
//   if (newUrl.includes('https://login.microsoftonline.com/common/oauth2')) {
//       let child = new BrowserWindow({ parent: mainWindow });
//       child.setAlwaysOnTop(true);
//       child.loadURL(newUrl);
//       event.preventDefault();
//       child.once('ready-to-show', () => {
//           child.show();
//           child.webContents.openDevTools();
//       });

//       child.webContents.on('will-navigate', function (event, newUrl1) {
//           console.log('inside child will-navigate', newUrl1);
//       });

//       child.webContents.on('will-redirect', async (event, newUrl) => {
//           console.log('will-redirect', newUrl);
//           if (newUrl.includes('?code=')) {
//               console.log('url found', newUrl.split('/?code=').pop());
//               await localStorage.setItem('OFFICE_REDIRECT_CODE', newUrl.split('/?code=').pop().split('&session_state=')[0])
//               // mainWindow.loadURL(indexPath)
//               event.preventDefault();
//               child.close()
//               mainWindow.reload()
//           }
//       });
//   }
// });

//   // @TODO: Use 'ready-to-show' event
//   //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
//   mainWindow.webContents.on('did-finish-load', () => {
//     if (!mainWindow) {
//       throw new Error('"mainWindow" is not defined');
//     }
//     if (process.env.START_MINIMIZED) {
//       mainWindow.minimize();
//     } else {
//       mainWindow.show();
//       mainWindow.focus();
//     }
//   });
//   mainWindow.webContents.openDevTools();

//   mainWindow.on('closed', () => {
//     mainWindow = null;
//   });

//   const menuBuilder = new MenuBuilder(mainWindow);
//   menuBuilder.buildMenu();

//   // Remove this if your app does not use auto updates
//   // eslint-disable-next-line
//   new AppUpdater();
// });

// ipcMain.on("quitAndInstall", (event, arg) => {
//   autoUpdater.quitAndInstall();
// })

