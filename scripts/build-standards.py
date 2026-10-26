"""중학교 성취기준 DB(2015·2022 개정, 전 교과)를 src/data/standards-middle.json으로 만든다.

원자료 (둘 다 MIT, 성취기준 문장은 고시 원문이라 저작권법 제7조 제2호 비보호):
  - 2022: npm korean-secondary-learning-map-mcp@0.3.0 (DECK6) data/kr/curriculum-standards.json + standard-texts.json
  - 2015: npm @koreaedu/curriculum-db@2.2.1 data/curriculum-db.db (achievement_standard, unit)
사용: python3 scripts/build-standards.py <deck6 package dir> <koreaedu package dir>
"""
import json, re, sqlite3, sys, collections

deck6, koreaedu = sys.argv[1], sys.argv[2]
SUBJECT_BY_TOKEN = {
    '국': '국어', '수': '수학', '영': '영어', '과': '과학', '사(지리)': '사회', '사(일사)': '사회', '역': '역사', '도': '도덕',
    '기가': '기술·가정', '정': '정보', '체': '체육', '음': '음악', '미': '미술', '한': '한문', '보': '보건', '환': '환경',
    '진': '진로와 직업', '진로': '진로와 직업', '생일': '생활 일본어', '생중': '생활 중국어', '생독': '생활 독일어', '생프': '생활 프랑스어',
    '생스': '생활 스페인어', '생러': '생활 러시아어', '생아': '생활 아랍어', '생베': '생활 베트남어',
}
out = collections.defaultdict(lambda: {'2015': [], '2022': []})

cs = json.load(open(f'{deck6}/data/kr/curriculum-standards.json'))['curricula']
texts = {t['key']: t['text'] for t in json.load(open(f'{deck6}/data/kr/standard-texts.json'))['texts']}
for cur in cs:
    if cur['schoolLevel'] != 'middle':
        continue
    for s in cur['standards']:
        m = re.match(r'\[9(.+?)(\d\d)-(\d\d)\]$', s['code'])
        tok = m.group(1)
        subj = SUBJECT_BY_TOKEN[tok]
        text = texts.get(s['key'], '')
        page = (s.get('sourceLocator') or {}).get('pdfPage')
        out[subj]['2022'].append([s['code'], text, s.get('domainKorean', ''), page])

db = sqlite3.connect(f'{koreaedu}/data/curriculum-db.db')
for sid, desc, unit in db.execute("select a.id, a.description, u.name from achievement_standard a left join unit u on a.unit_id=u.id where a.id like '2015-9%'"):
    m = re.match(r'2015-9(.+?)-?(\d\d)-(\d\d)$', sid)
    tok, a, b = m.group(1), m.group(2), m.group(3)
    subj = SUBJECT_BY_TOKEN[tok]
    out[subj]['2015'].append([f'[9{tok}{a}-{b}]', desc.strip(), (unit or '').split('-')[0], None])

data = {
    'note': '중학교 성취기준 (2015 개정 고시 제2015-74호 별책, 2022 개정 고시 제2022-33호 별책). 문장은 고시 원문(저작권법 제7조 제2호).',
    'sources': {
        '2022': 'DECK6/korean-secondary-learning-map (MIT) via npm korean-secondary-learning-map-mcp@0.3.0',
        '2015': 'Jobshopper/curriculum-db (MIT) via npm @koreaedu/curriculum-db@2.2.1',
    },
    'subjects': {k: {c: sorted(v[c]) for c in ('2015', '2022')} for k, v in sorted(out.items())},
}
json.dump(data, open('src/data/standards-middle.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for k, v in sorted(out.items()):
    print(k, len(v['2015']), len(v['2022']))
