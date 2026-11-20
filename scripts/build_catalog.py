"""Build the public offline index from GitHub metadata and Orbit's published snapshot."""
import concurrent.futures
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://daiyiqq.github.io/orbit-github-nav/site/data/'
NAME = re.compile(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+')
roles = json.loads((ROOT/'catalog/roles.json').read_text(encoding='utf-8'))
notes = json.loads((ROOT/'catalog/notes.json').read_text(encoding='utf-8'))

def load_remote(filename):
    request = Request(SOURCE + filename, headers={'User-Agent':'GitHub-Atlas-Indexer'})
    with urlopen(request, timeout=25) as response:
        return json.load(response)

def github_batch(names):
    def query_part(index, slug):
        owner, repo = slug.split('/')
        return f'r{index}:repository(owner:{json.dumps(owner)},name:{json.dumps(repo)})' + (
            '{nameWithOwner description descriptionHTML stargazerCount pushedAt isArchived isPrivate isFork '
            'primaryLanguage{name} licenseInfo{spdxId}}').replace(' descriptionHTML','')
    query = 'query {' + ' '.join(query_part(i, name) for i,name in enumerate(names)) + '}'
    result = subprocess.run(['gh','api','graphql','--input','-'],input=json.dumps({'query':query}),
                            capture_output=True,encoding='utf-8')
    payload = json.loads(result.stdout)
    if not payload.get('data'):
        raise RuntimeError('GitHub GraphQL failed. Run gh auth status and try again.')
    return {names[int(k[1:])].casefold():v for k,v in payload['data'].items() if v}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    repos_future = pool.submit(load_remote,'repos.json')
    meta_future = pool.submit(load_remote,'meta.json')
    repos, meta = repos_future.result(), meta_future.result()
assert len(repos)==meta['count'] and len(repos)>1000

labels = {c['slug']:c['label'] for c in meta['categories']}
index = {}
for row in repos:
    name = row['f']
    if not NAME.fullmatch(name) or row.get('a') or not isinstance(row.get('s'),int) or row['s']<0:
        continue
    categories = row.get('cat') or []
    if isinstance(categories,str):
        categories=[categories]
    index[name.casefold()] = dict(name=name,stars=row['s'],language=row.get('l') or '',license=row.get('lic') or '',
        updated=row.get('p') or '',categories=[labels.get(c,c) for c in categories],roles=[],
        description='',note='',source='Orbit 快照')

names = dict.fromkeys(name.casefold() for values in roles.values() for name in values)
names = list(names)
direct = {}
for i in range(0,len(names),24):
    direct.update(github_batch(names[i:i+24]))
for role, candidates in roles.items():
    for slug in candidates:
        key = slug.casefold()
        item = direct.get(key)
        if not item or item['isPrivate'] or item['isArchived'] or item['isFork']:
            continue
        canonical = item['nameWithOwner']
        if not NAME.fullmatch(canonical):
            continue
        current = index.get(canonical.casefold(), {})
        index[canonical.casefold()] = dict(name=canonical,stars=item['stargazerCount'],
            language=(item.get('primaryLanguage') or {}).get('name',''),
            license=(item.get('licenseInfo') or {}).get('spdxId') or '',updated=item['pushedAt'] or '',
            categories=current.get('categories',[]),roles=sorted(set(current.get('roles',[])) | {role}),
            description=item['description'] or '',note=notes.get(key,''),source='GitHub API')
counts = {role:sum(role in v['roles'] for v in index.values()) for role in roles}
assert all(n>=8 for n in counts.values()),counts
report = dict(version='0.1.0',generated=datetime.now(timezone.utc).isoformat(),orbitUpdated=meta['updatedAt'],
              roleCounts=counts,indexed=len(index),repos=sorted(index.values(),key=lambda x:(-x['stars'],x['name'].casefold())))
data = json.dumps(report,ensure_ascii=False,separators=(',',':')).replace('\u2028','\\u2028').replace('\u2029','\\u2029')
(ROOT/'app/catalog.js').write_text('window.ATLAS_CATALOG = '+data+';\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='repos'},ensure_ascii=False,indent=2))
