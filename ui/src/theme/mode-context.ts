'use client';

import type { Mode } from './tokens';

import { useContext, createContext } from 'react';

export const ModeContext = createContext<{ mode: Mode; toggle: () => void }>({
  mode: 'light',
  toggle: () => {},
});
export const useMode = () => useContext(ModeContext);
