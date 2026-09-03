import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_service.dart';

int _asInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? 0;
  return 0;
}

/// Staff HTTP client — `/api/v1/admin/*` (admin JWT) and edits queue (moderator+).
class AdminApiService {
  AdminApiService({required this.baseUrl});

  final String baseUrl;

  Future<AdminStats> fetchStats(String token) async {
    final data = await _adminGet(token, '/stats');
    return AdminStats.fromJson(data);
  }

  Future<({List<AdminUserRow> users, int total})> fetchUsers(
    String token, {
    String? q,
    String? role,
    bool? disabled,
    int page = 1,
  }) async {
    final data = await _adminGet(token, '/users', {
      if (q != null && q.isNotEmpty) 'q': q,
      if (role != null && role.isNotEmpty) 'role': role,
      if (disabled != null) 'disabled': disabled.toString(),
      'page': '$page',
    });
    final users = (data['users'] as List<dynamic>? ?? [])
        .map((e) => AdminUserRow.fromJson(e as Map<String, dynamic>))
        .toList();
    return (users: users, total: _asInt(data['total']));
  }

  Future<AdminUserRow> patchUser(
    String token,
    String userId,
    Map<String, dynamic> patch,
  ) async {
    final data = await _adminSend(
      token,
      '/users/$userId',
      method: 'PATCH',
      body: patch,
    );
    return AdminUserRow.fromJson(data);
  }

  Future<List<AdminUserKey>> fetchUserKeys(String token, String userId) async {
    final data = await _adminGet(token, '/users/$userId/keys');
    return (data['keys'] as List<dynamic>? ?? [])
        .map((e) => AdminUserKey.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> revokeKey(String token, String keyId) async {
    await _adminSend(token, '/keys/$keyId/revoke', method: 'POST');
  }

  Future<({List<AdminSubscriber> subscribers, int total})> fetchSubscriptions(
    String token, {
    int page = 1,
  }) async {
    final data = await _adminGet(token, '/subscriptions', {'page': '$page'});
    final items = (data['subscribers'] as List<dynamic>? ?? [])
        .map((e) => AdminSubscriber.fromJson(e as Map<String, dynamic>))
        .toList();
    return (subscribers: items, total: _asInt(data['total']));
  }

  Future<void> overrideTier(
    String token,
    String userId,
    String tier, {
    String? note,
  }) async {
    await _adminSend(
      token,
      '/users/$userId/tier',
      method: 'POST',
      body: {
        'tier': tier,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<List<AdminKeyUsage>> fetchUsage(String token, {int page = 1}) async {
    final data = await _adminGet(token, '/usage', {'page': '$page'});
    return (data['usage'] as List<dynamic>? ?? [])
        .map((e) => AdminKeyUsage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> fetchBillingHealth(String token) {
    return _adminGet(token, '/billing/health');
  }

  Future<({List<StaffEdit> edits, int total})> listEditQueue(
    String token, {
    String status = 'PENDING',
    String? kind,
    int page = 1,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/edits/queue').replace(
      queryParameters: {
        'status': status,
        'page': '$page',
        if (kind != null && kind.isNotEmpty) 'kind': kind,
      },
    );
    final data = _json(
      await http.get(uri, headers: _auth(token)),
    );
    final edits = (data['edits'] as List<dynamic>? ?? [])
        .map((e) => StaffEdit.fromJson(e as Map<String, dynamic>))
        .toList();
    return (edits: edits, total: _asInt(data['total']));
  }

  Future<void> reviewEdit(
    String token,
    String editId, {
    required String decision,
    String? reviewNote,
  }) async {
    _json(
      await http.patch(
        Uri.parse('$baseUrl/api/v1/edits/$editId/review'),
        headers: {
          ..._auth(token),
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'decision': decision,
          if (reviewNote != null && reviewNote.isNotEmpty)
            'review_note': reviewNote,
        }),
      ),
    );
  }

  Future<void> reopenEdit(String token, String editId) async {
    _json(
      await http.post(
        Uri.parse('$baseUrl/api/v1/edits/$editId/reopen'),
        headers: _auth(token),
      ),
    );
  }

  Map<String, String> _auth(String token) => {
        'Authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> _adminGet(
    String token,
    String path, [
    Map<String, String>? query,
  ]) async {
    final uri = Uri.parse('$baseUrl/api/v1/admin$path').replace(
      queryParameters: query,
    );
    return _json(await http.get(uri, headers: _auth(token)));
  }

  Future<Map<String, dynamic>> _adminSend(
    String token,
    String path, {
    required String method,
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/admin$path');
    final headers = {
      ..._auth(token),
      'Content-Type': 'application/json',
    };
    late http.Response response;
    if (method == 'PATCH') {
      response = await http.patch(
        uri,
        headers: headers,
        body: jsonEncode(body ?? {}),
      );
    } else {
      response = await http.post(
        uri,
        headers: headers,
        body: jsonEncode(body ?? {}),
      );
    }
    return _json(response);
  }

  Map<String, dynamic> _json(http.Response response) {
    final decoded = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = decoded is Map ? decoded['message'] : null;
      throw ApiException(
        msg is String
            ? msg
            : (msg is List
                ? msg.join(', ')
                : 'Request failed (${response.statusCode})'),
      );
    }
    if (decoded is Map<String, dynamic>) return decoded;
    return Map<String, dynamic>.from(decoded as Map);
  }
}

class AdminStats {
  AdminStats({
    required this.totalUsers,
    required this.verifiedUsers,
    required this.newUsers24h,
    required this.newUsers7d,
    required this.paidSubscribers,
    required this.pendingEdits,
    required this.pendingIngestMatches,
    required this.totalApiKeys,
    required this.requestsToday,
    required this.auditActions7d,
  });

  final int totalUsers;
  final int verifiedUsers;
  final int newUsers24h;
  final int newUsers7d;
  final int paidSubscribers;
  final int pendingEdits;
  final int pendingIngestMatches;
  final int totalApiKeys;
  final int requestsToday;
  final int auditActions7d;

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    return AdminStats(
      totalUsers: _asInt(json['total_users']),
      verifiedUsers: _asInt(json['verified_users']),
      newUsers24h: _asInt(json['new_users_24h']),
      newUsers7d: _asInt(json['new_users_7d']),
      paidSubscribers: _asInt(json['paid_subscribers']),
      pendingEdits: _asInt(json['pending_edits']),
      pendingIngestMatches: _asInt(json['pending_ingest_matches']),
      totalApiKeys: _asInt(json['total_api_keys']),
      requestsToday: _asInt(json['requests_today']),
      auditActions7d: _asInt(json['audit_actions_7d']),
    );
  }
}

class AdminUserRow {
  AdminUserRow({
    required this.id,
    required this.email,
    required this.role,
    required this.trustScore,
    required this.emailVerifiedAt,
    required this.subscriptionTier,
    required this.disabledAt,
    required this.apiKeyCount,
    required this.createdAt,
  });

  final String id;
  final String email;
  final String role;
  final int trustScore;
  final String? emailVerifiedAt;
  final String subscriptionTier;
  final String? disabledAt;
  final int apiKeyCount;
  final String createdAt;

  factory AdminUserRow.fromJson(Map<String, dynamic> json) {
    return AdminUserRow(
      id: json['id'] as String,
      email: json['email'] as String,
      role: json['role'] as String? ?? 'user',
      trustScore: _asInt(json['trust_score']),
      emailVerifiedAt: json['email_verified_at'] as String?,
      subscriptionTier: json['subscription_tier'] as String? ?? 'free',
      disabledAt: json['disabled_at'] as String?,
      apiKeyCount: _asInt(json['api_key_count']),
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}

class AdminUserKey {
  AdminUserKey({
    required this.id,
    required this.name,
    required this.keyPrefix,
    required this.tier,
    required this.usageToday,
    required this.revokedAt,
  });

  final String id;
  final String name;
  final String keyPrefix;
  final String tier;
  final int usageToday;
  final String? revokedAt;

  factory AdminUserKey.fromJson(Map<String, dynamic> json) {
    return AdminUserKey(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      keyPrefix: json['key_prefix'] as String? ?? '',
      tier: json['tier'] as String? ?? 'free',
      usageToday: _asInt(json['usage_today']),
      revokedAt: json['revoked_at'] as String?,
    );
  }
}

class AdminSubscriber {
  AdminSubscriber({
    required this.id,
    required this.email,
    required this.subscriptionTier,
    required this.subscriptionStatus,
    required this.stripeCustomerId,
    required this.periodEnd,
  });

  final String id;
  final String email;
  final String subscriptionTier;
  final String? subscriptionStatus;
  final String? stripeCustomerId;
  final String? periodEnd;

  factory AdminSubscriber.fromJson(Map<String, dynamic> json) {
    return AdminSubscriber(
      id: json['id'] as String,
      email: json['email'] as String,
      subscriptionTier: json['subscription_tier'] as String? ?? 'free',
      subscriptionStatus: json['subscription_status'] as String?,
      stripeCustomerId: json['stripe_customer_id'] as String?,
      periodEnd: json['subscription_current_period_end'] as String?,
    );
  }
}

class AdminKeyUsage {
  AdminKeyUsage({
    required this.id,
    required this.keyPrefix,
    required this.name,
    required this.email,
    required this.tier,
    required this.requestsToday,
    required this.imageBlocksToday,
    required this.rateLimitHitsToday,
  });

  final String id;
  final String keyPrefix;
  final String name;
  final String email;
  final String tier;
  final int requestsToday;
  final int imageBlocksToday;
  final int rateLimitHitsToday;

  factory AdminKeyUsage.fromJson(Map<String, dynamic> json) {
    return AdminKeyUsage(
      id: json['id'] as String,
      keyPrefix: json['key_prefix'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      tier: json['tier'] as String? ?? 'free',
      requestsToday: _asInt(json['requests_today']),
      imageBlocksToday: _asInt(json['image_blocks_today']),
      rateLimitHitsToday: _asInt(json['rate_limit_hits_today']),
    );
  }
}

class StaffEdit {
  StaffEdit({
    required this.id,
    required this.targetNodeId,
    required this.status,
    required this.submitterEmail,
    required this.editKind,
    required this.canReopen,
    required this.summary,
  });

  final String id;
  final String targetNodeId;
  final String status;
  final String submitterEmail;
  final String editKind;
  final bool canReopen;
  final String summary;

  factory StaffEdit.fromJson(Map<String, dynamic> json) {
    final proposed = Map<String, dynamic>.from(
      json['proposed_data'] as Map? ?? {},
    );
    return StaffEdit(
      id: json['id'] as String,
      targetNodeId: json['target_node_id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      submitterEmail: json['submitter_email'] as String? ?? '',
      editKind: json['edit_kind'] as String? ?? 'other',
      canReopen: json['can_reopen'] == true,
      summary: QueueEdit(
        id: json['id'] as String,
        targetNodeId: json['target_node_id'] as String? ?? '',
        proposedData: proposed,
        citationUrl: json['citation_url'] as String?,
        status: json['status'] as String? ?? 'PENDING',
        createdAt: DateTime.now(),
      ).summary,
    );
  }
}
