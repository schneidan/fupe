import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ResultScreen extends StatelessWidget {
  const ResultScreen({
    super.key,
    required this.gtin,
    required this.result,
  });

  final String gtin;
  final OwnershipResult? result;

  @override
  Widget build(BuildContext context) {
    if (result == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Not Found')),
        body: Center(child: Text('No data for GTIN $gtin')),
      );
    }

    final product = result!.product;
    final isPe = result!.isPeBacked;

    return Scaffold(
      appBar: AppBar(title: Text(product?['name'] as String? ?? gtin)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (isPe)
            Card(
              color: Colors.red.shade50,
              child: const ListTile(
                leading: Icon(Icons.warning_amber, color: Colors.red),
                title: Text('PE Backed', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          if (product != null)
            ListTile(
              title: Text(product['name'] as String? ?? ''),
              subtitle: Text('GTIN: ${product['gtin']}'),
            ),
          if (result!.manufacturer != null)
            ListTile(
              title: const Text('Manufacturer'),
              subtitle: Text(result!.manufacturer!['name'] as String? ?? ''),
            ),
          if (result!.owners.isNotEmpty) ...[
            const Divider(),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text('Ownership Chain', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            ...result!.owners.map((o) {
              final owner = o as Map<String, dynamic>;
              return ListTile(
                dense: true,
                title: Text(owner['name'] as String? ?? ''),
                subtitle: Text(owner['type'] as String? ?? ''),
              );
            }),
          ],
        ],
      ),
    );
  }
}
