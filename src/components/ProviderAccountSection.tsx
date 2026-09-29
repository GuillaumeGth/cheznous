import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProviderAccount } from '@/hooks/useProviderAccount';
import { refreshListingsIfActive } from '@/hooks/useListings';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { callableErrorMessage, refetchProvider, setGlobalProviderToken } from '@/services/providerAccounts';
import { styles } from '@/styles/providerAccount.styles';

type Props = {
  onMessage: (message: string, type: 'success' | 'error' | 'info') => void;
};

type Busy = 'token' | 'refetch' | null;

const EXPIRY_WARNING_DAYS = 5;
const DAY_MS = 86_400_000;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Profile section, visible to the app admin only: status of the app-wide Jinka
// account, token expiry, manual refetch and token replacement. Other users
// never configure anything — they just link alerts from the filters.
export default function ProviderAccountSection({ onMessage }: Props) {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const account = useProviderAccount();
  const [token, setToken] = useState('');
  const [editingToken, setEditingToken] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const saveToken = useCallback(async () => {
    if (!token.trim()) return;
    setBusy('token');
    try {
      const { alerts, expiresAt } = await setGlobalProviderToken(token.trim());
      setToken('');
      setEditingToken(false);
      refreshListingsIfActive(useFilterStore.getState().activeListId);
      onMessage(
        `Token Jinka enregistré · ${alerts.length} alerte${alerts.length > 1 ? 's' : ''}${expiresAt ? ` · valable jusqu'au ${formatDate(expiresAt)}` : ''}`,
        'success',
      );
    } catch (e) {
      onMessage(callableErrorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }, [token, onMessage]);

  // Refetch from Jinka now, then reload the swipe stack with the fresh feed.
  const refetch = useCallback(async () => {
    setBusy('refetch');
    try {
      const { feeds, newItems, expiredItems } = await refetchProvider();
      refreshListingsIfActive(useFilterStore.getState().activeListId);
      if (feeds === 0) {
        onMessage('Alertes mises à jour. Lie une alerte à une recherche pour voir ses annonces.', 'info');
      } else {
        const parts = [
          newItems > 0 ? `${newItems} nouvelle${newItems > 1 ? 's' : ''}` : null,
          expiredItems > 0 ? `${expiredItems} expirée${expiredItems > 1 ? 's' : ''}` : null,
        ].filter(Boolean);
        onMessage(`Annonces à jour${parts.length ? ` · ${parts.join(', ')}` : ''}`, 'success');
      }
    } catch (e) {
      onMessage(callableErrorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }, [onMessage]);

  const startEditing = useCallback(() => setEditingToken(true), []);
  const cancelEditing = useCallback(() => { setEditingToken(false); setToken(''); }, []);

  if (!account || !uid || !account.admin_uids?.includes(uid)) return null;

  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : null;
  const daysLeft = expiresAt !== null ? Math.floor((expiresAt - Date.now()) / DAY_MS) : null;
  const expired = account.status === 'expired' || (daysLeft !== null && expiresAt! <= Date.now());
  const expiringSoon = !expired && daysLeft !== null && daysLeft < EXPIRY_WARNING_DAYS;
  const showTokenForm = editingToken || expired;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.icon}>
          <Ionicons name="home-outline" size={20} color="#4A6CF7" />
        </View>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>Jinka · compte de l'app</Text>
          <Text style={styles.subtitle}>
            {account.last_sync_at ? `Synchro ${formatDate(account.last_sync_at)}` : 'Pas encore synchronisé'}
          </Text>
        </View>
      </View>

      {expired ? (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>
            Le token Jinka a expiré : plus aucune annonce n'arrive. Colle un nouveau token.
          </Text>
        </View>
      ) : expiringSoon ? (
        <View style={styles.warning}>
          <Ionicons name="time-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>
            Le token Jinka expire {daysLeft! <= 0 ? "aujourd'hui" : `dans ${daysLeft} jour${daysLeft! > 1 ? 's' : ''}`} : pense à le remplacer.
          </Text>
        </View>
      ) : account.status === 'error' && account.last_error ? (
        <View style={styles.warning}>
          <Ionicons name="cloud-offline-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>Dernière synchro en échec : {account.last_error}</Text>
        </View>
      ) : null}

      {account.alerts.map((alert) => (
        <View key={alert.id} style={styles.alertRow}>
          <Ionicons name="notifications-outline" size={14} color="#888" />
          <Text style={styles.alertName} numberOfLines={1}>{alert.name}</Text>
        </View>
      ))}
      {account.token_expires_at && !expired && (
        <Text style={styles.hint}>Token valable jusqu'au {formatDate(account.token_expires_at)}.</Text>
      )}

      {showTokenForm ? (
        <>
          <Text style={styles.hint}>
            Sur ordinateur, connecte-toi à jinka.fr, ouvre l'inspecteur (⌥⌘I → Réseau), clique sur
            une requête vers api.jinka.fr et copie la valeur de l'en-tête « Authorization » (ou du
            cookie LA_API_TOKEN). Colle-la ici.
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
            onSubmitEditing={saveToken}
          />
          <View style={styles.actionsRow}>
            {!expired && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={cancelEditing} disabled={busy !== null}>
                <Text style={styles.secondaryBtnText}>Annuler</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, styles.flexBtn, (!token.trim() || busy !== null) && styles.primaryBtnDisabled]}
              onPress={saveToken}
              disabled={!token.trim() || busy !== null}
            >
              {busy === 'token'
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Enregistrer le token</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={refetch} disabled={busy !== null}>
            {busy === 'refetch'
              ? <ActivityIndicator size="small" color="#4A6CF7" />
              : <Text style={styles.secondaryBtnText}>Actualiser les annonces</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={startEditing} disabled={busy !== null}>
            <Text style={styles.secondaryBtnText}>Remplacer le token</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
