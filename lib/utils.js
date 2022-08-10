function defineConst(target, name, value) {
    Object.defineProperty(target, name, {
        value,
        enumerable: false,
        configurable: false,
    });
}

function promiseSeries(test, step) {
    return new Promise((resolve, reject) => {
        function spin() {
            if (test()) {
                Promise.resolve(step())
                .then(spin)
                .catch(reject);
            }
            else {
                resolve();
            }
        }

        spin();
    });
}

function getRange(header) {
    if (typeof header !== 'string') {
        return null;
    }
    const match = header.match(/(\d+)-(\d+)?/);

    if (! match) {
        return null;
    }

    let [, start, end] = match;

    start = Number(start);
    end = Number(end);

    if (Number.isNaN(start)) {
        return null;
    }

    if (Number.isNaN(end)) {
        end = Infinity;
    }

    return [start, end];
}

function getRangeLength(range) {
    if (! range) {
        return 0;
    }

    return range[1] - range[0] + 1;
}

exports.defineConst = defineConst;
exports.promiseSeries = promiseSeries;
exports.getRange = getRange;
exports.getRangeLength = getRangeLength;
