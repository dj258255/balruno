/**
 * Storage IPC — renderer 의 KeyValueStorage 어댑터를 desktop electron-store 와 연결.
 *
 * renderer 에서 window.balruno.kvStorage.get/set/remove 호출 시
 * preload script 가 ipcRenderer.sendSync 로 main 에 전달.
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';

interface KvSchema {
  [key: string]: string;
}

const store = new Store<KvSchema>({
  name: 'balruno-kv',
  defaults: {},
});

export function registerStorageHandlers(): void {
  ipcMain.on('kv-storage:get', (event, key: string) => {
    event.returnValue = store.get(key) ?? null;
  });

  ipcMain.on('kv-storage:set', (event, key: string, value: string) => {
    store.set(key, value);
    event.returnValue = true;
  });

  ipcMain.on('kv-storage:remove', (event, key: string) => {
    store.delete(key);
    event.returnValue = true;
  });
}
