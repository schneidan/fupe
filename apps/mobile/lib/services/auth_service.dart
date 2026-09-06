import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required this.trustScore,
    required this.role,
    required this.emailVerified,
  });

  final String id;
  final String email;
  final int trustScore;
  final String role;
  final bool emailVerified;

  bool get isAdmin => role == 'admin';
  bool get isModerator => role == 'moderator' || role == 'admin';
  /// Admin hub (full) or queue-only for moderators.
  bool get canSeeAdminEntry => isModerator;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String,
      trustScore: json['trust_score'] as int? ?? 0,
      role: json['role'] as String? ?? 'user',
      emailVerified: json['email_verified'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'trust_score': trustScore,
        'role': role,
        'email_verified': emailVerified,
      };
}

class AuthService extends ChangeNotifier {
  AuthService({required this.baseUrl});

  final String baseUrl;
  static const _tokenKey = 'fupe_token';
  static const _userKey = 'fupe_user';

  String? _token;
  AuthUser? _user;
  bool _ready = false;

  String? get token => _token;
  AuthUser? get user => _user;
  bool get isSignedIn => _token != null && _user != null;
  bool get ready => _ready;
  bool get isAdmin => user?.isAdmin ?? false;
  bool get canSeeAdminEntry => user?.canSeeAdminEntry ?? false;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final raw = prefs.getString(_userKey);
    if (raw != null) {
      try {
        _user = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {
        _user = null;
        _token = null;
      }
    }
    _ready = true;
    notifyListeners();
    if (_token != null) {
      await refreshMe();
    }
  }

  Future<void> register(String email, String password) async {
    await _authPost('/api/v1/auth/register', email, password);
  }

  Future<void> login(String email, String password) async {
    await _authPost('/api/v1/auth/login', email, password);
  }

  Future<void> signOut() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
    _token = null;
    _user = null;
    notifyListeners();
  }

  Future<void> refreshMe() async {
    if (_token == null) return;
    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/auth/me'),
      headers: {'Authorization': 'Bearer $_token'},
    );
    if (response.statusCode != 200) return;
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    _user = AuthUser.fromJson(body);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(_user!.toJson()));
    notifyListeners();
  }

  Future<String> resendVerification() async {
    if (_token == null) throw Exception('Not signed in');
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/auth/resend-verification'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_token',
      },
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = body['message'];
      throw Exception(msg is String ? msg : 'Resend failed');
    }
    return body['message'] as String? ?? 'Sent';
  }

  Future<String> forgotPassword(String email) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/auth/forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim()}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = body['message'];
      throw Exception(msg is String ? msg : 'Request failed');
    }
    return body['message'] as String? ??
        'If an account exists for that email, we sent a password reset link.';
  }

  Future<String> resetPassword({
    required String token,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/auth/reset-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'token': token.trim(), 'password': password}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = body['message'];
      throw Exception(
        msg is String ? msg : (msg is List ? msg.join(', ') : 'Reset failed'),
      );
    }
    return body['message'] as String? ?? 'Password updated.';
  }

  Future<Map<String, dynamic>> exportMyData() async {
    if (_token == null) throw Exception('Not signed in');
    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/auth/export'),
      headers: {'Authorization': 'Bearer $_token'},
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      final msg = body['message'];
      throw Exception(msg is String ? msg : 'Export failed');
    }
    return body;
  }

  Future<void> deleteAccount() async {
    if (_token == null) throw Exception('Not signed in');
    final response = await http.delete(
      Uri.parse('$baseUrl/api/v1/auth/me'),
      headers: {'Authorization': 'Bearer $_token'},
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final msg = body['message'];
      throw Exception(msg is String ? msg : 'Delete failed');
    }
    await signOut();
  }

  Future<void> _authPost(String path, String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 && response.statusCode != 201) {
      final msg = body['message'];
      throw Exception(
        msg is String ? msg : (msg is List ? msg.join(', ') : 'Auth failed'),
      );
    }
    _token = body['token'] as String;
    _user = AuthUser.fromJson(body['user'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, _token!);
    await prefs.setString(_userKey, jsonEncode(_user!.toJson()));
    notifyListeners();
  }
}
