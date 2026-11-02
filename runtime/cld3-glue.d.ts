/**
 * Types for the Emscripten module factory in cld3-glue.js (cld3-asm 4.0.0's browser glue, converted to ESM; see
 * NOTICE.md). Only the members src/cld3-pack.ts uses are declared. The factory returns a self-resolving thenable,
 * which is why cld3-pack.ts never awaits it directly.
 *
 * VERIFIED: `tsc -p tsconfig.json` type-checks src/cld3-pack.ts against these declarations.
 */
export interface Cld3EmscriptenModule {
  cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: number[]) => number;
  allocateUTF8(text: string): number;
  UTF8ToString(pointer: number): string;
  getValue(pointer: number, type: 'i8' | 'i32' | 'float' | '*'): number;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
}
export interface Cld3ModuleOptions {
  wasmBinary: Uint8Array;
  onRuntimeInitialized(): void;
  onAbort(reason: unknown): void;
}
declare const createModule: (options: Cld3ModuleOptions) => Cld3EmscriptenModule;
export default createModule;
