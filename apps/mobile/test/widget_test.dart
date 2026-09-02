import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:fupe_mobile/main.dart';
import 'package:fupe_mobile/services/api_service.dart';

void main() {
  testWidgets('FUPE ask screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      Provider(
        create: (_) => ApiService(baseUrl: 'http://localhost:3000'),
        child: const FupeApp(),
      ),
    );

    expect(find.text('FUPE'), findsOneWidget);
    expect(find.text('owned by PE?'), findsOneWidget);
    expect(find.text('SEARCH'), findsOneWidget);
  });
}
