import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export type PickResult =
  | { status: 'success'; url: string }
  | { status: 'canceled' }
  | { status: 'no-permission' }
  | { status: 'error'; error: unknown };

async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Lecture du fichier échouée'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Ouvre la galerie, laisse l'utilisateur recadrer, puis upload l'image vers
 * Firebase Storage à `storagePath` et renvoie l'URL de téléchargement.
 * Réutilisé pour les avatars et les photos de couverture de recherche.
 */
export async function pickAndUploadImage(
  storagePath: string,
  aspect: [number, number] = [1, 1],
): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'no-permission' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.7,
  });
  if (result.canceled) return { status: 'canceled' };

  try {
    const blob = await uriToBlob(result.assets[0].uri);
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    return { status: 'success', url };
  } catch (error) {
    return { status: 'error', error };
  }
}
