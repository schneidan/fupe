import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/lookup_result.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ApiService {
  ApiService({required this.baseUrl});

  final String baseUrl;

  Future<LookupResult> lookupText(String query) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/lookup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'type': 'TEXT', 'query': query}),
    );

    return _parseLookupResponse(response);
  }

  Future<LookupResult> lookupBarcode(String gtin) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/lookup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'type': 'BARCODE', 'gtin': gtin}),
    );

    return _parseLookupResponse(response);
  }

  Future<LookupResult> lookupImage(File file) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/v1/lookup'),
    );
    request.fields['type'] = 'IMAGE';
    request.files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    return _parseLookupResponse(response);
  }

  Future<({List<EntitySummary> items, int total})> listEntities({
    String? q,
    String? type,
    String? country,
    bool peOnly = false,
    int page = 1,
    int limit = 20,
  }) async {
    final params = <String, String>{
      'page': '$page',
      'limit': '$limit',
      if (q != null && q.isNotEmpty) 'q': q,
      if (type != null && type.isNotEmpty) 'type': type,
      if (country != null && country.isNotEmpty) 'country': country,
      if (peOnly) 'pe_only': 'true',
    };

    final uri = Uri.parse('$baseUrl/api/v1/entities').replace(
      queryParameters: params,
    );
    final response = await http.get(uri);

    if (response.statusCode != 200) {
      throw ApiException('Failed to load directory');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final items = (data['items'] as List<dynamic>? ?? [])
        .map((e) => EntitySummary.fromJson(e as Map<String, dynamic>))
        .toList();
    final total = data['total'] as int? ?? items.length;
    return (items: items, total: total);
  }

  LookupResult _parseLookupResponse(http.Response response) {
    if (response.statusCode == 404) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final msg = body['message'];
      throw ApiException(msg is String ? msg : 'Not found');
    }

    if (response.statusCode != 200 && response.statusCode != 201) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final msg = body['message'];
      throw ApiException(
        msg is String ? msg : 'Lookup failed (${response.statusCode})',
      );
    }

    return LookupResult.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }
}
