import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../app/AppContext';
import { friendlyAuthError } from '../services/auth';
import { Dialog, OutlinedField, OutlinedPill, PillBadge, PrimaryButton, Row, Screen, T, useColors } from '../ui/kit';

export function LoginScreen({ onRegister }: { onRegister: () => void }) {
  const { auth } = useApp(); const c = useColors();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [google, setGoogle] = useState(false);
  const guest = async () => { setBusy(true); try { await auth.continueAsGuest(); } finally { setBusy(false); } };
  const login = async () => { setErr(null); setBusy(true); try { await auth.signIn(email, pw); } catch (e) { setErr(friendlyAuthError(e)); } finally { setBusy(false); } };
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T kind="headlineMedium" style={{ color: c.purple }}>FocusFox</T>
        <PillBadge text="OFFLINE READY" bg={c.purpleLight} color={c.purple} />
      </Row>
      <View style={{ height: 32 }} />
      <T kind="headlineLarge">Welcome back</T>
      <T kind="bodyDim">Let's get you into your study flow.</T>
      <View style={{ height: 28 }} />
      <OutlinedField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <View style={{ height: 16 }} />
      <OutlinedField label="Password" placeholder="••••••••" value={pw} onChangeText={setPw} secureTextEntry />
      {err ? <T kind="bodyDim" style={{ color: c.danger, marginTop: 8 }}>{err}</T> : null}
      <View style={{ height: 24 }} />
      <PrimaryButton title="Sign In" onPress={login} loading={busy} />
      <T kind="bodyDim" style={{ alignSelf: 'center', marginTop: 24 }}>or continue with</T>
      <Row style={{ marginTop: 12, gap: 12 }}>
        <OutlinedPill title="Google" onPress={() => setGoogle(true)} style={{ flex: 1, height: 48 }} />
        <OutlinedPill title="Guest Mode" onPress={guest} style={{ flex: 1, height: 48 }} />
      </Row>
      <Row style={{ justifyContent: 'center', marginTop: 32 }}>
        <T kind="bodyDim">New to FocusFox? </T>
        <Pressable onPress={onRegister}><T kind="label" style={{ color: c.purple }}>Create account</T></Pressable>
      </Row>
      <Dialog visible={google} title="Google Sign-In needs setup" onDismiss={() => setGoogle(false)} dismissLabel="Close" confirmLabel="Continue as Guest" onConfirm={() => { setGoogle(false); void guest(); }}>
        <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>Real Google Sign-In requires connecting this app to a Firebase or Google Cloud project (with your own OAuth client ID) — that's a one-time setup step for the developer, not something that can work out of the box. Until that's added, you can sign up with email or use Guest Mode.</Text>
      </Dialog>
    </Screen>
  );
}

export function RegisterScreen({ onLogin }: { onLogin: () => void }) {
  const { auth } = useApp(); const c = useColors();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    if (!name.trim() || !email.trim() || !pw) { setErr('Please fill in all fields.'); return; }
    setErr(null); setBusy(true);
    try { await auth.signUp(name, email, pw); } catch (e) { setErr(friendlyAuthError(e)); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <T kind="headlineLarge">Create your account</T>
      <T kind="bodyDim">A calm place for your academic life.</T>
      <View style={{ height: 24 }} />
      <OutlinedField label="Full name" placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
      <View style={{ height: 14 }} />
      <OutlinedField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <View style={{ height: 14 }} />
      <OutlinedField label="Password" placeholder="••••••••" value={pw} onChangeText={setPw} secureTextEntry />
      <View style={{ height: 14 }} />
      <OutlinedField label="Confirm password" placeholder="••••••••" value={pw2} onChangeText={setPw2} secureTextEntry />
      {err ? <T kind="bodyDim" style={{ color: c.danger, marginTop: 8 }}>{err}</T> : null}
      <View style={{ height: 24 }} />
      <PrimaryButton title="Create Account" onPress={submit} loading={busy} />
      <Row style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
        <PillBadge text="✓ Secure account" bg={c.purpleLight} color={c.purple} />
        <PillBadge text="● Cloud sync" bg={c.purpleLight} color={c.purple} />
        <PillBadge text="⇅ Offline mode" bg={c.purpleLight} color={c.purple} />
      </Row>
      <Row style={{ justifyContent: 'center', marginTop: 28 }}>
        <T kind="bodyDim">Already have an account? </T>
        <Pressable onPress={onLogin}><T kind="label" style={{ color: c.purple }}>Sign in</T></Pressable>
      </Row>
    </Screen>
  );
}
