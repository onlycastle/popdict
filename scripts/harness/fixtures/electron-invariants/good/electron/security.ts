// fixture
contents.setWindowOpenHandler(() => ({ action: 'deny' }))
contents.on('will-navigate', () => {})
