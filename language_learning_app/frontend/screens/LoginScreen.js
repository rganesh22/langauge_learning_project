import React, { useState, useContext, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../components/SafeText';
import { AuthContext } from '../contexts/AuthContext';

const PRIMARY = '#4A90E2';
const PRIMARY_LIGHT = '#E8F4FD';
const PRIMARY_DARK = '#3B7BC6';
const TEXT = '#1F2937';
const TEXT_SECONDARY = '#6B7280';
const BORDER = '#E5E7EB';
const ERROR = '#DC2626';
const SUCCESS = '#059669';
const WEAK = '#DC2626';
const FAIR = '#EA580C';
const GOOD = '#CA8A04';
const STRONG = '#059669';

// Password strength: 0-4 based on length, lower, upper, number, special
function getPasswordStrength(p) {
  if (!p || !p.length) return { score: 0, label: '', color: BORDER };
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  const capped = Math.min(score, 4);
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = [WEAK, FAIR, GOOD, STRONG];
  const i = Math.min(capped, 3);
  return { score: capped, label: labels[i], color: colors[i] };
}

export default function LoginScreen() {
  const { login, signUp, sendPasswordReset, loginWithGoogle } = useContext(AuthContext);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const isSignUp = mode === 'signup';
  const isForgot = mode === 'forgot';
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const switchToSignIn = () => {
    setMode('signin');
    setError('');
    setForgotSuccess(false);
    setDisplayName('');
    setUsername('');
    setConfirmPassword('');
  };
  const switchToSignUp = () => {
    setMode('signup');
    setError('');
    setConfirmPassword('');
  };
  const switchToForgot = () => {
    setMode('forgot');
    setError('');
    setForgotSuccess(false);
  };

  const handleSubmit = async () => {
    const e = (email || '').trim();
    const p = password || '';
    setError('');

    if (isForgot) {
      if (!e) {
        setError('Please enter your email');
        return;
      }
      setLoading(true);
      try {
        await sendPasswordReset(e);
        setForgotSuccess(true);
      } catch (err) {
        const msg = err?.message || 'Something went wrong';
        setError(msg.replace('Firebase: ', '').replace('auth/', ''));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!e) {
      setError('Please enter your email');
      return;
    }
    if (!p) {
      setError('Please enter your password');
      return;
    }
    if (isSignUp) {
      if (p.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      const d = (displayName || '').trim();
      const u = (username || '').trim();
      if (!d) {
        setError('Please enter a display name');
        return;
      }
      if (!u) {
        setError('Please enter a username (handle)');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(u)) {
        setError('Username can only contain letters, numbers, and underscores');
        return;
      }
    } else {
      if (p.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(e, p, (displayName || '').trim(), (username || '').trim());
      } else {
        await login(e, p);
      }
    } catch (err) {
      const msg = err?.message || 'Something went wrong';
      setError(msg.replace('Firebase: ', '').replace('auth/', ''));
    } finally {
      setLoading(false);
    }
  };

  // ----- Forgot password view -----
  if (isForgot) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Ionicons name="key-outline" size={40} color={PRIMARY} />
              </View>
              <SafeText style={styles.title}>Reset password</SafeText>
              <SafeText style={styles.subtitle}>
                Enter your email and we'll send you a link to reset your password
              </SafeText>
            </View>

            <View style={styles.card}>
              {forgotSuccess ? (
                <>
                  <View style={styles.successWrap}>
                    <Ionicons name="checkmark-circle" size={56} color={SUCCESS} />
                    <SafeText style={styles.successTitle}>Check your email</SafeText>
                    <SafeText style={styles.successText}>
                      We've sent a password reset link to {email.trim()}
                    </SafeText>
                  </View>
                  <TouchableOpacity style={styles.buttonSecondary} onPress={switchToSignIn}>
                    <SafeText style={styles.buttonSecondaryText}>Back to sign in</SafeText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={TEXT_SECONDARY}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                  {error ? <SafeText style={styles.error}>{error}</SafeText> : null}
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <SafeText style={styles.buttonText}>Send reset link</SafeText>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={switchToSignIn} disabled={loading}>
                    <Ionicons name="arrow-back" size={18} color={PRIMARY} />
                    <SafeText style={styles.linkText}>Back to sign in</SafeText>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ----- Sign in / Sign up view -----
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="book-outline" size={44} color={PRIMARY} />
            </View>
            <SafeText style={styles.title}>Fluo</SafeText>
            <SafeText style={styles.subtitle}>Language learning, your way</SafeText>
          </View>

          <View style={styles.card}>
            <SafeText style={styles.cardTitle}>{isSignUp ? 'Create account' : 'Welcome back'}</SafeText>
            <SafeText style={styles.cardSubtitle}>
              {isSignUp ? 'Sign up to save your progress and sync across devices' : 'Sign in to continue'}
            </SafeText>

            {isSignUp && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Display name"
                  placeholderTextColor={TEXT_SECONDARY}
                  value={displayName}
                  onChangeText={setDisplayName}
                  editable={!loading}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Username (letters, numbers, underscores)"
                  placeholderTextColor={TEXT_SECONDARY}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!loading}
                />
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={TEXT_SECONDARY}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder={isSignUp ? 'Password (min 8 characters)' : 'Password'}
              placeholderTextColor={TEXT_SECONDARY}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            {isSignUp && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor={TEXT_SECONDARY}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!loading}
                />
                {password.length > 0 && (
                  <View style={styles.strengthWrap}>
                    <View style={styles.strengthBarBg}>
                      <View
                        style={[
                          styles.strengthBarFill,
                          {
                            width: `${(passwordStrength.score / 4) * 100}%`,
                            backgroundColor: passwordStrength.color,
                          },
                        ]}
                      />
                    </View>
                    {passwordStrength.label ? (
                      <SafeText style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </SafeText>
                    ) : null}
                  </View>
                )}
              </>
            )}

            {!isSignUp && (
              <TouchableOpacity style={styles.forgotWrap} onPress={switchToForgot} disabled={loading}>
                <SafeText style={styles.forgotText}>Forgot password?</SafeText>
              </TouchableOpacity>
            )}

            {error ? <SafeText style={styles.error}>{error}</SafeText> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <SafeText style={styles.buttonText}>{isSignUp ? 'Create account' : 'Sign in'}</SafeText>
              )}
            </TouchableOpacity>

            {!loading && (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <SafeText style={styles.orLabel}>OR</SafeText>
                  <View style={styles.orLine} />
                </View>

                <TouchableOpacity
                  style={styles.buttonSecondary}
                  onPress={async () => {
                    setError('');
                    setLoading(true);
                    try {
                      await loginWithGoogle();
                    } catch (err) {
                      const msg = err?.message || 'Google sign-in failed';
                      setError(msg.replace('Firebase: ', '').replace('auth/', ''));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="logo-google" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
                    <SafeText style={styles.buttonSecondaryText}>Continue with Google</SafeText>
                  </View>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.switch}
              onPress={isSignUp ? switchToSignIn : switchToSignUp}
              disabled={loading}
            >
              <SafeText style={styles.switchText}>
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </SafeText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: TEXT,
    marginBottom: 14,
    backgroundColor: '#FAFAFA',
  },
  strengthWrap: {
    marginBottom: 14,
  },
  strengthBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '500',
  },
  error: {
    fontSize: 14,
    color: ERROR,
    marginBottom: 12,
    lineHeight: 20,
  },
  button: {
    height: 52,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonSecondary: {
    height: 52,
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },
  orLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginHorizontal: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  linkText: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '500',
  },
  switch: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 15,
    color: PRIMARY,
    fontWeight: '500',
  },
  successWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    marginTop: 12,
    marginBottom: 6,
  },
  successText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
});
