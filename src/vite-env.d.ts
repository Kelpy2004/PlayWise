/// <reference types="vite/client" />

import type { GameRecord, LaptopRecord } from './types/catalog'

declare global {
  interface Window {
    GAME_LIBRARY?: GameRecord[]
    OPEN_SOURCE_GAMES?: GameRecord[]
    LAPTOP_LIBRARY?: LaptopRecord[]
  }
}

export {}
