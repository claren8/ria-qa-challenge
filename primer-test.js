const { Builder } = require('selenium-webdriver');

(async () => {
    const driver = await new Builder().forBrowser('chrome').build();
    try {
        await driver.get('https://www.riamoneytransfer.com/');
        const title = await driver.getTitle();
        console.log('Titulo de la página', title);

    } finally {
        await driver.quit();
    }
})();