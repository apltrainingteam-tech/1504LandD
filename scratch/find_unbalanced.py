def find_unbalanced(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        # Very simple tag finding
        import re
        tags = re.findall(r'<(div|/div)', line)
        for tag in tags:
            if tag == 'div':
                stack.append(i + 1)
            else:
                if stack:
                    stack.pop()
                else:
                    print(f"Excess closing div at line {i+1}")
    
    for line_num in stack:
        print(f"Unclosed div opened at line {line_num}")

print("--- PerformanceCharts.tsx ---")
find_unbalanced('d:/Personal/visual-L-D-Database/src/features/dashboard/PerformanceCharts.tsx')
print("\n--- ReportsAnalytics.tsx ---")
find_unbalanced('d:/Personal/visual-L-D-Database/src/features/dashboard/ReportsAnalytics.tsx')
print("\n--- TrainingDataPage.tsx ---")
find_unbalanced('d:/Personal/visual-L-D-Database/src/features/notifications/TrainingDataPage.tsx')
