const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const path = require("path");
const serialport = require("serialport");
const { autoUpdater } = require("electron-updater");

let ports = [];
let mainWindow = null;

app.whenReady().then(() => {
  createWindow();

  registerIpcEvent();

  createMenu();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function checkForUpdates() {
  autoUpdater.setFeedURL("http://localhost:7777/download");
  autoUpdater.checkForUpdates();

  autoUpdater.on("update-available", function (info) {
    dialog.showMessageBox({title: '更新', message: '有更新可用'});
  });

  autoUpdater.on('update-not-available', function (info) {
    dialog.showMessageBox({title: '无更新', message: '无更新可用'});
  })

  autoUpdater.on("update-downloaded", (info) => {
    dialog.showMessageBox(
      {
        // icon: __static + "/favicon.png",
        type: "info",
        title: "软件更新",
        message: `已更新到最新版本（${info.version}）请重启应用。`,
        // detail: detail,
        buttons: ["确定"],
      },
      (idx) => {
        // 点击确定的时候执行更新
        if (idx === 0) {
          autoUpdater.quitAndInstall();
        }
      }
    );
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadFile("index.html");
}

function createMenu() {
  // main
  const template = [
    {
      label: "设置端口",
      click: function () {
        mainWindow.webContents.send("show-port-view");
      },
    },
    {
      label: "调试",
      click: function (item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
    },
    {
      label: "更新",
      click: function (item, focusedWindow) {
        checkForUpdates();
      },
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function registerIpcEvent() {
  serialport.list().then((ports) => {
    mainWindow.send("send-port-info", ports);
  });

  app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
  });

  ipcMain.on("close-serialport", (event, args) => {
    const currentPort = ports.find((i) => i.path === args.name);
    currentPort.isOpen && currentPort.close();

    if (!currentPort.isOpen) {
      event.reply("close-serialport", { name: args.name });
    }
  });

  ipcMain.on("open-serialport", (event, args) => {
    const port = new serialport(
      args.name,
      {
        baudRate: +args.baudRate,
      },
      (err) => {
        console.log(err);
        if (err) {
          event.reply("open-serialport", {
            hasError: true,
            ...args,
            message: err,
          });
        } else {
          event.reply("open-serialport", args);
          ports.push(port);
        }
      }
    );

    let receiveIndex = 0;
    let receiveData = [];
    port.on("data", (data) => {
      receiveIndex++;
      receiveData.push(receiveIndex + ".receive: " + data);
      console.log(receiveIndex + ".receive: " + data);

      event.sender.send("send-data", `${data}`);
    });

    let index = 0;

    port.on("open", () => {
      setInterval(() => {
        index++;
        // port.write(index + ": hello world");
        port.write(receiveData.length.toString());
      }, 1000);
    });

    console.log(args);
  });
}
