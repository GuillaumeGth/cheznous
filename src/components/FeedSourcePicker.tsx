import React, { memo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeedLink } from '@/hooks/useFeedLink';
import { useProviderAccount } from '@/hooks/useProviderAccount';
import { APP_TOKEN_EXPIRED_MESSAGE, callableErrorMessage, linkSearchList } from '@/services/providerAccounts';
import { ProviderAlert } from '@/types';
import { styles } from '@/styles/feedSourcePicker.styles';

type Props = {
  groupId: string | null;
  listId: string;
};

// Busy target: an alert id being linked, 'unlink', or nothing.
type Busy = string | null;

// FilterSheet section: which Jinka alert feeds this search list. The alerts are
// the app-wide Jinka account's; any member can link one, the whole group then
// swipes its listings.
export default function FeedSourcePicker({ groupId, listId }: Props) {
  const link = useFeedLink(groupId, listId);
  const account = useProviderAccount();
  const [busy, setBusy] = useState<Busy>(null);

  const setAlert = useCallback(async (alertId: string | null) => {
    if (!groupId) return;
    setBusy(alertId ?? 'unlink');
    try {
      // The swipe screen reloads by itself when the link changes (feedKey).
      await linkSearchList(groupId, listId, alertId);
    } catch (e) {
      Alert.alert('Jinka', callableErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }, [groupId, listId]);

  const unlink = useCallback(() => setAlert(null), [setAlert]);

  if (link === undefined || account === undefined) {
    return <ActivityIndicator color="#4A6CF7" />;
  }

  const alerts = account && account.status !== 'expired' ? account.alerts : [];

  return (
    <View style={styles.container}>
      {link ? (
        <View style={styles.linkedCard}>
          <Ionicons name="link-outline" size={18} color="#4A6CF7" />
          <View style={styles.linkedTexts}>
            <Text style={styles.linkedTitle} numberOfLines={1}>{link.alert_name}</Text>
            {link.status === 'ok' ? (
              <Text style={styles.linkedSub}>Alerte Jinka</Text>
            ) : (
              <Text style={styles.linkedSubWarning}>
                {link.status === 'expired' ? APP_TOKEN_EXPIRED_MESSAGE : 'Alerte introuvable ou synchro en échec'}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={unlink} disabled={busy !== null}>
            {busy === 'unlink'
              ? <ActivityIndicator size="small" color="#FF4444" />
              : <Text style={styles.unlinkText}>Délier</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.hint}>
          Aucune alerte liée : choisis une alerte Jinka pour alimenter cette recherche.
        </Text>
      )}

      {alerts.length > 0 ? (
        <View style={styles.chips}>
          {alerts.map((alert) => (
            <AlertChip
              key={alert.id}
              alert={alert}
              selected={link?.alert_id === alert.id}
              busy={busy === alert.id}
              disabled={busy !== null}
              onSelect={setAlert}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>
          {account?.status === 'expired' ? APP_TOKEN_EXPIRED_MESSAGE : 'Aucune alerte Jinka disponible pour le moment.'}
        </Text>
      )}
    </View>
  );
}

type AlertChipProps = {
  alert: ProviderAlert;
  selected: boolean;
  busy: boolean;
  disabled: boolean;
  onSelect: (alertId: string) => void;
};

const AlertChip = memo(function AlertChip({ alert, selected, busy, disabled, onSelect }: AlertChipProps) {
  const handlePress = useCallback(() => onSelect(alert.id), [onSelect, alert.id]);
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={handlePress}
      disabled={disabled || selected}
    >
      {busy && <ActivityIndicator size="small" color={selected ? '#fff' : '#4A6CF7'} />}
      <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>
        {alert.name}
      </Text>
    </TouchableOpacity>
  );
});
