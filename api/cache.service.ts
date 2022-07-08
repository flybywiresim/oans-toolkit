import * as fs from 'fs';
import * as path from 'path';
import { CACHE_DIRECTORY } from './constants';

export class CacheService {
    static async writeFile(name: string, data: Uint8Array): Promise<void> {
        const filePath = path.join(CACHE_DIRECTORY, `${name}.oanf`);

        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, data, (err) => {
                if (err) {
                    reject(err);
                }

                resolve();
            });
        });
    }

    static async readFile(name: string): Promise<Uint8Array> {
        const filePath = path.join(CACHE_DIRECTORY, `${name}.oanf`);

        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    reject(err);
                }

                resolve(data);
            });
        });
    }
}
