/**
 * javaTranspiler.ts - Robust Java-to-JavaScript transpiler for browser sandbox execution.
 * Handles common patterns in student Java code for coding questions.
 */

export function transpileJavaToJS(javaCode: string): string {
  let js = javaCode;

  // 1. Remove block comments
  js = js.replace(/\/\*[\s\S]*?\*\//g, '');

  // 2. Remove line comments (but preserve the line)
  js = js.replace(/\/\/[^\n]*/g, '');

  // 3. Remove class wrapper — extract the body content
  // Handles: public class Solution { ... }
  js = js.replace(/^\s*(public\s+)?class\s+\w+\s*\{([\s\S]*)\}\s*$/m, (_, __, body) => body);

  // 4. Remove access modifiers
  js = js.replace(/\b(public|private|protected|final|static)\s+/g, '');

  // 5. Remove Java type annotations on method parameters and convert method declarations to JS functions
  js = js.replace(/\b(int|long|double|float|boolean|char|String|Integer|Long|Double|Float|Boolean|void)\s*(?:\[\s*\])?\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_match, _returnType, methodName, params) => {
    // Clean params: String str -> str, int[] arr -> arr
    const cleanParams = params.split(',')
      .map((p: string) => {
        const parts = p.trim().split(/\s+/);
        return parts[parts.length - 1];
      })
      .filter(Boolean)
      .join(', ');
    return `function ${methodName}(${cleanParams}) {`;
  });

  // 7. Variable declarations: "int x = 0;" -> "let x = 0;"
  // Must not match inside words (e.g. "integer")
  js = js.replace(/\b(int|long|double|float|boolean|char|String|Integer|Long|Double|Float|Boolean)\s*(?:\[\s*\])?\s+(\w+)/g, 'let $2');

  // 8. Array initializer: "new int[]{1,2,3}" -> "[1,2,3]"
  js = js.replace(/new\s+\w+\s*\[\s*\]\s*\{([^}]*)\}/g, '[$1]');

  // 9. Array size init: "new int[n]" -> "new Array(n).fill(0)"
  js = js.replace(/new\s+(?:int|double|float|boolean|char|String)\s*\[([^\]]+)\]/g, 'new Array($1).fill(0)');

  // 10. Enhanced for loop: "for (x : arr)" -> "for (let x of arr)"
  js = js.replace(/for\s*\(\s*(?:let\s+)?(\w+)\s*:\s*(\w+)\s*\)/g, 'for (let $1 of $2)');

  // 11. Integer constants
  js = js.replace(/Integer\.MIN_VALUE/g, 'Number.MIN_SAFE_INTEGER');
  js = js.replace(/Integer\.MAX_VALUE/g, 'Number.MAX_SAFE_INTEGER');
  js = js.replace(/Integer\.parseInt\s*\(/g, 'parseInt(');
  js = js.replace(/Math\.abs\s*\(/g, 'Math.abs(');
  js = js.replace(/Math\.max\s*\(/g, 'Math.max(');
  js = js.replace(/Math\.min\s*\(/g, 'Math.min(');

  // 12. System.out.print
  js = js.replace(/System\.out\.println\s*\(/g, 'console.log(');
  js = js.replace(/System\.out\.print\s*\(/g, 'console.log(');

  // 13. String.length() -> .length (JS property not method)
  js = js.replace(/\.length\(\)/g, '.length');

  // 14. arr.length() -> arr.length
  // (already handled above)

  // 15. toString() removal
  js = js.replace(/\.toString\(\)/g, '.toString()'); // keep as-is

  // 16. toCharArray() conversion -> .split('')
  js = js.replace(/\.toCharArray\s*\(\s*\)/g, ".split('')");

  // 17. new String(charArray) conversion -> charArray.join('')
  js = js.replace(/new\s+String\s*\(\s*(\w+)\s*\)/g, "$1.join('')");

  return js.trim();
}

/**
 * Extract the first non-control-flow function name from transpiled JS.
 */
export function extractMethodName(transpiledCode: string): string {
  const controlFlow = ['if', 'for', 'while', 'else', 'switch', 'catch', 'try', 'do', 'return'];
  const matches = [...transpiledCode.matchAll(/function\s+(\w+)\s*\(/g)];
  for (const m of matches) {
    if (!controlFlow.includes(m[1])) {
      return m[1];
    }
  }
  return '';
}

/**
 * Run a single test case against the transpiled code.
 * Uses Function constructor to run in isolated scope.
 */
export function runTestCase(transpiledCode: string, methodName: string, input: string): { actual: string; error: string | null } {
  try {
    // Clean Java-style inputs (e.g. new int[]{1, 2, 3} -> [1, 2, 3])
    let cleanInput = input.trim();
    cleanInput = cleanInput.replace(/new\s+\w+\s*\[\s*\]\s*\{([^}]*)\}/g, '[$1]');

    // Wrap everything in a self-contained function scope
    const wrapper = `
      "use strict";
      ${transpiledCode}
      return JSON.stringify(${methodName}(${cleanInput}));
    `;
    // eslint-disable-next-line no-new-func
    const runner = new Function(wrapper);
    const result = runner();
    return { actual: String(result ?? ''), error: null };
  } catch (e: any) {
    return { actual: '', error: e.message || 'Unknown error' };
  }
}
