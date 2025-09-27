// js_image_cache.js

export class ImageCache {
    static #instance = null;
    #db = null;
    #maxSize = 10000;
    #placeholderImage = null;
    #dbInitializationPromise = null;
    #placeholderPromise = null; // FIX: Added promise for placeholder

    // Private constructor for singleton
    constructor() {
        if (ImageCache.#instance) {
            return ImageCache.#instance;
        }
        ImageCache.#instance = this;
        // FIX: Start both initializations and store their promises
        this.#placeholderPromise = this.#initializePlaceholder();
        this.#dbInitializationPromise = this.#initializeDB();
    }

    // Get singleton instance
    static getInstance() {
        if (!ImageCache.#instance) {
            ImageCache.#instance = new ImageCache();
        }
        return ImageCache.#instance;
    }

    // Initialize placeholder image (blank 256x256 canvas)
    async #initializePlaceholder() {
        // This only runs once, thanks to the promise pattern
        if (this.#placeholderImage) return;

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.fillRect(0, 0, 256, 256);
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = () => {
                this.#placeholderImage = img;
                resolve();
            };
            img.onerror = () => {
                console.error('Failed to create placeholder image from canvas');
                resolve(); // Resolve anyway so the app doesn't hang
            };
            img.src = canvas.toDataURL('image/png');
        });
    }

    // Initialize IndexedDB (no changes needed here)
    async #initializeDB() {
        if (this.#db) return this.#db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MapboxTileCache', 2);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (db.objectStoreNames.contains('tiles')) db.deleteObjectStore('tiles');
                if (db.objectStoreNames.contains('metadata')) db.deleteObjectStore('metadata');
                db.createObjectStore('tiles', { keyPath: 'key' });
                db.createObjectStore('metadata');
            };
            request.onsuccess = (event) => {
                this.#db = event.target.result;
                resolve(this.#db);
            };
            request.onerror = (event) => {
                console.error('IndexedDB initialization failed:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Helper to ensure dependencies are ready
    async #ready() {
        await this.#dbInitializationPromise;
        await this.#placeholderPromise;
    }
    
    // ... clearDatabase, #loadImageWithRetry, #imageToBlob methods (no changes needed) ...
    async clearDatabase() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase('MapboxTileCache');
            request.onsuccess = () => {
                this.#dbInitializationPromise = this.#initializeDB();
                resolve();
            };
            request.onerror = (e) => {
                console.error('Error deleting database:', e.target.error);
                reject(e.target.error);
            };
            request.onblocked = () => {
                console.warn('Database deletion blocked. Please close other connections.');
                reject(new Error('Database deletion blocked.'));
            };
        });
    }
    async #loadImageWithRetry(url, retries = 1) {
        for (let i = 0; i <= retries; i++) {
            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
                    img.src = url;
                });
                return img;
            } catch (error) {
                if (i < retries) {
                    await new Promise(res => setTimeout(res, 1000));
                    continue;
                }
                console.error(`Image load failed after ${retries} retries: ${url}`);
                return this.#placeholderImage;
            }
        }
    }
    async #imageToBlob(image) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    // Get image from cache or load and store
    async getImage(url, zoom, tileX, tileY) {
        await this.#ready(); // FIX: Ensure both DB and placeholder are ready

        const type = url.includes('terrain-rgb') ? 'terrain-rgb' : 'satellite-v9';
        const key = `${type}_${zoom}_${tileX}_${tileY}`;

        const cachedImage = await this.#getFromCache(key);
        if (cachedImage) {
            console.log(`Retrieved from cache: ${key}`);
            return cachedImage;
        }

        console.log(`Cache miss for ${key}, fetching from network...`);
        const image = await this.#loadImageWithRetry(url);
        if (image !== this.#placeholderImage) { // Don't cache placeholder on network failure
            await this.#addToCache(key, image);
        }
        return image;
    }

    // Retrieve image from IndexedDB and update LRU in a single transaction
    async #getFromCache(key) {
        return new Promise((resolve) => {
            const transaction = this.#db.transaction(['tiles', 'metadata'], 'readwrite');
            const tileStore = transaction.objectStore('tiles');
            const metadataStore = transaction.objectStore('metadata');
            let imageToReturn = null;

            const tileRequest = tileStore.get(key);
            tileRequest.onsuccess = () => {
                const data = tileRequest.result;
                if (!data || !data.blob) {
                    // This is a cache miss, the transaction will complete and resolve null.
                    return;
                }

                // This is a cache hit.
                const img = new Image();
                const objectURL = URL.createObjectURL(data.blob);
                
                img.onload = () => {
                    imageToReturn = img;
                    URL.revokeObjectURL(objectURL); // FIX: Revoke URL only after image is loaded
                };
                img.onerror = () => {
                    console.error(`Failed to load image from cached blob for key ${key}`);
                    URL.revokeObjectURL(objectURL); // FIX: Also revoke on error
                    // Don't return placeholder, treat as a miss
                };
                img.src = objectURL;

                // Update LRU list since this was a successful hit
                const lruRequest = metadataStore.get('lru');
                lruRequest.onsuccess = () => {
                    let lruList = Array.isArray(lruRequest.result) ? lruRequest.result : [];
                    lruList = [key, ...lruList.filter(k => k !== key)];
                    metadataStore.put(lruList, 'lru');
                };
            };

            transaction.oncomplete = () => {
                // FIX: Only resolve the image if found, otherwise it's a clear 'null' for a cache miss.
                resolve(imageToReturn);
            };
            transaction.onerror = (event) => {
                console.error('Get from cache transaction failed:', event.target.error);
                resolve(null); // Treat transaction error as a miss
            };
        });
    }

    // ... #addToCache and clearTiles methods (no changes needed) ...
    async #addToCache(key, image) {
        const blob = await this.#imageToBlob(image);

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(['tiles', 'metadata'], 'readwrite');
            const tileStore = transaction.objectStore('tiles');
            const metadataStore = transaction.objectStore('metadata');

            tileStore.put({ key, blob });

            const lruRequest = metadataStore.get('lru');
            lruRequest.onsuccess = () => {
                let lruList = Array.isArray(lruRequest.result) ? lruRequest.result : [];
                lruList = [key, ...lruList.filter(k => k !== key)];

                while (lruList.length > this.#maxSize) {
                    const keyToRemove = lruList.pop();
                    if (keyToRemove) {
                        tileStore.delete(keyToRemove);
                    }
                }
                metadataStore.put(lruList, 'lru');
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => {
                console.error('Add to cache transaction failed:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    async clearTiles(activeTileKeys) {
        await this.#ready();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(['tiles', 'metadata'], 'readwrite');
            const tileStore = transaction.objectStore('tiles');
            const metadataStore = transaction.objectStore('metadata');

            const keysRequest = tileStore.getAllKeys();
            keysRequest.onsuccess = () => {
                const cachedKeys = keysRequest.result;

                for (const key of cachedKeys) {
                    if (!activeTileKeys.has(key)) {
                        tileStore.delete(key);
                    }
                }

                const lruRequest = metadataStore.get('lru');
                lruRequest.onsuccess = () => {
                    let lruList = Array.isArray(lruRequest.result) ? lruRequest.result : [];
                    lruList = lruList.filter(key => activeTileKeys.has(key));
                    metadataStore.put(lruList, 'lru');
                };
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => {
                console.error('Clear tiles transaction failed:', event.target.error);
                reject(event.target.error);
            };
        });
    }
}