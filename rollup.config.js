import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
export default {
    input: 'main.js',
    output: {
        file: 'dist/COStreamJS.js',
        format: 'iife',
        name: 'COStreamJS'
    },
    plugins: [
        resolve(),
        commonjs(),
    ],
    external: ['fs']
}  