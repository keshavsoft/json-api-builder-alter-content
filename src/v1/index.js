import fs from "node:fs";
import path from "node:path";
import startFunc from "json-traversal-core";
import { generate } from "astring";


function formatJavaScript(source) {
    return source
        .replace(/import\s+\{([^}]+)\}\s+from/g, (_, names) => `import { ${names.trim()} } from`)
        .replace(/;\n(?=import\b)/g, ";\n")
        .replace(/;\n(?=(?:const|let|var)\b)/g, ";\n\n")
        .replace(/;\n(?=export\b)/g, ";\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd() + "\n";
}

function resolvePaths(options = {}) {
    const clientRoot = path.resolve(options.clientRoot ?? process.cwd());
    const inputRoot = path.resolve(options.inputRoot ?? path.join(clientRoot, "input"));
    const sourceRoot = path.resolve(options.sourceRoot ?? path.join(inputRoot, "source-of-truth"));
    const outputRoot = path.resolve(options.outputRoot ?? path.join(clientRoot, "output"));
    const treePath = path.resolve(options.treePath ?? path.join(sourceRoot, "tree.json"));

    if (!fs.existsSync(treePath)) {
        throw new Error(`Tree definition not found: ${treePath}`);
    }

    const tree = JSON.parse(fs.readFileSync(treePath, "utf8"));
    return { clientRoot, inputRoot, sourceRoot, outputRoot, tree, treePath };
}

function targetPath(outputRoot, key, parentPath) {
    const parentParts = parentPath === "" ? [] : parentPath.split(".");
    return path.join(outputRoot, ...parentParts, key);
}

function literal(value) {
    return { type: "Literal", value, raw: JSON.stringify(value) };
}

function identifier(name) {
    return { type: "Identifier", name };
}

function routeImport(localName, importPath) {
    return {
        type: "ImportDeclaration",
        specifiers: [{
            type: "ImportDefaultSpecifier",
            local: identifier(localName)
        }],
        source: literal(importPath)
    };
}

function routeCall(localName, routePath) {
    return {
        type: "ExpressionStatement",
        expression: {
            type: "CallExpression",
            callee: {
                type: "MemberExpression",
                computed: false,
                object: identifier("app"),
                property: identifier("route")
            },
            arguments: [literal(routePath), identifier(localName)],
            optional: false
        }
    };
}

function childRouteEntries(folderNode) {
    return Object.entries(folderNode).filter(([name, value]) =>
        name !== "routes.js" &&
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value["routes.js"] === "string"
    );
}

function toVariableName(folderName) {
    const normalized = folderName.replace(/[^a-zA-Z0-9]+(.)?/g, (_, next) => next ? next.toUpperCase() : "");
    return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}Routes`;
}

function toRoutePath(folderName) {
    return `/${folderName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

export function hookRoutes(options = {}) {
    const { sourceRoot, outputRoot, tree } = resolvePaths(options);
    let hookedFiles = 0;

    startFunc(tree, (folderName, folderNode, parentPath) => {
        if (folderNode === null || typeof folderNode !== "object" || Array.isArray(folderNode)) {
            return;
        }

        const entries = childRouteEntries(folderNode);
        if (entries.length === 0 || typeof folderNode["routes.js"] !== "string") {
            return;
        }

        const parentFile = targetPath(outputRoot, "routes.js", parentPath ? `${parentPath}.${folderName}` : folderName);
        if (!fs.existsSync(parentFile)) {
            throw new Error(`Parent routes.js not found. Run insert-content first: ${parentFile}`);
        }

        // Read the generated template before composing its AST, so this stage only
        // hooks files that were actually created by the preceding template stage.
        const existingSource = fs.readFileSync(parentFile, "utf8");
        if (!existingSource.includes("export default app")) {
            throw new Error(`Unexpected routes.js template; default app export missing: ${parentFile}`);
        }

        const definitionPath = path.resolve(sourceRoot, folderNode["routes.js"]);
        const ast = JSON.parse(fs.readFileSync(definitionPath, "utf8"));

        for (const [childName] of entries) {
            const localName = toVariableName(childName);
            const importPath = `./${childName}/routes.js`;
            const routePath = toRoutePath(childName);

            ast.body = ast.body.filter(node =>
                !(node.type === "ImportDeclaration" &&
                  node.source?.value === importPath)
            );
            const importNode = routeImport(localName, importPath);
            const firstNonImport = ast.body.findIndex(node => node.type !== "ImportDeclaration");
            ast.body.splice(firstNonImport < 0 ? ast.body.length : firstNonImport, 0, importNode);
        }

        const routeStatements = entries.map(([childName]) =>
            routeCall(toVariableName(childName), toRoutePath(childName))
        );

        const exportIndex = ast.body.findIndex(node => node.type === "ExportDefaultDeclaration");
        if (exportIndex < 0) {
            throw new Error(`Default app export not found in AST definition: ${definitionPath}`);
        }

        ast.body = ast.body.filter(node =>
            !(node.type === "ExpressionStatement" &&
              node.expression?.type === "CallExpression" &&
              node.expression.callee?.type === "MemberExpression" &&
              node.expression.callee.object?.name === "app" &&
              node.expression.callee.property?.name === "route")
        );
        const refreshedExportIndex = ast.body.findIndex(node => node.type === "ExportDefaultDeclaration");
        ast.body.splice(refreshedExportIndex, 0, ...routeStatements);

        fs.writeFileSync(parentFile, formatJavaScript(generate(ast)), "utf8");
        hookedFiles += 1;
    });

    return { outputRoot, hookedFiles };
}
