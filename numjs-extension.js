 // 改写numjs库的toString方法来适配网页显示效果
 const old_numjs_toString = nj.NdArray.prototype.toString
 nj.NdArray.prototype.toString = function(){
     var nChars = formatNumber(this.max()).length;

     var reg1 = /\]\,(\s*)\[/g;
     var spacer1 = '],\n$1 [';
     var reg3 = /\]\,(\s+)...\,(\s+)\[/g;
     var spacer3 = '],\n$2 ...\n$2 [';
     var reg2 = /\[\s+\[/g;
     var spacer2 = '[[';

     function formatNumber (v) {
         return String(Number((v || 0).toFixed(nj.config.nFloatingValues)));
     }
     function formatArray(k, v) {
         if (typeof v === 'string') { return v; }
         if (Number.isFinite(v) || Number.isNaN(v)) {
             var s = formatNumber(v);
             return new Array(Math.max(0, nChars - s.length + 2)).join(' ') + s;
         }
         k = k || 0;
         var arr;
         var th = nj.config.printThreshold;
         var hth = th / 2 | 0;
         if (v.length > th) {
             arr = [].concat(v.slice(0, hth), [' ...'], v.slice(v.length - hth));
         } else {
             arr = v;
         }
         return new Array(k + 1).join(' ') + '[' + arr.map(function (i, ii) {
             return formatArray(ii === 0 && k === 0 ? 1 : k + 1, i);
         }).join(',') + ']';
     }

     var base = JSON
         .stringify(this.tolist(), formatArray)
         .replace(reg1, spacer1)
         .replace(reg2, spacer2)
         .replace(reg2, spacer2)
         .replace(reg3, spacer3)
         .slice(2, -1);
     return '[' + base;
 };
 nj.NdArray.prototype.rows = function(){ return this.shape[0] }
 nj.NdArray.prototype.cols = function(){ return this.shape[1] }
 nj.NdArray.prototype.trace = function(){ return nj.diag(this).sum() }
 nj.constant = function(rows,cols,num){ return this.zeros([rows,cols]).assign(num) }

 // 为numjs扩展 rank 方法
nj.NdArray.prototype.rank = function rank(error_ = -1) {
    let Matrix = this.tolist()
    let n = Matrix[0].length;
    let m = Matrix.length;
    let i = 0, j1,j=0, temp1;
    if (m > n) {
        i = m;
        m = n;
        n = i;
        i = 1;
    }
    let temp = Array.from({ length: m }).map(_ => Array.from({ length: n }));
    if (i == 0) {
        for (i = 0; i < m; i++) {
            for (j = 0; j < n; j++) {
                temp[i][j] = Matrix[i][j];
            }
        }
    }
    else {
        for (i = 0; i < m; i++) {
            for (j = 0; j < n; j++) {
                temp[i][j] = Matrix[j][i];
            }
        }
    }
    if (m == 1) {
        i = 0;
        while (i < n) {
            if (Matrix[0][i] != 0) {
                return 1;
            }
            i += 1;
        }
        return 0;
    }
    let error0;
    if (error_ == -1) {
        error0 = Math.pow(0.1, 10);
    }
    else {
        error0 = Math.pow(0.1, error_);
    }
    i = 0;
    while (i < m) {
        j = 0;
        while (j < n) {
            if (temp[i][j] != 0) {
                error0 *= temp[i][j];
                i = m;
                break;
            }
            j += 1;
        }
        i += 1;
    }
    let error1;
    for (i = 0; i < m; i++) {
        j = 0;
        while (j < n) {
            if (temp[i][j] != 0) {
                break;
            }
            j += 1;
        }
        if (j < n) {
            i1 = 0;
            while (i1 < m) {
                if (temp[i1][j] != 0 && i1 != i) {
                    temp1 = temp[i][j] / temp[i1][j];
                    error1 = Math.abs((temp[i][j] - temp[i1][j] * temp1)) * 100;
                    error1 += error0;
                    for (j1 = 0; j1 < n; j1++) {
                        temp[i1][j1] = temp[i][j1] - temp[i1][j1] * temp1;
                        if (Math.abs(temp[i1][j1]) < error1) {
                            temp[i1][j1] = 0;
                        }
                    }

                }
                i1 += 1;
            }
        }
    }

    i1 = 0;
    for (i = 0; i < m; i++) {
        for (j = 0; j < n; j++) {
            if (temp[i][j] != 0) {
                i1 += 1;
                break;
            }
        }
    }
    return i1;

}
// 行列式值
nj.NdArray.prototype.det = function det() {
    let square = this.tolist()
    // 方阵约束
    if (square.length !== square[0].length) {
        throw new Error();
    }
    // 方阵阶数
    let n = square.length;

    let result = 0;
    if (n > 3) {
        // n 阶
        for (let column = 0; column < n; column++) {
            // 去掉第 0 行第 column 列的矩阵
            let matrix = new Array(n - 1).fill(0).map(arr => new Array(n - 1).fill(0));
            for (let i = 0; i < n - 1; i++) {
                for (let j = 0; j < n - 1; j++) {
                    if (j < column) {
                        matrix[i][j] = square[i + 1][j];
                    } else {
                        matrix[i][j] = square[i + 1][j + 1];
                    }
                }
            }
            result += square[0][column] * Math.pow(-1, 0 + column) * nj.array(matrix).det();
        }
    } else if (n === 3) {
        // 3 阶
        result = square[0][0] * square[1][1] * square[2][2] +
                 square[0][1] * square[1][2] * square[2][0] +
                 square[0][2] * square[1][0] * square[2][1] -
                 square[0][2] * square[1][1] * square[2][0] -
                 square[0][1] * square[1][0] * square[2][2] -
                 square[0][0] * square[1][2] * square[2][1];
    } else if (n === 2) {
        // 2 阶
        result = square[0][0] * square[1][1] - square[0][1] * square[1][0];
    } else if (n === 1) {
        // 1 阶
        result = square[0][0];
    }
    return result;
}
// 伴随矩阵：矩阵中每个元素对应的代数余子式所构成矩阵的转置矩阵
nj.NdArray.prototype.adjoint = function adjoint() {
    let square = this.tolist()
    // 方阵约束
    if (square[0].length !== square.length) {
        throw new Error();
    }

    let n = square.length;

    let result = new Array(n).fill(0).map(arr => new Array(n).fill(0));
    for (let row = 0; row < n; row++) {
        for (let column = 0; column < n; column++) {
            // 去掉第 row 行第 column 列的矩阵
            let matrix = [];
            for (let i = 0; i < square.length; i++) {
                if (i !== row) {
                    let arr = [];
                    for (let j = 0; j < square.length; j++) {
                        if (j !== column) {
                            arr.push(square[i][j]);
                        }
                    }
                    matrix.push(arr);
                }
            }
            result[row][column] = Math.pow(-1, row + column) * nj.array(matrix).det();
        }
    }
    return nj.array(result).transpose().tolist();
}
nj.NdArray.prototype.inverse = function inverse() {
    let square = this.tolist()
    if (square[0].length !== square.length) {
        throw new Error();
    }
    let detValue = this.det();
    let result = this.adjoint();
    
    for (let i = 0; i < result.length; i++) {
        for (let j = 0; j < result.length; j++) {
            result[i][j] /= detValue;
        }
    }
    return nj.array(result);
}
/** 矩阵映射部分 */
nj.NdArray.prototype.sin = function sin(){
    return nj.sin(this)
}
nj.NdArray.prototype.cos = function cos(){
    return nj.cos(this)
}