import re

path = r'c:\Users\trish\Desktop\Blaze_New\Frontend\src\modules\seller\pages\Onboarding.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace input classNames
content = re.sub(
    r'className=\\?\"rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-900 focus:bg-white transition-colors\\?\"',
    'className={ONBOARDING_INPUT}',
    content
)

# Replace conditional input classNames (email, etc)
content = re.sub(
    r'className=\{\`rounded-xl border bg-slate-50 px-4 py-3 text-sm font-medium (?:uppercase )?outline-none focus:border-slate-900 focus:bg-white transition-colors \$\{([^}]+)\}\`\}',
    r'className={`\${ONBOARDING_INPUT} \${\1}`}',
    content
)

# Replace disabled inputs
content = re.sub(
    r'className=\\?\"rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500 outline-none\\?\"',
    'className={`${ONBOARDING_INPUT} bg-slate-100 text-slate-500`}',
    content
)

# Replace SelectTrigger classNames
content = re.sub(
    r'className=\\?\"w-full rounded-xl border border-slate-200 bg-slate-50 px-4 h-\[46px\] text-sm font-medium outline-none focus:border-slate-900 focus:bg-white transition-colors\\?\"',
    'className={ONBOARDING_INPUT}',
    content
)

# Remove Service zone block
zone_pattern = re.compile(r'<div className=\"flex flex-col gap-1\.5\">\s*<label className=\"text-\[10px\] font-bold text-slate-500 uppercase tracking-wider\">Service zone <span className=\"text-red-500\">\*<\/span><\/label>\s*<Select\s*value=\{`\$\{form\.zoneSource\}:\$\{form\.zoneId\}`\}.*?<\/Select>\s*<\/div>', re.DOTALL)
content = zone_pattern.sub('', content)

# Remove selected zone block
selected_zone_pattern = re.compile(r'\{selectedZone \? \(\s*<div className=\"rounded-xl border border-red-200 bg-red-50 px-4 py-3 md:col-span-2\">\s*<p className=\"text-\[10px\] font-bold uppercase tracking-wider text-red-600\">Selected zone<\/p>\s*<p className=\"mt-1 text-sm font-semibold text-red-900\">\s*\{selectedZone\.label\}\s*<\/p>\s*<\/div>\s*\) : null\}', re.DOTALL)
content = selected_zone_pattern.sub('', content)

# Remove Store location block completely
location_pattern = re.compile(r'<div className=\"rounded-2xl border border-slate-100 bg-white p-5 md:col-span-2 shadow-\[0_2px_12px_rgba\(15,23,42,0\.03\)\]\">\s*<div className=\"mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between\">\s*<div>\s*<p className=\"text-sm font-bold text-slate-900\">Store location<\/p>.*?<\/div>\s*<\/div>\s*<\/div>', re.DOTALL)
content = location_pattern.sub('', content)

# Remove MapPicker component from the end of the file
map_picker_pattern = re.compile(r'\{isMapOpen && \(\s*<MapPicker.*?/>\s*\)\}', re.DOTALL)
content = map_picker_pattern.sub('', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
