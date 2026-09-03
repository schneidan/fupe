import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:fupe_mobile/main.dart';
import 'package:fupe_mobile/services/api_service.dart';
import 'package:fupe_mobile/services/admin_api_service.dart';
import 'package:fupe_mobile/services/auth_service.dart';

void main() {
  testWidgets('FUPE ask screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider(create: (_) => ApiService(baseUrl: 'http://localhost:3000')),
          Provider(
            create: (_) => AdminApiService(baseUrl: 'http://localhost:3000'),
          ),
          ChangeNotifierProvider(
            create: (_) => AuthService(baseUrl: 'http://localhost:3000'),
          ),
        ],
        child: const FupeApp(),
      ),
    );

    expect(find.text('FUPE'), findsOneWidget);
    expect(find.text('owned by PE?'), findsOneWidget);
    expect(find.text('SEARCH'), findsOneWidget);
  });
}
