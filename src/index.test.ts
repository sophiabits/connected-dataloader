import { describe, it, vi } from 'vitest';

import { ConnectedLoader, ConnectedLoaderStorage } from '.';

interface User {
  id: string;
  email: string;
  name: string;
}

function setup() {
  const dataset = {
    john: { id: 'user-1', email: 'john@test.com', name: 'John' },
    jake: { id: 'user-2', email: 'jake@test.com', name: 'Jake' },
  } satisfies Record<string, User>;

  const users = Object.values(dataset);

  const loadByIdsFn = vi.fn(async (keys: readonly string[]) => {
    return keys.map((key) => users.find((user) => user.id === key) || new Error('not found'));
  });
  const loadByEmailsFn = vi.fn(async (keys: readonly string[]) => {
    return keys.map((key) => users.find((user) => user.email === key) || new Error('not found'));
  });

  const storage = new ConnectedLoaderStorage<string, User>();
  const byId = new ConnectedLoader(loadByIdsFn, {
    storage,
    valueKeyFn: (user) => user.id,
  });
  const byEmail = new ConnectedLoader(loadByEmailsFn, {
    storage,
    valueKeyFn: (user) => user.email,
  });

  return { byEmail, byId, dataset, loadByEmailsFn, loadByIdsFn };
}

describe('connected-dataloader', () => {
  it('can clear storage', async ({ expect }) => {
    const { byId, dataset, loadByIdsFn } = setup();

    await byId.load(dataset.jake.id);
    byId.clearAll();
    await byId.load(dataset.jake.id);
    expect(loadByIdsFn).toHaveBeenCalledTimes(2);
  });

  it('can clear value', async ({ expect }) => {
    const { byEmail, byId, dataset, loadByEmailsFn } = setup();

    await byId.loadMany([dataset.jake.id, dataset.john.id]);

    vi.clearAllMocks();
    byId.clearValue(dataset.jake);

    await byEmail.load(dataset.jake.email);
    await byEmail.load(dataset.john.email);

    expect(loadByEmailsFn).toHaveBeenCalledTimes(1);
    expect(loadByEmailsFn).toHaveBeenCalledWith([dataset.jake.email]);
  });

  it('can load values', async ({ expect }) => {
    const { byEmail, byId, dataset, loadByEmailsFn, loadByIdsFn } = setup();
    {
      const user1 = await byId.load('user-1');
      const user2 = await byEmail.load('john@test.com');
      expect(loadByIdsFn).toHaveBeenCalledTimes(1);
      expect(loadByEmailsFn).not.toHaveBeenCalled();
      expect(user1).toBe(user2);
    }

    vi.clearAllMocks();
    {
      const users = await byEmail.loadMany(['john@test.com', 'jake@test.com', 'foo@test.com']);
      expect(loadByEmailsFn).toHaveBeenCalledWith(['jake@test.com', 'foo@test.com']);

      expect(users).toEqual([dataset.john, dataset.jake, expect.any(Error)]);
    }
  });

  it('can prime keys', async ({ expect }) => {
    const { byEmail, byId, dataset, loadByEmailsFn, loadByIdsFn } = setup();

    await byId.prime(dataset.jake.id, dataset.jake);

    {
      const user1 = await byId.load(dataset.jake.id);
      const user2 = await byEmail.load(dataset.jake.email);

      expect(user1).toBe(user2);
      expect(user1).toBe(dataset.jake);
    }

    expect(loadByEmailsFn).not.toHaveBeenCalled();
    expect(loadByIdsFn).not.toHaveBeenCalled();
  });

  it('can prime values', async ({ expect }) => {
    const { byEmail, byId, dataset, loadByEmailsFn, loadByIdsFn } = setup();

    await byId.primeValue(dataset.jake);

    {
      const user1 = await byId.load(dataset.jake.id);
      const user2 = await byEmail.load(dataset.jake.email);

      expect(user1).toBe(user2);
      expect(user1).toBe(dataset.jake);
    }

    expect(loadByEmailsFn).not.toHaveBeenCalled();
    expect(loadByIdsFn).not.toHaveBeenCalled();
  });
});
