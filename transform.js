module.exports = function (file, api) {
    const j = api.jscodeshift;
    const root = j(file.source);

    let hasStyles = false;

    // 1. Rename `const styles = StyleSheet.create(...)` to `const getStyles = () => StyleSheet.create(...)`
    root.find(j.VariableDeclarator, { id: { name: 'styles' } }).forEach(path => {
        if (path.node.init && path.node.init.callee &&
            path.node.init.callee.object && path.node.init.callee.object.name === 'StyleSheet' &&
            path.node.init.callee.property && path.node.init.callee.property.name === 'create') {

            hasStyles = true;

            // Re-assign name from 'styles' to 'getStyles'
            path.node.id = j.identifier('getStyles');

            // Wrap the StyleSheet.create(...) in an arrow function
            path.node.init = j.arrowFunctionExpression([], path.node.init);
        }
    });

    if (!hasStyles) return file.source;

    // Helper to check if a function returns JSX
    const isComponent = (path) => {
        let returnsJSX = false;

        // Block bodies
        j(path).find(j.ReturnStatement).forEach(ret => {
            if (ret.node.argument && (ret.node.argument.type === 'JSXElement' || ret.node.argument.type === 'JSXFragment')) {
                returnsJSX = true;
            }
        });

        // Implicit arrow function returns
        if (path.node.body && (path.node.body.type === 'JSXElement' || path.node.body.type === 'JSXFragment')) {
            returnsJSX = true;
        }

        return returnsJSX;
    };

    const styleDeclaration = j.variableDeclaration('const', [
        j.variableDeclarator(
            j.identifier('styles'),
            j.callExpression(j.identifier('getStyles'), [])
        )
    ]);

    const injectStyles = (path) => {
        const body = path.node.body;

        // If it's a block statement
        if (body.type === 'BlockStatement') {
            let alreadyInjected = false;
            body.body.forEach(stmt => {
                if (stmt.type === 'VariableDeclaration' && stmt.declarations[0].id.name === 'styles') {
                    alreadyInjected = true;
                }
            });

            if (!alreadyInjected) {
                body.body.unshift(styleDeclaration);
            }
        } else if (body.type === 'JSXElement' || body.type === 'JSXFragment') {
            // It's an implicit return arrow function like `() => <View />`
            // Convert to block statement
            path.node.body = j.blockStatement([
                styleDeclaration,
                j.returnStatement(body)
            ]);
        }
    };

    root.find(j.FunctionDeclaration).filter(isComponent).forEach(injectStyles);
    root.find(j.ArrowFunctionExpression).filter(isComponent).forEach(injectStyles);
    root.find(j.FunctionExpression).filter(isComponent).forEach(injectStyles);

    return root.toSource();
};
