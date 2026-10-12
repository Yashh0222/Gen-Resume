const { join } = require("path");

/**
 * Keep the downloaded Chrome inside the project folder so it exists at
 * runtime on hosts like Render (which do not persist $HOME/.cache/puppeteer
 * between the build and the running service).
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    cacheDirectory: join(__dirname, ".cache", "puppeteer")
};
