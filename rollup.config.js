import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
export default {
    input: 'main.js',
    output: {
        file: 'dist/global.js',
        format: 'iife',
        name: 'bundle'
    },
    plugins: [
        resolve(),
        commonjs(),
    ],
    external: ['fs']
}  