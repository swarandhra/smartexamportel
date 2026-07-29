/**
 * javaTranspiler.ts - A lightweight regex-based transpiler to translate
 * Java code classes into browser-executable JavaScript blocks for real-time evaluations.
 */

export function transpileJavaToJS(javaCode: string): string {
  let js = javaCode;

  // 1. Remove comments
  js = js.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

  // 2. Remove access modifiers from classes
  js = js.replace(/\bpublic\s+class\s+(\w+)/g, 'class $1');
  js = js.replace(/\bclass\s+(\w+)/g, 'class $1');

  // 3. Remove access modifiers on fields / methods (public, private, protected, final)
  js = js.replace(/\b(public|private|protected|final)\b/g, '');

  // 4. Translate method signatures
  // Matches "static int calculateTotal(int mark1...)" -> "static calculateTotal(mark1...)"
  // Matches "int[] moveZeroes(int[] arr)" -> "moveZeroes(arr)"
  js = js.replace(/\b(static\s+)?(int|double|float|boolean|char|String|void|int\[\]|String\[\])\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_match, isStatic, _retType, methodName, params) => {
    // Clean parameter lists: "int mark1, int mark2" -> "mark1, mark2"
    const cleanedParams = params.replace(/\b(int|double|float|boolean|char|String|int\[\]|String\[\])\s+(\w+)/g, '$2');
    return `${isStatic || ''}${methodName}(${cleanedParams}) {`;
  });

  // 5. Transpile array variable instantiations
  // e.g. "int[] arr = {2, 4, 6};" -> "let arr = [2, 4, 6];"
  js = js.replace(/\b(int|double|float|boolean|char|String)\[\]\s+(\w+)\s*=\s*\{([^}]+)\}/g, 'let $2 = [$3]');

  // 6. Transpile regular variable declarations
  // e.g. "int sum = 0;" -> "let sum = 0;"
  js = js.replace(/\b(int|double|float|boolean|char|String)\b(?!\s*\()/g, 'let');

  // 7. Transpile enhanced for loops
  // e.g. "for(int x : arr)" -> "for (let x of arr)"
  js = js.replace(/for\s*\(\s*let\s+(\w+)\s*:\s*(\w+)\s*\)/g, 'for (let $1 of $2)');
  js = js.replace(/for\s*\(\s*(\w+)\s*:\s*(\w+)\s*\)/g, 'for (let $1 of $2)');

  // 8. Transpile arrays inline declarations
  // e.g. "new int[]{2, 4, 6}" -> "[2, 4, 6]"
  js = js.replace(/new\s+(int|double|float|boolean|char|String)\[\]\s*\{([^}]+)\}/g, '[$2]');

  // 9. Transpile Integer constants
  js = js.replace(/Integer\.MIN_VALUE/g, 'Number.MIN_SAFE_INTEGER');
  js = js.replace(/Integer\.MAX_VALUE/g, 'Number.MAX_SAFE_INTEGER');

  // 10. Transpile print outputs
  js = js.replace(/System\.out\.println/g, 'console.log');
  js = js.replace(/System\.out\.print/g, 'console.log');

  return js;
}
