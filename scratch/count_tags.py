import re

def count_tags(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex for div tags (ignoring self-closing for now as we don't have many)
    open_divs = len(re.findall(r'<div', content))
    close_divs = len(re.findall(r'</div', content))
    
    open_fragments = len(re.findall(r'<Fragment|<React.Fragment|<>', content))
    close_fragments = len(re.findall(r'</Fragment|</React.Fragment|</>', content))
    
    open_motion_divs = len(re.findall(r'<motion.div', content))
    close_motion_divs = len(re.findall(r'</motion.div', content))
    
    print(f"File: {file_path}")
    print(f"Divs: {open_divs} / {close_divs}")
    print(f"Fragments: {open_fragments} / {close_fragments}")
    print(f"Motion Divs: {open_motion_divs} / {close_motion_divs}")

count_tags('d:/Personal/visual-L-D-Database/src/features/dashboard/PerformanceCharts.tsx')
count_tags('d:/Personal/visual-L-D-Database/src/features/dashboard/ReportsAnalytics.tsx')
count_tags('d:/Personal/visual-L-D-Database/src/features/notifications/TrainingDataPage.tsx')
