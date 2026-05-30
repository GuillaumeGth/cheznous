import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { logError } from '@/lib/errorReporting';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, `ErrorBoundary: ${info.componentStack?.substring(0, 200)}`);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.container}>
        <Text style={s.title}>Une erreur est survenue</Text>
        <ScrollView style={s.scroll}>
          <Text style={s.message}>{error.message}</Text>
          {__DEV__ && <Text style={s.stack}>{error.stack}</Text>}
        </ScrollView>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null })}>
          <Text style={s.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  title: { color: '#ff6b6b', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  scroll: { maxHeight: 300, marginBottom: 24 },
  message: { color: '#fff', fontSize: 15, marginBottom: 8 },
  stack: { color: '#aaa', fontSize: 11, fontFamily: 'monospace' },
  btn: { backgroundColor: '#4A6CF7', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
