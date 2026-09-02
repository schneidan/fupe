import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required this.trustScore,
  });

  final String id;
  final String email;
  final int trustScore;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String,
      trustScore: json['trust_score'] as int? ?? 0,
    );
  }
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
    await prefs.setString(_userKey, jsonEncode(body['user']));
    notifyListeners();
  }
}
