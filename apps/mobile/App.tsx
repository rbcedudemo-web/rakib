/**
 * Android app for "সবার জন্য ডিজিটাল দূরশিক্ষণ".
 *
 * The app opens the same student portal as the website (same accounts, lessons,
 * exams and results) inside a native shell, so every feature built for the web
 * works on the phone on day one. The shell adds what a phone needs: a splash
 * screen, the hardware back button, camera access for answer-sheet photos,
 * a clear message when there is no internet, and outside links opened in the
 * phone's browser.
 */
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from "react";
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation, type WebViewProps } from "react-native-webview";

// react-native-webview's class typings resolve to `never` props under React 19.3 types; same component, typed props
const AppWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

void SplashScreen.preventAutoHideAsync();

const extra = (Constants.expoConfig?.extra ?? {}) as { siteUrl?: string; startPath?: string };
const SITE = (extra.siteUrl ?? "https://rakib-azure.vercel.app").replace(/\/$/, "");
const START = `${SITE}${extra.startPath ?? "/me"}`;
const SITE_HOST = new URL(SITE).host;

const GREEN = "#006a4e";

/** Hosts the portal itself needs inside the app (login, storage files, YouTube player). */
function staysInApp(url: string): boolean {
  if (url.startsWith("about:") || url.startsWith("blob:") || url.startsWith("data:")) return true;
  try {
    const host = new URL(url).host;
    return (
      host === SITE_HOST ||
      host.endsWith(".supabase.co") ||
      host.endsWith("youtube.com") ||
      host.endsWith("youtube-nocookie.com") ||
      host.endsWith("ytimg.com") ||
      host.endsWith("googlevideo.com")
    );
  } catch {
    return false;
  }
}

function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.icon}>📶</Text>
      <Text style={styles.title}>ইন্টারনেট সংযোগ নেই</Text>
      <Text style={styles.body}>Wi-Fi বা মোবাইল ডেটা চালু করে আবার চেষ্টা করুন।</Text>
      <Text style={styles.bodyEn}>No internet connection. Turn on Wi-Fi or mobile data and try again.</Text>
      <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.buttonText}>আবার চেষ্টা করুন</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const web = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0); // remounts the WebView on retry

  // Android back button: go back inside the portal first, then leave the app
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current && web.current) {
        web.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // when the connection comes back after an error, load again by itself
  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && failed) {
        setFailed(false);
        setKey((k) => k + 1);
      }
    });
  }, [failed]);

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    setKey((k) => k + 1);
  }, []);

  const onNav = (nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        {failed ? (
          <Offline onRetry={retry} />
        ) : (
          <AppWebView
            key={key}
            ref={web}
            source={{ uri: START }}
            style={styles.web}
            applicationNameForUserAgent="RupshiApp/0.1"
            // sign-in stays after closing the app
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            cacheEnabled
            // lesson videos
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // answer-sheet photos: <input type="file" capture> opens the camera or gallery
            allowFileAccess
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            setSupportMultipleWindows={false}
            pullToRefreshEnabled
            onNavigationStateChange={onNav}
            onShouldStartLoadWithRequest={(req) => {
              if (staysInApp(req.url)) return true;
              void Linking.openURL(req.url); // outside links open in the phone's browser
              return false;
            }}
            onLoadEnd={() => {
              setLoading(false);
              void SplashScreen.hideAsync();
            }}
            onError={() => {
              setFailed(true);
              void SplashScreen.hideAsync();
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 500) setFailed(true);
            }}
            onRenderProcessGone={retry}
          />
        )}
        {loading && !failed && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  web: { flex: 1 },
  loader: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  icon: { fontSize: 44 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  body: { fontSize: 15, color: "#334155", textAlign: "center" },
  bodyEn: { fontSize: 13, color: "#64748b", textAlign: "center" },
  button: { marginTop: 12, backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 22, minHeight: 48, justifyContent: "center" },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
});
