import re

path = 'c:/Users/trish/Desktop/Blaze_New/Frontend/src/shared/layout/Sidebar.jsx'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any occurrence of `isSellerPanel ? "something" : isLightSidebar` with `isLightSidebar`
text = re.sub(r'isSellerPanel\s*\?\s*"[^"]*"\s*:\s*isLightSidebar', 'isLightSidebar', text)

# Replace occurrence in parens `(isSellerPanel ? "something" : isLightSidebar`
text = re.sub(r'\(isSellerPanel\s*\?\s*"[^"]*"\s*:\s*isLightSidebar', '(isLightSidebar', text)

# Handle the backgroundColor style object ternary
text = re.sub(r'isSellerPanel\s*\?\s*\{[^\}]*\}\s*:\s*isLightSidebar', 'isLightSidebar', text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
