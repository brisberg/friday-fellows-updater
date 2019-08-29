import Chinmei from 'chinmei';
import {readFile} from 'fs';

/**
 * @param {string} credPath path to Mal Credentials file.
 * @return {chinmei.ChinmeiClient} Authenticated Chinmei API Client
 */
export function initializeChinmeiClient(credPath: string):
    Promise<Chinmei.ChinmeiClient> {
  return new Promise(async (resolve, reject) => {
    // Load mal credentials from a local file.
    readFile(credPath, async (err, content) => {
      if (err) {
        console.log('Error loading MAL client credentials file:', err);
        reject(err);
      }
      // Authorize a client with credentials, then verify with MAL api.
      const {username, password} = JSON.parse(content.toString());

      try {
        const mal = Chinmei(username, password);
        await mal.verifyAuth();
        resolve(mal);
      } catch (err) {
        reject(err);
      }
    });
  });
}