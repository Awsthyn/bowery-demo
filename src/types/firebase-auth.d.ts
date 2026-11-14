// `firebase/auth` re-exports `@firebase/auth`, which Metro resolves to its React Native build
// (it has a "react-native" export condition). The `firebase` wrapper's own export map only ships the
// web typings, so TypeScript can't see the RN-only export. Declare it here.
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
