import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts", "mjs"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j|mj)s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: "es2021",
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: [],
  testEnvironment: "node",
  passWithNoTests: true,
  globalSetup: "<rootDir>/test/setup.ts",
  globalTeardown: "<rootDir>/test/teardown.ts",
  setupFiles: ["<rootDir>/test/env-setup.ts"],
};

export default config;
