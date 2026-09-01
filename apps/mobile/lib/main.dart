import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';

void main() {
  runApp(
    Provider(
      create: (_) => ApiService(baseUrl: 'http://localhost:3000'),
      child: const FupeApp(),
    ),
  );
}

class FupeApp extends StatelessWidget {
  const FupeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FUPE',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0D9488),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
