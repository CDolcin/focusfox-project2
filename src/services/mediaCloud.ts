import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { FirebaseStorage, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { AnyRecord } from '../core/sync';
import { CollectionName } from '../core/models';

/** Transport uploads bytes before publishing the record. Failed uploads keep the sync operation queued. */
export async function cloudRecord(storage: FirebaseStorage, uid: string, coll: CollectionName, record: AnyRecord): Promise<AnyRecord> {
  if (record.deleted) return record;
  const upload = async (uri: string, knownPath?: string): Promise<{ uri: string; path: string }> => {
    if (uri.includes('/ff-cloud-') && knownPath?.startsWith(`users/${uid}/`)) return { uri: await getDownloadURL(ref(storage, knownPath)), path: knownPath };
    if (/^https:\/\//.test(uri)) return { uri, path: '' };
    const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, uri);
    const path = `users/${uid}/${coll}/${record.id}/${key}`;
    const object = ref(storage, path);
    try { return { uri: await getDownloadURL(object), path }; }
    catch (e) { if ((e as { code?: string }).code !== 'storage/object-not-found') throw e; }
    const file = new File(uri);
    if (!file.exists) throw new Error('An attachment is missing on this phone. Remove it or restore the file, then retry sync.');
    await uploadBytes(object, await file.bytes(), { contentType: file.type || 'application/octet-stream' });
    return { uri: await getDownloadURL(object), path };
  };
  if (coll === 'tasks') {
    const images = await Promise.all(((record.imageUris as string[]) ?? []).map((uri, i) => upload(uri, (record.imagePaths as string[])?.[i])));
    return { ...record, imageUris: images.map(i => i.uri), imagePaths: images.map((i, n) => i.path || (record.imagePaths as string[])?.[n] || '') };
  }
  if (coll === 'settings' && typeof record.profilePhotoUri === 'string' && record.profilePhotoUri) {
    const photo = await upload(record.profilePhotoUri, record.profilePhotoStoragePath as string | undefined);
    return { ...record, profilePhotoUri: photo.uri, profilePhotoStoragePath: photo.path || record.profilePhotoStoragePath || null };
  }
  if (coll === 'recordings' && typeof record.voiceUri === 'string' && record.voiceUri) {
    const audio = await upload(record.voiceUri, record.voiceStoragePath as string | undefined);
    return { ...record, voiceUri: audio.uri, voiceStoragePath: audio.path || record.voiceStoragePath || null };
  }
  return record;
}
