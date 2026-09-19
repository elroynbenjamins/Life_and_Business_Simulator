import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';

const sections = [
  ['Scope', 'This policy applies to the Life Empire Android application, including advertising, in-app purchases, local saves and external links. Life Empire does not require an account, and Snelroy does not operate a server that receives or stores your game saves.'],
  ['Information stored locally', 'Life Empire stores save games, your display name, progression, statistics, settings, achievements, Prestige progress, virtual-currency balances, advertising-removal status, daily rewards, rewarded-ad usage, purchase identifiers and advertising-consent status on your device. This information is not sent to a Snelroy or Life Empire server. Delete it by removing save slots, clearing the app storage or uninstalling the app.'],
  ['Advertising and consent', 'Life Empire uses Google AdMob for optional rewarded ads and occasional interstitial ads. Depending on your region and choices, Google and its advertising partners may process device or advertising identifiers, IP-derived approximate location, ad interactions, diagnostics and consent choices. Where required, Google’s consent form is shown before ads are requested. Choices can be reviewed under Support > Advertising Privacy. Remove Ads disables advertisements in Life Empire.'],
  ['In-app purchases', 'Life Empire uses Google Play Billing for optional gem packs and permanent ad removal. Google processes payment information. Life Empire and Snelroy do not receive your complete card number, bank details or Google password. The game stores product, purchase-status and transaction identifiers to deliver purchases, restore permanent entitlements and prevent duplicate fulfillment.'],
  ['External services', 'Life Empire may open Discord, GitHub, email applications and web pages. These are independent services with their own terms and privacy practices. Information you choose to provide to them is handled by those providers.'],
  ['Information not intentionally collected', 'Life Empire does not require an account and does not intentionally transmit to a Life Empire server your email address, contacts, precise location, photos, videos, recordings, government identifiers, payment-card details or financial credentials. All salaries, stocks, loans, properties and businesses in the game are fictional.'],
  ['Data sharing and security', 'Snelroy does not sell your personal information. Google may process information for advertising, consent management, Play distribution, purchases, security and diagnostics. Life Empire minimizes data collection by keeping game saves on your device. No storage or transmission method can be guaranteed completely secure.'],
  ['Retention and deletion', 'Local game information remains until you delete the save, clear app storage or uninstall the app. Google and other providers retain information under their own policies and legal obligations. There is no separate Life Empire server-side account to delete.'],
  ["Children's privacy", 'Life Empire is not directed to children under 13. We do not knowingly collect personal information directly from children through a Life Empire account or server.'],
  ['International users', 'Google and other providers may process information outside your country. Their policies explain applicable safeguards. Local save information remains on your device unless handled by a device backup or another service you enabled.'],
  ['Changes', 'This policy may be updated when Life Empire, applicable law or its providers change. The revised policy and effective date will be published online and may also be communicated in the game or store listing.'],
] as const;

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy for Life Empire</Text>
        <Text style={styles.effective}>Effective date: 23 August 2026</Text>
        <Text style={styles.body}>Life Empire is published by Snelroy and operated by Elroy N Benjamins. This policy explains what information is handled when you use the game.</Text>
        {sections.map(([title, body]) => <View key={title} style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View>)}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.body}>Snelroy · Elroy N Benjamins · The Netherlands</Text>
          <Pressable onPress={() => Linking.openURL('mailto:Developerelroy@gmail.com')}><Text style={styles.link}>Developerelroy@gmail.com</Text></Pressable>
        </View>
        <Pressable style={styles.onlineButton} onPress={() => Linking.openURL('https://elroynbenjamins.github.io/life-empire/privacy/')}>
          <Ionicons name="open-outline" size={18} color={Colors.white} /><Text style={styles.onlineText}>Open Online Policy</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 48 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  effective: { color: Colors.warning, fontSize: 13, marginTop: 5, marginBottom: 14 },
  section: { marginTop: 20 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  link: { color: Colors.info, fontSize: 14, fontWeight: '600', marginTop: 6 },
  onlineButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, marginTop: 26 },
  onlineText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
