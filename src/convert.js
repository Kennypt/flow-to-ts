const { parse } = require("@babel/parser");
const traverse = require("../babel-traverse/lib/index.js").default;
const generate = require("../babel-generator/lib/index.js").default;
const prettier = require("prettier/standalone.js");
const plugins = [require("prettier/parser-typescript.js")];

const transform = require("./transform.js");

const r1 = /^(let|var|const) +([a-zA-Z_$][a-zA-Z0-9_$]*) +\= +(require)\((('|")[a-zA-Z0-9-_.\/@]+('|"))\)/gm;
const r2 = /^(let|var|const) +([a-zA-Z_$][a-zA-Z0-9_$]*) +\= +(require)\((('|")[a-zA-Z0-9-_.\/@]+('|"))\)\.([a-zA-Z][a-zA-Z0-9]+)/gm;
const r3 = /^(let|var|const) +(\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}) +\= +(require)\((('|")[a-zA-Z0-9-_.\/@]+('|"))\)/gm;
const e1 = /^module\.exports\s\=/gm;

const parseOptions = {
  sourceType: "module",
  plugins: [
    // enable jsx and flow syntax
    "jsx",
    "flow",
    "flowComments",

    // handle esnext syntax
    "classProperties",
    "objectRestSpread",
    "dynamicImport",
    "optionalChaining",
    "nullishCoalescingOperator"
  ]
};

const convert = (flowCode, options) => {
  const ast = parse(flowCode, parseOptions);

  const comments = {
    startLine: {},
    endLine: {}
  };
  for (const comment of ast.comments) {
    comments.startLine[comment.loc.start.line] = comment;
    comments.endLine[comment.loc.end.line] = comment;
  }

  // apply our transforms, traverse mutates the ast
  const state = {
    usedUtilityTypes: new Set(),
    options: Object.assign({ inlineUtilityTypes: false }, options),
    comments
  };
  traverse(ast, transform, null, state);

  if (options && options.debug) {
    console.log(JSON.stringify(ast, null, 4));
  }

  // we pass flowCode so that generate can compute source maps
  // if we ever decide to
  let tsCode = generate(ast, flowCode)
    .code.replace(r3, `import { $3 } from $5`)
    .replace(r2, `import { $7 as $2 } from $4`)
    .replace(r1, `import $2 from $4`)
    .replace(e1, `export default`);

  for (let i = 0; i < state.trailingLines; i++) {
    tsCode += "\n";
  }

  if (options && options.prettier) {
    const prettierOptions = {
      parser: "typescript",
      plugins,
      semi: options.semi,
      singleQuote: options.singleQuote,
      tabWidth: options.tabWidth,
      trailingComma: options.trailingComma,
      bracketSpacing: options.bracketSpacing,
      arrowParens: options.arrowParens,
      printWidth: options.printWidth
    };
    return prettier.format(tsCode, prettierOptions).trim();
  } else {
    return tsCode;
  }
};

module.exports = convert;
module.exports.parseOptions = parseOptions;
