import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'navigation/deep_links.dart';
import 'screens/shell_screen.dart';
import 'services/api_service.dart';
import 'theme/fupe_theme.dart';

String _defaultApiBaseUrl() {
  if (kIsWeb) return 'http://localhost:3000';
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return 'http://10.0.2.2:3000';
    case TargetPlatform.iOS:
    case TargetPlatform.macOS:
      return 'http://localhost:3000';
    default:
      return 'http://localhost:3000';
  }
}

final _navigatorKey = GlobalKey<NavigatorState>();

void main() {
  const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: '',
  );

  runApp(
    Provider(
      create: (_) => ApiService(
        baseUrl: apiUrl.isNotEmpty ? apiUrl : _defaultApiBaseUrl(),
      ),
      child: const FupeApp(),
    ),
  );
}

class FupeApp extends StatelessWidget {
  const FupeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return DeepLinkListener(
      navigatorKey: _navigatorKey,
      child: MaterialApp(
        title: 'FUPE',
        theme: fupeTheme(),
        navigatorKey: _navigatorKey,
        home: const ShellScreen(),
      ),
    );
  }
}
