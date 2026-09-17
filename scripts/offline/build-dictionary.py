#!/usr/bin/env python3
"""Build the shipped read-only SQLite dictionary from licensed source files."""
import argparse
import csv
import gzip
import hashlib
import json
import pathlib
import sqlite3
import tarfile
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[2]
LICENSE = {'name': 'CC BY-SA 4.0', 'url': 'https://creativecommons.org/licenses/by-sa/4.0/'}
POS = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb',
       'adj': 'adjective', 'adv': 'adverb', 'prep': 'preposition', 'pron': 'pronoun',
       'det': 'determiner', 'intj': 'interjection', 'conj': 'conjunction', 'num': 'numeral'}

def normalize(text):
    return ' '.join(unicodedata.normalize('NFKC', text).replace('’', "'").split()).lower()

def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def build(simple_path, wordnet_path, output):
    output.mkdir(parents=True, exist_ok=True)
    target = output / 'dictionary.sqlite'
    target.unlink(missing_ok=True)
    db = sqlite3.connect(target)
    db.executescript('''
      CREATE TABLE entries (key TEXT PRIMARY KEY, payload TEXT NOT NULL) WITHOUT ROWID;
      CREATE TABLE aliases (key TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(key,target)) WITHOUT ROWID;
      CREATE TABLE translations (key TEXT NOT NULL, language TEXT NOT NULL, rank INTEGER NOT NULL,
        text TEXT NOT NULL, sense TEXT, PRIMARY KEY(key,language,rank)) WITHOUT ROWID;
      PRAGMA user_version=1;
    ''')
    entries = {}
    aliases = set()
    def add(word, meaning, source, license_info, priority=False, phonetic=None):
        key = normalize(word)
        if not key or len(key) > 160:
            return
        entry = entries.setdefault(key, {'word': word, 'meanings': [], 'sourceUrls': [], 'attributions': []})
        if meaning not in entry['meanings']:
            entry['meanings'].insert(0, meaning) if priority else entry['meanings'].append(meaning)
        if source not in entry['sourceUrls']:
            entry['sourceUrls'].insert(0, source) if priority else entry['sourceUrls'].append(source)
            attribution = {'label': 'WordNet' if 'princeton' in source else 'Wiktionary via Kaikki', 'sourceUrl': source, 'license': license_info}
            entry['attributions'].insert(0, attribution) if priority else entry['attributions'].append(attribution)
        if phonetic:
            entry['phonetic'] = phonetic
        entry['license'] = entry['attributions'][0]['license']

    # WordNet index order is frequency-ranked; keep the first three senses per POS.
    with tarfile.open(wordnet_path, 'r:gz') as archive:
        files = {pathlib.PurePosixPath(m.name).name: m for m in archive.getmembers() if m.isfile()}
        read = lambda name: archive.extractfile(files[name]).read().decode('utf-8').splitlines()
        for suffix in ['noun', 'verb', 'adj', 'adv']:
            synsets = {}
            for line in read('data.' + suffix):
                if not line or not line[0].isdigit():
                    continue
                meta, gloss = line.split('|', 1)
                fields = meta.split()
                count = int(fields[3], 16)
                words = [fields[4 + i * 2].replace('_', ' ').removesuffix('(a)').removesuffix('(p)').removesuffix('(ip)') for i in range(count)]
                definition = gloss.strip().split('; "')[0].strip()
                examples = [part.split('"')[0] for part in gloss.split('"')[1::2]]
                synsets[fields[0]] = {'definition': definition, 'synonyms': words, **({'example': examples[0]} if examples else {})}
            for line in read('index.' + suffix):
                if not line or line.startswith(' '):
                    continue
                fields = line.split()
                pointer_count = int(fields[3])
                offsets = fields[6 + pointer_count:]
                word = fields[0].replace('_', ' ')
                definitions = []
                for offset in offsets[:3]:
                    if offset in synsets:
                        definition = dict(synsets[offset])
                        definition['synonyms'] = [s for s in definition['synonyms'] if normalize(s) != normalize(word)]
                        definitions.append(definition)
                if definitions:
                    add(word, {'partOfSpeech': POS[fields[1]], 'definitions': definitions},
                        'https://wordnet.princeton.edu/', {'name': 'WordNet 3.1 License', 'url': 'https://wordnet.princeton.edu/license-and-commercial-use'})
            for line in read(suffix + '.exc'):
                fields = line.split()
                aliases.update((normalize(fields[0].replace('_', ' ')), normalize(w.replace('_', ' '))) for w in fields[1:])
        import re
        license_lines = [re.sub(r'^\s*\d+\s?', '', line).rstrip() for line in read('data.noun') if line.startswith('  ')]
        (output / 'WORDNET-LICENSE.txt').write_text('\n'.join(license_lines) + '\n')

    # Simple English supplies everyday vocabulary, function words and learner-friendly senses.
    with gzip.open(simple_path, 'rt', encoding='utf-8') as stream:
        for line in stream:
            row = json.loads(line)
            if row.get('lang_code') != 'en' or not row.get('word'):
                continue
            canonical = next((form['form'] for form in row.get('forms', []) if form.get('form') and ('canonical' in form.get('tags', []) or 'Singular' in form.get('raw_tags', []))), row['word'])
            if normalize(canonical) != normalize(row['word']):
                aliases.add((normalize(row['word']), normalize(canonical)))
            definitions = []
            for sense in row.get('senses', []):
                if set(sense.get('tags', [])) & {'obsolete', 'archaic'}:
                    continue
                for ref in sense.get('form_of', []):
                    if ref.get('word'):
                        aliases.add((normalize(row['word']), normalize(ref['word'])))
                glosses = sense.get('glosses', [])
                if glosses and not sense.get('form_of'):
                    examples = sense.get('examples', [])
                    definition = {'definition': glosses[-1]}
                    if examples and examples[0].get('text'):
                        definition['example'] = examples[0]['text']
                    definitions.append(definition)
            for form in row.get('forms', []):
                if form.get('form') and form['form'] != '-' and ',' not in form['form']:
                    aliases.add((normalize(form['form']), normalize(canonical)))
            if definitions and normalize(canonical) == normalize(row['word']):
                ipa = next((s['ipa'] for s in row.get('sounds', []) if s.get('ipa')), None)
                from urllib.parse import quote
                add(row['word'], {'partOfSpeech': POS.get(row.get('pos'), row.get('pos', 'word')), 'definitions': definitions[:3]},
                    'https://simple.wiktionary.org/wiki/' + quote(row['word'].replace(' ', '_'), safe=''), LICENSE, True, ipa)

    with open(ROOT / 'data/phrases/phrase-entries.csv') as f:
        for row in csv.DictReader(f):
            definition = {'definition': row['definition'], 'synonyms': json.loads(row['synonyms']), 'antonyms': json.loads(row['antonyms']), 'usageLabels': json.loads(row['usage_labels'])}
            if row['example']:
                definition['example'] = row['example']
            add(row['phrase'], {'partOfSpeech': row['part_of_speech'], 'definitions': [definition]}, row['source_url'], LICENSE)
    db.executemany('INSERT INTO entries VALUES (?,?)', [(key, json.dumps(value, ensure_ascii=False, separators=(',', ':'))) for key, value in sorted(entries.items())])
    db.executemany('INSERT INTO aliases VALUES (?,?)', sorted((key, target) for key, target in aliases if target in entries and key != target and len(key) <= 160))
    with open(ROOT / 'data/translations/word-translations.csv') as f:
        for row in csv.DictReader(f):
            db.execute('INSERT INTO translations VALUES (?,?,?,?,?)', (row['normalized_word'], row['language_code'], int(row['rank']), row['translation'], row['sense_label'] or None))
    counts = {table: db.execute('SELECT count(*) FROM ' + table).fetchone()[0] for table in ['entries', 'aliases', 'translations']}
    db.commit()
    db.execute('VACUUM')
    db.close()
    with open(target, 'rb') as source, open(output / 'dictionary.sqlite.gz', 'wb') as dest:
        with gzip.GzipFile(filename='', mode='wb', fileobj=dest, mtime=0, compresslevel=9) as zipped:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                zipped.write(chunk)
    manifest = {'version': 1, **counts, 'sqliteBytes': target.stat().st_size, 'sqliteSha256': digest(target),
                'compressedBytes': (output / 'dictionary.sqlite.gz').stat().st_size,
                'compressedSha256': digest(output / 'dictionary.sqlite.gz'),
                'sources': [{'url': 'https://kaikki.org/dictionary/downloads/simple/simple-extract.jsonl.gz', 'sha256': digest(simple_path)},
                            {'url': 'https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz', 'sha256': digest(wordnet_path)},
                            {'path': 'data/phrases/phrase-entries.csv', 'sha256': digest(ROOT / 'data/phrases/phrase-entries.csv')},
                            {'path': 'data/translations/word-translations.csv', 'sha256': digest(ROOT / 'data/translations/word-translations.csv')}]}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    target.unlink()
    print(json.dumps(manifest, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--simple', type=pathlib.Path, required=True)
    parser.add_argument('--wordnet', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'data/offline')
    args = parser.parse_args()
    build(args.simple, args.wordnet, args.output)
