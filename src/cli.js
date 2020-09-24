const program = require("commander");
const fs = require("fs");
const glob = require("glob");
const path = require("path");
const { exec } = require("child_process");

const convert = require("./convert.js");
const detectJsx = require("./detect-jsx.js");
const version = require("../package.json").version;

const cli = argv => {
  program
    .version(version)
    .option(
      "--inline-utility-types",
      "inline utility types when possible, defaults to 'false'"
    )
    .option("--prettier", "use prettier for formatting")
    .option(
      "--semi",
      "add semi-colons, defaults to 'false' (depends on --prettier)"
    )
    .option(
      "--single-quote",
      "use single quotes instead of double quotes, defaults to 'false' (depends on --prettier)"
    )
    .option(
      "--tab-width [width]",
      "size of tabs (depends on --prettier)",
      /2|4/,
      4
    )
    .option(
      "--trailing-comma [all|es5|none]",
      "where to put trailing commas (depends on --prettier)",
      /all|es5|none/,
      "all"
    )
    .option(
      "--bracket-spacing",
      "put spaces between braces and contents, defaults to 'false' (depends on --prettier)"
    )
    .option(
      "--arrow-parens [avoid|always]",
      "arrow function param list parens (depends on --prettier)",
      /avoid|always/,
      "avoid"
    )
    .option("--print-width [width]", "line width (depends on --prettier)", 80)
    .option("--write", "write output to disk instead of STDOUT")
    .option("--delete-source", "delete the source file");

  program.parse(argv);

  if (program.args.length === 0) {
    program.outputHelp();
    process.exit(1);
  }

  const options = {
    inlineUtilityTypes: Boolean(program.inlineUtilityTypes),
    prettier: program.prettier,
    semi: Boolean(program.semi),
    singleQuote: Boolean(program.singleQuote),
    tabWidth: parseInt(program.tabWidth),
    trailingComma: program.trailingComma,
    bracketSpacing: Boolean(program.bracketSpacing),
    arrowParens: program.arrowParens,
    printWidth: parseInt(program.printWidth)
  };

  const basePath = __dirname; //path.resolve(__dirname, '../../appliedblockchain/strading-monorepo/packages/')
  console.log("------ args", program.args, basePath);

  const files = new Set();
  for (const arg of program.args) {
    for (const file of glob.sync(`${arg}/**/*.js`, { cwd: basePath })) {
      if (file.includes("node_modules")) {
        continue;
      }
      files.add(path.join(basePath, file));
    }
  }

  console.log("------ files", files);

  for (const file of files) {
    const inFile = file;
    const inCode = fs.readFileSync(inFile, "utf-8");

    try {
      const outCode = convert(inCode, options);

      if (program.write) {
        const extension = detectJsx(inCode) ? ".tsx" : ".ts";
        const outFile = file.replace(/\.jsx?$/, extension);
        fs.writeFileSync(outFile, outCode);
      } else {
        console.log(outCode);
      }

      if (program.deleteSource) {
        fs.unlinkSync(inFile);
      }
    } catch (e) {
      console.error(`error processing ${inFile}`);
      console.error(e);
    }
  }

  console.log('------- Going to execute "tsc"');
  const typesToInstall = new Set();
  for (const arg of program.args) {
    const pTsc = exec(
      `./node_modules/.bin/tsc --noEmit`,
      { cwd: path.join(basePath, arg) },
      (err, stdout, stderr) => {
        console.log("___callback");
        if (err) {
          //some err occurred
          console.error(err);
        } else {
          // the *entire* stdout and stderr (buffered)
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);
        }

        console.log("----- install", typesToInstall);
        for (const pkg of typesToInstall) {
          const pNpmInstall = exec(`npm i -DE ${pkg}`, {
            cwd: path.join(basePath, arg)
          });
          pNpmInstall.stdout.on("data", data => console.log(data));
        }

        /* 
      // TODO: If there are flow to ts errors, do not run
      console.log('----- ts migrate', path.join(basePath, arg))
      const pTsMigrate = exec(`./node_modules/.bin/ts-migrate -- rename ${path.join(basePath, arg)}`)
      pTsMigrate.stdout.on('data', data => console.log(data));
      */
      }
    );

    pTsc.stdout.on("data", data => {
      console.log(data);
      if (data.includes("`npm install ")) {
        const match = data.match(/\`npm install ([a-z\/@]+)\`/);
        if (match && match.length) {
          //console.log('----- match[1]', match[1]);
          typesToInstall.add(match[1]);
        }
      }
    });

    pTsc.stderr.on("data", data => console.error(data));

    pTsc.on("close", code => console.log(`tsc exited with code ${code}`));
  }
};

module.exports = cli;
