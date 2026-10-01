import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export type StoreKey = { kind: 'accounts' } | { kind: 'legacy' } | { kind: 'user'; id: string };

@Injectable({ providedIn: 'root' })
export class FileStoreService {
  private readonly native = Capacitor.isNativePlatform();

  async read(key: StoreKey): Promise<unknown | null> {
    if (this.native) {
      try {
        const result = await Filesystem.readFile({ path: phonePath(key), directory: Directory.Data, encoding: Encoding.UTF8 });
        const text = typeof result.data === 'string' ? result.data : await result.data.text();
        return JSON.parse(text) as unknown;
      } catch (error) {
        if (isMissingFile(error)) {
          return null;
        }
        throw new Error('Saved data on this phone could not be read.');
      }
    }
    let response: Response;
    try {
      response = await fetch(webPath(key), { cache: 'no-store' });
    } catch {
      throw new Error('The data server is not reachable. Start the app with npm start.');
    }
    if (!response.ok) {
      throw new Error('The data file could not be loaded. Restart npm start.');
    }
    return (await response.json()) as unknown;
  }

  async write(key: StoreKey, document: unknown): Promise<void> {
    const body = `${JSON.stringify(document, null, 2)}\n`;
    if (this.native) {
      try {
        await Filesystem.writeFile({ path: phonePath(key), data: body, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
        return;
      } catch {
        throw new Error('Changes could not be saved on this phone.');
      }
    }
    let response: Response;
    try {
      response = await fetch(webPath(key), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store' });
    } catch {
      throw new Error('Changes were not saved: the data server is not reachable.');
    }
    if (!response.ok) {
      throw new Error('Changes could not be saved to the data folder.');
    }
  }

  async remove(key: StoreKey): Promise<void> {
    if (this.native) {
      try {
        await Filesystem.deleteFile({ path: phonePath(key), directory: Directory.Data });
      } catch (error) {
        if (!isMissingFile(error)) {
          throw new Error('Saved data on this phone could not be deleted.');
        }
      }
      return;
    }
    const response = await fetch(webPath(key), { method: 'DELETE', cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Saved data could not be deleted.');
    }
  }
}

function phonePath(key: StoreKey): string {
  if (key.kind === 'user') {
    return `users/${key.id}.json`;
  }
  return key.kind === 'accounts' ? 'accounts.json' : 'tracker.json';
}

function webPath(key: StoreKey): string {
  if (key.kind === 'user') {
    return `/api/users/${key.id}`;
  }
  return key.kind === 'accounts' ? '/api/accounts' : '/api/legacy';
}

function isMissingFile(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /does not exist|not found|no such file/i.test(message);
}
