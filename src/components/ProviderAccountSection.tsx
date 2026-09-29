import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProviderAccount } from '@/hooks/useProviderAccount';
import {
  callableErrorMessage, connectProvider, disconnectProvider, refreshProviderAlerts,
} from '@/services/providerAccounts';
import { styles } from '@/styles/providerAccount.styles';

type Props = {
  onMessage: (message: string, type: 'success' | 'error' | 'info') => void;
};

type Busy = 'connect' | 'refresh' | 'disconnect' | null;

function formatSync(iso: string | null): string {
  if (!iso) return 'Pas encore synchronisé';
  return `Synchro ${new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })}`;
}

// Profile section: connect the user's Jinka account. The credentials go once to
// the server (callable), which keeps only the token.
export default function ProviderAccountSection({ onMessage }: Props) {
  const account = useProviderAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);

  const connect = useCallback(async () => {
    if (!email.trim() || !password) return;
    setBusy('connect');
    try {
      const alerts = await connectProvider(email.trim(), password);
      setPassword('');
      onMessage(
        alerts.length > 0
          ? `Jinka connecté · ${alerts.length} alerte${alerts.length > 1 ? 's' : ''}`
          : 'Jinka connecté. Crée une alerte sur jinka.fr pour recevoir des annonces.',
        'success',
      );
    } catch (e) {
      onMessage(callableErrorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }, [email, password, onMessage]);

  const refresh = useCallback(async () => {
    setBusy('refresh');
    try {
      const alerts = await refreshProviderAlerts();
      onMessage(`${alerts.length} alerte${alerts.length > 1 ? 's' : ''} Jinka`, 'info');
    } catch (e) {
      onMessage(callableErrorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }, [onMessage]);

  const disconnect = useCallback(async () => {
    setBusy('disconnect');
    try {
      await disconnectProvider();
      onMessage('Compte Jinka déconnecté', 'info');
    } catch (e) {
      onMessage(callableErrorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }, [onMessage]);

  if (account === undefined) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#4A6CF7" />
      </View>
    );
  }

  const connected = account !== null && account.status !== 'expired';
  const canSubmit = !!email.trim() && !!password && busy === null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.icon}>
          <Ionicons name="home-outline" size={20} color="#4A6CF7" />
        </View>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>Jinka</Text>
          <Text style={styles.subtitle}>
            {connected ? `${account.email} · ${formatSync(account.last_sync_at)}` : 'Source des annonces'}
          </Text>
        </View>
      </View>

      {account?.status === 'expired' && (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>
            Ta session Jinka a expiré : les recherches liées ne se mettent plus à jour. Reconnecte-toi.
          </Text>
        </View>
      )}
      {account?.status === 'error' && account.last_error && (
        <View style={styles.warning}>
          <Ionicons name="cloud-offline-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>Dernière synchro en échec : {account.last_error}</Text>
        </View>
      )}

      {connected ? (
        <>
          {account.alerts.length === 0 ? (
            <Text style={styles.hint}>
              Aucune alerte sur ce compte. Crée tes alertes sur jinka.fr, puis actualise.
            </Text>
          ) : (
            account.alerts.map((alert) => (
              <View key={alert.id} style={styles.alertRow}>
                <Ionicons name="notifications-outline" size={14} color="#888" />
                <Text style={styles.alertName} numberOfLines={1}>{alert.name}</Text>
              </View>
            ))
          )}
          <Text style={styles.hint}>
            Lie une alerte à une recherche depuis les filtres : tout le groupe swipe ses annonces.
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={refresh} disabled={busy !== null}>
              {busy === 'refresh'
                ? <ActivityIndicator size="small" color="#4A6CF7" />
                : <Text style={styles.secondaryBtnText}>Actualiser</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={disconnect} disabled={busy !== null}>
              {busy === 'disconnect'
                ? <ActivityIndicator size="small" color="#FF4444" />
                : <Text style={styles.dangerBtnText}>Déconnecter</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Connecte ton compte Jinka pour partager tes alertes avec ton groupe. Ton mot de passe
            n'est pas conservé.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Email Jinka"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe Jinka"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            onSubmitEditing={connect}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={connect}
            disabled={!canSubmit}
          >
            {busy === 'connect'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Connecter Jinka</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
