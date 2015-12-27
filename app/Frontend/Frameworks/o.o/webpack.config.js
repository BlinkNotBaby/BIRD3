var webpack = require("webpack");
module.exports = {
    entry: "./main",
    output: {
        path: "./",
        filename: "o.o.js"
    },
    module: {
        loaders: [
            { test: /\.json$/, loader: "json" }
        ]
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
                properties: true,
                sequences: true,
                dead_code: true,
                conditionals: true,
                comparisons: true,
                evaluate: true,
                booleans: true,
                unused: true,
                loops: true,
                hoist_funs: true,
                cascade: true,
                if_return: true,
                join_vars: true,
                //drop_console: true,
                drop_debugger: true,
                unsafe: true,
                hoist_vars: true,
                negate_iife: true,
                side_effects: false
            },
            mangle: {
                toplevel: true,
                sort: true,
                eval: true,
                properties: true
            },
            output: {
                space_colon: false,
                comments: function(node, comment) {
                    var text = comment.value;
                    var type = comment.type;
                    if (type == "comment2") {
                        // multiline comment
                        return /@copyright/i.test(text);
                    }
                }
            }
        })
    ]
}
