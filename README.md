# connected-dataloader

This package allows you to create DataLoader instances which share a common cache storage. Loads performed with one DataLoader will automatically prime the cache of other DataLoader instances that are linked to the same storage.

This is useful in cases where a particular piece of data can be located through multiple loaders&mdash;for example, a user might be loadable by either their ID or email address.

The connected DataLoader abstraction frees up developers from manually managing cache entries, and decouples DataLoaders from the technical details of each other's cache key function.

**Before**:

```typescript
const byId = new DataLoader<string[], User>(async (keys) => {
  const users = await db.users.findMany({
    where: { id: { in: keys } },
  });

  // This is duplicated
  for (const user of users) {
    byEmail.clear(user.email).prime(user.email, user);
  }

  return users;
});

const byEmail = new DataLoader<string[], User>(async (keys) => {
  const users = await db.users.findMany({
    where: { email: { in: keys } },
  });

  // And also means `byEmail` is coupled to cache key semantics of `byId`
  //   (and vice versa!)
  for (const user of users) {
    byId.clear(user.id).prime(user.id, user);
  }

  return users;
});
```

**After**:

```typescript
import {
  ConnectedLoader,
  ConnectedLoaderStorage,
} from 'connected-dataloader';

// Shared storage for connected loaders
const storage = new ConnectedLoaderStorage<string, User>();

// This loader will automatically prime `byEmail`'s cache
const byId = new ConnectedLoader(
  async keys =>
    db.user.findMany({
      where: { id: { in: keys } },
    }),
  // `valueKey` defines mapping from `user` object => cache key
  { storage, valueKey: user => user.id },
);

const byEmail = new ConnectedLoader(
  async keys =>
    db.user.findMany({
      where: { id: { in: keys } },
    }),
  { storage, valueKey: user => user.email },
)
```
