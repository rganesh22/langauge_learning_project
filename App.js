import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import DashboardScreen from './screens/DashboardScreen';
import VocabLibraryScreen from './screens/VocabLibraryScreen';
import ProfileScreen from './screens/ProfileScreen';
import PracticeScreen from './screens/PracticeScreen';
import LessonsScreen from './screens/LessonsScreen';
import ActivityScreen from './screens/ActivityScreenNew';
import ActivityHistoryScreen from './screens/ActivityHistoryScreen';
import FlashcardScreen from './screens/FlashcardScreen';
import { Ionicons } from '@expo/vector-icons';
import LanguageProvider from './contexts/LanguageContext';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View, Text as RNText } from 'react-native';
import SafeText from './components/SafeText';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Practice') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'Lessons') {
            iconName = focused ? 'school' : 'school-outline';
          } else if (route.name === 'Vocab') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Practice" component={PracticeScreen} />
      <Tab.Screen name="Lessons" component={LessonsScreen} />
      <Tab.Screen name="Vocab" component={VocabLibraryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  // Load app fonts (ensure assets/fonts/Noto_Nastaliq_Urdu/static/* exists)
  // We register separate family names for weight variants so components can select
  // the correct font when a fontWeight is requested.
  const [fontsLoaded] = useFonts({
    'Noto Nastaliq Urdu': require('./assets/fonts/Noto_Nastaliq_Urdu/static/NotoNastaliqUrdu-Regular.ttf'),
    'Noto Nastaliq Urdu-Medium': require('./assets/fonts/Noto_Nastaliq_Urdu/static/NotoNastaliqUrdu-Medium.ttf'),
    'Noto Nastaliq Urdu-SemiBold': require('./assets/fonts/Noto_Nastaliq_Urdu/static/NotoNastaliqUrdu-SemiBold.ttf'),
    'Noto Nastaliq Urdu-Bold': require('./assets/fonts/Noto_Nastaliq_Urdu/static/NotoNastaliqUrdu-Bold.ttf'),
  });

  // Sync SRS quotas from weekly goals on app startup
  useEffect(() => {
    const syncSrsQuotas = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/srs/sync-quotas-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          console.log('✓ SRS quotas synced on app startup:', data);
        }
      } catch (error) {
        console.error('Failed to sync SRS quotas on startup:', error);
      }
    };

    syncSrsQuotas();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }
  // Patch React.createElement once so that any usage of the native
  // React Native Text component is rendered via our SafeText wrapper.
  // SafeText applies the Noto Nastaliq Urdu font when Arabic script
  // is detected or when the selected language is Urdu. We guard this
  // with a global flag to avoid re-patching on hot reloads.
  if (!global.__SafeText_createElement_patched) {
    const origCreate = React.createElement;
    React.createElement = (type, props, ...children) => {
      try {
        if (type === RNText) {
          return origCreate(SafeText, props, ...children);
        }
      } catch (e) {
        // If anything goes wrong, fall back to original behavior
        console.error('SafeText createElement patch error:', e);
      }
      return origCreate(type, props, ...children);
    };
    global.__SafeText_createElement_patched = true;
  }
  return (
    <LanguageProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Activity" component={ActivityScreen} />
          <Stack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
          <Stack.Screen name="Flashcards" component={FlashcardScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </LanguageProvider>
  );
}
