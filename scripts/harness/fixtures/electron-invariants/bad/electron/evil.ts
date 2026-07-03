// fixture: forbidden regression
new BrowserWindow({ webPreferences: { contextIsolation: false } })
