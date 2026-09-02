import 'package:flutter/material.dart';

import 'ask_screen.dart';
import 'browse_screen.dart';
import 'contribute_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _index = 0;
  bool _browseMounted = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          const AskScreen(),
          _browseMounted
              ? const BrowseScreen()
              : const SizedBox.shrink(),
          const ContributeScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          setState(() {
            if (i == 1) _browseMounted = true;
            _index = i;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.search),
            label: 'Ask',
          ),
          NavigationDestination(
            icon: Icon(Icons.list),
            label: 'Browse',
          ),
          NavigationDestination(
            icon: Icon(Icons.edit_note),
            label: 'Contribute',
          ),
        ],
      ),
    );
  }
}
