import 'dart:convert';
import 'package:http/http.dart' as http;

class OwnershipResult {
  final Map<String, dynamic>? product;
  final Map<String, dynamic>? manufacturer;
  final List<dynamic> owners;
  final bool isPeBacked;
  final List<dynamic> peFirms;

  OwnershipResult({
    this.product,
    this.manufacturer,
    required this.owners,
    required this.isPeBacked,
    required this.peFirms,
  });

  factory OwnershipResult.fromJson(Map<String, dynamic> json) {
    return OwnershipResult(
      product: json['product'] as Map<String, dynamic>?,
      manufacturer: json['manufacturer'] as Map<String, dynamic>?,
      owners: json['owners'] as List<dynamic>? ?? [],
      isPeBacked: json['isPeBacked'] as bool? ?? false,
      peFirms: json['peFirms'] as List<dynamic>? ?? [],
    );
  }
}

class ApiService {
  ApiService({required this.baseUrl});

  final String baseUrl;

  Future<OwnershipResult?> lookupBarcode(String gtin) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/lookup/barcode'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'gtin': gtin}),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      return null;
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final result = data['result'];
    if (result == null) return null;
    return OwnershipResult.fromJson(result as Map<String, dynamic>);
  }

  Future<List<dynamic>> searchEntities(String query) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/lookup/search?q=${Uri.encodeQueryComponent(query)}'),
    );

    if (response.statusCode != 200) return [];
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['results'] as List<dynamic>? ?? [];
  }
}
