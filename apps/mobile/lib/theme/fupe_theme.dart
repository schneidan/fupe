import 'package:flutter/material.dart';

class FupeColors {
  static const bg = Color(0xFF141414);
  static const surface = Color(0xFF1C1C1C);
  static const elevated = Color(0xFF262626);
  static const border = Color(0xFF3A3A3A);
  static const muted = Color(0xFFA0A0A0);
  static const text = Color(0xFFFFFFFF);
  static const accentDim = Color(0xFF737373);
  static const verdictYes = Color(0xFFEF4444);
  static const verdictNo = Color(0xFF22C55E);
}

ThemeData fupeTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: FupeColors.bg,
    colorScheme: const ColorScheme.dark(
      surface: FupeColors.surface,
      onSurface: FupeColors.text,
      primary: FupeColors.text,
      onPrimary: FupeColors.bg,
      outline: FupeColors.border,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: FupeColors.bg,
      foregroundColor: FupeColors.text,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: FupeColors.elevated,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: FupeColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: FupeColors.border),
      ),
      focusedBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: FupeColors.muted, width: 2),
      ),
      hintStyle: const TextStyle(color: FupeColors.accentDim),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return FupeColors.text;
        return FupeColors.elevated;
      }),
      checkColor: WidgetStateProperty.all(FupeColors.bg),
    ),
    dividerColor: FupeColors.border,
  );
}
