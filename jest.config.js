module.exports = {
  moduleFileExtensions: ["js", "json"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.js$",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/main.js",
    "!src/app.module.js",
    "!src/**/*.module.js",
    "!src/**/*.entity.js",
    "!src/**/dto/**/*.js"
  ],
  coverageProvider: "v8",
  coverageDirectory: "coverage",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test/setup.js"]
};
