import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Shared AsyncStorage adapter for every persisted Zustand store. */
export const persistStorage = createJSONStorage(() => AsyncStorage);
