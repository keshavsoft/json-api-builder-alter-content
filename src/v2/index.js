import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import startFunc from "json-traversal-core";
import { generate } from "astring";

const snippetsDir = fileURLToPath(new URL("./templates/snippets", import.meta.url));
const importSnippetPath = path.join(snippetsDir, "route-import.json");
const mountSnippetPath = path.join(snippetsDir, "route-mount.json");

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

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
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
    const importSnippetTemplate = JSON.parse(fs.readFileSync(importSnippetPath, "utf8"));
    const mountSnippetTemplate = JSON.parse(fs.readFileSync(mountSnippetPath, "utf8"));
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

        const definitionPath = path.resolve(sourceRoot, folderNode["routes.js"]);
        const ast = JSON.parse(fs.readFileSync(definitionPath, "utf8"));

        // 1. Inject import AST snippets for each child route
        for (const [childName] of entries) {
            const localName = toVariableName(childName);
            const importPath = `./${childName}/routes.js`;

            ast.body = ast.body.filter(node =>
                !(node.type === "ImportDeclaration" && node.source?.value === importPath)
            );

            const importNode = deepClone(importSnippetTemplate);
            importNode.specifiers[0].local.name = localName;
            importNode.source.value = importPath;
            importNode.source.raw = JSON.stringify(importPath);

            const firstNonImport = ast.body.findIndex(node => node.type !== "ImportDeclaration");
            ast.body.splice(firstNonImport < 0 ? ast.body.length : firstNonImport, 0, importNode);
        }

        // 2. Inject route mount AST snippets for each child route
        const routeStatements = entries.map(([childName]) => {
            const localName = toVariableName(childName);
            const routePath = toRoutePath(childName);

            const mountNode = deepClone(mountSnippetTemplate);
            mountNode.expression.arguments[0].value = routePath;
            mountNode.expression.arguments[0].raw = JSON.stringify(routePath);
            mountNode.expression.arguments[1].name = localName;
            return mountNode;
        });

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

        // 3. Serialize AST directly to JavaScript via astring
        fs.writeFileSync(parentFile, generate(ast), "utf8");
        hookedFiles += 1;
    });

    return { outputRoot, hookedFiles };
}

export default { hookRoutes };
