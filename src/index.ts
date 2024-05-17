import DataLoader from 'dataloader';

/**
 * A shared storage for {@link ConnectedLoader} instances.
 */
export class ConnectedLoaderStorage<K, V, C = K> {
  #stores = new Map<ConnectedLoader<K, V, C>, Map<C, Promise<V>>>();

  /**
   * Clears all stored values from cache.
   */
  clearAll() {
    for (const store of this.#stores.values()) {
      store.clear();
    }
  }

  /**
   * Clears a value from cache. All connected loaders will be affected.
   */
  clearValue(value: V) {
    for (const [loader, store] of this.#stores.entries()) {
      const key = loader.valueKey(value);
      store.delete(key);
    }
  }

  /**
   * Primes a value in all connected loaders.
   */
  primeValue(value: V) {
    const promisedValue = Promise.resolve(value);
    for (const [loader, store] of this.#stores.entries()) {
      const key = loader.valueKey(value);
      store.set(key, promisedValue);
    }
  }

  /**
   * Registers a connected loader and returns its store.
   */
  register(loader: ConnectedLoader<K, V, C>): Map<C, Promise<V>> {
    const store = new Map<C, Promise<V>>();
    this.#stores.set(loader, store);
    return store;
  }
}

interface ConnectedLoaderOptions<K, V, C = K>
  extends Omit<DataLoader.Options<K, V, C>, 'cacheMap'> {
  storage: ConnectedLoaderStorage<K, V, C>;
  /**
   * A function that returns a cache key for a given value. This key will be used
   * to store and retrieve values from the cache {@link storage}.
   */
  valueKeyFn: (value: V) => C;
}

export class ConnectedLoader<K, V, C = K> extends DataLoader<K, V, C> {
  #options: ConnectedLoaderOptions<K, V, C>;

  constructor(batchLoadFn: DataLoader.BatchLoadFn<K,V>, options: ConnectedLoaderOptions<K, V, C>) {
    super(batchLoadFn, options);

    this.#options = options;

    // We can't pass `cacheMap` option directly to `super` as it would require
    // us to reference `this` before the `super` call.
    // @ts-expect-error
    this['_cacheMap'] = options.storage.register(this);
  }

  /**
   * Clears all stored values from cache. All loaders linked to the same storage
   * will have their cache cleared.
   */
  clearAll() {
    this.#options.storage.clearAll();
    return this;
  }

  /**
   * Clears a value from cache. All loaders linked to the same storage will have
   * this value removed from their cache.
   */
  clearValue(value: V): this {
    this.#options.storage.clearValue(value);
    return this;
  }

  async load(key: K): Promise<V> {
    const value = await super.load(key);
    this.#options.storage.primeValue(value);

    return value;
  }

  async loadMany(keys: ArrayLike<K>): Promise<(V | Error)[]> {
    const values = await super.loadMany(keys);
    for (const value of values) {
      if (!isError(value)) {
        this.#options.storage.primeValue(value);
      }
    }

    return values;
  }

  /**
   * Primes a value in the cache. All loaders linked to the same storage will
   * have this value made available for future loads.
   */
  primeValue(value: V): this {
    this.#options.storage.primeValue(value);
    return this;
  }

  /**
   * Returns a cache key used by this loader for the given value.
   */
  valueKey(value: V): C {
    return this.#options.valueKeyFn(value);
  }

  /**
   * @deprecated Use {@link clearValue} instead.
   */
  clear(key: K) {
    return super.clear(key);
  }

  /**
   * @deprecated Use {@link primeValue} instead.
   */
  prime(key: K, value: V) {
    if (isError(value)) {
      this.clear(key);
      return this;
    }

    this.#options.storage.primeValue(value);
    return this;
  }
}

function isError<T>(value: T | Error): value is Error {
  return value instanceof Error;
}
