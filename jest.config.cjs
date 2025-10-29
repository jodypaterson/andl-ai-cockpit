/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/tests'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: '<rootDir>/tsconfig.json',
				diagnostics: false
			}
		]
	},
	extensionsToTreatAsEsm: ['.ts', '.tsx'],
	moduleNameMapper: {
		// Allow TypeScript source imports that end with .js (NodeNext style)
		'^(\\.{1,2}/.*)\\.js$': '$1'
	},
	setupFilesAfterEnv: [],
	testPathIgnorePatterns: ['/node_modules/', '/dist/']
};
