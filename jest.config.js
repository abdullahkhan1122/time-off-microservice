module.exports = {
  moduleFileExtensions: ["js", "json"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.js$",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  collectCoverageFrom: ["src/**/*.js", "!src/main.js"],
  coverageProvider: "v8",
  coverageDirectory: "coverage",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test/setup.js"]
};
