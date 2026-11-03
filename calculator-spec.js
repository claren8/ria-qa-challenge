const { Builder, By, until, Key } = require('selenium-webdriver');
const assert = require('assert');

const URL = 'https://www.riamoneytransfer.com/en-cl/';
const XPATH_TASA = "//*[@id='rate-title']/following-sibling::div//span[contains(text(),'HTG')]";

// -------- FUNCIONES ---------
async function leerConversion(driver) {
    const textoTasa = await driver.findElement(By.xpath(XPATH_TASA)).getText();
    const valorTo = await driver.findElement(By.id('amount-to')).getAttribute('value');
    return {
        tasa: parseFloat(textoTasa),
        resultado: Number(valorTo.replace(/,/g, ''))
    };
}

async function esperarConversion(driver, monto) {
    await driver.wait(async () => {
        try {
            const { tasa, resultado } = await leerConversion(driver);
            return Math.abs(resultado - monto * tasa) < 0.05;
        } catch (e) {
            if (e.name === 'StaleElementReferenceError' || e.name === 'NoSuchElementError') return false;
            throw e;
        }
    }, 10000);
}

async function elegirHaitiHtg(driver) {
    const selector = await driver.wait(until.elementLocated(By.css('button[aria-label="Select Destination"]')), 10000);
    await selector.click();
    const haiti = await driver.wait(until.elementLocated(By.xpath("//*[@role='dialog'][@data-state='open']//*[contains(text(),'Haiti')]")), 10000);
    await haiti.click();

    const htg = await driver.wait(async () => {
        const candidatos = await driver.findElements(By.xpath("//*[@role='dialog'][@data-state='open']//*[text()='HTG']"));
        for (const c of candidatos) {
            if (await c.isDisplayed()) return c;
        }
        return false;
    }, 10000);
    await htg.click();
}

// ---------- TESTS ----------


async function test1a(driver) {
    const amountFrom = await driver.wait(until.elementLocated(By.id('amount-from')), 10000);
    await amountFrom.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
    await amountFrom.sendKeys('abc');
    const valor = await amountFrom.getAttribute('value');
    assert.strictEqual(/[a-zA-Z]/.test(valor), false, 'El campo no debería aceptar letras');
}

async function test1b(driver) {
    const amountFrom = await driver.wait(until.elementLocated(By.id('amount-from')), 10000);
    await amountFrom.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
    await amountFrom.sendKeys('11111111');
    const errorMsg = await driver.wait(until.elementLocated(By.id('amount-error')), 5000);
    const textoError = await errorMsg.getText();
    const invalido = await amountFrom.getAttribute('aria-invalid');

    assert.strictEqual(textoError, 'Maximum is 10,000,000 CLP', 'No muestra el error correcto');
    assert.strictEqual(invalido, 'true', 'El campo debería estar marcado como inválido');
}



async function test2(driver) {
    const selector = await driver.wait(until.elementLocated(By.css('button[aria-label="Select Destination"]')), 10000);
    await selector.click();
    const dialogo = await driver.wait(until.elementLocated(By.css('[role="dialog"][data-state="open"]')), 5000);
    await driver.wait(until.elementLocated(By.xpath("//*[@role='dialog'][@data-state='open']//*[contains(text(),'Haiti')]")), 10000);

    const textoModal = await dialogo.getText();

    assert.ok(textoModal.includes('Haiti'),'La lista de los paises no incluye Haiti');

}


async function test3(driver) {
    await elegirHaitiHtg(driver);


    const boton = await driver.wait(until.elementLocated(By.css('button[aria-label="Select Destination"]')), 10000);
    await driver.wait(until.elementTextContains(boton, 'HTG'), 5000);
    const textoBoton = await boton.getText();
    assert.ok(textoBoton.includes('HTG'), 'La opcion seleccionada no coincide con HTG');
}


async function test4(driver) {
    await elegirHaitiHtg(driver);

    // 1. esperar a que la cotización pase a HTG (no hace falta guardar el elemento)
    await driver.wait(until.elementLocated(By.xpath(XPATH_TASA)), 10000);

    // 2. ubicar el campo donde se escribe el monto
    const amountFrom = await driver.wait(until.elementLocated(By.id('amount-from')), 10000);

    // 3. borrar y escribir
    await amountFrom.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
    await amountFrom.sendKeys('25000');

    // 4. esperar a que el resultado cuadre con 25000 x tasa
    await esperarConversion(driver, 25000);

    // 5. volver a leer afuera de la espera y afirmar
    const { tasa, resultado } = await leerConversion(driver);
    console.log('resultado:', resultado, '| tasa:', tasa);
    assert.ok(
        Math.abs(resultado - 25000 * tasa) < 0.05,
        'El resultado mostrado no cuadra con 25000 x la tasa mostrada'
    );
}


async function test5(driver) {
    await elegirHaitiHtg(driver);
    await driver.wait(until.elementLocated(By.xpath(XPATH_TASA)), 10000);

    // primer monto
    let amountFrom = await driver.wait(until.elementLocated(By.id('amount-from')), 10000);
    await amountFrom.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
    await amountFrom.sendKeys('25000');
    await esperarConversion(driver, 25000);
    const primero = await leerConversion(driver);

    // segundo monto: ubicar el campo DE NUEVO, borrar, escribir 50000,
    let amountFrom2 = await driver.wait(until.elementLocated(By.id('amount-from')), 10000);
    await amountFrom2.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
    await amountFrom2.sendKeys('50000');
    
    // esperar la conversión y guardar la lectura en una variable 'segundo'
    await esperarConversion(driver, 50000);
    const segundo = await leerConversion(driver);
    // (escríbelo tú, es el mismo patrón de arriba)

    // assert 1: segundo.resultado es distinto de primero.resultado
    assert.notStrictEqual(segundo.resultado, primero.resultado, 'Efectivamente el resultado no cambió')
    // assert 2: segundo.resultado cuadra con 50000 x segundo.tasa
    assert.ok(Math.abs(segundo.resultado - 50000 * segundo.tasa) < 0.05, 'El resultado mostrado no cuadra con 50000 x la tasa mostrada')
}



// ---------- CORREDOR ----------

async function correrTest(nombre, fn) {
    const driver = await new Builder().forBrowser('chrome').build();
    try {
        await driver.get(URL);
        await fn(driver);
        console.log('✅ ' + nombre + ' OK');
    } catch (e) {
        console.log('❌ ' + nombre + ' FALLÓ: ' + e.stack);
    } finally {
        await driver.quit();
    }
}

(async () => {
    await correrTest('Test 1a: el campo bloquea letras', test1a);
    await correrTest('Test 1b: monto sobre el máximo muestra error', test1b);
    await correrTest('Test 2: el selector de destino abre y la lista incluye Haiti', test2);
    await correrTest('Test 3: el selector de destino abre, selecciona Haiti, selecciona HTG y luego cierra el modal', test3);
    await correrTest('Test 4: La multiplicacion de la tasa mostrada por el monto ingresado coincide con el mostrado por la calculadora', test4);
    await correrTest('Test 5: El resultado cambia al ingresar montos distintos', test5);



})();