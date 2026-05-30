import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { auth, db, GoogleAuthProvider } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_NOTIFICATION_PREFS } from '@/types';
import { logError } from '@/lib/errorReporting';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

// Isolated so the hook is never called without the required client IDs
function GoogleButton({ onCredential, disabled }: { onCredential: (token: string) => void; disabled: boolean }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      onCredential(response.params.id_token);
    }
  }, [response, onCredential]);

  return (
    <TouchableOpacity
      style={styles.googleBtn}
      onPress={() => promptAsync()}
      disabled={!request || disabled}
    >
      <Text style={styles.googleIcon}>G</Text>
      <Text style={styles.googleBtnText}>Continuer avec Google</Text>
    </TouchableOpacity>
  );
}

const showGoogleBtn = Platform.OS !== 'android' || !!GOOGLE_ANDROID_CLIENT_ID;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setError('');
    setLoading(true);
    try {
      const { setFirebaseUser, setProfile, setGroupId } = useAuthStore.getState();
      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, credential);

      setFirebaseUser(userCred.user);

      const snap = await getDoc(doc(db, 'users', userCred.user.uid));
      if (snap.exists()) {
        const profile = snap.data() as any;
        setProfile(profile);
        const groupId = profile.couple_id ?? null;
        setGroupId(groupId);
        router.replace(groupId ? '/(tabs)' : '/(auth)/invite');
      } else {
        await setDoc(doc(db, 'users', userCred.user.uid), {
          id: userCred.user.uid,
          email: userCred.user.email ?? '',
          display_name: userCred.user.displayName ?? userCred.user.email?.split('@')[0] ?? '',
          photo_url: userCred.user.photoURL ?? null,
          couple_id: null,
          push_token: null,
          notification_prefs: DEFAULT_NOTIFICATION_PREFS,
          created_at: new Date().toISOString(),
        });
        router.replace('/(auth)/invite');
      }
    } catch (e: any) {
      logError(e, 'auth-google-credential');
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }, []);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const { setFirebaseUser, setProfile, setGroupId } = useAuthStore.getState();
      let userCred;
      if (mode === 'login') {
        userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          id: userCred.user.uid,
          email: email.trim(),
          display_name: displayName.trim() || email.split('@')[0],
          couple_id: null,
          push_token: null,
          notification_prefs: DEFAULT_NOTIFICATION_PREFS,
          created_at: new Date().toISOString(),
        });
      }

      setFirebaseUser(userCred.user);
      const snap = await getDoc(doc(db, 'users', userCred.user.uid));
      if (snap.exists()) {
        const profile = snap.data() as any;
        setProfile(profile);
        const groupId = profile.couple_id ?? null;
        setGroupId(groupId);
        router.replace(groupId ? '/(tabs)' : '/(auth)/invite');
      } else {
        router.replace('/(auth)/invite');
      }
    } catch (e: any) {
      logError(e, `auth-${mode}`);
      setError(friendlyError(e.code) + (e.code ? ` [${e.code}]` : ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Ionicons name="home" size={64} color="#4A6CF7" style={styles.logo} />
          <Text style={styles.appName}>Chez Nous</Text>
          <Text style={styles.tagline}>Cherchez votre nid ensemble</Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Votre prénom"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</Text>
            }
          </TouchableOpacity>

          {showGoogleBtn && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>
              <GoogleButton onCredential={handleGoogleCredential} disabled={loading} />
            </>
          )}

          <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            <Text style={styles.switchText}>
              {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'Email invalide';
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Email ou mot de passe incorrect';
    case 'auth/email-already-in-use': return 'Cet email est déjà utilisé';
    case 'auth/weak-password': return 'Mot de passe trop faible (6 caractères min)';
    case 'auth/too-many-requests': return 'Trop de tentatives, réessayez plus tard';
    default: return 'Une erreur est survenue';
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 40 },
  logo: { marginBottom: 8 },
  appName: { fontSize: 36, fontWeight: '800', color: '#1A1A2E', letterSpacing: -1 },
  tagline: { fontSize: 16, color: '#888', marginTop: 4 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#eee',
    color: '#1A1A2E',
  },
  btn: {
    backgroundColor: '#4A6CF7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  dividerText: { color: '#999', fontSize: 13 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    gap: 10,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  switchText: { textAlign: 'center', color: '#4A6CF7', fontSize: 14, marginTop: 8 },
  error: { color: '#FF4444', fontSize: 13, textAlign: 'center' },
});
