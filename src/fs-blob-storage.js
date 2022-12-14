const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const pify = require('pify');
const mkdirpP = pify(mkdirp);
const writeFileP = pify(fs.writeFile);
const readFileP = pify(fs.readFile);
const unlinkP = pify(fs.unlink);
const copyFileP = pify(fs.copyFile);
const statP = pify(fs.stat);
const {Readable} = require('stream');
const uuid = require('uuid').v4;
const bluebird = require('bluebird');

const {getRangeLength} = require('../lib/utils');

class FsBlobStorage {
    constructor({dir = process.cwd(), tmp = '/tmp', depth = 3} = {}) {
        defineConst(this, 'dir', dir);
        defineConst(this, 'depth', depth);
        this._tmp = tmp;
    }

    get tmp() {
        return this._tmp;
    }

    /**
     * Put binary data into storage.
     *
     * @param  {Buffer|Stream} content Data to store.
     * @return {Promise<String>} Promise resolves with md5 of the content.
     * @return {Promise}
     */
    put(content) {
        if (content instanceof Readable) {
            return this.putStream(content);
        }

        const byteCount = content.length;
        const md5 = crypto.createHash('md5').update(content).digest('hex');
        const dir = this.getDirpath(md5);
        const filepath = this.getFilepath(md5);

        return existsP(filepath)
        .then((exists) => {
            if (exists) {
                return md5;
            }
            else {
                return mkdirpP(dir)
                .then(() => writeFileP(filepath, content))
                .then(() => ({md5, byteCount}));
            }
        });
    }
    /**
     * Get item value as Buffer.
     *
     * @param  {String} id Item id.
     * @return {Promise<Buffer,Error>} Returns item content with promise.
     */
    get(id, range) {
        var filepath = this.getFilepath(id);

        const open = bluebird.promisify(fs.open);
        const read = bluebird.promisify(fs.read);
        const close = bluebird.promisify(fs.close);

        const rangeLength = getRangeLength(range);

        const buffer = new Buffer(rangeLength);

        let file;
        return existsP(filepath)
        .then((exists) => {
            if (! exists) {
                throw new Error(`Item "${id}" not found`);
            }

            return open(filepath, 'r');
        })
        .then((data) => {
            file = data;

            return read(file, buffer, 0, rangeLength, range[0]);
        })
        .then(() => {
            return close(file);
        })
        .then(() => {
            return buffer;
        });
    }
    /**
     * Put file as a stream.
     * @param {Stream.Readable} readStream Readable stream.
     * @return {Promise<String>} Promise resolves with md5 of the content.
     */
    putStream(readStream) {
        var tmpFile = this.tmpFilename();

        return existsP(tmpFile)
        .then(exists => {
            if (exists) {
                throw new Error('File already exists');
            }

            const hash = crypto.createHash('md5');
            let byteCount = 0;

            return new Promise((resolve, reject) => {
                var writeStream = fs.createWriteStream(tmpFile);
                readStream.pipe(writeStream);
                readStream.on('data', (chunk) => {
                    hash.update(chunk);
                    byteCount += chunk.length;
                });
                writeStream.on('finish', () => {
                    resolve(hash.digest('hex'));
                });
                writeStream.on('error', reject);
            })
            .then((md5) => {
                var filepath = this.getFilepath(md5);

                return existsP(filepath)
                .then((exists) => {
                    if (exists) {
                        return unlinkP(tmpFile);
                    }
                    else {
                        return mkdirpP(path.dirname(filepath))
                        .then(() => copyFileP(tmpFile, filepath))
                        .then(() => unlinkP(tmpFile));
                    }
                })
                .then(() => ({md5, byteCount}));
            });
        });
    }
    /**
     * Get file read stream.
     *
     * @param  {String} id Item id.
     * @param  {Array} range of bytes of streamed files
     * @return {Promise}      Promise returning stram.
     */
    getStream (id, range) {
        var filepath = this.getFilepath(id);

        return existsP(filepath)
        .then((exists) => {
            if (! exists) {
                throw new Error(`Item "${id}" not found`);
            }

            const options = {};

            if (range) {
                options.start = range[0];
                options.end = range[1];
            }

            return fs.createReadStream(filepath, options);
        });
    }
    /**
     * Remove item from storage.
     *
     * @param  {String} id Item id.
     * @return {Promise}
     */
    delete(id) {
        return unlinkP(
            this.getFilepath(id)
        );
    }
    /**
     * Check if item exists in blob storage
     * @param {String} id Item id.
     * @return {Promise<Boolean>} Return promise returning boolean status.
     */
    has(id) {
        return existsP(
            this.getFilepath(id)
        );
    }


    // UTILS ---------------------------------------------------------------


    getDirpath(id) {
        var parts = [];
        var depth = this.depth;

        for (let i = 0; i < depth; i++) {
            parts.push(id.slice(i * 2, i * 2 + 2));
        }

        return path.join(this.dir, ...parts);
    }

    getFilepath(id) {
        return path.join(
            this.getDirpath(id), id
        );
    }

    getStat(id) {
        return statP(
            this.getFilepath(id)
        );
    }

    tmpFilename() {
        return path.join(this._tmp, uuid());
    }
}

function existsP(filepath) {
    return new Promise((resolve) => fs.exists(filepath, resolve));
}

function defineConst(target, name, value) {
    Object.defineProperty(target, name, {
        value,
        enumerable: true,
        configurable: false,
    });
}

module.exports = FsBlobStorage;
