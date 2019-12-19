import { COStreamJS } from "../FrontEnd/global"

const handle_options = { main: () => {} };
const Usage = ` 
  Version ${COStreamJS.version}
  Usage: COStream  [options] [file]

  Parses <file> as a COStream program, reporting syntax and type errors, and writes paralleled program out to <file>. If <file> is null, uses stdin and stdout.
`;

(function handleOptions_Main() {
	if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
		const fs = require('fs');
		const argv = require('yargs').usage(Usage).option({
			j: { alias: 'nCpucore', type: 'number', default: 4},
			w: { alias: 'nowarning' },
            o: { alias: 'output', describe: '设置输出路径, 默认为 dist/filename' },
			v: { alias: 'version' }
		}).argv;

		handle_options.main = function commonjsMain(args) {
			console.log(`控制台参数:\n`,argv);
			if (!argv._[0]) {
                require('yargs').showHelp();
				process.exit(1);
			}
			if (argv.v) {
				console.log(`COStreamJS Version: ${COStreamJS.version}`);
				process.exit(1);
			}

			const source_path = require('path').normalize(argv._[0]);
			const source_content = fs.readFileSync(source_path, 'utf8');
			const source_filename = source_path.split('/').pop().split('.')[0];
			console.log(`输入文件信息:\n`, source_path, source_filename);

			const removeLastChar = (s) => (s[s.length - 1] === '/' ? s.slice(0, -1) : s); //移除路径最后的一个'/'
			/** 设置输出文件夹的路径 */
            const outDir = (argv.o && removeLastChar(argv.o)) || `./dist/${source_filename}`;
            COStreamJS.outDir = outDir;

            COStreamJS.main(source_content, argv.j || 4); //执行编译
            if(fs.existsSync(outDir)){
                require('child_process').execSync(`rm -rf ${outDir}/*`)
            }else{
                fs.mkdirSync(outDir);
			}
			// 拷贝基础库文件, 避开 Eigen 库文件(使用 rsync 来实现这一功能, 而非 cp 指令)
			const libDir = require('path').resolve(__dirname, "../lib")
			require('child_process').exec(`rsync -a --exclude Eigen ${libDir}/* ${outDir}`, error => 
				error && console.error(`拷贝库文件出错: ${error}`)
			);
			// 根据情况决定是否拷贝矩阵库文件
			if(COStreamJS.plugins.matrix){
				require('child_process').exec(`rsync -a ${libDir}/Eigen ${outDir}`, error =>
					error && console.error(`拷贝矩阵库文件出错: ${error}`)
				);
			}
			// 写入生成的文件
			Object.entries(COStreamJS.files).forEach(([ out_filename, content ]) => {
				fs.writeFileSync(`${outDir}/${out_filename}`, content);
			});
		};
	}
})();

export default handle_options;
