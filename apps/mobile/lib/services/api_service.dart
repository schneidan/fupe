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

  Future<Map<String, dynamic>> submitEdit({
    required String token,
    required String targetNodeId,
    required Map<String, dynamic> proposedData,
    required String citationUrl,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/edits'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'target_node_id': targetNodeId,
        'proposed_data': proposedData,
        'citation_url': citationUrl,
      }),
    );
    return _parseJsonMap(response);
  }

  Future<List<QueueEdit>> listMyEdits({
    required String token,
    String? status,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/edits/mine').replace(
      queryParameters: {
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    final response = await http.get(
      uri,
      headers: {'Authorization': 'Bearer $token'},
    );
    final data = _parseJsonMap(response);
    final edits = data['edits'] as List<dynamic>? ?? [];
    return edits
        .map((e) => QueueEdit.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Map<String, dynamic> _parseJsonMap(http.Response response) {
    final body = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = body is Map ? body['message'] : null;
      throw ApiException(
        msg is String
            ? msg
            : (msg is List ? msg.join(', ') : 'Request failed (${response.statusCode})'),
      );
    }
    return body as Map<String, dynamic>;
  }
}

class QueueEdit {
  QueueEdit({
    required this.id,
    required this.targetNodeId,
    required this.proposedData,
    required this.citationUrl,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String targetNodeId;
  final Map<String, dynamic> proposedData;
  final String? citationUrl;
  final String status;
  final DateTime createdAt;

  factory QueueEdit.fromJson(Map<String, dynamic> json) {
    return QueueEdit(
      id: json['id'] as String,
      targetNodeId: json['target_node_id'] as String,
      proposedData: Map<String, dynamic>.from(
        json['proposed_data'] as Map? ?? {},
      ),
      citationUrl: json['citation_url'] as String?,
      status: json['status'] as String? ?? 'PENDING',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  String get summary {
    final ownership = proposedData['ownership'] as Map?;
    final newParent = proposedData['new_parent'] as Map?;
    if (ownership != null && ownership['parent_id'] != null) {
      final pct = ownership['percentage'];
      return 'Link parent ${ownership['parent_id']}${pct != null ? ' ($pct%)' : ''}';
    }
    if (newParent != null) {
      return 'New parent “${newParent['name']}”';
    }
    return 'Edit';
  }
}
