import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if 'StyleSheet.create' not in content:
        return

    # Check if already processed
    if 'getStyles = ()' in content or 'getStyles =' in content:
        return

    # 1. Transform `const styles = StyleSheet.create({`
    content = re.sub(
        r'const\s+styles\s*=\s*StyleSheet\.create\(\{',
        r'const getStyles = () => StyleSheet.create({',
        content
    )

    # 2. Inject `const styles = getStyles();` into component body
    # Regex 1: export default function XYZ(props) {
    content = re.sub(
        r'(export\s+default\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)',
        r'\g<1>\n    const styles = getStyles();',
        content
    )

    # Regex 2: export function XYZ(props) {
    content = re.sub(
        r'(^|\n)(export\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)',
        r'\g<1>\g<2>\n    const styles = getStyles();',
        content
    )

    # Regex 3: const XYZ = (props) => {
    content = re.sub(
        r'(^|\n)(const\s+[A-Za-z0-9_]+\s*=\s*\([^)]*\)\s*=>\s*\{)',
        r'\g<1>\g<2>\n    const styles = getStyles();',
        content
    )
    
    # Regex 4: function XYZ(props) {
    content = re.sub(
        r'(^|\n)(function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)',
        r'\g<1>\g<2>\n    const styles = getStyles();',
        content
    )

    with open(filepath, 'w') as f:
        f.write(content)

def main():
    src_dir = '/Users/gurjobansingh/Desktop/attendance/attendance-app/src'
    count = 0
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.js') or file.endswith('.jsx'):
                process_file(os.path.join(root, file))
                count += 1
    print(f"Processed {count} files.")

if __name__ == '__main__':
    main()
