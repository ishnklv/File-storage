const {defineConst} = require('../lib/utils.js');

class FileStore {
    constructor({dataStore, blobStore}) {
        if (! dataStore) {
            throw new Error('Datastore requried');
        }

        if (! dataStore) {
            throw new Error('Blobstore requried');
        }

        defineConst(this, 'dataStore', dataStore);
        defineConst(this, 'blobStore', blobStore);
    }

    put(id, meta, content) {
        if (typeof meta !== 'object') {
            throw new Error('Meta should be an object');
        }

        return this.blobStore.put(content)
        .then(({md5, byteCount}) => Object.assign({}, meta, {md5, contentLength: byteCount}))
        .then((meta) => this.dataStore.put(id, meta).then(() => meta));
    }

    has(id) {
        return this.dataStore.has(id);
    }

    get(id, range) {
        let meta;

        return this.getMeta(id)
        .then((data) => {
            meta = data;

            if (! Number.isFinite(range[1])) {
                range[1] = Number(meta.contentLength) - 1;
            }

            return this.getBlob(meta.md5, range);
        })
        .then((blob) => {
            return [meta, blob];
        });
    }

    delete(id) {
        return this.getMeta(id)
        .then((meta) =>
            this.dataStore.delete(id)
            .then(() => this.dataStore.countBlobRefs(meta.md5))
            .then((count) => {
                if (count > 0) {
                    return;
                }

                return this.blobStore.delete(meta.md5);
            })
        );
    }

    setDeleted(id) {
        return this.dataStore.setDeleted(id);
        return this.getMeta(id)
        .then((meta) =>
            this.dataStore.setDeleted(id)
            .then(() => this.dataStore.countBlobRefs(meta.md5))
            .then((count) => {
                if (count > 0) {
                    return;
                }

                return this.blobStore.delete(meta.md5);
            })
        );
    }

    setAccessDate(id, date) {
        return this.dataStore.setAccessDate(id, date);
    }

    getStream(id, range) {
        let meta;

        return this.getMeta(id)
        .then((data) => {
            meta = data;

            if (range && ! Number.isFinite(range[1])) {
                range[1] = Number(meta.contentLength) - 1;
            }

            return this.getBlobStream(meta.md5, range);
        })
        .then((stream) => [meta, stream]);
    }

    getMeta(id) {
        if (typeof id === 'object') {
            return Promise.resolve(id);
        }
        else {
            return this.dataStore.get(id);
        }
    }

    listMeta(skip, limit) {
        return this.dataStore.find(skip, limit);
    }

    countMeta(query, params = {}) {
        return this.dataStore.count(query, params);
    }

    getBlob(id, range) {
        return this.blobStore.get(id, range);
    }

    getBlobStream(id, range) {
        return this.blobStore.getStream(id, range);
    }

    listUpdated(date) {
        return this.dataStore.listUpdated(date);
    }

    countUpdated(date) {
        return this.dataStore.countUpdated(date);
    }
}

module.exports = FileStore;
