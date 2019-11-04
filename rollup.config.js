import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
export default {
	input: 'main.js',
	output: [
		{
			file: 'dist/COStreamJS.js',
			format: 'iife',
			name: 'COStreamJS'
		},
		{
			file: 'dist/costreamjs-cli.js',
			format: 'iife',
            name: 'COStreamJS',
            banner:'#!/usr/bin/env node'
		}
	],
	plugins: [ resolve(), commonjs() ],
	external: [ 'fs' ]
};
