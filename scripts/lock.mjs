/**
 * The model files pinned by models.lock.json, as one flat map from package path (`models/v0.3/der_3.dlid`) to the
 * file's bytes, SHA-256 and pinned Hugging Face URLs.
 *
 * Why a list of releases: the packs come from two Hugging Face repositories, the v0.3 release
 * (kyr0/defuss-lid-1.0: the fastText packs, the CLD3 core and every benchmark candidate) and the CLD3 DNO-PQ packs
 * (kyr0/cld3-pq-dno). Each is pinned by its own revision; one folder per release under models/ keeps a file's package
 * path unique even where both releases ship a file of the same name (`major_20.cld3q`).
 *
 * VERIFIED: `node scripts/fetch-models.mjs --live` matched all 32 files of both releases through this map on
 * 2026-11-03.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

/** @param {{releases: {repository: string, revision: string, target: string, files: Record<string, {bytes: number, sha256: string}>}[]}} lock */
export function lockedFiles(lock) {
  const files = {};
  for (const release of lock.releases) {
    for (const [path, {bytes, sha256}] of Object.entries(release.files)) {
      files[`${release.target}/${path}`] = {
        bytes, sha256, path, repository: release.repository, revision: release.revision, target: release.target,
        url: `https://huggingface.co/${release.repository}/resolve/${release.revision}/${path}`,
        page: `https://huggingface.co/${release.repository}/blob/${release.revision}/${path}`,
      };
    }
  }
  return files;
}

/** Read models.lock.json below `root`. */
export const readLock = root => JSON.parse(readFileSync(join(root, 'models.lock.json'), 'utf8'));
