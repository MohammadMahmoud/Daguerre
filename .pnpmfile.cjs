// TypeScript 7 (our `tsc`) has no JavaScript API, so typescript-eslint parses with TypeScript 6.
const TS6 = 'npm:@typescript/typescript6@^6.0.2';

module.exports = {
  hooks: {
    readPackage(pkg) {
      const eslintTs =
        pkg.name === 'typescript-eslint' ||
        pkg.name === 'ts-api-utils' ||
        pkg.name?.startsWith('@typescript-eslint/');
      if (eslintTs && pkg.peerDependencies?.typescript) {
        delete pkg.peerDependencies.typescript;
        pkg.dependencies = { ...pkg.dependencies, typescript: TS6 };
      }
      return pkg;
    },
  },
};
