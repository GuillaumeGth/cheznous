import React, { memo, useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProviderAccount } from '@/hooks/useProviderAccount';
import {
  callableErrorMessage, connectProvider, connectProviderWithToken, disconnectProvider, refreshProviderAlerts,
} from '@/services/providerAccounts';
import { ProviderAuthMethod } from '@/types';
import { styles } from '@/styles/providerAccount.styles';

type Props = {
  onMessage: (message: string, type: 'success' | 'error' | 'info') => void;
};

type Busy = 'connect' | 'refresh' | 'disconnect' | null;

const MODES: { value: ProviderAuthMethod; label: string }[] = [
  { value: 'token', label: 'Google / Apple' },
  { value: 'password', label: 'Email + mot de passe' },
];

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
  const [mode, setMode] = useState<ProviderAuthMethod>('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<Busy>(null);

  const connect = useCallback(async () => {
    if (mode === 'token' ? !token.trim() : !email.trim() || !password) return;
    setBusy('connect');
    try {
      const alerts = mode === 'token'
        ? await connectProviderWithToken(token.trim())
        : await connectProvider(email.trim(), password);
      setPassword('');
      setToken('');
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
  }, [mode, email, password, token, onMessage]);

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
  const canSubmit = busy === null && (mode === 'token' ? !!token.trim() : !!email.trim() && !!password);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.icon}>
          <Ionicons name="home-outline" size={20} color="#4A6CF7" />
        </View>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>Jinka</Text>
          <Text style={styles.subtitle}>
            {connected
              ? `${account.email || 'Compte connecté'} · ${formatSync(account.last_sync_at)}`
              : 'Source des annonces'}
          </Text>
        </View>
      </View>

      {account?.status === 'expired' && (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>
            {account.auth_method === 'token'
              ? 'Ton token Jinka a expiré : les recherches liées ne se mettent plus à jour. Colle un nouveau token.'
              : 'Ta session Jinka a expiré : les recherches liées ne se mettent plus à jour. Reconnecte-toi.'}
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
            Connecte ton compte Jinka pour partager tes alertes avec ton groupe.
          </Text>
          <View style={styles.modeRow}>
            {MODES.map(({ value, label }) => (
              <ModeChip key={value} value={value} label={label} active={mode === value} onSelect={setMode} />
            ))}
          </View>
          {mode === 'token' ? (
            <>
              <Text style={styles.hint}>
                Compte créé avec Google ou Apple : sur ordinateur, connecte-toi à jinka.fr, ouvre
                l'inspecteur (F12 → Réseau), clique sur une requête vers api.jinka.fr et copie la
                valeur de l'en-tête « Authorization » (ou du cookie LA_API_TOKEN). Colle-la ici.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Token Jinka"
                placeholderTextColor="#aaa"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                onSubmitEditing={connect}
              />
            </>
          ) : (
            <>
              <Text style={styles.hint}>Ton mot de passe n'est pas conservé.</Text>
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
            </>
          )}
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

type ModeChipProps = {
  value: ProviderAuthMethod;
  label: string;
  active: boolean;
  onSelect: (value: ProviderAuthMethod) => void;
};

const ModeChip = memo(function ModeChip({ value, label, active, onSelect }: ModeChipProps) {
  const handlePress = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <TouchableOpacity style={[styles.modeChip, active && styles.modeChipActive]} onPress={handlePress}>
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
});
