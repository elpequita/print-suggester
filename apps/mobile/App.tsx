import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import type { AccessoryCategory, PrintResult, SearchResponse } from './types';

const C = {
  bg: '#08080c',
  card: '#15151c',
  cardElevated: '#1d1d26',
  border: '#27272f',
  borderSoft: '#1f1f27',
  text: '#ffffff',
  textSecondary: '#9da0aa',
  textMuted: '#54565e',
  accent: '#7be1c8',
  accentDim: '#2a5e54',
  warn: '#f7c674',
};

const queryClient = new QueryClient();

function getApiBase(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8787`;
  }
  return 'http://127.0.0.1:8787';
}

const API_BASE = getApiBase();

type AnalyzeResult = SearchResponse & { sourceImage: string };

async function searchPrints(imageUri: string): Promise<AnalyzeResult> {
  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!manipulated.base64) throw new Error('Image conversion failed');

  const res = await fetch(`${API_BASE}/searches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image_base64: manipulated.base64 }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as SearchResponse;
  return { ...data, sourceImage: imageUri };
}

function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: C.text,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 10,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color="#000" />
      <Text style={{ color: '#000', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: 'transparent',
        borderColor: C.border,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 10,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={C.text} />
      <Text style={{ color: C.text, fontWeight: '600', fontSize: 16, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CaptureScreen({ onResult }: { onResult: (r: AnalyzeResult) => void }) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: searchPrints,
    onSuccess: (data) => {
      setPreviewUri(null);
      onResult(data);
    },
    onError: (e) => {
      setPreviewUri(null);
      Alert.alert('Search failed', String(e));
    },
  });

  const run = (uri: string) => {
    setPreviewUri(uri);
    mutation.mutate(uri);
  };

  const onCapture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access in Settings to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    run(result.assets[0].uri);
  };

  const onPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo permission needed', 'Enable photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    run(result.assets[0].uri);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient
        colors={['#15151f', '#08080c', '#08080c']}
        locations={[0, 0.6, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: 100,
          paddingBottom: 48,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'flex-start', gap: 12 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: C.cardElevated,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <Ionicons name="cube" size={28} color={C.accent} />
          </View>
          <Text
            style={{
              color: C.text,
              fontSize: 36,
              fontWeight: '800',
              letterSpacing: -0.5,
              lineHeight: 40,
            }}
          >
            What can I{'\n'}print for that?
          </Text>
          <Text
            style={{
              color: C.textSecondary,
              fontSize: 16,
              lineHeight: 22,
              marginTop: 4,
            }}
          >
            Snap an object. Get curated 3D-printable accessories from Printables and MakerWorld.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <PrimaryButton
            label="Take photo"
            icon="camera"
            onPress={onCapture}
            disabled={mutation.isPending}
          />
          <SecondaryButton
            label="Choose from library"
            icon="images-outline"
            onPress={onPick}
            disabled={mutation.isPending}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 12,
              gap: 6,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: C.accent,
              }}
            />
            <Text style={{ color: C.textMuted, fontSize: 11 }}>
              {API_BASE.replace('http://', '')}
            </Text>
          </View>
        </View>
      </View>

      {mutation.isPending && previewUri ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(8,8,12,0.92)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: 24,
          }}
        >
          <View
            style={{
              width: 240,
              height: 240,
              borderRadius: 24,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Image source={{ uri: previewUri }} style={{ width: '100%', height: '100%' }} />
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={C.accent} size="small" />
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>Analyzing…</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center' }}>
              Identifying object and matching prints
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ConfidenceDots({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i < filled ? C.accent : C.border,
          }}
        />
      ))}
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: C.cardElevated,
        borderWidth: 1,
        borderColor: C.borderSoft,
      }}
    >
      <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

function ResultCard({ item, onPress }: { item: PrintResult; onPress: () => void }) {
  const isMakerworld = item.source === 'makerworld';
  const sourceLabel = isMakerworld ? 'MakerWorld' : 'Printables';
  const stats: string[] = [];
  if (item.likes && item.likes > 0) stats.push(`${item.likes.toLocaleString()} ★`);
  if (item.downloads && item.downloads > 0) stats.push(`${item.downloads.toLocaleString()} ↓`);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        backgroundColor: pressed ? C.cardElevated : C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.borderSoft,
        overflow: 'hidden',
      })}
    >
      <View
        style={{
          width: 72,
          height: 72,
          backgroundColor: C.cardElevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={{ width: 72, height: 72 }} />
        ) : (
          <Ionicons
            name={isMakerworld ? 'search-outline' : 'cube-outline'}
            size={28}
            color={C.textMuted}
          />
        )}
      </View>
      <View style={{ flex: 1, padding: 12, gap: 4, justifyContent: 'center' }}>
        <Text
          style={{ color: C.text, fontSize: 14, fontWeight: '600', lineHeight: 18 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              color: isMakerworld ? C.warn : C.accent,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 0.3,
            }}
          >
            {sourceLabel.toUpperCase()}
          </Text>
          {stats.length > 0 ? (
            <Text style={{ color: C.textMuted, fontSize: 11 }}>· {stats.join(' · ')}</Text>
          ) : null}
        </View>
      </View>
      <View style={{ paddingRight: 14, justifyContent: 'center' }}>
        <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
      </View>
    </Pressable>
  );
}

function CategorySection({
  category,
  items,
  onOpen,
}: {
  category: AccessoryCategory;
  items: PrintResult[];
  onOpen: (url: string) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{category.label}</Text>
          {category.reasoning ? (
            <Text style={{ color: C.textMuted, fontSize: 12 }}>{category.reasoning}</Text>
          ) : null}
        </View>
        <ConfidenceDots value={category.confidence} />
      </View>
      <View style={{ gap: 8 }}>
        {items.map((it) => (
          <ResultCard key={it.url} item={it} onPress={() => onOpen(it.url)} />
        ))}
      </View>
    </View>
  );
}

function ResultsScreen({ data, onBack }: { data: AnalyzeResult; onBack: () => void }) {
  const grouped = new Map<string, PrintResult[]>();
  for (const r of data.results) {
    const list = grouped.get(r.category);
    if (list) list.push(r);
    else grouped.set(r.category, [r]);
  }

  const open = (url: string) => {
    WebBrowser.openBrowserAsync(url, {
      toolbarColor: C.bg,
      controlsColor: C.accent,
    }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: data.sourceImage }}
            style={{ width: '100%', height: 320 }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(8,8,12,0)', 'rgba(8,8,12,0.6)', C.bg]}
            locations={[0.4, 0.8, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <Pressable
            onPress={onBack}
            style={({ pressed }) => ({
              position: 'absolute',
              top: 56,
              left: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: pressed ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          {data.cached ? (
            <View
              style={{
                position: 'absolute',
                top: 56,
                right: 16,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: 'rgba(123,225,200,0.15)',
                borderWidth: 1,
                borderColor: C.accentDim,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="flash" size={11} color={C.accent} />
              <Text style={{ color: C.accent, fontSize: 11, fontWeight: '600' }}>cached</Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: -24, gap: 24 }}>
          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: C.text,
                fontSize: 30,
                fontWeight: '800',
                letterSpacing: -0.4,
                textTransform: 'capitalize',
              }}
            >
              {data.vision.object}
            </Text>
            {data.vision.attributes.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {data.vision.attributes.map((a) => (
                  <Chip key={a} label={a} />
                ))}
              </View>
            ) : null}
          </View>

          <View style={{ height: 1, backgroundColor: C.borderSoft, marginVertical: 4 }} />

          <View style={{ gap: 28 }}>
            {data.vision.accessory_categories.map((cat) => {
              const items = grouped.get(cat.label) ?? [];
              if (items.length === 0) return null;
              return (
                <CategorySection
                  key={cat.label}
                  category={cat}
                  items={items}
                  onOpen={open}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function App() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  return (
    <QueryClientProvider client={queryClient}>
      {result ? (
        <ResultsScreen data={result} onBack={() => setResult(null)} />
      ) : (
        <CaptureScreen onResult={setResult} />
      )}
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}
